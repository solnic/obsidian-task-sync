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
import type { ObsidianExtension } from "./app/extensions/ObsidianExtension";
import { Tasks } from "./app/entities/Tasks";
import { Areas } from "./app/entities/Areas";
import { Projects } from "./app/entities/Projects";
// Singleton operations removed - use operations from ObsidianExtension instance

export default class TaskSyncPlugin extends Plugin {
  settings: TaskSyncSettings;
  public host: ObsidianHost;

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

  // Expose operations for testing
  public get operations() {
    return {
      taskOperations: new Tasks.Operations(this.settings),
      areaOperations: new Areas.Operations(this.settings),
      projectOperations: new Projects.Operations(this.settings),
    };
  }

  async onload() {
    console.log("TaskSync plugin loading...");

    // Create ObsidianHost instance
    this.host = new ObsidianHost(this);

    // Load settings through host
    this.settings = await this.host.loadSettings();

    // Initialize the TaskSync app with Host abstraction
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

    // Add ribbon icon for main view
    this.addRibbonIcon("checkbox", "Task Sync", () => {
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

    // Add command to create area
    this.addCommand({
      id: "create-area",
      name: "Create Area",
      callback: () => {
        this.openCreateAreaModal();
      },
    });

    // Add command to create project
    this.addCommand({
      id: "create-project",
      name: "Create Project",
      callback: () => {
        this.openCreateProjectModal();
      },
    });

    // Add command to create task
    this.addCommand({
      id: "create-task",
      name: "Create Task",
      callback: () => {
        this.openCreateTaskModal();
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

      // Now activate the view
      this.activateView();
    });

    console.log("TaskSync plugin loaded successfully");
  }

  async onunload() {
    console.log("TaskSync plugin unloading...");
    await this.host.onunload();
    await taskSyncApp.shutdown();
  }

  async loadSettings() {
    this.settings = await this.host.loadSettings();
  }

  async saveSettings() {
    await this.host.saveSettings(this.settings);
    // Notify app of settings change to reactively update extensions
    await taskSyncApp.updateSettings(this.settings);
  }

  /**
   * Regenerate all base files
   * Called from settings UI
   */
  async regenerateBases(): Promise<void> {
    try {
      const { ObsidianBaseManager } = await import(
        "./app/extensions/obsidian/BaseManager"
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
        "./app/extensions/obsidian/BaseManager"
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

  async openCreateTaskModal() {
    const { TaskCreateModal } = await import("./app/modals/TaskCreateModal");
    new TaskCreateModal(this.app, this).open();
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
    return "checkbox";
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
}
