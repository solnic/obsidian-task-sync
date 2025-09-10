import { getContext, setContext } from "svelte";
import { writable, type Writable } from "svelte/store";
import type TaskSyncPlugin from "../../main";
import type { FileContext } from "../../main";

export interface PluginContext {
  plugin: TaskSyncPlugin;
}

const PLUGIN_CONTEXT_KEY = "task-sync-plugin";

export function setPluginContext(context: PluginContext) {
  setContext(PLUGIN_CONTEXT_KEY, context);
}

export function getPluginContext(): PluginContext {
  return getContext(PLUGIN_CONTEXT_KEY);
}

// Reactive context store for tracking current file context
export const currentFileContext: Writable<FileContext> = writable({
  type: "none",
});

/**
 * Initialize the context store with the plugin instance
 * This should be called when the plugin loads
 */
export function initializeContextStore(plugin: TaskSyncPlugin): void {
  // Set initial context
  currentFileContext.set(plugin.getCurrentContext());

  // Listen for context changes from the plugin
  // We'll use a custom event system to notify when context changes
  const updateContext = () => {
    const newContext = plugin.getCurrentContext();
    currentFileContext.set(newContext);
  };

  // Register workspace events to update context
  plugin.registerEvent(
    plugin.app.workspace.on("active-leaf-change", updateContext),
  );

  plugin.registerEvent(plugin.app.workspace.on("file-open", updateContext));
}

/**
 * Get the current context store for use in Svelte components
 */
export function getContextStore(): Writable<FileContext> {
  return currentFileContext;
}
