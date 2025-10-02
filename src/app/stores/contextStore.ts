/**
 * Context Store - Reactive store for tracking current file context
 * Ported from old-stuff/components/svelte/context.ts for new architecture
 */

import { writable, get, type Writable } from "svelte/store";
import type { FileContext } from "../types/context";

// Reactive context store for tracking current file context
export const currentFileContext: Writable<FileContext> = writable({
  type: "none",
  dailyPlanningMode: false,
});

/**
 * Get the current context store for use in Svelte components
 */
export function getContextStore(): Writable<FileContext> {
  return currentFileContext;
}

/**
 * Update the daily planning mode in the context store
 */
export function setDailyPlanningMode(isActive: boolean): void {
  currentFileContext.update((context) => ({
    ...context,
    dailyPlanningMode: isActive,
  }));
}

/**
 * Get the current daily planning mode
 */
export function getDailyPlanningMode(): boolean {
  const context = get(currentFileContext);
  return context.dailyPlanningMode || false;
}

/**
 * Update the current file context
 */
export function updateFileContext(newContext: FileContext): void {
  const currentContext = get(currentFileContext);
  
  // Only update if context actually changed (preserve dailyPlanningMode)
  if (
    currentContext.type !== newContext.type ||
    currentContext.name !== newContext.name ||
    currentContext.path !== newContext.path
  ) {
    currentFileContext.update((context) => ({
      ...newContext,
      dailyPlanningMode: context.dailyPlanningMode || false,
    }));
  }
}

/**
 * Get the current context value (non-reactive)
 */
export function getCurrentContext(): FileContext {
  return get(currentFileContext);
}
