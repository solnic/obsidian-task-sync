/**
 * Context Store - Reactive store for tracking current file context
 * Ported from old-stuff/components/svelte/context.ts for new architecture
 */

import {
  writable,
  get,
  derived,
  type Writable,
  type Readable,
} from "svelte/store";
import type { FileContext } from "../types/context";
import type { Schedule } from "../core/entities";

// Reactive context store for tracking current file context
export const currentFileContext: Writable<FileContext> = writable({
  type: "none",
  dailyPlanningMode: false,
});

// Derived store for daily planning mode (reactive equivalent to isPlanningActive)
export const isPlanningActive: Readable<boolean> = derived(
  currentFileContext,
  ($context) => $context.dailyPlanningMode || false
);

// Current schedule store for daily planning (temporary - should move to scheduleStore)
export const currentSchedule: Writable<Schedule | null> = writable(null);

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
 * Set planning active state (alias for setDailyPlanningMode for compatibility)
 */
export function setPlanningActive(active: boolean): void {
  setDailyPlanningMode(active);
}

/**
 * Set the current schedule for daily planning
 */
export function setCurrentSchedule(schedule: Schedule | null): void {
  currentSchedule.set(schedule);
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
  const entityChanged =
    (currentContext.entity?.id || null) !== (newContext.entity?.id || null);

  const shouldUpdate =
    currentContext.type !== newContext.type ||
    currentContext.name !== newContext.name ||
    currentContext.path !== newContext.path ||
    entityChanged;

  console.log("updateFileContext called:", {
    currentType: currentContext.type,
    newType: newContext.type,
    currentEntityId: currentContext.entity?.id,
    newEntityId: newContext.entity?.id,
    entityChanged,
    shouldUpdate,
  });

  if (shouldUpdate) {
    const updatedContext = {
      ...newContext,
      dailyPlanningMode: currentContext.dailyPlanningMode || false,
    };

    console.log("About to update store with:", {
      type: updatedContext.type,
      name: updatedContext.name,
      hasEntity: !!updatedContext.entity,
      entityId: updatedContext.entity?.id,
      entityTitle:
        updatedContext.entity && "title" in updatedContext.entity
          ? updatedContext.entity.title
          : updatedContext.entity && "name" in updatedContext.entity
          ? updatedContext.entity.name
          : "unknown",
    });

    currentFileContext.update((_context) => updatedContext);

    console.log("Context store updated with:", {
      type: newContext.type,
      name: newContext.name,
      hasEntity: !!newContext.entity,
      entityId: newContext.entity?.id,
    });
  }
}

/**
 * Get the current context value (non-reactive)
 */
export function getCurrentContext(): FileContext {
  return get(currentFileContext);
}
