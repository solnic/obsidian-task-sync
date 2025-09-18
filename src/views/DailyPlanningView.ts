/**
 * Daily Planning View Component
 * Custom ItemView wrapper for the Svelte DailyPlanningView component
 */

import { ItemView, WorkspaceLeaf } from "obsidian";
import DailyPlanningViewSvelte from "../components/svelte/DailyPlanningView.svelte";
import type { SvelteComponent } from "svelte";
import { AppleCalendarService } from "../services/AppleCalendarService";
import { DailyNoteService } from "../services/DailyNoteService";
import { TaskSyncSettings } from "../main";
import { setDailyPlanningMode } from "../components/svelte/context";

export const DAILY_PLANNING_VIEW_TYPE = "daily-planning";

export class DailyPlanningView extends ItemView {
  private svelteComponent: SvelteComponent | null = null;
  private appleCalendarService: AppleCalendarService;
  private dailyNoteService: DailyNoteService;
  private settings: {
    appleCalendarIntegration: TaskSyncSettings["appleCalendarIntegration"];
  };

  constructor(
    leaf: WorkspaceLeaf,
    appleCalendarService: AppleCalendarService,
    dailyNoteService: DailyNoteService,
    settings: {
      appleCalendarIntegration: TaskSyncSettings["appleCalendarIntegration"];
    }
  ) {
    super(leaf);
    this.appleCalendarService = appleCalendarService;
    this.dailyNoteService = dailyNoteService;
    this.settings = settings;
  }

  getViewType(): string {
    return DAILY_PLANNING_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Daily Planning";
  }

  getIcon(): string {
    return "calendar-days";
  }

  async onOpen(): Promise<void> {
    this.containerEl.empty();
    this.containerEl.addClass("daily-planning-view");
    this.containerEl.setAttribute("data-type", DAILY_PLANNING_VIEW_TYPE);

    // Set daily planning mode to true in the context store
    setDailyPlanningMode(true);

    // Create the Svelte component
    this.svelteComponent = new DailyPlanningViewSvelte({
      target: this.containerEl,
      props: {
        appleCalendarService: this.appleCalendarService,
        dailyNoteService: this.dailyNoteService,
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
    // Set daily planning mode to false in the context store
    setDailyPlanningMode(false);

    if (this.svelteComponent) {
      this.svelteComponent.$destroy();
      this.svelteComponent = null;
    }
  }
}
