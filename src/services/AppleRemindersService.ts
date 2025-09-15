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
    console.log(
      `🍎 Clearing Apple Reminders cache - this should only happen when settings change or user manually refreshes`
    );
    // Clear all cache instances
    if (this.listsCache) {
      await this.listsCache.clear();
      console.log(`🍎 Cleared lists cache`);
    }
    if (this.remindersCache) {
      await this.remindersCache.clear();
      console.log(`🍎 Cleared reminders cache`);
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
   * Fallback method to fetch reminders sequentially (non-concurrent)
   * Used when the single AppleScript approach fails
   */
  private async fetchRemindersSequentially(
    listsToProcess: any[],
    filter?: AppleRemindersFilter,
    includeCompleted?: boolean,
    onProgress?: (message: string, percentage?: number) => void
  ): Promise<AppleRemindersResult<AppleReminder[]>> {
    const allReminders: AppleReminder[] = [];

    // Prepare AppleScript query for individual list processing
    const appleScriptQuery = includeCompleted
      ? `tell list list_name in application "Reminders"
          return properties of reminders
        end tell`
      : `tell list list_name in application "Reminders"
          return properties of reminders whose completed is false
        end tell`;

    // Process lists one by one (sequential, not concurrent)
    for (let i = 0; i < listsToProcess.length; i++) {
      const list = listsToProcess[i];
      const percentage = 50 + Math.round((i / listsToProcess.length) * 40);
      onProgress?.(`Processing list: ${list.name}`, percentage);

      try {
        const reminders = await this.executeAppleScript(appleScriptQuery, {
          list_name: list.name,
        });

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
      } catch (scriptError) {
        console.warn(
          `🍎 Failed to fetch reminders from list "${list.name}":`,
          scriptError
        );
        // Continue with other lists even if one fails
      }
    }

    return {
      success: true,
      data: allReminders,
    };
  }

  /**
   * Fetch reminders from specified lists or all lists with persistent caching
   */
  async fetchReminders(
    filter?: AppleRemindersFilter,
    onProgress?: (message: string, percentage?: number) => void
  ): Promise<AppleRemindersResult<AppleReminder[]>> {
    const cacheKey = this.generateRemindersCacheKey(filter);

    // Report progress: checking cache
    onProgress?.("Checking cache...", 0);

    // Check cache first
    if (this.remindersCache) {
      console.log(`🍎 Looking for cache key: ${cacheKey}`);
      console.log(`🍎 Filter used for cache key:`, filter);
      const cachedReminders = await this.remindersCache.get(cacheKey);
      if (cachedReminders) {
        console.log(
          `🍎 Cache hit for key: ${cacheKey}, returning ${cachedReminders.length} reminders`
        );
        onProgress?.("Loaded from cache", 100);
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
        console.log(`🍎 Cache instance:`, this.remindersCache);
      }
    } else {
      console.log(`🍎 No reminders cache available!`);
    }

    const permissionCheck = await this.checkPermissions();
    if (!permissionCheck.success) {
      return {
        success: false,
        error: permissionCheck.error,
      };
    }

    try {
      // Report progress: loading lists
      onProgress?.("Loading reminder lists...", 10);

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

      // Build list of list names to query
      const listNames = listsToProcess.map((list) => list.name);

      // If no lists to process, return empty array
      if (listNames.length === 0) {
        onProgress?.("No lists to process", 100);
        return {
          success: true,
          data: [],
        };
      }

      // Report progress: found lists
      onProgress?.(
        `Found ${listNames.length} lists: ${listNames.join(", ")}`,
        20
      );

      // Prepare AppleScript query to fetch all reminders from all lists in one call
      // This avoids concurrent script execution which can cause timeouts
      const listNamesScript = listNames.map((name) => `"${name}"`).join(", ");
      const appleScriptQuery = includeCompleted
        ? `tell application "Reminders"
            set targetLists to {${listNamesScript}}
            set allReminders to {}
            repeat with listName in targetLists
              try
                set listReminders to properties of reminders in list listName
                repeat with reminderProps in listReminders
                  set reminderProps to reminderProps & {listName:listName}
                  set end of allReminders to reminderProps
                end repeat
              on error
                -- Skip lists that can't be accessed
              end try
            end repeat
            return allReminders
          end tell`
        : `tell application "Reminders"
            set targetLists to {${listNamesScript}}
            set allReminders to {}
            repeat with listName in targetLists
              try
                set listReminders to properties of reminders in list listName whose completed is false
                repeat with reminderProps in listReminders
                  set reminderProps to reminderProps & {listName:listName}
                  set end of allReminders to reminderProps
                end repeat
              on error
                -- Skip lists that can't be accessed
              end try
            end repeat
            return allReminders
          end tell`;

      try {
        // Report progress: fetching reminders
        onProgress?.("Fetching reminders from Apple Reminders...", 40);

        // Execute single AppleScript to get all reminders from all lists
        const allReminderData = await this.executeAppleScript(appleScriptQuery);
        const processedReminders = Array.isArray(allReminderData)
          ? allReminderData
          : [];

        // Report progress: processing reminders
        onProgress?.(
          `Processing ${processedReminders.length} reminders...`,
          60
        );

        // Process each reminder and match it to its list
        let processedCount = 0;
        for (const reminderData of processedReminders) {
          // Apply filters
          if (!this.shouldIncludeReminder(reminderData, filter)) {
            continue;
          }

          // Find the corresponding list object
          const listName = reminderData.listName;
          const list = listsToProcess.find((l) => l.name === listName);

          if (list) {
            const appleReminder: AppleReminder =
              this.transformAppleScriptReminderToAppleReminder(
                reminderData,
                list
              );
            allReminders.push(appleReminder);
          }

          // Update progress periodically
          processedCount++;
          if (
            processedCount % 10 === 0 ||
            processedCount === processedReminders.length
          ) {
            const percentage =
              60 +
              Math.round((processedCount / processedReminders.length) * 30);
            onProgress?.(
              `Processed ${processedCount}/${processedReminders.length} reminders`,
              percentage
            );
          }
        }
      } catch (scriptError) {
        console.warn(`🍎 Failed to fetch reminders:`, scriptError);
        // Fall back to sequential processing if the single script fails
        onProgress?.("Falling back to sequential processing...", 50);
        return this.fetchRemindersSequentially(
          listsToProcess,
          filter,
          includeCompleted,
          onProgress
        );
      }

      // Report progress: caching results
      onProgress?.(`Caching ${allReminders.length} reminders...`, 95);

      // Cache the result
      if (this.remindersCache) {
        await this.remindersCache.set(cacheKey, allReminders);
        console.log(
          `🍎 Cached ${allReminders.length} reminders with key: ${cacheKey}`
        );
        // Verify the cache was set correctly
        const verifyCache = await this.remindersCache.get(cacheKey);
        console.log(
          `🍎 Cache verification: ${
            verifyCache ? verifyCache.length : "null"
          } reminders found for key: ${cacheKey}`
        );
      } else {
        console.log(`🍎 No reminders cache available for setting!`);
      }

      // Report completion
      onProgress?.(`Loaded ${allReminders.length} reminders`, 100);

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
    return this.importExternalItem(
      reminder,
      config,
      this.transformReminderToTaskData.bind(this),
      this.enhanceConfigWithReminderData.bind(this)
    );
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
      dueDate: reminder.dueDate, // Include due date from Apple Reminders
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
