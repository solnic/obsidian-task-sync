/**
 * Lightweight Obsidian Plugin Wrapper for Svelte App
 * Refactored to use ObsidianHost abstraction
 */

import { Plugin, ItemView, WorkspaceLeaf, Notice } from "obsidian";
import { mount, unmount } from "svelte";
import App from "./app/App.svelte";
import { TaskSyncSettings } from "./app/types/settings";
import { taskSyncApp } from "./app/App";
import { ObsidianHost } from "./app/hosts/ObsidianHost";
import { TaskSyncSettingTab } from "./app/components/settings";
import { DayView, DAY_VIEW_TYPE } from "./app/views/DayView";
import {
  DailyPlanningView,
  DAILY_PLANNING_VIEW_TYPE,
} from "./app/views/DailyPlanningView";
import { taskStore, type TaskStore } from "./app/stores/taskStore";
import { projectStore, type ProjectStore } from "./app/stores/projectStore";
import { areaStore, type AreaStore } from "./app/stores/areaStore";
import type { ObsidianExtension } from "./app/extensions/obsidian/ObsidianExtension";
import { Obsidian } from "./app/extensions/obsidian/entities/Obsidian";
import { get } from "svelte/store";
import type { Task, Project, Area } from "./app/core/entities";
// Singleton operations removed - use operations from ObsidianExtension instance

// Commands
import { RefreshTasksCommand } from "./app/commands/core/RefreshTasksCommand";
import { CheckAppleRemindersPermissionsCommand } from "./app/commands/apple-reminders/CheckAppleRemindersPermissionsCommand";
import { ImportAppleRemindersCommand } from "./app/commands/apple-reminders/ImportAppleRemindersCommand";

// NoteKit imports
import {
  NoteKit,
  TypeCache,
  type CachePersistenceAdapter,
} from "./app/core/note-kit";

export default class TaskSyncPlugin extends Plugin {
  settings: TaskSyncSettings;
  public host: ObsidianHost;

  // NoteKit API
  public typeNote: NoteKit;

  // Track registered note type commands for cleanup
  private registeredNoteTypeCommands: string[] = [];

  // Expose stores for testing (like in the old implementation)
  public get stores(): {
    taskStore: TaskStore;
    projectStore: ProjectStore;
    areaStore: AreaStore;
  } {
    return {
      taskStore,
      projectStore,
      areaStore,
    };
  }

  // Expose taskSyncApp for testing
  public get taskSyncApp() {
    return taskSyncApp;
  }

  // Expose operations for testing and entity creation
  // Uses Obsidian-specific operations which set source.keys.obsidian
  public get operations() {
    // Use Obsidian namespace operations which extend EntitiesOperations
    // and set source.keys.obsidian in buildEntity
    const taskOps = new Obsidian.TaskOperations(this.settings);
    const projectOps = new Obsidian.ProjectOperations(this.settings);
    const areaOps = new Obsidian.AreaOperations(this.settings);

    return {
      task: taskOps,
      area: areaOps,
      project: projectOps,
      // Legacy aliases for backward compatibility
      taskOperations: taskOps,
      areaOperations: areaOps,
      projectOperations: projectOps,
    };
  }

