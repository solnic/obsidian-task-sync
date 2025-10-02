/**
 * Global daily planning state store
 * Simple, decoupled state that views can subscribe to
 */

import { writable } from "svelte/store";
import type { Schedule } from "../core/entities";

// Global planning state
export const isPlanningActive = writable<boolean>(false);
export const currentSchedule = writable<Schedule | null>(null);

// Simple functions to update state
export function setPlanningActive(active: boolean): void {
  isPlanningActive.set(active);
}

export function setCurrentSchedule(schedule: Schedule | null): void {
  currentSchedule.set(schedule);
}
