/**
 * Apple Reminders Extension for TaskSync
 * Provides Apple Reminders integration following the Extension pattern
 */

import { Plugin } from "obsidian";
import { Extension, extensionRegistry, EntityType } from "../../core/extension";
import { eventBus } from "../../core/events";
import { taskStore } from "../../stores/taskStore";
import { derived, get, writable, type Readable } from "svelte/store";
import { Task, TaskSchema } from "../../core/entities";
import { generateId } from "../../utils/idGenerator";
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
import { Tasks } from "../../entities/Tasks";
import { EntitiesOperations } from "../../core/entities-base";
import type { SelectOption } from "../../core/note-kit";

/**
 * Progress tracking interface for Apple Reminders refresh operations
 */
export interface AppleRemindersRefreshProgress {
  status: 'idle' | 'checking-permissions' | 'fetching-lists' | 'fetching-reminders' | 'processing' | 'complete' | 'error';
  currentList?: string;
  processedLists: number;
  totalLists: number;
  processedReminders: number;
  totalReminders: number;
  percentage: number;
  error?: string;
}

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

  // Cached platform support check result
  private platformSupported?: boolean;

  // Task operations for creating task files
  private taskOperations: EntitiesOperations;

  // Loading guard to prevent multiple simultaneous refresh operations
  private isRefreshing = false;
  private refreshPromise?: Promise<void>;

  // Progress tracking for UI feedback
  private refreshProgress = writable<AppleRemindersRefreshProgress>({
    status: 'idle',
    processedLists: 0,
    totalLists: 0,
    processedReminders: 0,
    totalReminders: 0,
    percentage: 0,
  });

  constructor(plugin: Plugin, settings: TaskSyncSettings) {
    this.plugin = plugin;
    this.settings = settings;
    this.taskOperations = new Tasks.Operations(settings);
  }

  /**
   * Check if the current platform supports Apple Reminders
   * Result is cached after first check to avoid repeated platform checks
   * Note: Cache is bypassed in test environments to allow stubbing
   */
  isPlatformSupported(): boolean {
    // Check if we're in a test environment with stubs - bypass cache for tests
    if (typeof window !== 'undefined' && (window as any).__appleRemindersApiStubs) {
      return true;
    }

    // Return cached result if available (non-test environments only)
    if (this.platformSupported !== undefined) {
      return this.platformSupported;
    }

    // Check if we're in a test environment by looking at the vault path
    const obsidianHost = this.plugin.app as any;
    const vaultPath = obsidianHost?.vault?.adapter?.basePath || '';
    const isTestVault = vaultPath.includes('test-environments') || vaultPath.includes('e2e');

    // In test environment, always return true to allow testing on non-macOS platforms
    if (isTestVault) {
      this.platformSupported = true;
      return true;
    }

    // Cache and return the platform check result
    this.platformSupported = process.platform === "darwin";
    return this.platformSupported;
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

      // Check if we have cached reminders data
      const cachedReminders = this.remindersCache
        ? await this.remindersCache.get("reminders")
        : null;

      console.log(`🍎 Cache check: ${cachedReminders ? cachedReminders.length : 0} cached reminders found`);

      // Load cached data into entity store if available
      if (cachedReminders && cachedReminders.length > 0) {
        console.log(`🍎 Loading ${cachedReminders.length} cached Apple Reminders (skipping refresh)`);

        // Transform cached reminders to tasks
        const tasks: Task[] = [];
        for (const reminder of cachedReminders) {
          try {
            const taskData = this.transformReminderToTask(reminder);
            const task = TaskSchema.parse({
              id: generateId(),
              createdAt: reminder.creationDate || new Date(),
              updatedAt: reminder.modificationDate || new Date(),
              ...taskData,
            });
            tasks.push(task);
          } catch (error) {
            console.error("Failed to transform cached Apple Reminder to Task:", error, reminder);
          }
        }

        this.entityStore.set(tasks);
        console.log(`🍎 Successfully loaded ${tasks.length} tasks from cache`);
      } else {
        console.log("🍎 No cached Apple Reminders data found, triggering refresh");

        // Start loading data asynchronously only if no cache exists
        // The Svelte component will handle showing loading state
        this.refresh().catch((error) => {
          console.error("Failed to load initial Apple Reminders data:", error);
        });
      }

      // Trigger extension loaded event immediately (don't wait for data refresh)
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

  // Store for available reminder lists
  private listsStore = writable<AppleRemindersList[]>([]);

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
   * Get available reminder lists (read-only)
   */
  getLists(): Readable<AppleRemindersList[]> {
    return this.listsStore;
  }

  /**
   * Check if the extension is currently refreshing data
   */
  getIsRefreshing(): boolean {
    return this.isRefreshing;
  }

  /**
   * Get the refresh progress store (read-only)
   */
  getRefreshProgress(): Readable<AppleRemindersRefreshProgress> {
    return this.refreshProgress;
  }

  /**
   * Refresh Apple Reminders data
   * Uses a loading guard to prevent multiple concurrent refreshes
   */
  async refresh(): Promise<void> {
    if (!this.isEnabled()) {
      console.log("Apple Reminders integration is disabled");
      return;
    }

    // If already refreshing, return the existing promise
    if (this.isRefreshing && this.refreshPromise) {
      console.log("Apple Reminders refresh already in progress, waiting for completion...");
      return this.refreshPromise;
    }

    // Set refreshing flag and create new promise
    this.isRefreshing = true;
    this.refreshPromise = this.performRefresh();

    try {
      await this.refreshPromise;
    } finally {
      // Clear refreshing state after completion
      this.isRefreshing = false;
      this.refreshPromise = undefined;
    }
  }  /**
   * Internal method that performs the actual refresh
   */
  private async performRefresh(): Promise<void> {
    try {
      console.log("🍎 [performRefresh] Starting Apple Reminders data refresh...");

      // Update progress: checking permissions
      this.refreshProgress.update(p => ({
        ...p,
        status: 'checking-permissions',
        percentage: 0,
      }));

      // Check permissions first
      console.log("🍎 [performRefresh] Checking permissions...");
      const permissionResult = await this.checkPermissions();
      console.log("🍎 [performRefresh] Permission result:", permissionResult);

      if (!permissionResult.success || permissionResult.data !== "authorized") {
        this.refreshProgress.update(p => ({
          ...p,
          status: 'error',
          error: 'Permission denied',
          percentage: 0,
        }));
        throw new Error("Apple Reminders permission denied");
      }

      // Update progress: fetching lists
      this.refreshProgress.update(p => ({
        ...p,
        status: 'fetching-lists',
        percentage: 10,
      }));

      // Get all lists first
      console.log("🍎 [performRefresh] Fetching reminder lists...");
      const listsResult = await this.fetchLists();
      console.log("🍎 [performRefresh] Lists result:", listsResult);

      if (!listsResult.success || !listsResult.data) {
        this.refreshProgress.update(p => ({
          ...p,
          status: 'error',
          error: 'Failed to fetch reminder lists',
          percentage: 0,
        }));
        throw new Error("Failed to fetch reminder lists");
      }

      const lists = listsResult.data;

      // Filter lists based on settings if specific lists are selected
      const selectedLists = this.settings.integrations.appleReminders?.reminderLists ?? [];
      console.log(`🍎 Selected lists from settings: ${selectedLists.length > 0 ? selectedLists.join(', ') : 'ALL (no filter)'}`);

      const listsToProcess = selectedLists.length > 0
        ? lists.filter(list => selectedLists.includes(list.name))
        : lists;

      console.log(`🍎 Processing ${listsToProcess.length} of ${lists.length} total lists`);

      const totalLists = listsToProcess.length;      // Update progress: starting to fetch reminders
      this.refreshProgress.update(p => ({
        ...p,
        status: 'fetching-reminders',
        totalLists,
        processedLists: 0,
        processedReminders: 0,
        totalReminders: 0,
        percentage: 20,
      }));

      const includeCompleted = this.settings.integrations.appleReminders?.includeCompletedReminders ?? false;
      const allReminders: AppleReminder[] = [];
      let processedLists = 0;

      // Process each list with progress updates
      for (const list of listsToProcess) {
        // Update progress: current list being processed
        this.refreshProgress.update(p => ({
          ...p,
          currentList: list.name,
          processedLists,
          percentage: 20 + Math.floor((processedLists / totalLists) * 60), // 20-80% range
        }));

        try {
          const script = includeCompleted
            ? `tell application "Reminders" to return properties of reminders in list "${list.name}"`
            : `tell application "Reminders" to return properties of reminders in list "${list.name}" whose completed is false`;

          const reminders = await this.executeAppleScript(script);
          const processedReminders: AppleScriptReminder[] = Array.isArray(reminders) ? reminders : [];

          for (const reminder of processedReminders) {
            const appleReminder: AppleReminder = this.transformAppleScriptReminderToAppleReminder(reminder, list);
            allReminders.push(appleReminder);
          }

          processedLists++;

          // Update progress after each list
          this.refreshProgress.update(p => ({
            ...p,
            processedLists,
            processedReminders: allReminders.length,
            totalReminders: allReminders.length,
            percentage: 20 + Math.floor((processedLists / totalLists) * 60),
          }));
        } catch (error) {
          console.warn(`🍎 Failed to fetch reminders from list "${list.name}":`, error);
          processedLists++;
          // Continue with other lists
        }
      }

      // Update progress: processing data
      this.refreshProgress.update(p => ({
        ...p,
        status: 'processing',
        currentList: undefined,
        percentage: 85,
      }));

      // Cache the results
      if (this.remindersCache) {
        await this.remindersCache.set("reminders", allReminders);
      }

      // Transform reminders to tasks and update entity store directly
      // No need to call dataSource.refresh() since we already have the data
      const tasks: Task[] = [];
      for (const reminder of allReminders) {
        try {
          const taskData = this.transformReminderToTask(reminder);
          const task = TaskSchema.parse({
            id: generateId(),
            createdAt: reminder.creationDate || new Date(),
            updatedAt: reminder.modificationDate || new Date(),
            ...taskData,
          });
          tasks.push(task);
        } catch (error) {
          console.error("Failed to transform Apple Reminder to Task:", error, reminder);
        }
      }

      this.entityStore.set(tasks);
      console.log(`Loaded ${tasks.length} Apple Reminders tasks`);

      // Update progress: complete
      this.refreshProgress.update(p => ({
        ...p,
        status: 'complete',
        percentage: 100,
      }));

      // Reset to idle after a short delay
      setTimeout(() => {
        this.refreshProgress.update(p => ({
          ...p,
          status: 'idle',
        }));
      }, 2000);
    } catch (error) {
      console.error("Failed to refresh Apple Reminders data:", error);

      // Update progress: error
      this.refreshProgress.update(p => ({
        ...p,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      }));

      // Reset to idle after a delay
      setTimeout(() => {
        this.refreshProgress.update(p => ({
          ...p,
          status: 'idle',
        }));
      }, 5000);

      throw error; // Re-throw to allow callers to handle errors
    }
  }

  /**
   * Import an Apple Reminder as a task
   * Creates a task file in the vault with Apple Reminders source metadata
   */
  async importReminderAsTask(
    reminder: AppleReminder
  ): Promise<{ success: boolean; taskId?: string; error?: string }> {
    try {
      console.log(`Importing Apple Reminder: ${reminder.title}`);

      // Transform Apple Reminder to task data
      const taskData = this.transformReminderToTask(reminder);

      // Use task operations to create the task (which creates the file and triggers events)
      const task = await this.taskOperations.create(taskData);

      console.log(
        `Successfully imported Apple Reminder "${reminder.title}" as task ${task.id}`
      );

      return {
        success: true,
        taskId: task.id,
      };
    } catch (error: any) {
      console.error(`Failed to import Apple Reminder:`, error);
      return {
        success: false,
        error: error.message || "Unknown error",
      };
    }
  }

  /**
   * Transform an Apple Reminder to a Task object (without persisting)
   * Used for importing Apple Reminders as tasks
   */
  transformReminderToTask(
    reminder: AppleReminder
  ): Omit<Task, "id" | "createdAt" | "updatedAt"> {
    // Get the plugin's typeNote instance to access task note type configuration
    const typeNote = (this.plugin as any).typeNote;
    const taskNoteType = typeNote.registry.getOrThrow("task");

    // Access properties directly via PropertyAccessor
    const statusProp = taskNoteType.properties.status;
    const priorityProp = taskNoteType.properties.priority;
    const categoryProp = taskNoteType.properties.category;

    // Get default values using PropertyAccessor's .default getter
    const defaultStatus = statusProp.default;
    const defaultCategory = categoryProp.default;

    // Find the "done" status from the status options
    const doneStatus = statusProp.doneOptions[0]; // Get first done status
    const doneStatusValue = doneStatus?.value ?? "Done";

    // Map Apple Reminders priority (0-9) to configured task priority names
    // Priority mapping: 0=none, 1-3=low, 4-6=medium, 7-9=high
    let priorityName = "";
    if (reminder.priority > 0 && priorityProp.selectOptions) {
      if (reminder.priority >= 7) {
        // High priority (7-9)
        const highPriority = priorityProp.selectOptions.find(
          (p: SelectOption) => p.value.toLowerCase() === "high" || p.value.toLowerCase() === "urgent"
        );
        priorityName = highPriority?.value || "";
      } else if (reminder.priority >= 4) {
        // Medium priority (4-6)
        const mediumPriority = priorityProp.selectOptions.find(
          (p: SelectOption) => p.value.toLowerCase() === "medium"
        );
        priorityName = mediumPriority?.value || "";
      } else {
        // Low priority (1-3)
        const lowPriority = priorityProp.selectOptions.find(
          (p: SelectOption) => p.value.toLowerCase() === "low"
        );
        priorityName = lowPriority?.value || "";
      }
    }

    return {
      title: reminder.title,
      description: reminder.notes || "",
      category: defaultCategory,
      status: reminder.completed ? doneStatusValue : defaultStatus,
      priority: priorityName,
      done: reminder.completed,
      project: "",
      areas: [],
      parentTask: "",
      doDate: undefined,
      dueDate: reminder.dueDate || undefined,
      tags: [], // Don't set tags for Apple Reminders
      source: {
        extension: "apple-reminders",
        keys: {
          "apple-reminders": reminder.id,
        },
        data: reminder, // Store original Apple Reminder data
      },
    };
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
        // Load cached lists into the store
        const cachedLists = await this.listsCache.get("lists");
        if (cachedLists) {
          this.listsStore.set(cachedLists);
        }
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

      // Update the lists store so UI can react
      this.listsStore.set(lists);

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
        console.log("🔧 Returning lists data:", (window as any).__appleRemindersApiStubs?.lists);
        return (window as any).__appleRemindersApiStubs?.lists || [];
      } else if (script.includes('properties of reminders')) {
        // Reminders fetching script - extract list name from script
        const listMatch = script.match(/in list "([^"]+)"/);
        const includeCompleted = !script.includes('whose completed is false');

        if (listMatch && listMatch[1]) {
          const listName = listMatch[1];
          const remindersData = (window as any).__appleRemindersApiStubs?.reminders || {};
          let listReminders = remindersData[listName] || [];

          // Filter out completed reminders if script specifies "whose completed is false"
          if (!includeCompleted) {
            listReminders = listReminders.filter((r: any) => !r.completed);
          }

          console.log(`🔧 Returning ${includeCompleted ? 'all' : 'incomplete'} reminders for list "${listName}":`, listReminders);
          return listReminders;
        }
        // If no list specified, return all reminders
        let allReminders = Object.values((window as any).__appleRemindersApiStubs?.reminders || {}).flat();

        // Filter out completed reminders if script specifies "whose completed is false"
        if (!includeCompleted) {
          allReminders = allReminders.filter((r: any) => !r.completed);
        }

        console.log(`🔧 Returning ${includeCompleted ? 'all' : 'incomplete'} reminders:`, allReminders);
        return allReminders;
      } else if (script.includes('get name of list 1') || script.includes('return "authorized"')) {
        // Permission check script
        console.log("🔧 Returning permission: authorized");
        return "authorized";
      }

      // Default return for unknown scripts
      console.log("🔧 Unknown script, returning empty array");
      return [];
    }

    // Check platform support before executing real AppleScript
    if (!this.isPlatformSupported()) {
      throw new Error("Apple Reminders is only supported on macOS");
    }

    return new Promise((resolve, reject) => {
      let completed = false;
      const timeout = 180000;

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

      setTimeout(() => {
        if (completed) return;
        completed = true;

        childProcess.stdin?.pause();
        childProcess.kill();
        reject(new Error("AppleScript execution timed out after #{timeout / 1000} seconds"));
      }, timeout);
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
