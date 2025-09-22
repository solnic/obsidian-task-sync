import {
  Plugin,
  TFile,
  Notice,
  App,
  Vault,
  MarkdownPostProcessor,
} from "obsidian";
import { get } from "svelte/store";
import { VaultScanner } from "./services/VaultScannerService";
import { BaseManager } from "./services/BaseManager";

import { FileChangeListener } from "./services/FileChangeListener";
import { TaskFileManager } from "./services/TaskFileManager";
import { TaskTodoMarkdownProcessor } from "./services/TaskTodoMarkdownProcessor";
import { AreaFileManager } from "./services/AreaFileManager";
import { ProjectFileManager } from "./services/ProjectFileManager";
import { AreaCreateData } from "./commands/core/CreateAreaCommand";
import { ProjectCreateData } from "./commands/core/CreateProjectCommand";

import { TaskSyncSettingTab } from "./components/ui/settings";
import type {
  TaskSyncSettings,
  TaskType,
  TaskTypeColor,
} from "./components/ui/settings";
import { EventManager } from "./events";
import { EventType, SettingsChangedEventData } from "./events/EventTypes";
import { StatusDoneHandler } from "./events/handlers";
import { EntityCacheHandler } from "./events/handlers/EntityCacheHandler";
import { TaskStatusSettingsHandler } from "./events/handlers/SettingsChangeHandler";
import {
  DEFAULT_SETTINGS,
  TASK_TYPE_COLORS,
  validateFolderPath,
} from "./components/ui/settings";
import type { TaskSyncPluginInterface } from "./interfaces/TaskSyncPluginInterface";
import { PROPERTY_SETS } from "./services/base-definitions/BaseConfigurations";
import { AppleCalendarService } from "./services/AppleCalendarService";
import { IntegrationManager } from "./services/IntegrationManager";
import { TaskSchedulingService } from "./services/TaskSchedulingService";
import { TaskImportManager } from "./services/TaskImportManager";
import { CacheManager } from "./cache/CacheManager";
import { TasksView, TASKS_VIEW_TYPE } from "./views/TasksView";
import { ContextTabView, CONTEXT_TAB_VIEW_TYPE } from "./views/ContextTabView";
import {
  TaskPlanningView,
  TASK_PLANNING_VIEW_TYPE,
} from "./views/TaskPlanningView";
import {
  DailyPlanningView,
  DAILY_PLANNING_VIEW_TYPE,
} from "./views/DailyPlanningView";
import { TaskImportConfig } from "./types/integrations";
import { Task, Project, Area } from "./types/entities";
import { taskStore } from "./stores/taskStore";
import { projectStore } from "./stores/projectStore";
import { areaStore } from "./stores/areaStore";
import { TodoPromotionService } from "./services/TodoPromotionService";
import { DailyNoteService } from "./services/DailyNoteService";
import {
  initializeContextStore,
  currentFileContext,
} from "./components/svelte/context";
import { TaskMentionDetectionService } from "./services/TaskMentionDetectionService";
import { TaskMentionSyncHandler } from "./events/handlers/TaskMentionSyncHandler";
import { taskMentionStore } from "./stores/taskMentionStore";
import { scheduleStore } from "./stores/scheduleStore";
import { dailyPlanningStore } from "./stores/dailyPlanningStore";
import { settingsStore } from "./stores/settingsStore";
import { CommandManager } from "./services/CommandManager";
import {
  NoteManagers,
  type NoteTypeRegistration,
  type NoteTypeConfig,
} from "./services/NoteManagers";
import { FileManager } from "./services/FileManager";
import { ContextService } from "./services/ContextService";

// Re-export types for backward compatibility
export type { TaskSyncSettings, TaskType, TaskTypeColor };
export { TASK_TYPE_COLORS };

// File context interface for context-aware modal
export interface FileContext {
  type: "project" | "area" | "task" | "daily" | "none";
  name?: string;
  path?: string;
  dailyPlanningMode?: boolean; // Whether Daily Planning wizard is currently active
}

// Todo item detection interface
export interface TodoItem {
  text: string;
  completed: boolean;
  indentation: string;
  listMarker: string;
  lineNumber: number;
}

// Extended todo item with parent information
export interface TodoItemWithParent extends TodoItem {
  parentTodo?: TodoItem;
}

/**
 * Setup NoteManagers with default note types
 * Registers note types with their manager classes without instantiating them
 */
function setupNoteManagers(
  app: App,
  vault: Vault,
  settings: TaskSyncSettings,
  vaultScanner: VaultScanner
): NoteManagers {
  const noteManagers = new NoteManagers(app, vault, settings, vaultScanner);

  // Register default note types with their manager classes
  noteManagers.registerNoteType("Task", {
    managerClass: TaskFileManager,
  });

  noteManagers.registerNoteType("Area", {
    managerClass: AreaFileManager,
  });

  noteManagers.registerNoteType("Project", {
    managerClass: ProjectFileManager,
  });

  return noteManagers;
}