  // Public query API for tests - provides easy access to store data
  public query = {
    /**
     * Find a task by its source key for a specific extension
     */
    findTaskBySourceKey: (extension: string, key: string): Task | undefined => {
      const state = get(taskStore);
      return state.tasks.find((t) => t.source.keys[extension] === key);
    },

    /**
     * Find a task by its ID
     */
    findTaskById: (id: string): Task | undefined => {
      const state = get(taskStore);
      return state.tasks.find((t) => t.id === id);
    },

    /**
     * Find a task by its Obsidian file path
     */
    findTaskByFilePath: (filePath: string): Task | undefined => {
      const state = get(taskStore);
      return state.tasks.find((t) => t.source.keys.obsidian === filePath);
    },

    /**
     * Find a task by its GitHub URL (convenience method for tests)
     * @deprecated Use findTaskBySourceKey('github', url) instead
     */
    findTaskBySourceUrl: (url: string): Task | undefined => {
      const state = get(taskStore);
      return state.tasks.find((t) => t.source.keys.github === url);
    },

    /**
     * Find a task by its title
     */
    findTaskByTitle: (title: string): Task | undefined => {
      const state = get(taskStore);
      return state.tasks.find((t) => t.title === title);
    },

    /**
     * Get all tasks
     */
    getAllTasks: (): readonly Task[] => {
      const state = get(taskStore);
      return state.tasks;
    },

    /**
     * Find a project by its name
     */
    findProjectByName: (name: string): Project | undefined => {
      const state = get(projectStore);
      return state.projects.find((p) => p.name === name);
    },

    /**
     * Find an area by its name
     */
    findAreaByName: (name: string): Area | undefined => {
      const state = get(areaStore);
      return state.areas.find((a) => a.name === name);
    },
  };

  async onload() {
    console.log("TaskSync plugin loading...");

    // Create ObsidianHost instance
    this.host = new ObsidianHost(this);

    // Load settings through host
    this.settings = await this.host.loadSettings();

    // Initialize NoteKit API with persistence BEFORE taskSyncApp.initialize
    // This is critical because ObsidianExtension needs to use this NoteKit instance
    this.typeNote = await this.createTypeNoteWithPersistence();

    // Initialize the TaskSync app with Host abstraction
    // ObsidianExtension will now use this.typeNote instance
    await taskSyncApp.initialize(this.host);

    // Call host onload to set up event handlers
    await this.host.onload();

    // Register settings tab
    this.addSettingTab(new TaskSyncSettingTab(this.app, this));

    // Register the main view
    this.registerView("task-sync-main", (leaf) => {
      return new TaskSyncView(leaf, this);
    });

    // Register the Day View
    this.registerView(DAY_VIEW_TYPE, (leaf) => {
      return new DayView(leaf, this.host, this.settings);
    });

    // Register the Daily Planning View
    this.registerView(DAILY_PLANNING_VIEW_TYPE, (leaf) => {
      return new DailyPlanningView(leaf);
    });

    // Add ribbon icon for main view (use valid Obsidian icon)
    this.addRibbonIcon("list-todo", "Task Sync", () => {
      this.activateView();
    });

    // Add ribbon icon for Day View
    this.addRibbonIcon("calendar", "Day View", () => {
      this.activateDayView();
    });

    // Add command to open main view
    this.addCommand({
      id: "open-main-view",
      name: "Open Main View",
      callback: () => {
        this.activateView();
      },
    });

    // Add command to open Day View
    this.addCommand({
      id: "open-day-view",
      name: "Open Day View",
      callback: () => {
        this.activateDayView();
      },
    });

    // Add command to refresh bases
    this.addCommand({
      id: "refresh-bases",
      name: "Refresh Bases",
      callback: async () => {
        await this.refreshBases();
      },
    });

    // Register Refresh Tasks command
    const refreshTasksCommand = new RefreshTasksCommand({
      plugin: this,
      app: this.app,
      settings: this.settings,
    });
    refreshTasksCommand.register();

    // Register Apple Reminders commands
    const checkAppleRemindersPermissionsCommand = new CheckAppleRemindersPermissionsCommand({
      plugin: this,
      app: this.app,
      settings: this.settings,
    });
    checkAppleRemindersPermissionsCommand.register();

    const importAppleRemindersCommand = new ImportAppleRemindersCommand({
      plugin: this,
      app: this.app,
      settings: this.settings,
    });
    importAppleRemindersCommand.register();

    // Add command to start daily planning
    this.addCommand({
      id: "start-daily-planning",
      name: "Start Daily Planning",
      callback: () => {
        this.startDailyPlanning();
      },
    });

    // Add command to promote todo to task
    this.addCommand({
      id: "promote-todo-to-task",
      name: "Promote Todo to Task",
      callback: async () => {
        await this.promoteTodoToTask();
      },
    });

    // Add command to revert promoted todo
    this.addCommand({
      id: "revert-promoted-todo",
      name: "Revert Promoted Todo",
      callback: async () => {
        await this.revertPromotedTodo();
      },
    });

    // Load extensions and activate view when layout is ready
    this.app.workspace.onLayoutReady(async () => {
      await this.host.load();

      // Register note type commands after Task note type is registered
      // This must happen after ObsidianExtension.initialize() which registers the Task note type
      this.registerNoteTypeCommands();

      // Now activate the view
      this.activateView();
    });

    console.log("TaskSync plugin loaded successfully");
  }

