import { Plugin, TFile, Notice, Modal, App } from "obsidian";
import { VaultScanner } from "./services/VaultScannerService";
import { BaseManager } from "./services/BaseManager";

import { FileChangeListener } from "./services/FileChangeListener";
import { TemplateManager } from "./services/TemplateManager";
import { TaskFileManager } from "./services/TaskFileManager";
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

import { TaskSyncSettingTab } from "./components/ui/settings";
import type {
  TaskSyncSettings,
  TaskType,
  TaskTypeColor,
} from "./components/ui/settings";
import { EventManager } from "./events";
import { EventType, SettingsChangedEventData } from "./events/EventTypes";
import { StatusDoneHandler } from "./events/handlers";
import { TaskPropertyHandler } from "./events/handlers/TaskPropertyHandler";
import { AreaPropertyHandler } from "./events/handlers/AreaPropertyHandler";
import { ProjectPropertyHandler } from "./events/handlers/ProjectPropertyHandler";
import { EntityCacheHandler } from "./events/handlers/EntityCacheHandler";
import {
  GitHubSettingsHandler,
  AppleRemindersSettingsHandler,
} from "./events/handlers/SettingsChangeHandler";
import {
  DEFAULT_SETTINGS,
  TASK_TYPE_COLORS,
  validateFolderPath,
} from "./components/ui/settings";
import { GitHubService } from "./services/GitHubService";
import { AppleRemindersService } from "./services/AppleRemindersService";
import { TaskImportManager } from "./services/TaskImportManager";
import { CacheManager } from "./cache/CacheManager";
import { TasksView, TASKS_VIEW_TYPE } from "./views/TasksView";
import { ContextTabView, CONTEXT_TAB_VIEW_TYPE } from "./views/ContextTabView";
import { TaskImportConfig } from "./types/integrations";
import { taskStore } from "./stores/taskStore";
import { projectStore } from "./stores/projectStore";
import { areaStore } from "./stores/areaStore";
import { TodoPromotionService } from "./services/TodoPromotionService";
import { DailyNoteService } from "./services/DailyNoteService";
import { initializeContextStore } from "./components/svelte/context";

// Re-export types for backward compatibility
export type { TaskSyncSettings, TaskType, TaskTypeColor };
export { TASK_TYPE_COLORS };

// File context interface for context-aware modal
export interface FileContext {
  type: "project" | "area" | "task" | "daily" | "none";
  name?: string;
  path?: string;
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

export default class TaskSyncPlugin extends Plugin {
  settings: TaskSyncSettings;
  private previousSettings: TaskSyncSettings | null = null;
  vaultScanner: VaultScanner;
  baseManager: BaseManager;
  templateManager: TemplateManager;

  eventManager: EventManager;
  fileChangeListener: FileChangeListener;
  statusDoneHandler: StatusDoneHandler;
  taskPropertyHandler: TaskPropertyHandler;
  areaPropertyHandler: AreaPropertyHandler;
  projectPropertyHandler: ProjectPropertyHandler;
  entityCacheHandler: EntityCacheHandler;
  githubSettingsHandler: GitHubSettingsHandler;
  appleRemindersSettingsHandler: AppleRemindersSettingsHandler;
  cacheManager: CacheManager;
  githubService: GitHubService;
  appleRemindersService: AppleRemindersService;
  taskImportManager: TaskImportManager;
  taskFileManager: TaskFileManager;
  areaFileManager: AreaFileManager;
  projectFileManager: ProjectFileManager;
  todoPromotionService: TodoPromotionService;
  dailyNoteService: DailyNoteService;

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

  // Wait for store refresh operations to complete (for e2e testing)
  public async waitForStoreRefresh() {
    await Promise.all([
      taskStore.waitForRefresh(),
      projectStore.waitForRefresh(),
      areaStore.waitForRefresh(),
    ]);
  }

  // Global context system
  private currentContext: FileContext = { type: "none" };

