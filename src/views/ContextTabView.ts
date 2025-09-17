/**
 * Context Tab View Component
 * Custom ItemView wrapper for the Svelte ContextTabView component
 */

import { ItemView, WorkspaceLeaf } from "obsidian";
import type { FileContext } from "../main";
import ContextTabViewSvelte from "../components/svelte/ContextTabView.svelte";
import type { SvelteComponent } from "svelte";

export const CONTEXT_TAB_VIEW_TYPE = "context-tab";

/**
 * Custom view for displaying context-aware entity properties and actions
 */
export class ContextTabView extends ItemView {
  private svelteComponent: SvelteComponent | null = null;
  private currentContext: FileContext = { type: "none" };
  private isComponentCreated: boolean = false;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType(): string {
    return CONTEXT_TAB_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Context";
  }

  getIcon(): string {
    return "info";
  }

  async onOpen(): Promise<void> {
    this.containerEl.empty();
    this.containerEl.addClass("context-tab-view-container");
    this.containerEl.setAttribute("data-type", CONTEXT_TAB_VIEW_TYPE);

    // Check if this is a deferred view (not yet active)
    if (this.leaf.isDeferred) {
      // Don't create the component yet, wait until the view becomes active
      return;
    }

    this.createComponent();
  }

  private createComponent(): void {
    if (this.isComponentCreated) {
      return;
    }

    // Get the plugin instance
    const plugin = (this.app as any).plugins?.plugins?.["obsidian-task-sync"];
    if (!plugin) {
      console.error("Task Sync plugin not found");
      this.containerEl.createEl("div", {
        text: "Task Sync plugin not found",
        cls: "context-tab-error",
      });
      return;
    }

    // Get current context
    this.currentContext = plugin.getCurrentContext();

    // Create the Svelte component
    this.svelteComponent = new ContextTabViewSvelte({
      target: this.containerEl,
      props: {
        context: this.currentContext,
      },
      context: new Map([
        [
          "task-sync-plugin",
          {
            plugin: plugin,
          },
        ],
      ]),
    });

    this.isComponentCreated = true;

    // Listen for context changes
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        this.updateContext();
      })
    );

    this.registerEvent(
      this.app.workspace.on("file-open", () => {
        this.updateContext();
      })
    );
  }

  /**
   * Override setState to handle when view becomes active (no longer deferred)
   */
  async setState(state: any, result: any): Promise<void> {
    await super.setState(state, result);

    // If the view was deferred and is now becoming active, create the component
    if (!this.isComponentCreated && !this.leaf.isDeferred) {
      this.createComponent();
    }
  }

  /**
   * Override onResize to handle when view becomes active (no longer deferred)
   */
  async onResize(): Promise<void> {
    // If the view was deferred and is now becoming active, create the component
    if (!this.isComponentCreated && !this.leaf.isDeferred) {
      this.createComponent();
    }
  }

  async onClose(): Promise<void> {
    if (this.svelteComponent) {
      this.svelteComponent.$destroy();
      this.svelteComponent = null;
    }
    this.isComponentCreated = false;
  }

  /**
   * Update the context when the active file changes
   */
  private updateContext(): void {
    const plugin = (this.app as any).plugins?.plugins?.["obsidian-task-sync"];
    if (!plugin || !this.svelteComponent) return;

    const newContext = plugin.getCurrentContext();

    // Only update if context actually changed
    if (
      this.currentContext.type !== newContext.type ||
      this.currentContext.name !== newContext.name ||
      this.currentContext.path !== newContext.path
    ) {
      this.currentContext = newContext;

      // Update the Svelte component's context prop
      this.svelteComponent.$set({ context: newContext });
    }
  }

  /**
   * Refresh the view
   */
  async refresh(): Promise<void> {
    this.updateContext();
  }
}