  /**
   * Create NoteKit instance with proper persistence adapter
   */
  private async createTypeNoteWithPersistence(): Promise<NoteKit> {
    // Create persistence adapter that uses plugin storage
    const persistenceAdapter: CachePersistenceAdapter = {
      load: async () => {
        try {
          const data = await this.loadData();
          return data?.noteTypes || {};
        } catch (error) {
          console.warn("Failed to load note types from storage:", error);
          return {};
        }
      },
      save: async (data) => {
        try {
          const existingData = (await this.loadData()) || {};
          existingData.noteTypes = data;
          await this.saveData(existingData);
        } catch (error) {
          console.error("Failed to save note types to storage:", error);
          throw error;
        }
      },
      clear: async () => {
        try {
          const existingData = (await this.loadData()) || {};
          delete existingData.noteTypes;
          await this.saveData(existingData);
        } catch (error) {
          console.error("Failed to clear note types from storage:", error);
          throw error;
        }
      },
    };

    // Create TypeCache with persistence
    const typeCache = new TypeCache(persistenceAdapter);

    // Create NoteKit instance
    const typeNote = new NoteKit(this.app);

    // Connect the cache to the registry
    await this.connectCacheToRegistry(typeNote, typeCache);

    // Initialize NoteKit
    await typeNote.initialize();

    return typeNote;
  }

  /**
   * Connect TypeCache to TypeRegistry for persistence
   */
  private async connectCacheToRegistry(
    typeNote: NoteKit,
    typeCache: TypeCache
  ): Promise<void> {
    // Load existing note types from cache
    await typeCache.warmUp();
    const existingKeys = await typeCache.keys();

    // Load all existing note types into registry
    for (const key of existingKeys) {
      const noteType = await typeCache.get(key);
      if (noteType) {
        // Reconstruct schemas from serialized note type
        const { reconstructNoteTypeSchemas } = await import(
          "./app/core/note-kit/schema-utils"
        );
        const reconstructedNoteType = reconstructNoteTypeSchemas(noteType);

        typeNote.registry.register(reconstructedNoteType, {
          allowOverwrite: true,
          validate: false,
        });
      }
    }

    // Override registry methods to use cache for persistence
    const originalRegister = typeNote.registry.register.bind(typeNote.registry);
    const originalUnregister = typeNote.registry.unregister.bind(
      typeNote.registry
    );

    // Track pending persistence operations
    const pendingPersistence: Promise<void>[] = [];

    typeNote.registry.register = (noteType, options = {}) => {
      const result = originalRegister(noteType, options);
      if (result.valid) {
        // Save to cache asynchronously and track the promise
        const persistPromise = typeCache
          .set(noteType.id, noteType)
          .catch((error) => {
            console.error(`Failed to persist note type ${noteType.id}:`, error);
          });
        pendingPersistence.push(persistPromise);
      }
      return result;
    };

    typeNote.registry.unregister = (noteTypeId) => {
      const result = originalUnregister(noteTypeId);
      if (result) {
        // Remove from cache asynchronously and track the promise
        const persistPromise = typeCache.delete(noteTypeId).catch((error) => {
          console.error(
            `Failed to remove note type ${noteTypeId} from persistence:`,
            error
          );
        });
        pendingPersistence.push(persistPromise);
      }
      return result;
    };

    // Add a method to wait for all pending persistence operations
    (typeNote.registry as any).waitForPersistence = async () => {
      await Promise.all(pendingPersistence);
      pendingPersistence.length = 0; // Clear the array
    };
  }

