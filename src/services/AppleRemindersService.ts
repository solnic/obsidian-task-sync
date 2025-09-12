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
import { taskStore } from "../stores/taskStore";
import { AbstractService } from "./AbstractService";
import { CacheManager } from "../cache/CacheManager";
import { SchemaCache } from "../cache/SchemaCache";
import {
  AppleRemindersListsSchema,
  AppleRemindersSchema,
  AppleRemindersLists,
  AppleReminders,
} from "../cache/schemas/apple-reminders";
import * as osascript from "node-osascript";

export class AppleRemindersService extends AbstractService {
  private listsCache?: SchemaCache<AppleRemindersLists>;
  private remindersCache?: SchemaCache<AppleReminders>;

  constructor(settings: TaskSyncSettings) {
    super(settings);
  }

  /**
   * Setup Apple Reminders-specific caches
   */
  protected async setupCaches(): Promise<void> {
    this.listsCache = this.createCache(
      "apple-reminders-lists",
      AppleRemindersListsSchema
    );
    this.remindersCache = this.createCache(
      "apple-reminders",
      AppleRemindersSchema
    );
  }

  /**
   * Preload Apple Reminders caches from persistent storage
   */
  protected async preloadCaches(): Promise<void> {
    const caches = [this.listsCache, this.remindersCache];

    await Promise.all(
      caches.map(async (cache) => {
        if (cache) {
          await cache.preloadFromStorage();
        }
      })
    );
  }

  /**
   * Initialize the service with cache manager
   */
  async initialize(cacheManager: CacheManager): Promise<void> {
    await super.initialize(cacheManager);
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
    // Clear all cache instances
    if (this.listsCache) {
      await this.listsCache.clear();
    }
    if (this.remindersCache) {
      await this.remindersCache.clear();
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
    const cacheKey = "lists";

    // Check cache first
    if (this.listsCache) {
      const cachedLists = await this.listsCache.get(cacheKey);
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
      if (this.listsCache) {
        await this.listsCache.set(cacheKey, reminderLists);
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
    if (this.remindersCache) {
      console.log(`🍎 Looking for cache key: ${cacheKey}`);
      const cachedReminders = await this.remindersCache.get(cacheKey);
      if (cachedReminders) {
        console.log(
          `🍎 Cache hit for key: ${cacheKey}, returning ${cachedReminders.length} reminders`
        );
        return {
          success: true,
          data: cachedReminders,
        };
      } else {
        console.log(
          `🍎 Cache miss for key: ${cacheKey}, fetching from Apple Reminders`
        );
        // Debug: Check what keys are actually in the cache
        const availableKeys = await this.remindersCache.keys();
        console.log(`🍎 Available cache keys:`, availableKeys);
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

      // Filter lists based on settings
      const configuredLists =
        this.settings.appleRemindersIntegration.reminderLists;
      const listsToProcess = processedLists.filter(
        (list) =>
          configuredLists.length === 0 || configuredLists.includes(list.name)
      );

      // Determine if we should include completed reminders
      const includeCompleted =
        filter?.includeCompleted ??
        this.settings.appleRemindersIntegration.includeCompletedReminders;

      // Prepare AppleScript query
      const appleScriptQuery = includeCompleted
        ? `tell list list_name in application "Reminders"
            return properties of reminders
          end tell`
        : `tell list list_name in application "Reminders"
            return properties of reminders whose completed is false
          end tell`;

      // Process all lists concurrently for better performance
      const listPromises = listsToProcess.map(async (list) => {
        try {
          const reminders = await this.executeAppleScript(appleScriptQuery, {
            list_name: list.name,
          });

          const processedReminders = Array.isArray(reminders) ? reminders : [];
          const filteredReminders: AppleReminder[] = [];

          for (const reminder of processedReminders) {
            // Apply filters
            if (!this.shouldIncludeReminder(reminder, filter)) {
              continue;
            }

            const appleReminder: AppleReminder =
              this.transformAppleScriptReminderToAppleReminder(reminder, list);
            filteredReminders.push(appleReminder);
          }

          return filteredReminders;
        } catch (scriptError) {
          console.warn(
            `🍎 Failed to fetch reminders from list "${list.name}":`,
            scriptError
          );
          return []; // Return empty array for failed lists
        }
      });

      // Wait for all lists to be processed concurrently
      const listResults = await Promise.all(listPromises);

      // Flatten all results into a single array
      listResults.forEach((reminders) => {
        allReminders.push(...reminders);
      });

      // Cache the result
      if (this.remindersCache) {
        await this.remindersCache.set(cacheKey, allReminders);
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
