/**
 * Tasks View Component
 * Generic container view for multiple task integration services
 */

import { ItemView, WorkspaceLeaf } from "obsidian";
import { GitHubService } from "../services/GitHubService";
import { GitHubIntegrationSettings } from "../components/ui/settings/types";
import { TaskImportManager } from "../services/TaskImportManager";
import { TaskImportConfig } from "../types/integrations";
import TasksViewSvelte from "../components/svelte/TasksView.svelte";
import type { SvelteComponent } from "svelte";

export const TASKS_VIEW_TYPE = "tasks";

export interface TasksViewSettings {
  githubIntegration: GitHubIntegrationSettings;
}

export interface TasksViewDependencies {
  taskImportManager: TaskImportManager;
  getDefaultImportConfig: () => TaskImportConfig;
}

/**
 * Custom view for browsing tasks from multiple integration services using Svelte
 */
export class TasksView extends ItemView {
  private githubService: GitHubService;
  private settings: TasksViewSettings;
  private dependencies: TasksViewDependencies;
  private svelteComponent: SvelteComponent | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    githubService: GitHubService,
    settings: TasksViewSettings,
    dependencies: TasksViewDependencies
  ) {
    super(leaf);
    this.githubService = githubService;
    this.settings = settings;
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

    // Create the Svelte component
    this.svelteComponent = new TasksViewSvelte({
      target: this.containerEl,
      props: {
        githubService: this.githubService,
        settings: this.settings,
        dependencies: this.dependencies,
      },
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
  }

  async onClose(): Promise<void> {
    if (this.svelteComponent) {
      this.svelteComponent.$destroy();
      this.svelteComponent = null;
    }
  }

  /**
   * Update settings and refresh the Svelte component
   */
  updateSettings(settings: TasksViewSettings): void {
    this.settings = settings;

    // Call the Svelte component's updateSettings method
    const methods = (window as any).__tasksViewMethods;
    if (methods && methods.updateSettings) {
      methods.updateSettings(settings);
    }
  }

  /**
   * Refresh repositories and issues
   */
  async refresh(): Promise<void> {
    // Call the Svelte component's refresh method
    const methods = (window as any).__tasksViewMethods;
    if (methods && methods.refresh) {
      await methods.refresh();
    }
  }
}
