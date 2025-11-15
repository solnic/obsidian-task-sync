/**
 * Context View Component
 * Custom ItemView wrapper for the Svelte ContextView component
 * Displays context information for the currently active file
 */

import { ItemView, WorkspaceLeaf } from "obsidian";
import ContextViewSvelte from "../components/ContextView.svelte";
import { mount, unmount } from "svelte";
import type { Host } from "../core/host";
import type { TaskSyncSettings } from "../types/settings";

export const CONTEXT_VIEW_TYPE = "task-sync-context";

export class ContextView extends ItemView {
  private svelteComponent: any = null;
  private host: Host;
  private settings: TaskSyncSettings;

  constructor(leaf: WorkspaceLeaf, host: Host, settings: TaskSyncSettings) {
    super(leaf);
    this.host = host;
    this.settings = settings;
  }

  getViewType(): string {
    return CONTEXT_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Context";
  }

  getIcon(): string {
    return "info";
  }

  async onOpen(): Promise<void> {
    this.containerEl.empty();
    this.containerEl.addClass("context-view");
    this.containerEl.setAttribute("data-type", CONTEXT_VIEW_TYPE);

    // Mount Svelte 5 component
    this.svelteComponent = mount(ContextViewSvelte, {
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
    if (this.svelteComponent) {
      this.svelteComponent.$set({
        settings: newSettings,
      });
    }
  }
}
