/**
 * GitHub Issues View Component
 * Custom ItemView wrapper for the Svelte GitHubIssuesView component
 */

import { ItemView, WorkspaceLeaf } from "obsidian";
import { GitHubService } from "../services/GitHubService";
import { GitHubIntegrationSettings } from "../components/ui/settings/types";
import { TaskImportManager } from "../services/TaskImportManager";
import { TaskImportConfig } from "../types/integrations";
import GitHubIssuesViewSvelte from "../components/svelte/GitHubIssuesView.svelte";
import type { SvelteComponent } from "svelte";

export const GITHUB_ISSUES_VIEW_TYPE = "github-issues";

export interface GitHubIssuesViewSettings {
  githubIntegration: GitHubIntegrationSettings;
}

export interface GitHubIssuesViewDependencies {
  taskImportManager: TaskImportManager;
  getDefaultImportConfig: () => TaskImportConfig;
}

/**
 * Custom view for browsing GitHub issues using Svelte
 */
export class GitHubIssuesView extends ItemView {
  private githubService: GitHubService;
  private settings: GitHubIssuesViewSettings;
  private dependencies: GitHubIssuesViewDependencies;
  private svelteComponent: SvelteComponent | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    githubService: GitHubService,
    settings: GitHubIssuesViewSettings,
    dependencies: GitHubIssuesViewDependencies
  ) {
    super(leaf);
    this.githubService = githubService;
    this.settings = settings;
    this.dependencies = dependencies;
  }

  getViewType(): string {
    return GITHUB_ISSUES_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Task Sync";
  }

  getIcon(): string {
    return "github";
  }

  async onOpen(): Promise<void> {
    this.containerEl.empty();
    this.containerEl.addClass("github-issues-view");
    this.containerEl.setAttribute("data-type", GITHUB_ISSUES_VIEW_TYPE);

    // Create the Svelte component
    this.svelteComponent = new GitHubIssuesViewSvelte({
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
  updateSettings(settings: GitHubIssuesViewSettings): void {
    this.settings = settings;

    // Call the Svelte component's updateSettings method
    const methods = (window as any).__githubIssuesViewMethods;
    if (methods && methods.updateSettings) {
      methods.updateSettings(settings);
    }
  }

  /**
   * Refresh repositories and issues
   */
  async refresh(): Promise<void> {
    // Call the Svelte component's refresh method
    const methods = (window as any).__githubIssuesViewMethods;
    if (methods && methods.refresh) {
      await methods.refresh();
    }
  }
}
