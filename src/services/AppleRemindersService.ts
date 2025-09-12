/**
 * Apple Reminders Service
 * Handles integration with Apple Reminders on macOS using node-osascript
 */

import {
  ExternalTaskData,
  TaskImportConfig,
  ImportResult,
} from "../types/integrations";
import { TaskSyncSettings } from "../components/ui/settings/types";
import {
  AppleReminder,
  AppleRemindersList,
  AppleRemindersResult,
  AppleRemindersError,
  AppleRemindersPermission,
  AppleRemindersFilter,
} from "../types/apple-reminders";
import { TaskImportManager } from "./TaskImportManager";
import { taskStore } from "../stores/taskStore";
import { ExternalDataCache } from "./ExternalDataCache";
import * as osascript from "node-osascript";

export class AppleRemindersService {
  private settings: TaskSyncSettings;
  private taskImportManager?: TaskImportManager;
  private cache?: ExternalDataCache;
  private readonly CACHE_DURATION = 60 * 60 * 1000; // 1 hour cache duration
  private isInitialized = false;

  constructor(settings: TaskSyncSettings) {
    this.settings = settings;
  }

  /**
   * Set import dependencies (called from main plugin)
   */
  setImportDependencies(taskImportManager: TaskImportManager): void {
    this.taskImportManager = taskImportManager;
  }

  /**
   * Initialize the service with cache
   */
  async initialize(cache: ExternalDataCache): Promise<void> {
    this.cache = cache;
    this.isInitialized = true;
  }

  /**
   * Update settings reference (legacy method)
   * This will be replaced by the event system
   */
  updateSettings(newSettings: TaskSyncSettings): void {
    this.updateSettingsInternal(newSettings.appleRemindersIntegration);
  }

  /**
   * Internal method to update Apple Reminders settings without cache clearing
   * Used by the event system
   */
  updateSettingsInternal(newAppleSettings: any): void {
    // Update the full settings object
    this.settings = {
      ...this.settings,
      appleRemindersIntegration: newAppleSettings,
    };
  }

  /**
   * Clear all caches
   */
  async clearCache(): Promise<void> {
    if (this.cache) {
      // Clear reminder lists cache
      await this.cache.delete("apple-reminders-lists");

      // Clear all possible reminder cache keys
      // Generate all possible combinations of cache keys
      const completedOptions = [true, false];
      const allDayOptions = [true, false];

      for (const includeCompleted of completedOptions) {
        for (const excludeAllDay of allDayOptions) {
          const key = this.generateRemindersCacheKey({
            includeCompleted,
            excludeAllDay,
          });
          await this.cache.delete(key);
        }
      }
    }
  }

  /**
   * Generate cache key for reminders based on filter
   * Note: listNames are excluded from cache key since list filtering is now done in memory
   */
  private generateRemindersCacheKey(filter?: AppleRemindersFilter): string {
    const parts = [
      "apple-reminders",
      filter?.includeCompleted ? "completed" : "incomplete",
      filter?.excludeAllDay ? "no-allday" : "with-allday",
    ];
    return parts.join("|");
  }

  /**
   * Check if Apple Reminders integration is enabled and available
   */
  isEnabled(): boolean {
    return (
      this.settings.appleRemindersIntegration.enabled &&
      this.isPlatformSupported()
    );
  }

  /**
   * Check if the current platform supports Apple Reminders
   */
  isPlatformSupported(): boolean {
    return process.platform === "darwin";
  }

