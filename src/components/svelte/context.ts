import { getContext, setContext } from 'svelte';
import type TaskSyncPlugin from '../../main';

export interface PluginContext {
  plugin: TaskSyncPlugin;
}

const PLUGIN_CONTEXT_KEY = 'task-sync-plugin';

export function setPluginContext(context: PluginContext) {
  setContext(PLUGIN_CONTEXT_KEY, context);
}

export function getPluginContext(): PluginContext {
  return getContext(PLUGIN_CONTEXT_KEY);
}