  async onunload() {
    console.log("TaskSync plugin unloading...");
    await this.host.onunload();
    await taskSyncApp.shutdown();

    // Cleanup NoteKit
    if (this.typeNote) {
      await this.typeNote.cleanup();
    }
  }

  async loadSettings() {
    this.settings = await this.host.loadSettings();
  }

  async saveSettings() {
    await this.host.saveSettings(this.settings);
    // Notify app of settings change to reactively update extensions
    await taskSyncApp.updateSettings(this.settings);

    // Update all open views with new settings
    this.app.workspace.iterateAllLeaves((leaf) => {
      if (leaf.view instanceof TaskSyncView) {
        leaf.view.updateSettings(this.settings);
      }
      if (leaf.view.getViewType() === DAY_VIEW_TYPE) {
        (leaf.view as DayView).updateSettings(this.settings);
      }
    });
  }

  /**
   * Regenerate all base files
   * Called from settings UI
   */
  async regenerateBases(): Promise<void> {
    try {
      const { ObsidianBaseManager } = await import(
        "./app/extensions/obsidian/utils/BaseManager"
      );
      const baseManager = new ObsidianBaseManager(
        this.app,
        this.app.vault,
        this.settings
      );

      // Generate the main Tasks.base file
      const projectsAndAreas = await baseManager.getProjectsAndAreas();
      await baseManager.createOrUpdateTasksBase(projectsAndAreas);

      // Generate individual area and project bases if enabled
      if (this.settings.areaBasesEnabled || this.settings.projectBasesEnabled) {
        await baseManager.syncAreaProjectBases();
      }

      console.log("Task Sync: Bases regenerated successfully");
    } catch (error) {
      console.error("Task Sync: Failed to regenerate bases:", error);
      throw error;
    }
  }

  /**
   * Sync area and project bases
   * Called from settings UI when settings change
   */
  async syncAreaProjectBases(): Promise<void> {
    try {
      const { ObsidianBaseManager } = await import(
        "./app/extensions/obsidian/utils/BaseManager"
      );
      const baseManager = new ObsidianBaseManager(
        this.app,
        this.app.vault,
        this.settings
      );

      // Sync project bases if enabled
      if (this.settings.projectBasesEnabled) {
        await baseManager.syncProjectBases();
      }

      console.log("Task Sync: Area/Project bases synced successfully");
    } catch (error) {
      console.error("Task Sync: Failed to sync area/project bases:", error);
      throw error;
    }
  }

  async startDailyPlanning() {
    try {
      // Get the daily planning extension
      const dailyPlanningExtension =
        this.host.getExtensionById("daily-planning");

      if (!dailyPlanningExtension) {
        new Notice("Daily Planning extension not found");
        return;
      }

      // Check if Daily Planning view already exists
      const existingLeaves = this.app.workspace.getLeavesOfType(
        DAILY_PLANNING_VIEW_TYPE
      );

      if (existingLeaves.length > 0) {
        // Activate existing view
        this.app.workspace.revealLeaf(existingLeaves[0]);
      } else {
        // Create new view
        const leaf = this.app.workspace.getLeaf("tab");
        await leaf.setViewState({
          type: DAILY_PLANNING_VIEW_TYPE,
          active: true,
        });
      }
    } catch (error: any) {
      console.error("Error starting daily planning:", error);
      new Notice(`Failed to start daily planning: ${error.message}`);
    }
  }

