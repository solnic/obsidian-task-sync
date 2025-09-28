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

export default class TaskSyncPlugin extends Plugin {
  settings: TaskSyncSettings;
  private host: ObsidianHost;

  async onload() {
    console.log("TaskSync plugin loading...");

    // Create ObsidianHost instance
    this.host = new ObsidianHost(this);

    // Load settings through host
    this.settings = await this.host.loadSettings();

    // Initialize the TaskSync app with Host abstraction
    await taskSyncApp.initialize(this.host);

    // Register settings tab
    this.addSettingTab(new TaskSyncSettingTab(this.app, this));

    // Register the main view
    this.registerView("task-sync-main", (leaf) => {
      return new TaskSyncView(leaf, this);
    });

    // Add ribbon icon
    this.addRibbonIcon("checkbox", "Task Sync", () => {
      this.activateView();
    });

    // Add command to open main view
    this.addCommand({
      id: "open-main-view",
      name: "Open Main View",
      callback: () => {
        this.activateView();
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

    // Activate view when layout is ready
    this.app.workspace.onLayoutReady(() => {
      this.activateView();
    });

    console.log("TaskSync plugin loaded successfully");
  }

  async onunload() {
    console.log("TaskSync plugin unloading...");
    await taskSyncApp.shutdown();
  }

  async loadSettings() {
    this.settings = await this.host.loadSettings();
  }

  async saveSettings() {
    await this.host.saveSettings(this.settings);
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

  // Placeholder methods for settings UI compatibility
  // TODO: Implement these methods when base management is ported to new architecture
  async syncAreaProjectBases(): Promise<void> {
    console.warn(
      "syncAreaProjectBases() not yet implemented in new architecture"
    );
    // For now, do nothing - this functionality will be implemented later
  }

  // Placeholder noteManagers object for settings UI compatibility
  noteManagers = {
    createTemplate: async (templateType: string): Promise<void> => {
      console.warn(
        `createTemplate(${templateType}) not yet implemented in new architecture`
      );
      new Notice(
        `Template creation for ${templateType} is not yet available. This feature will be implemented in a future update.`,
        5000
      );
      throw new Error(
        `Template creation for ${templateType} is not yet available in the new architecture.`
      );
    },
  };
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