  /**
   * Execute AppleScript with timeout and error handling
   */
  private async executeAppleScript(
    script: string,
    variables: Record<string, any> = {}
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const childProcess = osascript.execute(
        script,
        variables,
        (err: any, res: any) => {
          if (err) {
            reject(err);
          } else {
            resolve(res);
          }
        }
      );

      // Add timeout to prevent hanging
      setTimeout(() => {
        childProcess.stdin?.pause();
        childProcess.kill();
        reject(new Error("AppleScript execution timed out"));
      }, 30000);
    });
  }

  /**
   * Check and request permissions for accessing Apple Reminders
   */
  async checkPermissions(): Promise<
    AppleRemindersResult<AppleRemindersPermission>
  > {
    if (!this.isPlatformSupported()) {
      throw new Error("Apple Reminders is only available on macOS");
    }

    try {
      // Try to access reminders to test permissions
      await this.executeAppleScript(
        'tell application "Reminders" to return name of lists'
      );

      return {
        success: true,
        data: AppleRemindersPermission.AUTHORIZED,
      };
    } catch (error: any) {
      throw new Error(`Permission denied: ${error.message || "Unknown error"}`);
    }
  }

  /**
   * Fetch all available reminder lists with persistent caching
   */
  async fetchReminderLists(): Promise<
    AppleRemindersResult<AppleRemindersList[]>
  > {
    const cacheKey = "apple-reminders-lists";

    // Check cache first
    if (this.cache) {
      const cachedLists = await this.cache.get<AppleRemindersList[]>(cacheKey);
      if (cachedLists) {
        return {
          success: true,
          data: cachedLists,
        };
      }
    }

    const permissionCheck = await this.checkPermissions();
    if (!permissionCheck.success) {
      return {
        success: false,
        error: permissionCheck.error,
      };
    }

    try {
      const lists = await this.executeAppleScript(
        'tell application "Reminders" to return properties of lists'
      );

      const reminderLists: AppleRemindersList[] = (
        Array.isArray(lists) ? lists : []
      ).map((list: any) => ({
        id: list.id || list.name, // Use name as fallback ID
        name: list.name,
        color: list.color || "#007AFF", // Default blue color
        reminderCount: 0, // We'll get this separately if needed
      }));

      // Cache the result
      if (this.cache) {
        await this.cache.set(cacheKey, reminderLists, {
          duration: this.CACHE_DURATION,
        });
      }

      return {
        success: true,
        data: reminderLists,
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          type: AppleRemindersError.UNKNOWN,
          message: `Failed to fetch reminder lists: ${error.message}`,
          originalError: error,
        },
      };
    }
  }

  /**
   * Fetch reminders from specified lists or all lists with persistent caching
   */
  async fetchReminders(
    filter?: AppleRemindersFilter
  ): Promise<AppleRemindersResult<AppleReminder[]>> {
    const cacheKey = this.generateRemindersCacheKey(filter);

    // Check cache first
    if (this.cache) {
      const cachedReminders = await this.cache.get<AppleReminder[]>(cacheKey);
      if (cachedReminders) {
        console.log(
          `🍎 Cache hit for key: ${cacheKey}, returning ${cachedReminders.length} reminders`
        );
        // Deserialize date fields that were converted to strings during JSON serialization
        const deserializedReminders =
          this.deserializeCachedReminders(cachedReminders);
        return {
          success: true,
          data: deserializedReminders,
        };
      } else {
        console.log(
          `🍎 Cache miss for key: ${cacheKey}, fetching from Apple Reminders`
        );
      }
    }

    const permissionCheck = await this.checkPermissions();
    if (!permissionCheck.success) {
      return {
        success: false,
        error: permissionCheck.error,
      };
    }

    try {
      const lists = await this.executeAppleScript(
        'tell application "Reminders" to return properties of lists'
      );

      const allReminders: AppleReminder[] = [];
      const processedLists = Array.isArray(lists) ? lists : [];

      for (const list of processedLists) {
        // Skip lists not in settings if configured
        // Note: listNames filter is now handled in memory, not at fetch level
        const configuredLists =
          this.settings.appleRemindersIntegration.reminderLists;
        if (
          configuredLists.length > 0 &&
          !configuredLists.includes(list.name)
        ) {
          continue;
        }

        // Determine if we should include completed reminders
        const includeCompleted =
          filter?.includeCompleted ??
          this.settings.appleRemindersIntegration.includeCompletedReminders;

        // Get reminders from this list with appropriate filter
        let appleScriptQuery: string;
        if (includeCompleted) {
          // Get all reminders (both completed and incomplete)
          appleScriptQuery = `tell list list_name in application "Reminders"
            return properties of reminders
          end tell`;
        } else {
          // Get only incomplete reminders
          appleScriptQuery = `tell list list_name in application "Reminders"
            return properties of reminders whose completed is false
          end tell`;
        }

        let reminders;
        try {
          reminders = await this.executeAppleScript(appleScriptQuery, {
            list_name: list.name,
          });
        } catch (scriptError) {
          continue; // Skip this list and continue with others
        }

        const processedReminders = Array.isArray(reminders) ? reminders : [];

        for (const reminder of processedReminders) {
          // Apply filters
          if (!this.shouldIncludeReminder(reminder, filter)) {
            continue;
          }

          const appleReminder: AppleReminder =
            this.transformAppleScriptReminderToAppleReminder(reminder, list);
          allReminders.push(appleReminder);
        }
      }

      // Cache the result
      if (this.cache) {
        await this.cache.set(cacheKey, allReminders, {
          duration: this.CACHE_DURATION,
        });
        console.log(
          `🍎 Cached ${allReminders.length} reminders with key: ${cacheKey}`
        );
      }

      return {
        success: true,
        data: allReminders,
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          type: AppleRemindersError.UNKNOWN,
          message: `Failed to fetch reminders: ${error.message}`,
          originalError: error,
        },
      };
    }
  }

  /**
   * Import Apple Reminder as Obsidian task
   */
  async importReminderAsTask(
    reminder: AppleReminder,
    config: TaskImportConfig
  ): Promise<ImportResult> {
    if (!this.taskImportManager) {
      throw new Error(
        "Import dependencies not initialized. Call setImportDependencies() first."
      );
    }

    try {
      const taskData = this.transformReminderToTaskData(reminder);

      // Check if task is already imported using task store
      const isAlreadyImported = taskStore.isTaskImported(
        taskData.sourceType,
        taskData.id
      );

      if (isAlreadyImported) {
        return {
          success: true,
          skipped: true,
          reason: "Task already imported",
        };
      }

      // Enhance config with reminder-specific settings
      const enhancedConfig = this.enhanceConfigWithReminderData(
        reminder,
        config
      );

      // Create the task
      const taskPath = await this.taskImportManager.createTaskFromData(
        taskData,
        enhancedConfig
      );

      // Task store will automatically pick up the new task via file watchers
      return {
        success: true,
        taskPath,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Transform Apple Reminder to ExternalTaskData format
   */
  private transformReminderToTaskData(
    reminder: AppleReminder
  ): ExternalTaskData {
    return {
      id: reminder.id,
      title: reminder.title,
      description: reminder.notes || undefined,
      status: reminder.completed ? "completed" : "open",
      priority: this.mapReminderPriorityToTaskPriority(reminder.priority),
      assignee: undefined, // Apple Reminders doesn't have assignees
      labels: [reminder.list.name], // Use list name as a label
      createdAt: reminder.creationDate,
      updatedAt: reminder.modificationDate,
      externalUrl: reminder.url || `reminder://${reminder.id}`,
      sourceType: "apple-reminders",
      sourceData: reminder,
    };
  }

  /**
   * Transform AppleScript reminder data to AppleReminder format
   */
  private transformAppleScriptReminderToAppleReminder(
    scriptReminder: any,
    list: any
  ): AppleReminder {
    return {
      id: scriptReminder.id || scriptReminder.name,
      title: scriptReminder.name,
      notes: scriptReminder.body || "",
      completed: scriptReminder.completed || false,
      completionDate: scriptReminder.completionDate
        ? new Date(scriptReminder.completionDate)
        : undefined,
      creationDate: scriptReminder.creationDate
        ? new Date(scriptReminder.creationDate)
        : new Date(),
      modificationDate: scriptReminder.modificationDate
        ? new Date(scriptReminder.modificationDate)
        : new Date(),
      dueDate: scriptReminder.dueDate
        ? new Date(scriptReminder.dueDate)
        : undefined,
      priority: scriptReminder.priority || 0,
      list: {
        id: list.id || list.name,
        name: list.name,
        color: list.color || "#007AFF",
      },
      allDay: scriptReminder.allDay || false,
      url: `reminder://${scriptReminder.id || scriptReminder.name}`,
    };
  }

  /**
   * Deserialize cached reminders by converting string dates back to Date objects
   */
  private deserializeCachedReminders(
    cachedReminders: AppleReminder[]
  ): AppleReminder[] {
    return cachedReminders.map((reminder) => ({
      ...reminder,
      creationDate:
        typeof reminder.creationDate === "string"
          ? new Date(reminder.creationDate)
          : reminder.creationDate,
      modificationDate:
        typeof reminder.modificationDate === "string"
          ? new Date(reminder.modificationDate)
          : reminder.modificationDate,
      completionDate:
        reminder.completionDate && typeof reminder.completionDate === "string"
          ? new Date(reminder.completionDate)
          : reminder.completionDate,
      dueDate:
        reminder.dueDate && typeof reminder.dueDate === "string"
          ? new Date(reminder.dueDate)
          : reminder.dueDate,
    }));
  }

  /**
   * Check if a reminder should be included based on filters
   */
  private shouldIncludeReminder(
    reminder: any,
    filter?: AppleRemindersFilter
  ): boolean {
    console.log("🍎 shouldIncludeReminder checking:", reminder.name, {
      completed: reminder.completed,
      allDay: reminder.allDay,
      priority: reminder.priority,
      dueDate: reminder.dueDate,
    });

    // Check completion status
    if (filter?.includeCompleted === false && reminder.completed) {
      console.log(
        "🍎 Excluding reminder (filter excludes completed):",
        reminder.name
      );
      return false;
    }

    if (
      !filter?.includeCompleted &&
      !this.settings.appleRemindersIntegration.includeCompletedReminders &&
      reminder.completed
    ) {
      console.log(
        "🍎 Excluding reminder (settings exclude completed):",
        reminder.name
      );
      return false;
    }

    // Check all-day reminders
    if (filter?.excludeAllDay && reminder.allDay) {
      console.log(
        "🍎 Excluding reminder (filter excludes all-day):",
        reminder.name
      );
      return false;
    }

    if (
      this.settings.appleRemindersIntegration.excludeAllDayReminders &&
      reminder.allDay
    ) {
      console.log(
        "🍎 Excluding reminder (settings exclude all-day):",
        reminder.name
      );
      return false;
    }

    // Check priority range
    if (filter?.priorityRange) {
      const priority = reminder.priority || 0;
      if (
        filter.priorityRange.min !== undefined &&
        priority < filter.priorityRange.min
      ) {
        console.log(
          "🍎 Excluding reminder (priority too low):",
          reminder.name,
          priority
        );
        return false;
      }
      if (
        filter.priorityRange.max !== undefined &&
        priority > filter.priorityRange.max
      ) {
        console.log(
          "🍎 Excluding reminder (priority too high):",
          reminder.name,
          priority
        );
        return false;
      }
    }

    // Check due date range
    if (filter?.dueDateRange && reminder.dueDate) {
      const dueDate = new Date(reminder.dueDate);
      if (filter.dueDateRange.start && dueDate < filter.dueDateRange.start) {
        console.log(
          "🍎 Excluding reminder (due date too early):",
          reminder.name,
          dueDate
        );
        return false;
      }
      if (filter.dueDateRange.end && dueDate > filter.dueDateRange.end) {
        console.log(
          "🍎 Excluding reminder (due date too late):",
          reminder.name,
          dueDate
        );
        return false;
      }
    }

    console.log("🍎 Including reminder:", reminder.name);
    return true;
  }

  /**
   * Map Apple Reminders priority (0-9) to task priority string
   */
  private mapReminderPriorityToTaskPriority(priority: number): string {
    if (priority === 0) return "Low";
    if (priority <= 3) return "Low";
    if (priority <= 6) return "Medium";
    if (priority <= 8) return "High";
    return "Urgent";
  }

  /**
   * Enhance import config with reminder-specific data
   */
  private enhanceConfigWithReminderData(
    _reminder: AppleReminder,
    config: TaskImportConfig
  ): TaskImportConfig {
    return {
      ...config,
      taskType:
        config.taskType ||
        this.settings.appleRemindersIntegration.defaultTaskType ||
        "Task",
    };
  }
}