  async promoteTodoToTask() {
    try {
      // Get the Obsidian extension
      const obsidianExtension = this.host.getExtensionById(
        "obsidian"
      ) as ObsidianExtension;

      if (!obsidianExtension) {
        new Notice("Obsidian extension not found");
        return;
      }

      // Call the todo promotion operation
      const result =
        await obsidianExtension.todoPromotionOperations.promoteTodoToTask();
      new Notice(result.message);
    } catch (error) {
      console.error("Failed to promote todo to task:", error);
      new Notice(`Error promoting todo: ${error.message}`);
    }
  }

  async revertPromotedTodo() {
    try {
      // Get the Obsidian extension
      const obsidianExtension = this.host.getExtensionById(
        "obsidian"
      ) as ObsidianExtension;

      if (!obsidianExtension) {
        new Notice("Obsidian extension not found");
        return;
      }

      // Call the todo revert operation
      const result =
        await obsidianExtension.todoPromotionOperations.revertPromotedTodo();
      new Notice(result.message);
    } catch (error) {
      console.error("Failed to revert promoted todo:", error);
      new Notice(`Error reverting todo: ${error.message}`);
    }
  }

  async activateView() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType("task-sync-main")[0];

    if (!leaf) {
      leaf = workspace.getRightLeaf(false);
      await leaf.setViewState({ type: "task-sync-main", active: true });
    }

    workspace.revealLeaf(leaf);
  }

  async activateDayView() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(DAY_VIEW_TYPE)[0];

    if (!leaf) {
      leaf = workspace.getRightLeaf(false);
      await leaf.setViewState({ type: DAY_VIEW_TYPE, active: true });
    }

    workspace.revealLeaf(leaf);
  }

  async openCreateAreaModal() {
    const { AreaCreateModal } = await import("./app/modals/AreaCreateModal");
    new AreaCreateModal(this.app, this).open();
  }

  async openCreateProjectModal() {
    const { ProjectCreateModal } = await import(
      "./app/modals/ProjectCreateModal"
    );
    new ProjectCreateModal(this.app, this).open();
  }

  async openCreateNoteModal(noteTypeId?: string) {
    const { CreateEntityModal } = await import(
      "./app/modals/CreateEntityModal"
    );

    // Derive contextual defaults for Task creation
    let initialPropertyValues: Record<string, any> | undefined;
    let contextualTitle: string | undefined;

    try {
      const activeFile = this.app.workspace.getActiveFile();
      const activePath = activeFile?.path || "";

      // Only attempt context for tasks
      if (noteTypeId === "task") {
        const areaFolder = this.settings.areasFolder + "/";
        const projectFolder = this.settings.projectsFolder + "/";

        // Basic inference from path: if under Projects/ or Areas/ use that as default
        if (activePath.startsWith(projectFolder)) {
          const parts = activePath.substring(projectFolder.length).split("/");
          const projectName = parts[0] || "";
          if (projectName) {
            initialPropertyValues = {
              ...(initialPropertyValues || {}),
              project: projectName,
            };
            contextualTitle = `Create Task for Project: ${projectName}`;
          }
        } else if (activePath.startsWith(areaFolder)) {
          const parts = activePath.substring(areaFolder.length).split("/");
          const areaName = parts[0] || "";
          if (areaName) {
            initialPropertyValues = {
              ...(initialPropertyValues || {}),
              areas: [areaName],
            };
            contextualTitle = `Create Task for Area: ${areaName}`;
          }
        }

        // If opening from within a task file, set Parent task
        const tasksFolder = this.settings.tasksFolder + "/";
        if (activePath.startsWith(tasksFolder)) {
          const parentTitle = activeFile?.basename;
          if (parentTitle) {
            initialPropertyValues = {
              ...(initialPropertyValues || {}),
              parentTask: parentTitle,
            };
            // If no prior context title, reflect parent task
            if (!contextualTitle) {
              contextualTitle = `Create Subtask of: ${parentTitle}`;
            }
          }
        }
      }
    } catch (_) {
      // Best-effort context; ignore errors
    }

    new CreateEntityModal(this.app, this, noteTypeId, {
      initialPropertyValues,
      contextualTitle,
    }).open();
  }

  /**
   * Register dynamic commands for each note type
   * This allows users to create notes of specific types directly from the command palette
   */
  registerNoteTypeCommands() {
    // Clear any previously registered commands
    this.registeredNoteTypeCommands.forEach((commandId) => {
      this.removeCommand(commandId);
    });
    this.registeredNoteTypeCommands = [];

    // Get all note types from the registry
    const noteTypes = this.typeNote.registry.getAll();

    // Register a command for each note type
    noteTypes.forEach((noteType) => {
      const commandId = `create-note-${noteType.id}`;

      this.addCommand({
        id: commandId,
        name: `Create ${noteType.name}`,
        callback: () => {
          this.openCreateNoteModal(noteType.id);
        },
      });

      this.registeredNoteTypeCommands.push(commandId);
    });

    console.log(
      `Registered ${noteTypes.length} note type commands:`,
      this.registeredNoteTypeCommands
    );
  }

  /**
   * Refresh bases - adds missing bases and updates existing ones according to current settings
   */
  async refreshBases() {
    try {
      new Notice("Refreshing bases...");

      // Get the ObsidianExtension from the app
      const extension = taskSyncApp.getExtensionById("obsidian");
      if (!extension) {
        new Notice("❌ Failed to refresh bases: Obsidian extension not found");
        return;
      }

      // Cast to ObsidianExtension type
      const obsidianExtension = extension as ObsidianExtension;

      // Get the BaseManager from the extension
      const baseManager = obsidianExtension.getBaseManager();

      // Generate the main Tasks.base file
      const projectsAndAreas = await baseManager.getProjectsAndAreas();
      await baseManager.createOrUpdateTasksBase(projectsAndAreas);

      // Generate individual area and project bases if enabled
      if (this.settings.areaBasesEnabled || this.settings.projectBasesEnabled) {
        await baseManager.syncAreaProjectBases();
      }

      new Notice("✅ Successfully refreshed bases");
      console.log("Bases refreshed successfully");
    } catch (error) {
      console.error("Failed to refresh bases:", error);
      new Notice(`❌ Failed to refresh bases: ${error.message}`);
    }
  }
}

