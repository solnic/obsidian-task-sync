/**
 * Day View Component
 * Custom ItemView wrapper for the Svelte DayView component
 */

import { ItemView, WorkspaceLeaf } from "obsidian";
import DayViewSvelte from "../components/DayView.svelte";
import { mount, unmount } from "svelte";
import type { Host } from "../core/host";
import type { TaskSyncSettings } from "../types/settings";

export const DAY_VIEW_TYPE = "task-sync-day";

export class DayView extends ItemView {
  private svelteComponent: any = null;
  private host: Host;
  private settings: TaskSyncSettings;

  constructor(leaf: WorkspaceLeaf, host: Host, settings: TaskSyncSettings) {
    super(leaf);
    this.host = host;
    this.settings = settings;
  }

  getViewType(): string {
    return DAY_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Day View";
  }

  getIcon(): string {
    return "calendar";
  }

  async onOpen(): Promise<void> {
    this.containerEl.empty();
    this.containerEl.addClass("day-view");
    this.containerEl.setAttribute("data-type", DAY_VIEW_TYPE);

    // Mount Svelte 5 component
    this.svelteComponent = mount(DayViewSvelte, {
      target: this.containerEl,
      props: {
        host: this.host,
        settings: this.settings,
      },
    });
  }

  async onClose(): Promise<void> {
    // Unmount Svelte 5 component
    if (this.svelteComponent) {
      await unmount(this.svelteComponent);
      this.svelteComponent = null;
    }
  }

  /**
   * Update settings and refresh the view
   */
  updateSettings(newSettings: TaskSyncSettings): void {
    this.settings = newSettings;
    void this.refresh();
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
