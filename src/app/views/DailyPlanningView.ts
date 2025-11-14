/**
 * Daily Planning View Component
 * Custom ItemView wrapper for the Svelte DailyPlanningView component
 * Adapted for the new extension-based architecture
 */

import { ItemView, WorkspaceLeaf } from "obsidian";
import DailyPlanningViewSvelte from "../extensions/daily-planning/components/DailyPlanningView.svelte";
import { mount, unmount } from "svelte";
import type { DailyPlanningExtension } from "../extensions/daily-planning/DailyPlanningExtension";
import { extensionRegistry } from "../core/extension";

export const DAILY_PLANNING_VIEW_TYPE = "daily-planning";

export class DailyPlanningView extends ItemView {
  private svelteComponent: any = null;
  private dailyPlanningExtension: DailyPlanningExtension | null = null;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
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
        dailyPlanningExtension: this.dailyPlanningExtension,
        onClose: () => this.closeView(),
      },
    });
  }

  /**
   * Close the daily planning view
   */
  private closeView(): void {
    this.app.workspace.detachLeavesOfType(DAILY_PLANNING_VIEW_TYPE);
  }

  async onClose(): Promise<void> {
    // Cancel daily planning if it's still active
    if (this.dailyPlanningExtension) {
      const planningActive = this.dailyPlanningExtension.isPlanningActive();

      if (planningActive) {
        await this.dailyPlanningExtension.cancelDailyPlanning();
      }
    }

    // Unmount Svelte 5 component
    if (this.svelteComponent) {
      await unmount(this.svelteComponent);
      this.svelteComponent = null;
    }
  }
}
