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
} from "../../types/apple-reminders";

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
    return process.platform === "darwin";
  }

  /**
   * Check if Apple Reminders integration is enabled in settings
   */
  isEnabled(): boolean {
    return (
      this.isPlatformSupported() &&
      this.settings.integrations?.appleReminders?.enabled === true
    );
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      console.log("Initializing AppleRemindersExtension...");

      // Check platform support
      if (!this.isPlatformSupported()) {
        console.log("Apple Reminders not supported on this platform");
        return;
      }

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
    return this.initialized && this.isPlatformSupported() && this.isEnabled();
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

      // Check permissions first
      const permissionResult = await this.checkPermissions();
      if (!permissionResult.success) {
        console.error("Apple Reminders permission denied:", permissionResult.error);
        return;
      }

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
    if (!this.isPlatformSupported()) {
      return {
        success: false,
        error: {
          type: AppleRemindersError.PLATFORM_NOT_SUPPORTED,
          message: "Apple Reminders is only supported on macOS",
        },
      };
    }

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
  async fetchReminderLists(): Promise<AppleRemindersResult<AppleRemindersList[]>> {
    if (!this.isPlatformSupported()) {
      return {
        success: false,
        error: {
          type: AppleRemindersError.PLATFORM_NOT_SUPPORTED,
          message: "Apple Reminders is only supported on macOS",
        },
      };
    }

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
   * Fetch reminders from Apple Reminders
   */
  async fetchReminders(): Promise<AppleRemindersResult<AppleReminder[]>> {
    if (!this.isPlatformSupported()) {
      return {
        success: false,
        error: {
          type: AppleRemindersError.PLATFORM_NOT_SUPPORTED,
          message: "Apple Reminders is only supported on macOS",
        },
      };
    }

    try {
      const script = `
        tell application "Reminders"
          set reminderData to {}
          repeat with reminderList in lists
            repeat with reminder in reminders of reminderList
              set reminderInfo to {id:(id of reminder), name:(name of reminder), body:(body of reminder), completed:(completed of reminder), priority:(priority of reminder), allDay:(allday of reminder), listId:(id of reminderList), listName:(name of reminderList)}
              set end of reminderData to reminderInfo
            end repeat
          end repeat
          return reminderData
        end tell
      `;

      const result = await this.executeAppleScript(script);
      const reminders: AppleReminder[] = result.map((item: any) => ({
        id: item.id,
        title: item.name,
        notes: item.body === "missing value" ? undefined : item.body,
        completed: item.completed,
        priority: item.priority,
        allDay: item.allDay,
        list: {
          id: item.listId,
          name: item.listName,
        },
        creationDate: new Date(), // AppleScript doesn't easily provide creation date
        modificationDate: new Date(), // AppleScript doesn't easily provide modification date
      }));

      // Cache the results
      if (this.remindersCache) {
        await this.remindersCache.set("reminders", reminders);
      }

      return {
        success: true,
        data: reminders,
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
   */
  private async executeAppleScript(script: string, variables: Record<string, any> = {}): Promise<any> {
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
}
