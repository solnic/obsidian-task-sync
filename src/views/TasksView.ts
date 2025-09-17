/**
 * Tasks View Component
 * Generic container view for multiple task integration services
 */

import { ItemView, WorkspaceLeaf, ViewStateResult } from "obsidian";
import { mount, unmount } from "svelte";
import { GitHubService } from "../services/GitHubService";
import { AppleRemindersService } from "../services/AppleRemindersService";
import { IntegrationManager } from "../services/IntegrationManager";
import {
  GitHubIntegrationSettings,
  AppleRemindersIntegrationSettings,
} from "../components/ui/settings/types";
import { TaskImportManager } from "../services/TaskImportManager";
import { TaskImportConfig } from "../types/integrations";
import TasksViewSvelte from "../components/svelte/TasksView.svelte";
import { settingsStore } from "../stores/settingsStore";

export const TASKS_VIEW_TYPE = "tasks";

export interface TasksViewSettings {
  githubIntegration: GitHubIntegrationSettings;
  appleRemindersIntegration: AppleRemindersIntegrationSettings;
}

export interface TasksViewDependencies {
  taskImportManager: TaskImportManager;
  getDefaultImportConfig: () => TaskImportConfig;
}

/**
 * Custom view for browsing tasks from multiple integration services using Svelte
 */
export class TasksView extends ItemView {
  private integrationManager: IntegrationManager;
  private dependencies: TasksViewDependencies;
  private svelteComponent: any = null;
  private isComponentCreated: boolean = false;
  private integrationUnsubscribe: (() => void) | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    integrationManager: IntegrationManager,
    dependencies: TasksViewDependencies
  ) {
    super(leaf);
    this.integrationManager = integrationManager;
    this.dependencies = dependencies;
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
   * Create the Svelte component with current settings from store
   */
  private async createSvelteComponent(): Promise<void> {
    if (this.isComponentCreated) {
      return;
    }

    // Get current settings from the reactive store
    const currentSettings = settingsStore.getCurrentSettings();
    if (!currentSettings) {
      console.warn("TasksView: Settings not loaded yet");
      return;
    }

    // Create initial props
    const initialProps = {
      githubService: this.integrationManager.getGitHubService(),
      appleRemindersService: this.integrationManager.getAppleRemindersService(),
      settings: {
        githubIntegration: currentSettings.githubIntegration,
        appleRemindersIntegration: currentSettings.appleRemindersIntegration,
      },
      dependencies: this.dependencies,
    };

    // Mount Svelte 5 component
    this.svelteComponent = mount(TasksViewSvelte, {
      target: this.containerEl,
      props: initialProps,
      context: new Map([
        [
          "task-sync-plugin",
          {
            plugin: (window as any).app?.plugins?.plugins?.[
              "obsidian-task-sync"
            ],
          },
        ],
      ]),
    });

    // Subscribe to integration changes to update service props
    this.integrationUnsubscribe = this.integrationManager.onServicesChanged(
      () => {
        this.updateServiceProps();
      }
    );

    this.isComponentCreated = true;
  }

  /**
   * Update service props when integrations change
   */
  private updateServiceProps(): void {
    if (!this.isComponentCreated || !this.svelteComponent) {
      return;
    }

    // Update the service props
    this.svelteComponent.githubService =
      this.integrationManager.getGitHubService();
    this.svelteComponent.appleRemindersService =
      this.integrationManager.getAppleRemindersService();
  }

  async onClose(): Promise<void> {
    // Unsubscribe from integration changes
    if (this.integrationUnsubscribe) {
      this.integrationUnsubscribe();
      this.integrationUnsubscribe = null;
    }

    // Unmount Svelte 5 component
    if (this.svelteComponent) {
      unmount(this.svelteComponent);
      this.svelteComponent = null;
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
  updateSettings(settings: TasksViewSettings): void {
    // Settings are now managed by the reactive store, so we just need to
    // update the Svelte component if it exists
    if (this.isComponentCreated && this.svelteComponent) {
      const methods = (window as any).__tasksViewMethods;
      if (methods && methods.updateSettings) {
        methods.updateSettings(settings);
      }
    }
  }

  /**
   * Refresh repositories and issues
   */
  async refresh(): Promise<void> {
    // Only refresh if component is created
    if (this.isComponentCreated) {
      const methods = (window as any).__tasksViewMethods;
      if (methods && methods.refresh) {
        await methods.refresh();
      }
    }
  }
}
