/**
 * Apple Reminders Extension for TaskSync
 * Provides Apple Reminders integration following the Extension pattern
 */

import { Plugin } from "obsidian";
import { Extension, extensionRegistry, EntityType } from "../../core/extension";
import { eventBus } from "../../core/events";
import { taskStore } from "../../stores/taskStore";
import { derived, get, writable, type Readable } from "svelte/store";
import type { Task } from "../../core/entities";
import { SchemaCache } from "../../cache/SchemaCache";
import {
  AppleRemindersListsSchema,
  AppleRemindersSchema,
  type AppleReminders,
  type AppleRemindersLists,
} from "../../cache/schemas/apple-reminders";
import type { TaskSyncSettings } from "../../types/settings";
import { AppleRemindersDataSource } from "./sources/DataSource";
import { taskSourceManager } from "../../core/TaskSourceManager";
import { syncManager, type EntityDataProvider } from "../../core/SyncManager";
import * as osascript from "node-osascript";
import {
  AppleRemindersPermission,
  AppleRemindersError,
  type AppleRemindersResult,
  type AppleReminder,
  type AppleRemindersList,
  type AppleScriptReminder,
  type AppleScriptList,
  type AppleRemindersFilter,
} from "../../types/apple-reminders";
import moment from "moment";

/**
 * EntityDataProvider for Apple Reminders extension
 * Handles reading Apple Reminders data for cross-source synchronization
 */
class AppleRemindersEntityDataProvider implements EntityDataProvider {
  extensionId = "apple-reminders";

  constructor(private extension: AppleRemindersExtension) {}

  async readEntityData(entityId: string): Promise<Partial<Task> | null> {
    console.log(
      `[AppleRemindersEntityDataProvider] Reading Apple Reminders data for entity ${entityId}`
    );

    // First, try to find the task in the main task store
    const mainStoreState = get(taskStore);
    const mainTask = mainStoreState.tasks.find((t) => t.id === entityId);

    if (mainTask) {
      console.log(
        `[AppleRemindersEntityDataProvider] Found Apple Reminders task in main store:`,
        {
          title: mainTask.title,
          sourceKeys: mainTask.source.keys,
        }
      );
      return mainTask;
    }

    // Fallback: Read from the extension's entity store
    const appleRemindersTasks = get(this.extension.getEntityStore()) as Task[];
    const task = appleRemindersTasks.find((t) => t.id === entityId);

    if (task) {
      console.log(
        `[AppleRemindersEntityDataProvider] Found Apple Reminders task in entity store:`,
        {
          title: task.title,
          description: task.description,
        }
      );
      return task;
    }

    console.log(
      `[AppleRemindersEntityDataProvider] No Apple Reminders task found for ${entityId}`
    );
    return null;
  }

  async writeEntityData(entityId: string, _data: Partial<Task>): Promise<void> {
    // Apple Reminders extension is read-only for now
    // Future enhancement could support writing back to Apple Reminders
    console.log(
      `[AppleRemindersEntityDataProvider] Apple Reminders is read-only, ignoring write for entity ${entityId}`
    );
  }

  canHandle(entity: Task): boolean {
    return entity.source.extension === "apple-reminders";
  }
}

/**
 * Apple Reminders Extension
 * Integrates with macOS Apple Reminders app using AppleScript
 */
export class AppleRemindersExtension implements Extension {
  readonly id = "apple-reminders";
  readonly name = "Apple Reminders";
  readonly version = "1.0.0";
  readonly supportedEntities: readonly EntityType[] = ["task"];

  private plugin: Plugin;
  private settings: TaskSyncSettings;
  private initialized = false;

  // Caches for Apple Reminders data
  private listsCache?: SchemaCache<AppleRemindersLists>;
  private remindersCache?: SchemaCache<AppleReminders>;

  // Data source for Apple Reminders tasks
  private dataSource?: AppleRemindersDataSource;

  // Entity data provider for sync manager
  private entityDataProvider?: AppleRemindersEntityDataProvider;

  constructor(plugin: Plugin, settings: TaskSyncSettings) {
    this.plugin = plugin;
    this.settings = settings;
  }