export default class TaskSyncPlugin
  extends Plugin
  implements NoteTypeRegistration, TaskSyncPluginInterface
{
  settings: TaskSyncSettings;
  private previousSettings: TaskSyncSettings | null = null;
  vaultScanner: VaultScanner;
  baseManager: BaseManager;

  eventManager: EventManager;
  fileChangeListener: FileChangeListener;
  statusDoneHandler: StatusDoneHandler;
  entityCacheHandler: EntityCacheHandler;
  taskStatusSettingsHandler: TaskStatusSettingsHandler;
  cacheManager: CacheManager;
  integrationManager: IntegrationManager;
  appleCalendarService: AppleCalendarService;
  taskSchedulingService: TaskSchedulingService;
  taskImportManager: TaskImportManager;
  todoPromotionService: TodoPromotionService;
  dailyNoteService: DailyNoteService;
  taskTodoMarkdownProcessor: TaskTodoMarkdownProcessor;
  taskMentionDetectionService: TaskMentionDetectionService;
  taskMentionSyncHandler: TaskMentionSyncHandler;
  commandManager: CommandManager;
  noteManagers: NoteManagers;
  contextService: ContextService;
  private markdownProcessor: MarkdownPostProcessor;

  public get stores(): {
    taskStore: typeof taskStore;
    projectStore: typeof projectStore;
    areaStore: typeof areaStore;
    taskMentionStore: typeof taskMentionStore;
    scheduleStore: typeof scheduleStore;
    dailyPlanningStore: typeof dailyPlanningStore;
    settingsStore: typeof settingsStore;
  } {
    return {
      taskStore: taskStore,
      projectStore: projectStore,
      areaStore: areaStore,
      taskMentionStore: taskMentionStore,
      scheduleStore: scheduleStore,
      dailyPlanningStore: dailyPlanningStore,
      settingsStore: settingsStore,
    };
  }

  // Expose store access methods for e2e testing
  public getCachedTasks() {
    return taskStore.getEntities();
  }

  public getCachedProjects() {
    return projectStore.getEntities();
  }

  public getCachedAreas() {
    return areaStore.getEntities();
  }

  /**
   * Register a note type with corresponding file manager
   * Implements NoteTypeRegistration interface
   */
  public registerNoteType<T extends FileManager>(
    noteType: string,
    config: NoteTypeConfig<T>
  ): void {
    this.noteManagers.registerNoteType(noteType, config);
  }

  /**
   * Backward compatibility getters for e2e tests
   * These delegate to IntegrationManager to maintain test compatibility
   */
  get githubService() {
    return this.integrationManager?.getGitHubService();
  }

  get appleRemindersService() {
    return this.integrationManager?.getAppleRemindersService();
  }

  async onload() {
    console.log("Loading Task Sync Plugin");

    // Load settings
    await this.loadSettings();

    this.vaultScanner = new VaultScanner(this.app.vault, this.settings);
    this.baseManager = new BaseManager(this.app, this.app.vault, this.settings);

    // Initialize context service
    this.contextService = new ContextService(this.app, this.settings);

    // Initialize cache manager
    this.cacheManager = new CacheManager(this);

    // Initialize Apple Calendar service
    this.appleCalendarService = new AppleCalendarService(this.settings);
    await this.appleCalendarService.initialize(this.cacheManager);

    // Initialize Task Scheduling service
    this.taskSchedulingService = new TaskSchedulingService(this.settings);
    await this.taskSchedulingService.initialize(this.cacheManager);
    this.taskSchedulingService.setCalendarService(this.appleCalendarService);

    // Initialize NoteManagers and register note types
    this.noteManagers = setupNoteManagers(
      this.app,
      this.app.vault,
      this.settings,
      this.vaultScanner
    );
    await this.noteManagers.initialize();

    // Initialize import services with dependencies
    this.taskImportManager = new TaskImportManager(
      this.app,
      this.app.vault,
      this.settings,
      this.noteManagers
    );

    // Initialize TodoPromotionService
    this.todoPromotionService = new TodoPromotionService(
      this.app,
      this.settings,
      this.noteManagers,
      this.baseManager,
      (taskData: any) => this.createTask(taskData),
      () => this.detectCurrentFileContext(),
      () => this.refreshBaseViews()
    );

    // Initialize DailyNoteService
    this.dailyNoteService = new DailyNoteService(
      this.app,
      this.app.vault,
      this.settings
    );

    // Initialize TaskTodoMarkdownProcessor
    this.taskTodoMarkdownProcessor = new TaskTodoMarkdownProcessor(
      this.app,
      this.settings,
      this.noteManagers
    );

    // Initialize stores - this will set up the basic structure
    // Full population will happen in onLayoutReady after vault is loaded
    await this.initializeStores();

    // Initialize IntegrationManager to handle reactive service management
    this.integrationManager = new IntegrationManager(
      this.cacheManager,
      this.taskImportManager,
      this.dailyNoteService,
      this.settings
    );

    // Wire up Apple Calendar service with import dependencies
    this.appleCalendarService.setImportDependencies(this.taskImportManager);
    this.appleCalendarService.setDailyNoteService(this.dailyNoteService);

    // Initialize CommandManager with new command system
    this.commandManager = new CommandManager(
      this,
      this.integrationManager,
      this.settings
    );

    // Ensure templates exist
    await this.noteManagers.ensureAllTemplatesExist();

    // Initialize event system
    this.eventManager = new EventManager();
    this.statusDoneHandler = new StatusDoneHandler(this.app, this.settings);
    this.entityCacheHandler = new EntityCacheHandler(this.app, this.settings);

    // Initialize task mention services
    this.taskMentionDetectionService = new TaskMentionDetectionService(
      this.app,
      this.settings,
      this.eventManager
    );
    this.taskMentionSyncHandler = new TaskMentionSyncHandler(
      this.app,
      this.settings,
      this.noteManagers
    );

    this.fileChangeListener = new FileChangeListener(
      this.app,
      this.app.vault,
      this.eventManager,
      this.settings
    );

    // Connect task mention detection service to file change listener
    this.fileChangeListener.setTaskMentionDetectionService(
      this.taskMentionDetectionService
    );

    // Initialize task status settings handler (GitHub and Apple Reminders handlers are now managed by their services)
    this.taskStatusSettingsHandler = new TaskStatusSettingsHandler(
      this.statusDoneHandler
    );

    // Register event handlers (GitHub and Apple Reminders handlers are now registered by their services)
    this.eventManager.registerHandler(this.statusDoneHandler);
    this.eventManager.registerHandler(this.entityCacheHandler);
    this.eventManager.registerHandler(this.taskStatusSettingsHandler);
    this.eventManager.registerHandler(this.taskMentionSyncHandler);

    // Initialize file change listener
    await this.fileChangeListener.initialize();

    // Initialize context tracking system
    this.initializeContextTracking();

    // Initialize Svelte context store
    initializeContextStore(this);

    // Add settings tab
    this.addSettingTab(new TaskSyncSettingTab(this.app, this));

    // Register Tasks view
    this.registerView(
      TASKS_VIEW_TYPE,
      (leaf) =>
        new TasksView(leaf, this.integrationManager, {
          taskImportManager: this.taskImportManager,
          getDefaultImportConfig: () => this.getDefaultImportConfig(),
        })
    );

    // Register Context Tab view
    this.registerView(
      CONTEXT_TAB_VIEW_TYPE,
      (leaf) => new ContextTabView(leaf)
    );

    // Register Task Planning view
    this.registerView(
      TASK_PLANNING_VIEW_TYPE,
      (leaf) =>
        new TaskPlanningView(leaf, this.appleCalendarService, {
          appleCalendarIntegration: this.settings.integrations.appleCalendar,
        })
    );

    // Register Daily Planning view
    this.registerView(
      DAILY_PLANNING_VIEW_TYPE,
      (leaf) =>
        new DailyPlanningView(
          leaf,
          this.appleCalendarService,
          this.dailyNoteService,
          {
            appleCalendarIntegration: this.settings.integrations.appleCalendar,
          }
        )
    );

    // Wait for layout ready, then populate stores and create views
    this.app.workspace.onLayoutReady(async () => {
      await this.populateStoresFromVault();

      // Initialize views after stores are populated
      this.initializeTasksView();
      this.initializeContextTabView();
      this.initializeTaskPlanningView();

      // Register markdown processor after layout is ready
      this.registerTaskTodoMarkdownProcessor();

      // Initialize CommandManager to handle all command registration
      this.commandManager.initialize();
    });
  }

  async onunload() {
    await taskStore.saveData();
    await projectStore.saveData();
    await areaStore.saveData();
    await taskMentionStore.saveData();

    // Cache manager doesn't need explicit unload - data is saved automatically

    if (this.commandManager) {
      this.commandManager.cleanup();
    }

    if (this.noteManagers) {
      this.noteManagers.cleanup();
    }

    if (this.fileChangeListener) {
      this.fileChangeListener.cleanup();
    }

    // Cleanup integration manager and all services
    if (this.integrationManager) {
      this.integrationManager.cleanup();
    }

    // Cleanup Apple Calendar service
    if (this.appleCalendarService) {
      this.appleCalendarService.cleanup();
    }

    if (this.eventManager) {
      this.eventManager.clear();
    }

    // Unregister markdown processor
    this.unregisterTaskTodoMarkdownProcessor();
  }

  async loadSettings() {
    const loadedData = await this.loadData();

    if (!loadedData) {
      // First time installation - use defaults and save them
      console.log(
        "Task Sync: First time installation, creating default settings"
      );
      this.settings = { ...DEFAULT_SETTINGS };
      await this.saveData(this.settings);
    } else {
      // Settings exist - load them and migrate if needed
      this.settings = loadedData as TaskSyncSettings;
      await this.migrateSettings();
    }

    // Initialize previous settings for comparison
    this.previousSettings = { ...this.settings };

    // Initialize settings store with loaded settings
    settingsStore.initialize(this.settings);

    this.validateSettings();
  }

  /**
   * Migrate settings when new properties are added
   */
  private async migrateSettings(): Promise<void> {
    let needsSave = false;

    // Migrate from old flat settings structure to new integrations structure
    if (!this.settings.integrations) {
      console.log(
        "Task Sync: Migrating from old flat settings structure to new integrations structure"
      );
      this.settings.integrations = {
        github: { ...DEFAULT_SETTINGS.integrations.github },
        appleReminders: { ...DEFAULT_SETTINGS.integrations.appleReminders },
        appleCalendar: { ...DEFAULT_SETTINGS.integrations.appleCalendar },
      };

      // Migrate old flat integration settings if they exist
      const oldSettings = this.settings as any;
      if (oldSettings.githubIntegration) {
        this.settings.integrations.github = {
          ...oldSettings.githubIntegration,
        };
        delete oldSettings.githubIntegration;
      }
      if (oldSettings.appleRemindersIntegration) {
        this.settings.integrations.appleReminders = {
          ...oldSettings.appleRemindersIntegration,
        };
        delete oldSettings.appleRemindersIntegration;
      }
      if (oldSettings.appleCalendarIntegration) {
        this.settings.integrations.appleCalendar = {
          ...oldSettings.appleCalendarIntegration,
        };
        delete oldSettings.appleCalendarIntegration;
      }

      needsSave = true;
    }

    // Check if appleCalendarIntegration is missing or has missing properties
    if (this.settings.integrations.appleCalendar) {
      const defaults = DEFAULT_SETTINGS.integrations.appleCalendar;
      const current = this.settings.integrations.appleCalendar;

      if (typeof current.startHour === "undefined") {
        current.startHour = defaults.startHour;
        needsSave = true;
      }
      if (typeof current.endHour === "undefined") {
        current.endHour = defaults.endHour;
        needsSave = true;
      }
      if (typeof current.timeIncrement === "undefined") {
        current.timeIncrement = defaults.timeIncrement;
        needsSave = true;
      }
      if (typeof current.schedulingEnabled === "undefined") {
        current.schedulingEnabled = defaults.schedulingEnabled;
        needsSave = true;
      }
      if (typeof current.defaultSchedulingCalendar === "undefined") {
        current.defaultSchedulingCalendar = defaults.defaultSchedulingCalendar;
        needsSave = true;
      }
      if (typeof current.defaultEventDuration === "undefined") {
        current.defaultEventDuration = defaults.defaultEventDuration;
        needsSave = true;
      }
      if (!Array.isArray(current.defaultReminders)) {
        current.defaultReminders = [...defaults.defaultReminders];
        needsSave = true;
      }
      if (typeof current.includeTaskDetailsInEvent === "undefined") {
        current.includeTaskDetailsInEvent = defaults.includeTaskDetailsInEvent;
        needsSave = true;
      }
    } else {
      // Missing entire appleCalendarIntegration object
      this.settings.integrations.appleCalendar = {
        ...DEFAULT_SETTINGS.integrations.appleCalendar,
      };
      needsSave = true;
    }

    // Check if appleRemindersIntegration is missing
    if (!this.settings.integrations.appleReminders) {
      this.settings.integrations.appleReminders = {
        ...DEFAULT_SETTINGS.integrations.appleReminders,
      };
      needsSave = true;
    }

    // Check if githubIntegration is missing
    if (!this.settings.integrations.github) {
      this.settings.integrations.github = {
        ...DEFAULT_SETTINGS.integrations.github,
      };
      needsSave = true;
    }

    // Migrate taskPropertyOrder to include any missing properties
    if (this.settings.taskPropertyOrder) {
      const currentProperties = new Set(this.settings.taskPropertyOrder);
      const requiredProperties = PROPERTY_SETS.TASK_FRONTMATTER;
      const missingProperties = requiredProperties.filter(
        (prop) => !currentProperties.has(prop)
      );

      if (missingProperties.length > 0) {
        // Add missing properties to the end of the current order
        this.settings.taskPropertyOrder = [
          ...this.settings.taskPropertyOrder,
          ...missingProperties,
        ];
        needsSave = true;
        console.log(
          `Task Sync: Added missing properties to taskPropertyOrder: ${missingProperties.join(
            ", "
          )}`
        );
      }
    } else {
      // If taskPropertyOrder is missing entirely, use the default
      this.settings.taskPropertyOrder = [...DEFAULT_SETTINGS.taskPropertyOrder];
      needsSave = true;
      console.log(
        "Task Sync: Initialized missing taskPropertyOrder with defaults"
      );
    }

    // Add other migration checks here as needed for future updates

    if (needsSave) {
      console.log("Task Sync: Migrated settings to include new properties");
      await this.saveData(this.settings);
    }
  }

  async saveSettings() {
    this.validateSettings();

    // Store previous settings for comparison
    const oldSettings = this.previousSettings
      ? { ...this.previousSettings }
      : null;

    await this.saveData(this.settings);

    // Update settings store with new settings
    settingsStore.updateSettings(this.settings);

    // Emit settings change events for different sections
    if (this.eventManager && oldSettings) {
      await this.emitSettingsChangeEvents(oldSettings, this.settings);
    }

    // Update previous settings for next comparison
    this.previousSettings = { ...this.settings };

    // Update handlers that don't use the event system yet
    if (this.statusDoneHandler) {
      this.statusDoneHandler.updateSettings(this.settings);
    }

    if (this.taskImportManager) {
      this.taskImportManager.updateSettings(this.settings);
    }

    if (this.contextService) {
      this.contextService.updateSettings(this.settings);
    }

    // TasksView settings are now reactive through the settings store
    // No manual update needed

    // Update Task Planning views
    const taskPlanningLeaves = this.app.workspace.getLeavesOfType(
      TASK_PLANNING_VIEW_TYPE
    );
    taskPlanningLeaves.forEach((leaf) => {
      const view = leaf.view as TaskPlanningView;
      if (view && view.updateSettings) {
        view.updateSettings({
          appleCalendarIntegration: this.settings.integrations.appleCalendar,
        });
      }
    });

    // Update other managers
    // Template management is now handled by individual file managers through NoteManagers

    if (this.baseManager) {
      this.baseManager.updateSettings(this.settings);
    }

    if (this.noteManagers) {
      this.noteManagers.updateSettings(this.settings);
    }
  }

  /**
   * Emit settings change events for different sections
   */
  private async emitSettingsChangeEvents(
    oldSettings: TaskSyncSettings,
    newSettings: TaskSyncSettings
  ): Promise<void> {
    // Define the settings sections we want to track
    const settingsSections = [
      "githubIntegration",
      "appleRemindersIntegration",
      "taskTypes",
      "taskPriorities",
      "taskStatuses",
      "templateFolder",
      "basesFolder",
    ];

    for (const section of settingsSections) {
      const oldSectionSettings = (oldSettings as any)[section];
      const newSectionSettings = (newSettings as any)[section];

      // Check if this section has actually changed
      const hasChanges =
        JSON.stringify(oldSectionSettings) !==
        JSON.stringify(newSectionSettings);

      // Emit event for this section
      const eventData: SettingsChangedEventData = {
        section,
        oldSettings: oldSectionSettings,
        newSettings: newSectionSettings,
        hasChanges,
      };

      await this.eventManager.emit(EventType.SETTINGS_CHANGED, eventData);
    }
  }

  private validateSettings() {
    // Validate folder names (allow empty strings but ensure they're strings)
    const folderFields = [
      "tasksFolder",
      "projectsFolder",
      "areasFolder",
      "templateFolder",
    ];
    folderFields.forEach((field) => {
      const folderPath = this.settings[
        field as keyof TaskSyncSettings
      ] as string;

      if (typeof folderPath !== "string") {
        console.warn(`Task Sync: Invalid ${field}, using default`);
        (this.settings as any)[field] = (DEFAULT_SETTINGS as any)[field];
        return;
      }

      // Validate folder path using validation function
      const validation = validateFolderPath(folderPath);
      if (!validation.isValid) {
        console.error(`Task Sync: Invalid ${field}: ${validation.error}`);
        console.warn(`Task Sync: Resetting ${field} to default value`);
        (this.settings as any)[field] = (DEFAULT_SETTINGS as any)[field];
      }
    });

    // Validate template settings - these are MANDATORY and cannot be empty
    const templateFields = [
      "defaultTaskTemplate",
      "defaultProjectTemplate",
      "defaultAreaTemplate",
      "defaultParentTaskTemplate",
    ];
    templateFields.forEach((field) => {
      const templateName = this.settings[
        field as keyof TaskSyncSettings
      ] as string;

      if (
        !templateName ||
        typeof templateName !== "string" ||
        templateName.trim() === ""
      ) {
        console.warn(
          `Task Sync: Template setting ${field} is empty or invalid, using default`
        );
        (this.settings as any)[field] = (DEFAULT_SETTINGS as any)[field];
      }
    });

    // Validate critical arrays - these are MANDATORY and cannot be empty
    if (
      !Array.isArray(this.settings.taskTypes) ||
      this.settings.taskTypes.length === 0
    ) {
      console.warn(`Task Sync: taskTypes is empty or invalid, using defaults`);
      this.settings.taskTypes = [...DEFAULT_SETTINGS.taskTypes];
    }

    if (
      !Array.isArray(this.settings.taskPriorities) ||
      this.settings.taskPriorities.length === 0
    ) {
      console.warn(
        `Task Sync: taskPriorities is empty or invalid, using defaults`
      );
      this.settings.taskPriorities = [...DEFAULT_SETTINGS.taskPriorities];
    }

    if (
      !Array.isArray(this.settings.taskStatuses) ||
      this.settings.taskStatuses.length === 0
    ) {
      console.warn(
        `Task Sync: taskStatuses is empty or invalid, using defaults`
      );
      this.settings.taskStatuses = [...DEFAULT_SETTINGS.taskStatuses];
    }

    if (
      !Array.isArray(this.settings.taskPropertyOrder) ||
      this.settings.taskPropertyOrder.length === 0
    ) {
      console.warn(
        `Task Sync: taskPropertyOrder is empty or invalid, using defaults`
      );
      this.settings.taskPropertyOrder = [...DEFAULT_SETTINGS.taskPropertyOrder];
    }
  }

  /**
   * Initialize Tasks view in the right sidebar if it doesn't already exist
   */
  private async initializeTasksView(): Promise<void> {
    const existingLeaves = this.app.workspace.getLeavesOfType(TASKS_VIEW_TYPE);

    if (existingLeaves.length > 0) {
      console.log("✅ Tasks view already exists, skipping creation");
      return;
    }

    const rightLeaf = this.app.workspace.getRightLeaf(false);

    await rightLeaf.setViewState({
      type: TASKS_VIEW_TYPE,
      active: false,
    });
  }

  /**
   * Initialize Context Tab view in the right sidebar if it doesn't already exist
   */
  private async initializeContextTabView(): Promise<void> {
    const existingLeaves = this.app.workspace.getLeavesOfType(
      CONTEXT_TAB_VIEW_TYPE
    );

    if (existingLeaves.length > 0) {
      console.log("✅ Context Tab view already exists, skipping creation");
      return; // View already exists
    }

    const rightLeaf = this.app.workspace.getRightLeaf(false);

    await rightLeaf.setViewState({
      type: CONTEXT_TAB_VIEW_TYPE,
      active: false,
    });
  }

  /**
   * Initialize Task Planning view in the right sidebar if it doesn't already exist
   */
  private async initializeTaskPlanningView(): Promise<void> {
    const existingLeaves = this.app.workspace.getLeavesOfType(
      TASK_PLANNING_VIEW_TYPE
    );

    if (existingLeaves.length > 0) {
      console.log("✅ Task Planning view already exists, skipping creation");
      return; // View already exists
    }

    const rightLeaf = this.app.workspace.getRightLeaf(false);

    await rightLeaf.setViewState({
      type: TASK_PLANNING_VIEW_TYPE,
      active: false,
    });
  }

  public detectCurrentFileContext(): FileContext {
    return this.contextService.detectCurrentFileContext();
  }

  /**
   * Initialize context tracking system
   */
  private initializeContextTracking(): void {
    // Update context when active file changes
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        this.updateCurrentContext();
      })
    );

    // Update context when file is opened
    this.registerEvent(
      this.app.workspace.on("file-open", () => {
        this.updateCurrentContext();
      })
    );

    // Set initial context
    this.updateCurrentContext();
  }

  /**
   * Update the current context based on active file
   */
  private updateCurrentContext(): void {
    const newContext = this.detectCurrentFileContext();

    // Get current context from store to compare
    const currentStoreContext = get(currentFileContext);

    // Only update if context actually changed (preserve dailyPlanningMode)
    if (
      currentStoreContext.type !== newContext.type ||
      currentStoreContext.name !== newContext.name ||
      currentStoreContext.path !== newContext.path
    ) {
      // Update the context store, preserving dailyPlanningMode
      currentFileContext.update((context) => ({
        ...newContext,
        dailyPlanningMode: context.dailyPlanningMode || false,
      }));
      console.log("🔄 Context updated:", newContext);
    }
  }

  /**
   * Get the current context
   */
  getCurrentContext(): FileContext {
    // Get the current context from the store to include daily planning mode
    return get(currentFileContext);
  }

  // Create a new task
  async createTask(taskData: any): Promise<Task> {
    const content = taskData.content || taskData.description;
    const source = taskData.source; // Extract source before creating file

    const taskFileManager = this.noteManagers.getTaskManager()!;
    const filePath = await taskFileManager.createTaskFile(taskData, content);
    const file = this.app.vault.getAbstractFileByPath(filePath) as TFile;

    await taskFileManager.waitForMetadataCache(file);

    // Set source if provided (for todo promotion and other internal sources)
    if (source) {
      await this.stores.taskStore.setTaskSource(filePath, source);
    }

    const task = this.stores.taskStore.findEntityByPath(filePath);
    if (!task) {
      throw new Error(
        `Failed to create task: Task not found in store after creation at path ${filePath}`
      );
    }

    return task;
  }

  /**
   * Create a new area
   */
  public async createArea(areaData: AreaCreateData): Promise<Area> {
    const areaCreationData = {
      name: areaData.name,
      description: areaData.description,
    };

    const areaFileManager = this.noteManagers.getAreaManager()!;
    const filePath = await areaFileManager.createAreaFile(areaCreationData);
    const file = this.app.vault.getAbstractFileByPath(filePath) as TFile;

    // Wait for metadata cache to be updated
    await areaFileManager.waitForMetadataCache(file);

    // Load the entity directly from the file manager
    const area = await areaFileManager.loadEntity(file);

    // Add the entity to the store
    await this.stores.areaStore.upsertEntity(area);

    if (
      this.settings.areaBasesEnabled &&
      this.settings.autoSyncAreaProjectBases
    ) {
      await this.baseManager.createOrUpdateAreaBase({
        name: areaData.name,
        path: area.filePath,
        type: "area",
      });
    }

    return area;
  }

  /**
   * Create a new project
   */
  public async createProject(projectData: ProjectCreateData): Promise<Project> {
    const projectCreationData = {
      name: projectData.name,
      description: projectData.description,
      areas: projectData.areas,
    };

    const projectFileManager = this.noteManagers.getProjectManager()!;
    const filePath = await projectFileManager.createProjectFile(
      projectCreationData
    );
    const file = this.app.vault.getAbstractFileByPath(filePath) as TFile;

    // Wait for metadata cache to be updated
    await projectFileManager.waitForMetadataCache(file);

    // Load the entity directly from the file manager
    const project = await projectFileManager.loadEntity(file);

    // Add the entity to the store
    await this.stores.projectStore.upsertEntity(project);

    if (
      this.settings.projectBasesEnabled &&
      this.settings.autoSyncAreaProjectBases
    ) {
      await this.baseManager.createOrUpdateProjectBase({
        name: projectData.name,
        path: project.filePath,
        type: "project",
      });
    }

    return project;
  }

  // Base Management Methods

  /**
   * Comprehensive refresh operation - updates file properties and regenerates bases
   */
  public async refresh(): Promise<void> {
    const results = {
      filesUpdated: 0,
      propertiesUpdated: 0,
      basesRegenerated: 0,
      templatesUpdated: 0,
      errors: [] as string[],
    };

    await this.updateFileProperties(results);
    await this.updateTemplateFiles(results);
    await this.regenerateBases();

    results.basesRegenerated = 1;

    this.showRefreshResults(results);
  }

  /**
   * Update properties in all task, project, and area files to match current schema
   */
  private async updateFileProperties(results: any): Promise<void> {
    await this.noteManagers.updateFiles("Task", results);
    await this.noteManagers.updateFiles("Project", results);
    await this.noteManagers.updateFiles("Area", results);
  }

  /**
   * Update template files to match current property order
   */
  private async updateTemplateFiles(results: any): Promise<void> {
    try {
      console.log("Task Sync: Starting template file updates...");

      // Delegate template updates to NoteManagers
      await this.noteManagers.updateAllTemplateFiles(results);

      console.log(
        `Task Sync: Updated ${results.templatesUpdated} template files`
      );
    } catch (error) {
      console.error("Task Sync: Failed to update template files:", error);
      results.errors.push(`Failed to update template files: ${error.message}`);
    }
  }

  /**
   * Show refresh results to the user
   */
  private showRefreshResults(results: any): void {
    const {
      filesUpdated,
      propertiesUpdated,
      basesRegenerated,
      templatesUpdated,
      errors,
    } = results;

    let message = "Refresh completed!\n\n";
    message += `• Files updated: ${filesUpdated}\n`;
    message += `• Properties updated: ${propertiesUpdated}\n`;
    message += `• Templates updated: ${templatesUpdated}\n`;
    message += `• Bases regenerated: ${basesRegenerated}\n`;

    if (errors.length > 0) {
      message += `\nErrors encountered:\n`;
      errors.forEach((error: string) => {
        message += `• ${error}\n`;
      });
    }

    // Show a notice to the user
    new Notice(message, 5000);
    console.log("Task Sync: Refresh results:", results);
  }

  /**
   * Regenerate all base files
   */
  async regenerateBases(): Promise<void> {
    try {
      const projectsAndAreas = await this.baseManager.getProjectsAndAreas();
      await this.baseManager.createOrUpdateTasksBase(projectsAndAreas);

      // Generate individual area and project bases if enabled
      if (this.settings.areaBasesEnabled || this.settings.projectBasesEnabled) {
        await this.baseManager.syncAreaProjectBases();
      }

      // Ensure base embedding in project and area files that don't have individual bases
      for (const item of projectsAndAreas) {
        const shouldHaveIndividualBase =
          (item.type === "area" && this.settings.areaBasesEnabled) ||
          (item.type === "project" && this.settings.projectBasesEnabled);

        if (!shouldHaveIndividualBase) {
          await this.baseManager.ensureBaseEmbedding(item.path);
        }
      }

      console.log("Task Sync: Bases regenerated successfully");
    } catch (error) {
      console.error("Task Sync: Failed to regenerate bases:", error);
    }
  }

  /**
   * Refresh base views (same as regenerate for now)
   */
  public async refreshBaseViews(): Promise<void> {
    await this.regenerateBases();
  }

  /**
   * Get default import configuration with context awareness
   */
  public getDefaultImportConfig(): TaskImportConfig {
    // Use the global context instead of detecting again
    const context = this.getCurrentContext();

    const config: TaskImportConfig = {
      // Don't set taskType here - let label mapping handle it
      importLabelsAsTags: true,
      preserveAssignee: true,
    };

    // Apply context-specific configuration
    if (context.type === "project" && context.name) {
      config.targetProject = context.name;
    } else if (context.type === "area" && context.name) {
      config.targetArea = context.name;
    }

    return config;
  }

  /**
   * Sync area and project bases when settings change
   */
  async syncAreaProjectBases(): Promise<void> {
    try {
      console.log("Syncing area and project bases...");
      await this.baseManager.syncAreaProjectBases();
      console.log("Area and project bases synced successfully");
    } catch (error) {
      console.error("Failed to sync area and project bases:", error);
      throw error;
    }
  }

  /**
   * Initialize stores with basic setup (no file scanning)
   */
  private async initializeStores(): Promise<void> {
    await taskStore.initialize(
      this.app,
      this,
      this.settings.tasksFolder,
      this.noteManagers.getTaskManager()!
    );
    await projectStore.initialize(
      this.app,
      this,
      this.settings.projectsFolder,
      this.noteManagers.getProjectManager()!
    );
    await areaStore.initialize(
      this.app,
      this,
      this.settings.areasFolder,
      this.noteManagers.getAreaManager()!
    );
  }

  /**
   * Populate stores from vault after layout is ready
   */
  private async populateStoresFromVault(): Promise<void> {
    console.log("Populating stores from vault...");

    // Initialize task mention store
    taskMentionStore.initialize(this.app, this, "");

    // Refresh all stores to load existing files
    await taskStore.refreshEntities();
    await projectStore.refreshEntities();
    await areaStore.refreshEntities();
    await taskMentionStore.refreshEntities();

    // Initialize schedule store after entity stores are refreshed
    // This prevents empty schedule.tasks during rehydration
    await scheduleStore.initialize(this.app, this);

    console.log("Stores populated from vault");
  }

  /**
   * Register the task todo markdown processor
   */
  private registerTaskTodoMarkdownProcessor(): void {
    if (this.taskTodoMarkdownProcessor) {
      this.markdownProcessor = this.registerMarkdownPostProcessor(
        this.taskTodoMarkdownProcessor.getProcessor(),
        100 // Sort order - run after other processors
      );
      console.log("Task todo markdown processor registered");
    }
  }

  /**
   * Unregister the task todo markdown processor
   */
  private unregisterTaskTodoMarkdownProcessor(): void {
    if (this.markdownProcessor) {
      // Note: Obsidian doesn't provide a direct unregister method for post processors
      // The processor will be automatically cleaned up when the plugin unloads
      this.markdownProcessor = null;
      console.log("Task todo markdown processor unregistered");
    }
  }
}