class TaskSyncView extends ItemView {
  private plugin: TaskSyncPlugin;
  private appComponent: any = null;

  constructor(leaf: WorkspaceLeaf, plugin: TaskSyncPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return "task-sync-main";
  }

  getDisplayText(): string {
    return "Task Sync";
  }

  getIcon(): string {
    return "list-todo";
  }

  async onOpen() {
    console.log("TaskSync view opening...");
    const container = this.containerEl.children[1];
    container.empty();

    try {
      this.appComponent = mount(App, {
        target: container,
        props: {
          obsidianApp: this.app,
          plugin: this.plugin,
          settings: this.plugin.settings,
        },
      });
      console.log("TaskSync Svelte app mounted successfully");
    } catch (error) {
      console.error("Failed to mount TaskSync Svelte app:", error);
      container.createEl("div", {
        text: "Failed to load TaskSync app: " + error.message,
      });
    }
  }

  async onClose() {
    console.log("TaskSync view closing...");
    if (this.appComponent) {
      try {
        unmount(this.appComponent);
        this.appComponent = null;
        console.log("TaskSync Svelte app unmounted successfully");
      } catch (error) {
        console.error("Failed to unmount TaskSync Svelte app:", error);
      }
    }
  }

  /**
   * Update settings and refresh the Svelte component
   * This method is called when settings change in the main plugin
   */
  updateSettings(settings: TaskSyncSettings): void {
    // Update the Svelte component if it exists
    if (this.appComponent) {
      // Update the settings prop
      this.appComponent.settings = settings;
    }
  }
}