  /**
   * Check if the current platform supports Apple Reminders
   */
  isPlatformSupported(): boolean {
    // Check if we're in a test environment with stubs
    if (typeof window !== 'undefined' && (window as any).__appleRemindersApiStubs) {
      console.log('🔧 Test environment with Apple Reminders stubs detected, allowing on any platform');
      return true;
    }

    // Check if we're in a test environment by looking at the vault path
    const obsidianHost = this.plugin.app as any;
    const vaultPath = obsidianHost?.vault?.adapter?.basePath || '';
    const isTestVault = vaultPath.includes('test-environments') || vaultPath.includes('e2e');

    console.log('🔧 Platform check debug:', {
      platform: process.platform,
      vaultPath,
      isTestVault,
      nodeEnv: process.env.NODE_ENV
    });

    // In test environment, always return true to allow testing on non-macOS platforms
    if (isTestVault) {
      console.log('🔧 Test environment detected, bypassing platform check');
      return true;
    }

    return process.platform === "darwin";
  }

  /**
   * Check if Apple Reminders integration is enabled in settings
   */
  isEnabled(): boolean {
    return this.settings.integrations?.appleReminders?.enabled === true;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      console.log("Initializing AppleRemindersExtension...");

      // Check if enabled in settings
      if (!this.isEnabled()) {
        console.log("Apple Reminders integration is disabled");
        return;
      }

      // Register extension
      extensionRegistry.register(this);

      // Initialize caches
      this.initializeCaches();

      // Initialize data source
      this.dataSource = new AppleRemindersDataSource(this);
      taskSourceManager.registerSource(this.dataSource);

      // Initialize entity data provider
      this.entityDataProvider = new AppleRemindersEntityDataProvider(this);
      syncManager.registerProvider(this.entityDataProvider);

      // Trigger extension registered event
      eventBus.trigger({
        type: "extension.registered",
        extension: this.id,
        supportedEntities: [...this.supportedEntities],
      });

      this.initialized = true;
      console.log("AppleRemindersExtension initialized successfully");
    } catch (error) {
      console.error("Failed to initialize AppleRemindersExtension:", error);
      throw error;
    }
  }

  async load(): Promise<void> {
    if (!this.initialized) {
      throw new Error("AppleRemindersExtension must be initialized before loading");
    }

    if (!this.isEnabled()) {
      console.log("Apple Reminders integration is disabled, skipping load");
      return;
    }

    try {
      console.log("Loading AppleRemindersExtension...");

      // Preload caches with existing data
      await this.preloadCaches();

      // Load initial data
      await this.refresh();

      // Trigger extension loaded event
      eventBus.trigger({
        type: "extension.loaded",
        extension: this.id,
        supportedEntities: this.supportedEntities,
      });

      console.log("AppleRemindersExtension loaded successfully");
    } catch (error) {
      console.error("Failed to load AppleRemindersExtension:", error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    if (!this.initialized) return;

    eventBus.trigger({
      type: "extension.unregistered",
      extension: this.id,
    });

    this.initialized = false;
  }

  async isHealthy(): Promise<boolean> {
    return this.initialized && this.isEnabled();
  }

  // Event handler methods required by Extension interface
  async onEntityCreated(_event: any): Promise<void> {
    // Apple Reminders extension uses reactive stores instead of event handlers
  }

  async onEntityUpdated(_event: any): Promise<void> {
    // Apple Reminders extension uses reactive stores instead of event handlers
  }

  async onEntityDeleted(_event: any): Promise<void> {
    // Apple Reminders extension uses reactive stores instead of event handlers
  }

  // ============================================================================
  // REACTIVE STATE - Extension-level state that components can observe
  // ============================================================================

  // Extension's own entity store - contains Apple Reminders tasks owned by this extension
  private entityStore = writable<Task[]>([]);

  /**
   * Get the extension's entity store (read-only)
   */
  getEntityStore(): Readable<Task[]> {
    return this.entityStore;
  }

  /**
   * Get tasks from this extension (implements ExtensionDataAccess)
   */
  getTasks(): Readable<readonly Task[]> {
    return derived(this.entityStore, (tasks) => tasks as readonly Task[]);
  }

  /**
   * Refresh Apple Reminders data
   */
  async refresh(): Promise<void> {
    if (!this.isEnabled()) {
      console.log("Apple Reminders integration is disabled");
      return;
    }

    try {
      console.log("Refreshing Apple Reminders data...");

      // Clear caches to force fresh data
      await this.clearCache();

      // Fetch reminders and update entity store using data source
      if (this.dataSource) {
        const tasks = await this.dataSource.refresh();
        this.entityStore.set(tasks as Task[]);
        console.log(`Loaded ${tasks.length} Apple Reminders tasks`);
      }
    } catch (error) {
      console.error("Failed to refresh Apple Reminders data:", error);
    }
  }

  /**
   * Clear all Apple Reminders caches
   */
  async clearCache(): Promise<void> {
    try {
      if (this.listsCache) {
        await this.listsCache.clear();
      }
      if (this.remindersCache) {
        await this.remindersCache.clear();
      }
      console.log("🍎 Apple Reminders caches cleared");
    } catch (error) {
      console.error("Failed to clear Apple Reminders caches:", error);
    }
  }

  // ============================================================================
  // PRIVATE METHODS - Apple Reminders API integration
  // ============================================================================

  /**
   * Initialize caches for Apple Reminders data
   */
  private initializeCaches(): void {
    this.listsCache = new SchemaCache(
      this.plugin,
      "apple-reminders-lists",
      AppleRemindersListsSchema,
      { version: "1.0.0" }
    );

    this.remindersCache = new SchemaCache(
      this.plugin,
      "apple-reminders-reminders",
      AppleRemindersSchema,
      { version: "1.0.0" }
    );
  }

  /**
   * Preload caches with existing data
   */
  private async preloadCaches(): Promise<void> {
    try {
      if (this.listsCache) {
        await this.listsCache.preloadFromStorage();
      }
      if (this.remindersCache) {
        await this.remindersCache.preloadFromStorage();
      }
    } catch (error) {
      console.warn("Failed to preload Apple Reminders caches:", error);
    }
  }

  /**
   * Check Apple Reminders permissions
   */
  async checkPermissions(): Promise<AppleRemindersResult<AppleRemindersPermission>> {

    try {
      const script = `
        tell application "Reminders"
          try
            get name of list 1
            return "authorized"
          on error
            return "denied"
          end try
        end tell
      `;

      const result = await this.executeAppleScript(script);
      const permission = result === "authorized"
        ? AppleRemindersPermission.AUTHORIZED
        : AppleRemindersPermission.DENIED;

      return {
        success: true,
        data: permission,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          type: AppleRemindersError.UNKNOWN,
          message: `Permission check failed: ${error}`,
          originalError: error,
        },
      };
    }
  }

  /**
   * Fetch reminder lists from Apple Reminders
   */
  async fetchLists(): Promise<AppleRemindersResult<AppleRemindersList[]>> {

    try {
      const script = `
        tell application "Reminders"
          set listData to {}
          repeat with reminderList in lists
            set listInfo to {id:(id of reminderList), name:(name of reminderList), color:"#007AFF"}
            set end of listData to listInfo
          end repeat
          return listData
        end tell
      `;

      const result = await this.executeAppleScript(script);
      const lists: AppleRemindersList[] = result.map((item: any) => ({
        id: item.id,
        name: item.name,
        color: item.color,
      }));

      // Cache the results
      if (this.listsCache) {
        await this.listsCache.set("lists", lists);
      }

      return {
        success: true,
        data: lists,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          type: AppleRemindersError.UNKNOWN,
          message: `Failed to fetch reminder lists: ${error}`,
          originalError: error,
        },
      };
    }
  }

  /**
   * Fetch reminder lists from Apple Reminders (alias for fetchLists)
   */
  async fetchReminderLists(): Promise<AppleRemindersResult<AppleRemindersList[]>> {
    return this.fetchLists();
  }

  /**
   * Fetch reminders from Apple Reminders with filtering support
   */
  async fetchReminders(filter?: AppleRemindersFilter): Promise<AppleRemindersResult<AppleReminder[]>> {

    try {
      // Check permissions first
      const permissionResult = await this.checkPermissions();
      if (!permissionResult.success) {
        return {
          success: false,
          error: permissionResult.error,
        };
      }

      // Get all lists first
      const listsResult = await this.fetchLists();
      if (!listsResult.success || !listsResult.data) {
        return {
          success: false,
          error: listsResult.error || {
            type: AppleRemindersError.UNKNOWN,
            message: "Failed to fetch reminder lists",
          },
        };
      }

      const allReminders: AppleReminder[] = [];
      const includeCompleted = filter?.includeCompleted ??
        this.settings.integrations.appleReminders?.includeCompletedReminders ?? false;

      // Process each list
      for (const list of listsResult.data) {
        // Skip lists not in filter if specified
        if (filter?.listNames && !filter.listNames.includes(list.name)) {
          continue;
        }

        try {
          // Enhanced AppleScript to get all reminder properties
          const script = includeCompleted
            ? `tell application "Reminders" to return properties of reminders in list "${list.name}"`
            : `tell application "Reminders" to return properties of reminders in list "${list.name}" whose completed is false`;

          const reminders = await this.executeAppleScript(script);
          const processedReminders: AppleScriptReminder[] = Array.isArray(reminders) ? reminders : [];
          for (const reminder of processedReminders) {
            // Apply filters
            if (!this.shouldIncludeReminder(reminder, filter)) {
              continue;
            }

            const appleReminder: AppleReminder = this.transformAppleScriptReminderToAppleReminder(reminder, list);
            allReminders.push(appleReminder);
          }
        } catch (error) {
          console.warn(`🍎 Failed to fetch reminders from list "${list.name}":`, error);
          // Continue with other lists
        }
      }

      // Cache the results
      if (this.remindersCache) {
        await this.remindersCache.set("reminders", allReminders);
      }

      return {
        success: true,
        data: allReminders,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          type: AppleRemindersError.UNKNOWN,
          message: `Failed to fetch reminders: ${error}`,
          originalError: error,
        },
      };
    }
  }

  /**
   * Execute AppleScript with timeout and error handling
   * Public for e2e test stubbing - allows tests to mock AppleScript execution
   */
  async executeAppleScript(script: string, variables: Record<string, any> = {}): Promise<any> {
    // Check if we're in a test environment and should use mock data
    if (typeof window !== 'undefined' && (window as any).__appleRemindersApiStubs) {
      console.log("🔧 Test environment detected, using stubbed Apple Reminders data");

      // Return mock data based on the script content
      if (script.includes('repeat with reminderList in lists') || script.includes('return listData')) {

        return (window as any).__appleRemindersApiStubs?.lists || [];
      } else if (script.includes('properties of reminders')) {

        return (window as any).__appleRemindersApiStubs?.reminders || [];
      } else if (script.includes('get name of list 1') || script.includes('return "authorized"')) {
        // Permission check script

        return "authorized";
      }

      // Default return for unknown scripts

      return [];
    }

    // Check platform support before executing real AppleScript
    if (!this.isPlatformSupported()) {
      throw new Error("Apple Reminders is only supported on macOS");
    }

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

      // 20 second timeout
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
   * Transform AppleScript reminder data to AppleReminder format
   * Handles AppleScript date strings and "missing value" cases
   */
  private transformAppleScriptReminderToAppleReminder(
    scriptReminder: AppleScriptReminder,
    list: AppleRemindersList
  ): AppleReminder {
    // Parse remind me date and convert to reminders array
    const reminders: Date[] = [];
    if (scriptReminder.remindMeDate) {
      const reminderDate = this.parseAppleScriptDate(scriptReminder.remindMeDate);
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
      modificationDate: this.parseAppleScriptDate(scriptReminder.modificationDate),
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
   * Parse AppleScript date string to Date object using moment
   * Handles "missing value" and various date formats from AppleScript
   */
  private parseAppleScriptDate(value: any): Date | undefined {
    if (!value || value === "missing value" || typeof value !== "string") {
      return undefined;
    }

    try {
      // AppleScript returns dates in format like "Thursday, 29 May 2025 at 20:37:46"
      // or "Monday, 15 September 2025 at 00:00:00"
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
      !this.settings.integrations.appleReminders?.includeCompletedReminders &&
      reminder.completed
    ) {
      return false;
    }

    // Check all-day reminders
    if (filter?.excludeAllDay && reminder.allDay) {
      return false;
    }

    if (
      this.settings.integrations.appleReminders?.excludeAllDayReminders &&
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
}
