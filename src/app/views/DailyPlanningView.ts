/**
 * Daily Planning View Component
 * Custom ItemView wrapper for the Svelte DailyPlanningView component
 * Adapted for the new extension-based architecture
 */

import { ItemView, WorkspaceLeaf } from "obsidian";
import DailyPlanningViewSvelte from "../components/DailyPlanningView.svelte";
import { mount, unmount } from "svelte";
import { AppleCalendarService } from "../services/AppleCalendarService";
import type { DailyPlanningExtension } from "../extensions/DailyPlanningExtension";
import type { TaskSyncSettings } from "../types/settings";
import { extensionRegistry } from "../core/extension";

export const DAILY_PLANNING_VIEW_TYPE = "daily-planning";

export class DailyPlanningView extends ItemView {
  private svelteComponent: any = null;
  private appleCalendarService: AppleCalendarService;
  private dailyPlanningExtension: DailyPlanningExtension | null = null;
  private settings: TaskSyncSettings;

  constructor(
    leaf: WorkspaceLeaf,
    appleCalendarService: AppleCalendarService,
    settings: TaskSyncSettings
  ) {
    super(leaf);
    this.appleCalendarService = appleCalendarService;
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

    // Get the daily planning extension
    const extension = extensionRegistry.getById("daily-planning");
    if (extension && extension.id === "daily-planning") {
      this.dailyPlanningExtension = extension as DailyPlanningExtension;
    }

    if (this.dailyPlanningExtension) {
      // Start daily planning
      await this.dailyPlanningExtension.startDailyPlanning();
    }

    // Mount Svelte 5 component
    this.svelteComponent = mount(DailyPlanningViewSvelte, {
      target: this.containerEl,
      props: {
        appleCalendarService: this.appleCalendarService,
        dailyPlanningExtension: this.dailyPlanningExtension,
      },
    });
  }

  async onClose(): Promise<void> {
    // Cancel daily planning if it's still active
    if (this.dailyPlanningExtension) {
      const planningActive = await new Promise<boolean>((resolve) => {
        const unsubscribe =
          this.dailyPlanningExtension!.getPlanningActive().subscribe(
            (active) => {
              resolve(active);
              unsubscribe();
            }
          );
      });

      if (planningActive) {
        await this.dailyPlanningExtension.cancelDailyPlanning();
      }
    }

    // Unmount Svelte 5 component
    if (this.svelteComponent) {
      unmount(this.svelteComponent);
      this.svelteComponent = null;
    }
  }
}
