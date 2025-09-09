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

    // Get the plugin instance
    const plugin = (this.app as any).plugins?.plugins?.["obsidian-task-sync"];
    if (!plugin) {
      this.containerEl.createEl("div", {
        text: "Task Sync plugin not found",
        cls: "context-tab-error"
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

  async onClose(): Promise<void> {
    if (this.svelteComponent) {
      this.svelteComponent.$destroy();
      this.svelteComponent = null;
    }
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
