/**
 * Task Planning View Component
 * Custom ItemView wrapper for the Svelte TaskPlanningView component
 */

import { ItemView, WorkspaceLeaf } from "obsidian";
import { AppleCalendarService } from "../services/AppleCalendarService";
import { AppleCalendarIntegrationSettings } from "../components/ui/settings/types";
import TaskPlanningViewSvelte from "../components/svelte/TaskPlanningView.svelte";
import type { SvelteComponent } from "svelte";

export const TASK_PLANNING_VIEW_TYPE = "task-planning";

export interface TaskPlanningViewSettings {
  appleCalendarIntegration: AppleCalendarIntegrationSettings;
}

export class TaskPlanningView extends ItemView {
  private svelteComponent: SvelteComponent | null = null;
  private appleCalendarService: AppleCalendarService;
  private settings: TaskPlanningViewSettings;

  constructor(
    leaf: WorkspaceLeaf,
    appleCalendarService: AppleCalendarService,
    settings: TaskPlanningViewSettings
  ) {
    super(leaf);
    this.appleCalendarService = appleCalendarService;
    this.settings = settings;
  }

  getViewType(): string {
    return TASK_PLANNING_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Task Planning";
  }

  getIcon(): string {
    return "calendar";
  }

  async onOpen(): Promise<void> {
    this.containerEl.empty();
    this.containerEl.addClass("task-planning-view");
    this.containerEl.setAttribute("data-type", TASK_PLANNING_VIEW_TYPE);

    // Create the Svelte component
    this.svelteComponent = new TaskPlanningViewSvelte({
      target: this.containerEl,
      props: {
        appleCalendarService: this.appleCalendarService,
        settings: this.settings,
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
   * Refresh the view
   */
  async refresh(): Promise<void> {
    if (this.svelteComponent) {
      // Force refresh by updating props
      this.svelteComponent.$set({
        settings: this.settings,
      });
    }
  }
}
