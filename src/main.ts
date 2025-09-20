import {
  Plugin,
  TFile,
  Notice,
  Modal,
  App,
  Vault,
  MarkdownPostProcessor,
} from "obsidian";
import { VaultScanner } from "./services/VaultScannerService";
import { BaseManager } from "./services/BaseManager";

import { FileChangeListener } from "./services/FileChangeListener";
import { TemplateManager } from "./services/TemplateManager";
import { TaskFileManager } from "./services/TaskFileManager";
import { TaskTodoMarkdownProcessor } from "./services/TaskTodoMarkdownProcessor";
import { AreaFileManager } from "./services/AreaFileManager";
import { ProjectFileManager } from "./services/ProjectFileManager";
import { TaskCreateModalWrapper } from "./components/svelte/TaskCreateModalWrapper";
import {
  AreaCreateModal,
  AreaCreateData,
} from "./components/modals/AreaCreateModal";
import {
  ProjectCreateModal,
  ProjectCreateData,
} from "./components/modals/ProjectCreateModal";
import {
  TaskScheduleModal,
  TaskScheduleData,
} from "./components/modals/TaskScheduleModal";

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
import {
  GitHubSettingsHandler,
  AppleRemindersSettingsHandler,
  TaskStatusSettingsHandler,
} from "./events/handlers/SettingsChangeHandler";
import {
  DEFAULT_SETTINGS,
  TASK_TYPE_COLORS,
  validateFolderPath,
} from "./components/ui/settings";
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
import {
  CommandManager,
  type CommandCallbacks,
} from "./services/CommandManager";
import {
  NoteManagers,
  type NoteTypeRegistration,
  type NoteTypeConfig,
} from "./services/NoteManagers";
import { FileManager } from "./services/FileManager";

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
  implements NoteTypeRegistration
{
  settings: TaskSyncSettings;
  private previousSettings: TaskSyncSettings | null = null;
  vaultScanner: VaultScanner;
  baseManager: BaseManager;
  templateManager: TemplateManager;

  eventManager: EventManager;
  fileChangeListener: FileChangeListener;
  statusDoneHandler: StatusDoneHandler;
  entityCacheHandler: EntityCacheHandler;
  githubSettingsHandler: GitHubSettingsHandler;
  appleRemindersSettingsHandler: AppleRemindersSettingsHandler;
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
  private markdownProcessor: MarkdownPostProcessor;
  commandManager: CommandManager;
  noteManagers: NoteManagers;

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

  // Wait for store refresh operations to complete
  private async waitForStoreRefresh() {
    await Promise.all([
      taskStore.waitForRefresh(),
      projectStore.waitForRefresh(),
      areaStore.waitForRefresh(),
    ]);
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

  /**
   * Create command callbacks for CommandManager
   */
  private createCommandCallbacks(): CommandCallbacks {
    return {
      openTaskCreateModal: () => this.openTaskCreateModal(),
      openAreaCreateModal: () => this.openAreaCreateModal(),
      openProjectCreateModal: () => this.openProjectCreateModal(),
      refresh: () => this.refresh(),
      refreshBaseViews: () => this.refreshBaseViews(),
      promoteTodoToTask: () => this.todoPromotionService.promoteTodoToTask(),
      revertPromotedTodo: () => this.todoPromotionService.revertPromotedTodo(),
      addCurrentTaskToToday: () => this.addCurrentTaskToToday(),
      activateTasksView: () => this.activateTasksView(),
      activateContextTabView: () => this.activateContextTabView(),
      activateTaskPlanningView: () => this.activateTaskPlanningView(),
      startDailyPlanning: () => this.startDailyPlanning(),
      importGitHubIssue: () => this.importGitHubIssue(),
      importAllGitHubIssues: () => this.importAllGitHubIssues(),
      importAppleReminders: () => this.importAppleReminders(),
      checkAppleRemindersPermissions: () =>
        this.checkAppleRemindersPermissions(),
      insertCalendarEvents: () => this.insertCalendarEvents(),
      checkAppleCalendarPermissions: () => this.checkAppleCalendarPermissions(),
      scheduleCurrentTask: () => this.scheduleCurrentTask(),
      clearAllCaches: () => this.cacheManager.clearAllCaches(),
      getStats: () => this.cacheManager.getStats(),
      isAppleCalendarPlatformSupported: () =>
        this.appleCalendarService.isPlatformSupported(),
    };
  }

  async onload() {
    console.log("Loading Task Sync Plugin");

    // Load settings
    await this.loadSettings();

    this.vaultScanner = new VaultScanner(this.app.vault, this.settings);
    this.baseManager = new BaseManager(this.app, this.app.vault, this.settings);
    this.templateManager = new TemplateManager(
      this.app,
      this.app.vault,
      this.settings
    );

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
      this.templateManager,
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

    // Initialize CommandManager with callbacks
    this.commandManager = new CommandManager(
      this,
      this.integrationManager,
      this.createCommandCallbacks(),
      this.settings
    );

    // Ensure templates exist
    await this.templateManager.ensureTemplatesExist();

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

    // Initialize settings change handlers
    this.githubSettingsHandler = new GitHubSettingsHandler(
      this.integrationManager.getGitHubService()
    );
    this.appleRemindersSettingsHandler = new AppleRemindersSettingsHandler(
      this.integrationManager.getAppleRemindersService()
    );
    this.taskStatusSettingsHandler = new TaskStatusSettingsHandler(
      this.statusDoneHandler
    );

    // Register event handlers
    this.eventManager.registerHandler(this.statusDoneHandler);
    this.eventManager.registerHandler(this.entityCacheHandler);
    this.eventManager.registerHandler(this.githubSettingsHandler);
    this.eventManager.registerHandler(this.appleRemindersSettingsHandler);
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
          appleCalendarIntegration: this.settings.appleCalendarIntegration,
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
            appleCalendarIntegration: this.settings.appleCalendarIntegration,
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

    // Check if appleCalendarIntegration is missing or has missing properties
    if (this.settings.appleCalendarIntegration) {
      const defaults = DEFAULT_SETTINGS.appleCalendarIntegration;
      const current = this.settings.appleCalendarIntegration;

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
      this.settings.appleCalendarIntegration = {
        ...DEFAULT_SETTINGS.appleCalendarIntegration,
      };
      needsSave = true;
    }

    // Check if appleRemindersIntegration is missing
    if (!this.settings.appleRemindersIntegration) {
      this.settings.appleRemindersIntegration = {
        ...DEFAULT_SETTINGS.appleRemindersIntegration,
      };
      needsSave = true;
    }

    // Check if githubIntegration is missing
    if (!this.settings.githubIntegration) {
      this.settings.githubIntegration = {
        ...DEFAULT_SETTINGS.githubIntegration,
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

  async saveSettings(skipTemplateUpdate = false) {
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
          appleCalendarIntegration: this.settings.appleCalendarIntegration,
        });
      }
    });

    // Update other managers
    if (this.templateManager) {
      this.templateManager.updateSettings(this.settings);
    }

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

  // UI Methods
  private async openTaskCreateModal(): Promise<void> {
    const context = this.detectCurrentFileContext();

    const modal = new TaskCreateModalWrapper(
      this,
      context,
      {},
      async (taskData) => {
        await this.createTask(taskData);

        if (this.settings.autoUpdateBaseViews) {
          await this.refreshBaseViews();
        }
      }
    );

    modal.open();
  }

  /**
   * Open area creation modal
   */
  private openAreaCreateModal(): void {
    const modal = new AreaCreateModal(this.app, this);

    modal.onSubmit(async (areaData) => {
      await this.createArea(areaData);

      if (this.settings.autoUpdateBaseViews) {
        await this.refreshBaseViews();
      }
    });

    modal.open();
  }

  /**
   * Open project creation modal
   */
  private openProjectCreateModal(): void {
    const modal = new ProjectCreateModal(this.app, this);

    modal.onSubmit(async (projectData) => {
      await this.createProject(projectData);

      if (this.settings.autoUpdateBaseViews) {
        await this.refreshBaseViews();
      }
    });

    modal.open();
  }

  /**
   * Schedule the current task as a calendar event
   */
  private async scheduleCurrentTask(): Promise<void> {
    if (!this.taskSchedulingService.isEnabled()) {
      new Notice(
        "Task scheduling is not enabled. Please configure it in settings."
      );
      return;
    }

    // Get the current file and check if it's a task
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) {
      new Notice("No active file. Please open a task file to schedule.");
      return;
    }

    // Check if the current file is a task
    const task = taskStore.findEntityByPath(activeFile.path);
    if (!task) {
      new Notice(
        "Current file is not a task. Please open a task file to schedule."
      );
      return;
    }

    // Check if task is already scheduled
    const isScheduled = await this.taskSchedulingService.isTaskScheduled(
      task.filePath || ""
    );
    if (isScheduled) {
      new Notice("This task is already scheduled.");
      return;
    }

    // Open the scheduling modal
    const modal = new TaskScheduleModal(this.app, this, task);

    modal.onSubmit(async (scheduleData) => {
      await this.scheduleTask(task, scheduleData);
    });

    modal.open();
  }

  /**
   * Schedule a task with the given configuration
   */
  private async scheduleTask(
    task: Task,
    scheduleData: TaskScheduleData
  ): Promise<void> {
    try {
      new Notice("Scheduling task...");

      const config = {
        targetCalendar: scheduleData.targetCalendar,
        startDate: scheduleData.startDate,
        endDate: scheduleData.endDate,
        allDay: scheduleData.allDay,
        location: scheduleData.location,
        notes: scheduleData.notes,
        includeTaskDetails: scheduleData.includeTaskDetails,
        reminders: scheduleData.reminders,
      };

      const result = await this.taskSchedulingService.scheduleTask(
        task,
        config
      );

      if (result.success) {
        new Notice(
          `✅ Task scheduled successfully in ${scheduleData.targetCalendar}`
        );

        // Optionally refresh any open calendar views
        // This could be extended to refresh calendar views if needed
      } else {
        new Notice(`❌ Failed to schedule task: ${result.error}`);
      }
    } catch (error: any) {
      console.error("Failed to schedule task:", error);
      new Notice(`❌ Failed to schedule task: ${error.message}`);
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

  /**
   * Activate the Tasks view (bring it to focus)
   */
  private async activateTasksView(): Promise<void> {
    const existingLeaves = this.app.workspace.getLeavesOfType(TASKS_VIEW_TYPE);

    if (existingLeaves.length > 0) {
      // Ensure right sidebar is expanded
      this.app.workspace.rightSplit.expand();
      // Activate existing view
      this.app.workspace.revealLeaf(existingLeaves[0]);
    } else {
      // Ensure right sidebar is expanded
      this.app.workspace.rightSplit.expand();
      // Create new view in right sidebar
      const rightLeaf = this.app.workspace.getRightLeaf(false);
      await rightLeaf.setViewState({
        type: TASKS_VIEW_TYPE,
        active: true,
      });
    }
  }

  /**
   * Activate the Context Tab view (bring it to focus)
   */
  private async activateContextTabView(): Promise<void> {
    const existingLeaves = this.app.workspace.getLeavesOfType(
      CONTEXT_TAB_VIEW_TYPE
    );

    if (existingLeaves.length > 0) {
      // Ensure right sidebar is expanded
      this.app.workspace.rightSplit.expand();
      // Activate existing view
      this.app.workspace.revealLeaf(existingLeaves[0]);
    } else {
      // Ensure right sidebar is expanded
      this.app.workspace.rightSplit.expand();
      // Create new view in right sidebar
      const rightLeaf = this.app.workspace.getRightLeaf(false);
      await rightLeaf.setViewState({
        type: CONTEXT_TAB_VIEW_TYPE,
        active: true,
      });
    }
  }

  /**
   * Activate the Task Planning view (bring it to focus)
   */
  private async activateTaskPlanningView(): Promise<void> {
    const existingLeaves = this.app.workspace.getLeavesOfType(
      TASK_PLANNING_VIEW_TYPE
    );

    if (existingLeaves.length > 0) {
      // Ensure right sidebar is expanded
      this.app.workspace.rightSplit.expand();
      // Activate existing view
      this.app.workspace.revealLeaf(existingLeaves[0]);
    } else {
      // Ensure right sidebar is expanded
      this.app.workspace.rightSplit.expand();
      // Create new view in right sidebar
      const rightLeaf = this.app.workspace.getRightLeaf(false);
      await rightLeaf.setViewState({
        type: TASK_PLANNING_VIEW_TYPE,
        active: true,
      });
    }
  }

  /**
   * Start daily planning - opens daily note and creates Daily Planning view above it
   */
  private async startDailyPlanning(): Promise<void> {
    try {
      // Ensure today's daily note exists
      const dailyNoteResult =
        await this.dailyNoteService.ensureTodayDailyNote();

      // Open the daily note if it's not already open
      if (dailyNoteResult.file) {
        await this.app.workspace.openLinkText(
          dailyNoteResult.file.path,
          "",
          false
        );
      }

      // Create or activate Daily Planning view above the daily note
      await this.activateDailyPlanningView();
    } catch (error: any) {
      console.error("Error starting daily planning:", error);
      new Notice(`Failed to start daily planning: ${error.message}`);
    }
  }

  /**
   * Activate the Daily Planning view (bring it to focus)
   */
  private async activateDailyPlanningView(): Promise<void> {
    const existingLeaves = this.app.workspace.getLeavesOfType(
      DAILY_PLANNING_VIEW_TYPE
    );

    if (existingLeaves.length > 0) {
      // Activate existing view
      this.app.workspace.revealLeaf(existingLeaves[0]);
    } else {
      // Create new view in main area (above daily note)
      const mainLeaf = this.app.workspace.getLeaf("tab");
      await mainLeaf.setViewState({
        type: DAILY_PLANNING_VIEW_TYPE,
        active: true,
      });
    }
  }

  private detectCurrentFileContext(): FileContext {
    const activeFile = this.app.workspace.getActiveFile();

    if (!activeFile) {
      return { type: "none" };
    }

    const filePath = activeFile.path;
    const fileName = activeFile.name;

    // Check if file is a daily note (format: YYYY-MM-DD anywhere in path or name)
    const dailyNotePattern = /\b\d{4}-\d{2}-\d{2}\b/;
    if (dailyNotePattern.test(filePath) || dailyNotePattern.test(fileName)) {
      return {
        type: "daily",
        name: fileName.replace(".md", ""),
        path: filePath,
      };
    }

    // Check if file is in projects folder
    if (filePath.startsWith(this.settings.projectsFolder + "/")) {
      return {
        type: "project",
        name: fileName.replace(".md", ""),
        path: filePath,
      };
    }

    // Check if file is in areas folder
    if (filePath.startsWith(this.settings.areasFolder + "/")) {
      return {
        type: "area",
        name: fileName.replace(".md", ""),
        path: filePath,
      };
    }

    // Check if file is in tasks folder
    if (filePath.startsWith(this.settings.tasksFolder + "/")) {
      return {
        type: "task",
        name: fileName.replace(".md", ""),
        path: filePath,
      };
    }

    return { type: "none" };
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
    let currentStoreContext: FileContext = { type: "none" };
    currentFileContext.subscribe((context) => {
      currentStoreContext = context;
    })();

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
    let storeContext: FileContext = { type: "none" };
    currentFileContext.subscribe((context) => {
      storeContext = context;
    })();

    return storeContext;
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

    return this.stores.taskStore.findEntityByPath(filePath);
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
  async refresh(): Promise<void> {
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

      // Update each template type using explicit paths from settings
      await this.updateSpecificTemplateFiles(results);

      console.log(
        `Task Sync: Updated ${results.templatesUpdated} template files`
      );
    } catch (error) {
      console.error("Task Sync: Failed to update template files:", error);
      results.errors.push(`Failed to update template files: ${error.message}`);
    }
  }

  /**
   * Update specific template files using explicit paths from settings
   */
  private async updateSpecificTemplateFiles(results: any): Promise<void> {
    try {
      // Update Task template
      await this.updateOrCreateTaskTemplate(results);

      // Update Area template (create only, don't modify existing)
      await this.updateOrCreateAreaTemplate(results);

      // Update Project template (create only, don't modify existing)
      await this.updateOrCreateProjectTemplate(results);

      // Update Parent Task template
      await this.updateOrCreateParentTaskTemplate(results);
    } catch (error) {
      console.error(
        "Task Sync: Failed to update specific template files:",
        error
      );
      results.errors.push(
        `Failed to update specific template files: ${error.message}`
      );
    }
  }

  /**
   * Update or create Task template
   */
  private async updateOrCreateTaskTemplate(results: any): Promise<void> {
    const templatePath = `${this.settings.templateFolder}/${this.settings.defaultTaskTemplate}`;
    const file = this.app.vault.getAbstractFileByPath(templatePath);

    if (file && file instanceof TFile) {
      // Update existing task template with property reordering
      const content = await this.app.vault.read(file);
      const taskFileManager = this.noteManagers.getTaskManager()!;
      const updatedContent =
        await taskFileManager.reorderTaskTemplateProperties(content);
      if (updatedContent !== content) {
        await this.app.vault.modify(file, updatedContent);
        results.templatesUpdated++;
        console.log(`Task Sync: Updated task template ${templatePath}`);
      }
    } else {
      // Create missing task template
      await this.templateManager.createTaskTemplate();
      results.templatesUpdated++;
      console.log(`Task Sync: Created missing task template ${templatePath}`);
    }
  }

  /**
   * Update or create Area template (create only, don't modify existing)
   */
  private async updateOrCreateAreaTemplate(results: any): Promise<void> {
    const templatePath = `${this.settings.templateFolder}/${this.settings.defaultAreaTemplate}`;
    const file = this.app.vault.getAbstractFileByPath(templatePath);

    if (!file) {
      // Create missing area template
      await this.templateManager.createAreaTemplate();
      results.templatesUpdated++;
      console.log(`Task Sync: Created missing area template ${templatePath}`);
    }
    // Don't modify existing area templates to preserve their structure
  }

  /**
   * Update or create Project template (create only, don't modify existing)
   */
  private async updateOrCreateProjectTemplate(results: any): Promise<void> {
    const templatePath = `${this.settings.templateFolder}/${this.settings.defaultProjectTemplate}`;
    const file = this.app.vault.getAbstractFileByPath(templatePath);

    if (!file) {
      // Create missing project template
      await this.templateManager.createProjectTemplate();
      results.templatesUpdated++;
      console.log(
        `Task Sync: Created missing project template ${templatePath}`
      );
    }
    // Don't modify existing project templates to preserve their structure
  }

  /**
   * Update or create Parent Task template
   */
  private async updateOrCreateParentTaskTemplate(results: any): Promise<void> {
    const templatePath = `${this.settings.templateFolder}/${this.settings.defaultParentTaskTemplate}`;
    const file = this.app.vault.getAbstractFileByPath(templatePath);

    if (file && file instanceof TFile) {
      // Update existing parent task template with property reordering
      const content = await this.app.vault.read(file);
      const taskFileManager = this.noteManagers.getTaskManager()!;
      const updatedContent =
        await taskFileManager.reorderTaskTemplateProperties(content);
      if (updatedContent !== content) {
        await this.app.vault.modify(file, updatedContent);
        results.templatesUpdated++;
        console.log(`Task Sync: Updated parent task template ${templatePath}`);
      }
    } else {
      // Create missing parent task template
      await this.templateManager.createParentTaskTemplate();
      results.templatesUpdated++;
      console.log(
        `Task Sync: Created missing parent task template ${templatePath}`
      );
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
  private async refreshBaseViews(): Promise<void> {
    await this.regenerateBases();
  }

  /**
   * Import a single GitHub issue as a task
   */
  private async importGitHubIssue(): Promise<void> {
    const githubService = this.integrationManager.getGitHubService();
    if (!githubService?.isEnabled()) {
      new Notice("GitHub integration is not enabled or configured");
      return;
    }

    try {
      // For now, show a simple prompt for issue URL
      // In a full implementation, this could be a modal with repository selection
      const issueUrl = await this.promptForIssueUrl();
      if (!issueUrl) {
        return;
      }

      const issueData = await this.fetchIssueFromUrl(issueUrl);
      if (!issueData) {
        new Notice("Failed to fetch GitHub issue");
        return;
      }

      // Use default import configuration
      const config = this.getDefaultImportConfig();

      const result = await githubService.importIssueAsTask(
        issueData.issue,
        config,
        issueData.repository
      );

      if (result.success) {
        if (result.skipped) {
          new Notice(`Issue already imported: ${result.reason}`);
        } else {
          new Notice(`Successfully imported issue: ${issueData.issue.title}`);
        }
      } else {
        new Notice(`Failed to import issue: ${result.error}`);
      }
    } catch (error: any) {
      console.error("Failed to import GitHub issue:", error);
      new Notice(`Error importing issue: ${error.message}`);
    }
  }

  /**
   * Import all GitHub issues from the default repository
   */
  private async importAllGitHubIssues(): Promise<void> {
    const githubService = this.integrationManager.getGitHubService();
    if (!githubService?.isEnabled()) {
      new Notice("GitHub integration is not enabled or configured");
      return;
    }

    try {
      const repository = this.settings.githubIntegration.defaultRepository;
      if (!repository) {
        new Notice("No default repository configured");
        return;
      }

      new Notice("Fetching GitHub issues...");

      const issues = await githubService.fetchIssues(repository);
      if (issues.length === 0) {
        new Notice("No issues found in repository");
        return;
      }

      new Notice(`Found ${issues.length} issues. Starting import...`);

      const config = this.getDefaultImportConfig();
      let imported = 0;
      let skipped = 0;
      let failed = 0;

      for (const issue of issues) {
        try {
          const result = await githubService.importIssueAsTask(
            issue,
            config,
            repository
          );

          if (result.success) {
            if (result.skipped) {
              skipped++;
            } else {
              imported++;
            }
          } else {
            failed++;
            console.error(
              `Failed to import issue ${issue.number}:`,
              result.error
            );
          }
        } catch (error: any) {
          failed++;
          console.error(`Error importing issue ${issue.number}:`, error);
        }
      }

      new Notice(
        `Import complete: ${imported} imported, ${skipped} skipped, ${failed} failed`
      );
    } catch (error: any) {
      console.error("Failed to import GitHub issues:", error);
      new Notice(`Error importing issues: ${error.message}`);
    }
  }

  /**
   * Prompt user for GitHub issue URL
   */
  private async promptForIssueUrl(): Promise<string | null> {
    return new Promise((resolve) => {
      const modal = new (class extends Modal {
        result: string | null = null;

        constructor(app: App) {
          super(app);
        }

        onOpen() {
          const { contentEl } = this;
          contentEl.createEl("h2", { text: "Import GitHub Issue" });

          const inputEl = contentEl.createEl("input", {
            type: "text",
            placeholder: "https://github.com/owner/repo/issues/123",
          });
          inputEl.style.width = "100%";
          inputEl.style.marginBottom = "10px";

          const buttonContainer = contentEl.createDiv();
          buttonContainer.style.textAlign = "right";

          const cancelBtn = buttonContainer.createEl("button", {
            text: "Cancel",
          });
          cancelBtn.style.marginRight = "10px";
          cancelBtn.onclick = () => {
            this.result = null;
            this.close();
          };

          const importBtn = buttonContainer.createEl("button", {
            text: "Import",
          });
          importBtn.onclick = () => {
            this.result = inputEl.value.trim();
            this.close();
          };

          inputEl.focus();
          inputEl.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
              this.result = inputEl.value.trim();
              this.close();
            }
          });
        }

        onClose() {
          resolve(this.result);
        }
      })(this.app);

      modal.open();
    });
  }

  /**
   * Fetch GitHub issue from URL
   */
  private async fetchIssueFromUrl(
    url: string
  ): Promise<{ issue: any; repository: string } | null> {
    try {
      const githubService = this.integrationManager.getGitHubService();
      if (!githubService) {
        new Notice("GitHub integration is not available");
        return null;
      }

      // Parse GitHub issue URL
      const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)\/issues\/(\d+)/);
      if (!match) {
        new Notice("Invalid GitHub issue URL format");
        return null;
      }

      const [, owner, repo, issueNumber] = match;
      const repository = `${owner}/${repo}`;

      // Fetch all issues and find the specific one
      // In a full implementation, you'd want to fetch the specific issue directly
      const issues = await githubService.fetchIssues(repository);
      const issue = issues.find((i: any) => i.number === parseInt(issueNumber));

      if (!issue) {
        new Notice(`Issue #${issueNumber} not found in ${repository}`);
        return null;
      }

      return { issue, repository };
    } catch (error: any) {
      console.error("Error fetching issue from URL:", error);
      return null;
    }
  }

  /**
   * Import Apple Reminders as tasks
   */
  private async importAppleReminders(): Promise<void> {
    const appleRemindersService =
      this.integrationManager.getAppleRemindersService();
    if (!appleRemindersService?.isEnabled()) {
      new Notice(
        "Apple Reminders integration is not enabled or not available on this platform"
      );
      return;
    }

    try {
      // Check permissions first
      const permissionResult = await appleRemindersService.checkPermissions();
      if (!permissionResult.success) {
        new Notice(`Permission error: ${permissionResult.error?.message}`);
        return;
      }

      new Notice("Fetching Apple Reminders...");

      // Fetch reminders
      const remindersResult = await appleRemindersService.fetchReminders();

      if (!remindersResult.success) {
        new Notice(
          `Failed to fetch reminders: ${remindersResult.error?.message}`
        );
        return;
      }

      const reminders = remindersResult.data || [];

      if (reminders.length === 0) {
        new Notice("No reminders found");
        return;
      }

      console.log("🍎 Starting import of", reminders.length, "reminders");

      // Import each reminder
      let imported = 0;
      let skipped = 0;
      let failed = 0;

      for (const reminder of reminders) {
        try {
          const config = this.getDefaultImportConfig();

          const result = await appleRemindersService.importReminderAsTask(
            reminder,
            config
          );

          if (result.success) {
            if (result.skipped) {
              skipped++;
            } else {
              imported++;
            }
          } else {
            failed++;
          }
        } catch (error: any) {
          failed++;
        }
      }

      // Wait for file system events to be processed
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Refresh task store to ensure UI is updated
      await taskStore.refreshEntities();

      // Additional delay to ensure UI can process the changes
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Refresh Apple Reminders view if it's open
      const appleRemindersViewMethods = (window as any)
        .__appleRemindersServiceMethods;
      if (appleRemindersViewMethods && appleRemindersViewMethods.refresh) {
        await appleRemindersViewMethods.refresh();
      }

      new Notice(
        `Import complete: ${imported} imported, ${skipped} skipped, ${failed} failed`
      );
    } catch (error: any) {
      new Notice(`Error importing reminders: ${error.message}`);
    }
  }

  /**
   * Check Apple Reminders permissions
   */
  private async checkAppleRemindersPermissions(): Promise<void> {
    const appleRemindersService =
      this.integrationManager.getAppleRemindersService();
    if (!appleRemindersService?.isPlatformSupported()) {
      new Notice("Apple Reminders is only available on macOS");
      return;
    }

    try {
      const result = await appleRemindersService.checkPermissions();

      if (result.success) {
        const permission = result.data;
        switch (permission) {
          case "authorized":
            new Notice("✅ Apple Reminders access is authorized");
            break;
          case "denied":
            new Notice(
              "❌ Apple Reminders access is denied. Please grant permission in System Preferences > Security & Privacy > Privacy > Reminders"
            );
            break;
          case "notDetermined":
            new Notice(
              "⚠️ Apple Reminders permission not determined. Please try importing reminders to trigger permission request."
            );
            break;
          case "restricted":
            new Notice("🔒 Apple Reminders access is restricted");
            break;
        }
      } else {
        new Notice(`Permission check failed: ${result.error?.message}`);
      }
    } catch (error: any) {
      console.error("Error checking Apple Reminders permissions:", error);
      new Notice(`Error checking permissions: ${error.message}`);
    }
  }

  /**
   * Insert calendar events into current daily note
   */
  private async insertCalendarEvents(): Promise<void> {
    if (!this.appleCalendarService.isEnabled()) {
      new Notice(
        "Apple Calendar integration is not enabled. Please configure it in settings."
      );
      return;
    }

    try {
      // Get current daily note or create one
      const dailyNoteResult =
        await this.dailyNoteService.ensureTodayDailyNote();
      if (!dailyNoteResult.file) {
        new Notice("Could not find or create daily note");
        return;
      }
      const dailyNote = dailyNoteResult.file;

      // Get calendar events for today
      const today = new Date();
      const startOfDay = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
      );
      const endOfDay = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() + 1
      );

      const events = await this.appleCalendarService.getTodayEvents();

      if (events.length === 0) {
        new Notice("No calendar events found for today");
        return;
      }

      // Format events
      const { DefaultCalendarEventFormatter } = await import(
        "./services/CalendarEventFormatter"
      );
      const formatter = new DefaultCalendarEventFormatter();

      const config = this.settings.appleCalendarIntegration;
      const formattedEvents = formatter.formatEvents(events, {
        includeTime: true,
        includeLocation: config.includeLocation,
        includeDescription: config.includeNotes,
        timeFormat: config.timeFormat,
        groupByCalendar: true,
        showCalendarName: false,
        markdown: {
          useBullets: true,
          useCheckboxes: false,
          calendarHeaderLevel: 3,
        },
      });

      // Insert into daily note
      const content = await this.app.vault.read(dailyNote);
      const newContent =
        content + "\n\n## Calendar Events\n\n" + formattedEvents + "\n";
      await this.app.vault.modify(dailyNote, newContent);

      new Notice(`Inserted ${events.length} calendar events into daily note`);
    } catch (error: any) {
      console.error("Error inserting calendar events:", error);
      new Notice(`Error inserting calendar events: ${error.message}`);
    }
  }

  /**
   * Check Apple Calendar permissions
   */
  private async checkAppleCalendarPermissions(): Promise<void> {
    try {
      const hasPermissions = await this.appleCalendarService.checkPermissions();

      if (hasPermissions) {
        new Notice("✅ Apple Calendar access is working");
      } else {
        new Notice(
          "❌ Apple Calendar access failed. Please check your credentials in settings."
        );
      }
    } catch (error: any) {
      console.error("Error checking Apple Calendar permissions:", error);
      new Notice(`Error checking permissions: ${error.message}`);
    }
  }

  /**
   * Get default import configuration with context awareness
   */
  getDefaultImportConfig(): TaskImportConfig {
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
   * Add current task to today's daily note
   */
  private async addCurrentTaskToToday(): Promise<void> {
    try {
      // Get the currently active file
      const activeFile = this.app.workspace.getActiveFile();

      if (!activeFile) {
        new Notice("No file is currently open");
        return;
      }

      // Check if the current file is a task
      const frontMatter =
        this.app.metadataCache.getFileCache(activeFile)?.frontmatter;
      if (!frontMatter || frontMatter.Type !== "Task") {
        new Notice("Current file is not a task");
        return;
      }

      // Add the task to today's daily note
      const result = await this.dailyNoteService.addTaskToToday(
        activeFile.path
      );

      if (result.success) {
        new Notice(
          `Added "${
            frontMatter.Title || activeFile.name
          }" to today's daily note`
        );
      } else {
        new Notice(
          `Failed to add to today: ${result.error || "Unknown error"}`
        );
      }
    } catch (error: any) {
      console.error("Error adding current task to today:", error);
      new Notice(`Error adding to today: ${error.message || "Unknown error"}`);
    }
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

    // Initialize schedule store
    await scheduleStore.initialize(this.app, this);

    // Refresh all stores to load existing files
    await taskStore.refreshEntities();
    await projectStore.refreshEntities();
    await areaStore.refreshEntities();
    await taskMentionStore.refreshEntities();

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