  async onload() {
    console.log("Loading Task Sync Plugin");

    // Load settings
    await this.loadSettings();

    // Initialize services
    console.log("🔧 Initializing services with settings:", {
      taskTypes: this.settings.taskTypes,
      githubIntegration: this.settings.githubIntegration,
    });

    this.vaultScanner = new VaultScanner(this.app.vault, this.settings);
    this.baseManager = new BaseManager(this.app, this.app.vault, this.settings);
    this.templateManager = new TemplateManager(
      this.app,
      this.app.vault,
      this.settings
    );

    // Initialize cache manager
    this.cacheManager = new CacheManager(this);

    this.githubService = new GitHubService(this.settings);
    await this.githubService.initialize(this.cacheManager);

    // Initialize Apple Reminders service (only on macOS)
    this.appleRemindersService = new AppleRemindersService(this.settings);
    await this.appleRemindersService.initialize(this.cacheManager);

    // Initialize import services
    this.taskImportManager = new TaskImportManager(
      this.app,
      this.app.vault,
      this.settings
    );
    this.taskFileManager = new TaskFileManager(
      this.app,
      this.app.vault,
      this.settings
    );
    this.areaFileManager = new AreaFileManager(
      this.app,
      this.app.vault,
      this.settings
    );
    this.projectFileManager = new ProjectFileManager(
      this.app,
      this.app.vault,
      this.settings
    );

    // Initialize TodoPromotionService
    this.todoPromotionService = new TodoPromotionService(
      this.app,
      this.settings,
      this.taskFileManager,
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

    // Initialize stores - this will set up the basic structure
    // Full population will happen in onLayoutReady after vault is loaded
    await this.initializeStores();

    // Wire up GitHub service with import dependencies
    this.githubService.setImportDependencies(this.taskImportManager);

    // Wire up Apple Reminders service with import dependencies
    this.appleRemindersService.setImportDependencies(this.taskImportManager);

    // Ensure templates exist
    await this.templateManager.ensureTemplatesExist();

    // Initialize event system
    this.eventManager = new EventManager();
    this.statusDoneHandler = new StatusDoneHandler(this.app, this.settings);
    this.taskPropertyHandler = new TaskPropertyHandler(this.app, this.settings);
    this.areaPropertyHandler = new AreaPropertyHandler(this.app, this.settings);
    this.projectPropertyHandler = new ProjectPropertyHandler(
      this.app,
      this.settings
    );
    this.entityCacheHandler = new EntityCacheHandler(this.app, this.settings);
    this.fileChangeListener = new FileChangeListener(
      this.app,
      this.app.vault,
      this.eventManager,
      this.settings
    );

    // Initialize settings change handlers
    this.githubSettingsHandler = new GitHubSettingsHandler(this.githubService);
    this.appleRemindersSettingsHandler = new AppleRemindersSettingsHandler(
      this.appleRemindersService
    );

    // Register event handlers
    this.eventManager.registerHandler(this.statusDoneHandler);
    this.eventManager.registerHandler(this.taskPropertyHandler);
    this.eventManager.registerHandler(this.areaPropertyHandler);
    this.eventManager.registerHandler(this.projectPropertyHandler);
    this.eventManager.registerHandler(this.entityCacheHandler);
    this.eventManager.registerHandler(this.githubSettingsHandler);
    this.eventManager.registerHandler(this.appleRemindersSettingsHandler);

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
        new TasksView(
          leaf,
          this.githubService,
          this.appleRemindersService,
          {
            githubIntegration: this.settings.githubIntegration,
            appleRemindersIntegration: this.settings.appleRemindersIntegration,
          },
          {
            taskImportManager: this.taskImportManager,
            getDefaultImportConfig: () => this.getDefaultImportConfig(),
          }
        )
    );

    // Register Context Tab view
    this.registerView(
      CONTEXT_TAB_VIEW_TYPE,
      (leaf) => new ContextTabView(leaf)
    );

    // Wait for layout ready, then populate stores and create views
    this.app.workspace.onLayoutReady(async () => {
      console.log("Layout ready - populating stores from vault");

      // Now that vault is fully loaded, populate stores with existing files
      await this.populateStoresFromVault();

      // Initialize views after stores are populated
      this.initializeTasksView();
      this.initializeContextTabView();
    });

    // Note: Removed automatic folder creation - Obsidian handles this automatically
    // Base files and templates will be created on-demand when needed

    // Add commands
    this.addCommand({
      id: "add-task",
      name: "Add Task",
      callback: () => {
        this.openTaskCreateModal();
      },
    });

    this.addCommand({
      id: "refresh",
      name: "Refresh",
      callback: async () => {
        await this.refresh();
      },
    });

    this.addCommand({
      id: "refresh-base-views",
      name: "Refresh Base Views",
      callback: async () => {
        await this.refreshBaseViews();
      },
    });

    this.addCommand({
      id: "create-area",
      name: "Create Area",
      callback: () => {
        this.openAreaCreateModal();
      },
    });

    this.addCommand({
      id: "create-project",
      name: "Create Project",
      callback: () => {
        this.openProjectCreateModal();
      },
    });

    this.addCommand({
      id: "promote-todo-to-task",
      name: "Promote Todo to Task",
      callback: async () => {
        const result = await this.todoPromotionService.promoteTodoToTask();
        new Notice(result.message);
      },
    });

    // Add cache management commands
    this.addCommand({
      id: "clear-all-caches",
      name: "Clear all caches",
      callback: async () => {
        await this.cacheManager.clearAllCaches();
        new Notice("All caches cleared");
      },
    });

    this.addCommand({
      id: "show-cache-stats",
      name: "Show cache statistics",
      callback: async () => {
        const stats = await this.cacheManager.getStats();
        const message = stats
          .map((s) => `${s.cacheKey}: ${s.keyCount} entries`)
          .join("\n");
        new Notice(`Cache statistics:\n${message}`);
      },
    });

    this.addCommand({
      id: "revert-promoted-todo",
      name: "Revert Promoted Todo",
      callback: async () => {
        const result = await this.todoPromotionService.revertPromotedTodo();
        new Notice(result.message);
      },
    });

    this.addCommand({
      id: "add-to-today",
      name: "Add to Today",
      callback: async () => {
        await this.addCurrentTaskToToday();
      },
    });

    // GitHub Import Commands
    this.addCommand({
      id: "import-github-issue",
      name: "Import GitHub Issue",
      callback: async () => {
        await this.importGitHubIssue();
      },
    });

    this.addCommand({
      id: "import-all-github-issues",
      name: "Import All GitHub Issues",
      callback: async () => {
        await this.importAllGitHubIssues();
      },
    });

    // Apple Reminders Import Commands (only on macOS)
    if (this.appleRemindersService.isPlatformSupported()) {
      this.addCommand({
        id: "import-apple-reminders",
        name: "Import Apple Reminders",
        callback: async () => {
          await this.importAppleReminders();
        },
      });

      this.addCommand({
        id: "check-apple-reminders-permissions",
        name: "Check Apple Reminders Permissions",
        callback: async () => {
          await this.checkAppleRemindersPermissions();
        },
      });
    }

    this.addCommand({
      id: "open-context-tab",
      name: "Open Context Tab",
      callback: () => {
        this.activateContextTabView();
      },
    });
  }

