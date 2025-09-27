/**
 * Tasks View Component for the new architecture
 * Simplified wrapper that mounts the Svelte TasksView component
 */

import { ItemView, WorkspaceLeaf, ViewStateResult } from "obsidian";
import { mount, unmount } from "svelte";
import TasksViewSvelte from "../components/TasksView.svelte";
import type { TaskSyncSettings } from "../types/settings";
import type { Host } from "../core/host";

export const TASKS_VIEW_TYPE = "task-sync-tasks";

/**
 * Custom view for browsing tasks using Svelte
 */
export class TasksView extends ItemView {
  private host: Host;
  private settings: TaskSyncSettings;
  private svelteComponent: any = null;
  private svelteComponentRef: any = null;
  private isComponentCreated: boolean = false;

  constructor(leaf: WorkspaceLeaf, host: Host, settings: TaskSyncSettings) {
    super(leaf);
    this.host = host;
    this.settings = settings;
  }

  getViewType(): string {
    return TASKS_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Tasks";
  }

  getIcon(): string {
    return "list-todo";
  }

  async onOpen(): Promise<void> {
    this.containerEl.empty();
    this.containerEl.addClass("tasks-view");
    this.containerEl.setAttribute("data-type", TASKS_VIEW_TYPE);

    // Check if this view is deferred (not currently active)
    if (this.leaf.isDeferred) {
      // Don't create the Svelte component yet - wait until view becomes active
      this.isComponentCreated = false;
      return;
    }

    // Create the Svelte component only when view is active
    await this.createSvelteComponent();
  }

  /**
   * Create the Svelte component with current settings
   */
  private async createSvelteComponent(): Promise<void> {
    if (this.isComponentCreated) {
      return;
    }

    try {
      // Create initial props with component reference binding
      const initialProps = {
        settings: this.settings,
        host: this.host,
        testId: "tasks-view",
      };

      // Mount Svelte 5 component
      this.svelteComponent = mount(TasksViewSvelte, {
        target: this.containerEl,
        props: initialProps,
      });

      // Store reference to the component instance for direct method calls
      this.svelteComponentRef = this.svelteComponent;

      this.isComponentCreated = true;
      console.log("TasksView Svelte component mounted successfully");
    } catch (error) {
      console.error("Failed to mount TasksView Svelte component:", error);
      this.containerEl.createEl("div", {
        text: "Failed to load Tasks view: " + error.message,
        cls: "task-sync-error",
      });
    }
  }

  async onClose(): Promise<void> {
    // Unmount Svelte 5 component
    if (this.svelteComponent) {
      try {
        unmount(this.svelteComponent);
        this.svelteComponent = null;
        this.svelteComponentRef = null;
        console.log("TasksView Svelte component unmounted successfully");
      } catch (error) {
        console.error("Error unmounting TasksView Svelte component:", error);
      }
    }
    this.isComponentCreated = false;
  }

  /**
   * Override setState to handle when view becomes active (no longer deferred)
   */
  async setState(state: any, result: ViewStateResult): Promise<void> {
    await super.setState(state, result);

    // If the view was deferred and is now becoming active, create the component
    if (!this.isComponentCreated && !this.leaf.isDeferred) {
      await this.createSvelteComponent();
    }
  }

  /**
   * Override onResize to handle when view becomes active (no longer deferred)
   */
  async onResize(): Promise<void> {
    // If the view was deferred and is now becoming active, create the component
    if (!this.isComponentCreated && !this.leaf.isDeferred) {
      await this.createSvelteComponent();
    }
  }

  /**
   * Update settings and refresh the Svelte component
   * This method is called when settings change in the main plugin
   */
  updateSettings(settings: TaskSyncSettings): void {
    this.settings = settings;

    // Update the Svelte component if it exists
    if (this.isComponentCreated && this.svelteComponent) {
      // Update the settings prop
      this.svelteComponent.settings = settings;
    }
  }

  /**
   * Refresh tasks
   */
  async refresh(): Promise<void> {
    // Only refresh if component is created and we have a reference
    if (this.isComponentCreated && this.svelteComponentRef) {
      // Call the refresh method directly on the component instance
      if (typeof this.svelteComponentRef.refresh === "function") {
        await this.svelteComponentRef.refresh();
      }
    }
  }
}
