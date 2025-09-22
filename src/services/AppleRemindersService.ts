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
import moment from "moment";
import {
  AppleReminder,
  AppleRemindersList,
  AppleRemindersResult,
  AppleRemindersError,
  AppleRemindersPermission,
  AppleRemindersFilter,
  AppleScriptReminder,
  AppleScriptList,
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
import { settingsStore } from "../stores/settingsStore";

export class AppleRemindersService extends AbstractService {
  private listsCache?: SchemaCache<AppleRemindersLists>;
  private remindersCache?: SchemaCache<AppleReminders>;
  private settingsUnsubscribe?: () => void;

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
    this.updateSettingsInternal(newSettings.integrations.appleReminders);
  }

  /**
   * Internal method to update Apple Reminders settings without cache clearing
   * Used by the event system
   */
  updateSettingsInternal(newAppleSettings: any): void {
    // Update the integration settings
    if (this.settings.integrations.appleReminders) {
      Object.assign(
        this.settings.integrations.appleReminders,
        newAppleSettings
      );
    }
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
      this.settings.integrations.appleReminders.enabled &&
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
   * Setup reactive settings subscription
   */
  setupSettingsSubscription(): void {
    // Unsubscribe any existing subscription to prevent duplicates
    this.dispose();

    this.settingsUnsubscribe =
      settingsStore.appleRemindersIntegration.subscribe((appleSettings) => {
        if (appleSettings) {
          console.log(
            "🍎 Apple Reminders settings changed via store, updating service"
          );
          this.updateSettingsInternal(appleSettings);
          this.clearCache();
        }
      });
  }

  /**
   * Dispose of the service and clean up subscriptions
   */
  dispose(): void {
    if (this.settingsUnsubscribe) {
      this.settingsUnsubscribe();
      this.settingsUnsubscribe = undefined;
    }
  }

  /**
   * Execute AppleScript with simple timeout and retry
   */
  private async executeAppleScript(
    script: string,
    variables: Record<string, any> = {},
    retries: number = 2
  ): Promise<any> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await this.executeAppleScriptOnce(script, variables);
      } catch (error: any) {
        // Don't retry on permission errors
        if (
          error.message?.includes("Permission denied") ||
          error.message?.includes("not authorized")
        ) {
          throw error;
        }

        // If this was the last attempt, throw the error
        if (attempt === retries) {
          console.warn(
            `🍎 AppleScript failed after ${retries + 1} attempts:`,
            error.message
          );
          throw error;
        }

        // Simple 2 second delay between retries
        console.warn(
          `🍎 AppleScript attempt ${attempt + 1} failed, retrying...`
        );
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
    throw new Error("Unexpected retry loop exit");
  }

  /**
   * Execute AppleScript with basic timeout
   */
  private async executeAppleScriptOnce(
    script: string,
    variables: Record<string, any> = {}
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      let completed = false;

      const childProcess = osascript.execute(
        script,
        variables,
        (err: any, res: any) => {
          if (completed) return;
          completed = true;

          if (err) {
            reject(err);
          } else {
            resolve(res);
          }
        }
      );

      // 20 second timeout - much shorter
      setTimeout(() => {
        if (completed) return;
        completed = true;

        childProcess.stdin?.pause();
        childProcess.kill();
        reject(new Error("AppleScript execution timed out after 20 seconds"));
      }, 20000);
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

    try {
      // Use the abstract fetch method that guarantees cache persistence
      const reminderLists = await this.fetch(this.listsCache, cacheKey, () =>
        this.fetchReminderListsFromApple()
      );

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
   * Internal method to fetch reminder lists from Apple Reminders (no caching)
   */
  private async fetchReminderListsFromApple(): Promise<AppleRemindersList[]> {
    const permissionCheck = await this.checkPermissions();
    if (!permissionCheck.success) {
      throw new Error(
        `Permission denied: ${
          permissionCheck.error?.message || "Unknown error"
        }`
      );
    }

    const lists = await this.executeAppleScript(
      'tell application "Reminders" to return properties of lists'
    );

    const reminderLists: AppleRemindersList[] = (
      Array.isArray(lists) ? lists : []
    ).map((list: AppleScriptList) => ({
      id: list.id,
      name: list.name,
      color: list.color,
      reminderCount: 0, // We don't fetch count in this operation
    }));

    return reminderLists;
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

    try {
      // Use the abstract fetch method that guarantees cache persistence
      const reminders = await this.fetch(this.remindersCache, cacheKey, () =>
        this.fetchRemindersFromApple(filter, onProgress)
      );

      onProgress?.(`Loaded ${reminders.length} reminders`, 100);
      return {
        success: true,
        data: reminders,
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
   * Internal method to fetch reminders from Apple Reminders (no caching)
   */
  private async fetchRemindersFromApple(
    filter?: AppleRemindersFilter,
    onProgress?: (message: string, percentage?: number) => void
  ): Promise<AppleReminder[]> {
    // Check permissions first
    const permissionCheck = await this.checkPermissions();
    if (!permissionCheck.success) {
      throw new Error(
        `Permission denied: ${
          permissionCheck.error?.message || "Unknown error"
        }`
      );
    }

    onProgress?.("Getting reminder lists...", 10);

    // Get all lists first
    const lists = await this.executeAppleScript(
      'tell application "Reminders" to return properties of lists'
    );
    const processedLists = Array.isArray(lists) ? lists : [];

    // Filter lists based on settings
    const configuredLists =
      this.settings.integrations.appleReminders.reminderLists;
    const listsToProcess =
      configuredLists.length > 0
        ? processedLists.filter((list: AppleScriptList) =>
            configuredLists.includes(list.name)
          )
        : processedLists;

    if (listsToProcess.length === 0) {
      onProgress?.("No lists to process", 100);
      return [];
    }

    // Determine if we should include completed reminders
    const includeCompleted =
      filter?.includeCompleted ??
      this.settings.integrations.appleReminders.includeCompletedReminders;

    onProgress?.(`Processing ${listsToProcess.length} lists...`, 30);

    const allReminders: AppleReminder[] = [];

    // Process lists one by one - simple and reliable
    for (let i = 0; i < listsToProcess.length; i++) {
      const list: AppleScriptList = listsToProcess[i];
      const progress = 30 + Math.round((i / listsToProcess.length) * 60);
      onProgress?.(`Processing list: ${list.name}`, progress);

      try {
        // Simple AppleScript to get reminders from one list
        const script = includeCompleted
          ? `tell application "Reminders" to return properties of reminders in list "${list.name}"`
          : `tell application "Reminders" to return properties of reminders in list "${list.name}" whose completed is false`;

        const reminders = await this.executeAppleScript(script);

        const processedReminders: AppleScriptReminder[] = Array.isArray(
          reminders
        )
          ? reminders
          : [];

        for (const reminder of processedReminders) {
          // Apply filters
          if (!this.shouldIncludeReminder(reminder, filter)) {
            continue;
          }

          const appleReminder: AppleReminder =
            this.transformAppleScriptReminderToAppleReminder(reminder, list);
          allReminders.push(appleReminder);
        }
      } catch (error) {
        console.warn(
          `🍎 Failed to fetch reminders from list "${list.name}":`,
          error
        );
        // Continue with other lists
      }
    }

    onProgress?.(`Loaded ${allReminders.length} reminders`, 100);
    return allReminders;
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
    // Use current date as fallback for missing dates
    const now = new Date();

    return {
      id: reminder.id,
      title: reminder.title,
      description: reminder.notes || undefined,
      status: reminder.completed ? "completed" : "open",
      priority: this.mapReminderPriorityToTaskPriority(reminder.priority),
      assignee: undefined, // Apple Reminders doesn't have assignees
      labels: [reminder.list.name], // Use list name as a label
      createdAt: reminder.creationDate || now,
      updatedAt: reminder.modificationDate || now,
      dueDate: reminder.dueDate, // Include due date from Apple Reminders
      reminders: reminder.reminders, // Include reminder timestamps
      externalUrl: reminder.url || `reminder://${reminder.id}`,
      sourceType: "apple-reminders",
      sourceData: reminder, // Store the processed AppleReminder data
    };
  }

  /**
   * Transform AppleScript reminder data to AppleReminder format
   * Handles AppleScript date strings and "missing value" cases
   */
  private transformAppleScriptReminderToAppleReminder(
    scriptReminder: AppleScriptReminder,
    list: AppleScriptList
  ): AppleReminder {
    // Parse remind me date and convert to reminders array
    const reminders: Date[] = [];
    if (scriptReminder.remindMeDate) {
      const reminderDate = this.parseAppleScriptDate(
        scriptReminder.remindMeDate
      );
      if (reminderDate) {
        reminders.push(reminderDate);
      }
    }

    return {
      id: scriptReminder.id,
      title: scriptReminder.name,
      notes: this.parseAppleScriptValue(scriptReminder.body),
      completed: scriptReminder.completed,
      completionDate: this.parseAppleScriptDate(scriptReminder.completionDate),
      creationDate: this.parseAppleScriptDate(scriptReminder.creationDate),
      modificationDate: this.parseAppleScriptDate(
        scriptReminder.modificationDate
      ),
      dueDate: this.parseAppleScriptDate(scriptReminder.dueDate),
      reminders: reminders.length > 0 ? reminders : undefined,
      priority: scriptReminder.priority,
      list: {
        id: list.id,
        name: list.name,
        color: list.color,
      },
      allDay: scriptReminder.allDay,
      url: `reminder://${scriptReminder.id}`,
    };
  }

  /**
   * Parse AppleScript date string to Date object using Obsidian's moment
   * Handles "missing value" and various date formats from AppleScript
   */
  private parseAppleScriptDate(value: any): Date | undefined {
    if (!value || value === "missing value" || typeof value !== "string") {
      return undefined;
    }

    try {
      // AppleScript returns dates in format like "Thursday, 29 May 2025 at 20:37:46"
      // or "Monday, 15 September 2025 at 00:00:00"

      // Try using moment to parse the AppleScript date format
      const momentDate = moment(value, [
        "dddd, DD MMMM YYYY [at] HH:mm:ss",
        "dddd, D MMMM YYYY [at] HH:mm:ss",
        "dddd, DD MMM YYYY [at] HH:mm:ss",
        "dddd, D MMM YYYY [at] HH:mm:ss",
      ]);

      if (momentDate.isValid()) {
        return momentDate.toDate();
      }

      // Fallback: try direct parsing with moment
      const fallbackMoment = moment(value);
      if (fallbackMoment.isValid()) {
        return fallbackMoment.toDate();
      }

      console.warn(`🍎 Failed to parse AppleScript date: ${value}`);
      return undefined;
    } catch (error) {
      console.warn(`🍎 Error parsing AppleScript date "${value}":`, error);
      return undefined;
    }
  }

  /**
   * Parse AppleScript value, handling "missing value" cases
   */
  private parseAppleScriptValue(value: any): string | undefined {
    if (!value || value === "missing value") {
      return undefined;
    }
    return typeof value === "string" ? value : String(value);
  }

  /**
   * Check if a reminder should be included based on filters
   */
  private shouldIncludeReminder(
    reminder: AppleScriptReminder,
    filter?: AppleRemindersFilter
  ): boolean {
    // Check completion status
    if (filter?.includeCompleted === false && reminder.completed) {
      return false;
    }

    if (
      !filter?.includeCompleted &&
      !this.settings.integrations.appleReminders.includeCompletedReminders &&
      reminder.completed
    ) {
      return false;
    }

    // Check all-day reminders
    if (filter?.excludeAllDay && reminder.allDay) {
      return false;
    }

    if (
      this.settings.integrations.appleReminders.excludeAllDayReminders &&
      reminder.allDay
    ) {
      return false;
    }

    // Check priority range
    if (filter?.priorityRange) {
      if (
        filter.priorityRange.min !== undefined &&
        reminder.priority < filter.priorityRange.min
      ) {
        return false;
      }
      if (
        filter.priorityRange.max !== undefined &&
        reminder.priority > filter.priorityRange.max
      ) {
        return false;
      }
    }

    // Check due date range
    if (filter?.dueDateRange && reminder.dueDate) {
      const parsedDueDate = this.parseAppleScriptDate(reminder.dueDate);
      if (parsedDueDate) {
        if (
          filter.dueDateRange.start &&
          parsedDueDate < filter.dueDateRange.start
        ) {
          return false;
        }
        if (
          filter.dueDateRange.end &&
          parsedDueDate > filter.dueDateRange.end
        ) {
          return false;
        }
      }
    }

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
        this.settings.integrations.appleReminders.defaultTaskType ||
        "Task",
    };
  }
}