  async onunload() {
    await taskStore.saveData();
    await projectStore.saveData();
    await areaStore.saveData();

    // Cache manager doesn't need explicit unload - data is saved automatically

    if (this.fileChangeListener) {
      this.fileChangeListener.cleanup();
    }

    if (this.eventManager) {
      this.eventManager.clear();
    }
  }

  async loadSettings() {
    const loadedData = await this.loadData();

    this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData);

    // Initialize previous settings for comparison
    this.previousSettings = { ...this.settings };

    this.validateSettings();
  }

  async saveSettings(skipTemplateUpdate = false) {
    this.validateSettings();

    // Store previous settings for comparison
    const oldSettings = this.previousSettings
      ? { ...this.previousSettings }
      : null;

    await this.saveData(this.settings);

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

    if (this.taskPropertyHandler) {
      this.taskPropertyHandler.updateSettings(this.settings);
    }

    if (this.areaPropertyHandler) {
      this.areaPropertyHandler.updateSettings(this.settings);
    }

    if (this.projectPropertyHandler) {
      this.projectPropertyHandler.updateSettings(this.settings);
    }

    if (this.taskImportManager) {
      this.taskImportManager.updateSettings(this.settings);
    }

    // Update UI views
    const tasksLeaves = this.app.workspace.getLeavesOfType(TASKS_VIEW_TYPE);
    tasksLeaves.forEach((leaf) => {
      const view = leaf.view as TasksView;
      if (view && view.updateSettings) {
        view.updateSettings({
          githubIntegration: this.settings.githubIntegration,
          appleRemindersIntegration: this.settings.appleRemindersIntegration,
        });
      }
    });

    // Update other managers
    if (this.templateManager) {
      this.templateManager.updateSettings(this.settings);
      if (!skipTemplateUpdate) {
        await this.templateManager.updateTemplatesOnSettingsChange();
      }
    }

    if (this.baseManager) {
      this.baseManager.updateSettings(this.settings);
    }

    if (this.taskFileManager) {
      this.taskFileManager.updateSettings(this.settings);
    }

    if (this.areaFileManager) {
      this.areaFileManager.updateSettings(this.settings);
    }

    if (this.projectFileManager) {
      this.projectFileManager.updateSettings(this.settings);
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
   * Activate the Context Tab view (bring it to focus)
   */
  private async activateContextTabView(): Promise<void> {
    const existingLeaves = this.app.workspace.getLeavesOfType(
      CONTEXT_TAB_VIEW_TYPE
    );

    if (existingLeaves.length > 0) {
      // Activate existing view
      this.app.workspace.revealLeaf(existingLeaves[0]);
    } else {
      // Create new view in right sidebar
      const rightLeaf = this.app.workspace.getRightLeaf(false);
      await rightLeaf.setViewState({
        type: CONTEXT_TAB_VIEW_TYPE,
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

    // Only update if context actually changed
    if (
      this.currentContext.type !== newContext.type ||
      this.currentContext.name !== newContext.name
    ) {
      this.currentContext = newContext;
      console.log("🔄 Context updated:", this.currentContext);
    }
  }

  /**
   * Get the current context
   */
  getCurrentContext(): FileContext {
    return { ...this.currentContext };
  }

  // Task creation logic
  // This is the SINGLE METHOD for creating tasks - all task creation must go through this method
  // to ensure consistent property setting and context handling
  async createTask(taskData: any): Promise<void> {
    const content = taskData.content || taskData.description;

    const taskPath = await this.taskFileManager.createTaskFile(
      taskData,
      content
    );
  }

  /**
   * Create a new area
   */
  private async createArea(areaData: AreaCreateData): Promise<void> {
    const areaCreationData = {
      title: areaData.name,
      description: areaData.description,
    };

    const areaPath = await this.areaFileManager.createAreaFile(
      areaCreationData
    );

    if (
      this.settings.areaBasesEnabled &&
      this.settings.autoSyncAreaProjectBases
    ) {
      await this.baseManager.createOrUpdateAreaBase({
        name: areaData.name,
        path: areaPath,
        type: "area",
      });
    }
  }

  /**
   * Create a new project
   */
  private async createProject(projectData: ProjectCreateData): Promise<void> {
    const projectCreationData = {
      title: projectData.name,
      description: projectData.description,
      areas: projectData.areas,
    };

    const projectPath = await this.projectFileManager.createProjectFile(
      projectCreationData
    );

    if (
      this.settings.projectBasesEnabled &&
      this.settings.autoSyncAreaProjectBases
    ) {
      await this.baseManager.createOrUpdateProjectBase({
        name: projectData.name,
        path: projectPath,
        type: "project",
      });
    }
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
    await this.updateTaskFiles(results);
    await this.updateProjectFiles(results);
    await this.updateAreaFiles(results);
  }

  /**
   * Update task files to match current schema
   */
  private async updateTaskFiles(results: any): Promise<void> {
    try {
      const taskFiles = await this.vaultScanner.scanTasksFolder();

      for (const filePath of taskFiles) {
        try {
          const updateResult =
            await this.taskFileManager.updateTaskFileProperties(filePath);

          if (updateResult.hasChanges) {
            results.filesUpdated++;
            results.propertiesUpdated += updateResult.propertiesChanged;
          }
        } catch (error) {
          console.error(
            `Task Sync: Failed to update task file ${filePath}:`,
            error
          );
          results.errors.push(`Failed to update ${filePath}: ${error.message}`);
        }
      }
    } catch (error) {
      console.error("Task Sync: Failed to update task files:", error);
      results.errors.push(`Failed to update task files: ${error.message}`);
    }
  }

  /**
   * Update project files to match current schema
   */
  private async updateProjectFiles(results: any): Promise<void> {
    try {
      const projectFiles = await this.vaultScanner.scanProjectsFolder();
      for (const filePath of projectFiles) {
        try {
          const updateResult =
            await this.projectFileManager.updateFileProperties(filePath);
          if (updateResult.hasChanges) {
            results.filesUpdated++;
            results.propertiesUpdated += updateResult.propertiesChanged;
            console.log(
              `Task Sync: Updated ${updateResult.propertiesChanged} properties in ${filePath}`
            );
          } else {
            console.log(`Task Sync: No changes needed for ${filePath}`);
          }
        } catch (error) {
          console.error(
            `Task Sync: Failed to update project file ${filePath}:`,
            error
          );
          results.errors.push(`Failed to update ${filePath}: ${error.message}`);
        }
      }
    } catch (error) {
      console.error("Task Sync: Failed to update project files:", error);
      results.errors.push(`Failed to update project files: ${error.message}`);
    }
  }

  /**
   * Update area files to match current schema
   */
  private async updateAreaFiles(results: any): Promise<void> {
    try {
      const areaFiles = await this.vaultScanner.scanAreasFolder();
      for (const filePath of areaFiles) {
        try {
          const updateResult = await this.areaFileManager.updateFileProperties(
            filePath
          );
          if (updateResult.hasChanges) {
            results.filesUpdated++;
            results.propertiesUpdated += updateResult.propertiesChanged;
            console.log(
              `Task Sync: Updated ${updateResult.propertiesChanged} properties in ${filePath}`
            );
          } else {
            console.log(`Task Sync: No changes needed for ${filePath}`);
          }
        } catch (error) {
          console.error(
            `Task Sync: Failed to update area file ${filePath}:`,
            error
          );
          results.errors.push(`Failed to update ${filePath}: ${error.message}`);
        }
      }
    } catch (error) {
      console.error("Task Sync: Failed to update area files:", error);
      results.errors.push(`Failed to update area files: ${error.message}`);
    }
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
      const updatedContent =
        await this.taskFileManager.reorderTaskTemplateProperties(content);
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
      const updatedContent =
        await this.taskFileManager.reorderTaskTemplateProperties(content);
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
    if (!this.githubService.isEnabled()) {
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

      const issue = await this.fetchIssueFromUrl(issueUrl);
      if (!issue) {
        new Notice("Failed to fetch GitHub issue");
        return;
      }

      // Use default import configuration
      const config = this.getDefaultImportConfig();

      const result = await this.githubService.importIssueAsTask(issue, config);

      if (result.success) {
        if (result.skipped) {
          new Notice(`Issue already imported: ${result.reason}`);
        } else {
          new Notice(`Successfully imported issue: ${issue.title}`);
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
    if (!this.githubService.isEnabled()) {
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

      const issues = await this.githubService.fetchIssues(repository);
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
          const result = await this.githubService.importIssueAsTask(
            issue,
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
  private async fetchIssueFromUrl(url: string): Promise<any | null> {
    try {
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
      const issues = await this.githubService.fetchIssues(repository);
      const issue = issues.find((i) => i.number === parseInt(issueNumber));

      if (!issue) {
        new Notice(`Issue #${issueNumber} not found in ${repository}`);
        return null;
      }

      return issue;
    } catch (error: any) {
      console.error("Error fetching issue from URL:", error);
      return null;
    }
  }

  /**
   * Import Apple Reminders as tasks
   */
  private async importAppleReminders(): Promise<void> {
    if (!this.appleRemindersService.isEnabled()) {
      new Notice(
        "Apple Reminders integration is not enabled or not available on this platform"
      );
      return;
    }

    try {
      // Check permissions first
      const permissionResult =
        await this.appleRemindersService.checkPermissions();
      if (!permissionResult.success) {
        new Notice(`Permission error: ${permissionResult.error?.message}`);
        return;
      }

      new Notice("Fetching Apple Reminders...");

      // Fetch reminders
      const remindersResult = await this.appleRemindersService.fetchReminders();

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

          const result = await this.appleRemindersService.importReminderAsTask(
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
    if (!this.appleRemindersService.isPlatformSupported()) {
      new Notice("Apple Reminders is only available on macOS");
      return;
    }

    try {
      const result = await this.appleRemindersService.checkPermissions();

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
      this.taskFileManager
    );
    await projectStore.initialize(
      this.app,
      this,
      this.settings.projectsFolder,
      this.projectFileManager
    );
    await areaStore.initialize(
      this.app,
      this,
      this.settings.areasFolder,
      this.areaFileManager
    );
  }

  /**
   * Populate stores from vault after layout is ready
   */
  private async populateStoresFromVault(): Promise<void> {
    console.log("Populating stores from vault...");

    // Refresh all stores to load existing files
    await taskStore.refreshEntities();
    await projectStore.refreshEntities();
    await areaStore.refreshEntities();

    console.log("Stores populated from vault");
  }
}
