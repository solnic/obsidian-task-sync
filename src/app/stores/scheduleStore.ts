/**
 * Schedule Store - Manages daily schedules with reactive updates
 * Provides a centralized store for schedule data following the new architecture patterns
 */

import {
  writable,
  derived,
  get,
  type Writable,
  type Readable,
} from "svelte/store";
import type { Schedule, ScheduleCreateData } from "../core/entities";
import { generateId } from "../utils/idGenerator";

export interface ScheduleStoreState {
  schedules: readonly Schedule[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

class ScheduleStore {
  private _store: Writable<ScheduleStoreState>;
  public subscribe: Readable<ScheduleStoreState>["subscribe"];

  constructor() {
    this._store = writable<ScheduleStoreState>({
      schedules: [],
      loading: false,
      error: null,
      lastUpdated: null,
    });
    this.subscribe = this._store.subscribe;
  }

  /**
   * Add a new schedule to the store
   */
  addSchedule(schedule: Schedule): void {
    this._store.update((state) => ({
      ...state,
      schedules: [...state.schedules, schedule],
      lastUpdated: new Date(),
    }));
  }

  /**
   * Update an existing schedule in the store
   */
  updateSchedule(updatedSchedule: Schedule): void {
    this._store.update((state) => ({
      ...state,
      schedules: state.schedules.map((schedule) =>
        schedule.id === updatedSchedule.id ? updatedSchedule : schedule
      ),
      lastUpdated: new Date(),
    }));
  }

  /**
   * Remove a schedule from the store
   */
  removeSchedule(scheduleId: string): void {
    this._store.update((state) => ({
      ...state,
      schedules: state.schedules.filter(
        (schedule) => schedule.id !== scheduleId
      ),
      lastUpdated: new Date(),
    }));
  }

  /**
   * Get all schedules
   */
  getSchedules(): readonly Schedule[] {
    const state = get(this._store);
    return state.schedules;
  }

  /**
   * Find a schedule by ID
   */
  findScheduleById(scheduleId: string): Schedule | null {
    const state = get(this._store);
    return state.schedules.find((s) => s.id === scheduleId) || null;
  }

  /**
   * Find a schedule by date
   */
  findScheduleByDate(date: Date): Schedule | null {
    const state = get(this._store);
    const dateString = this.getDateString(date);
    return (
      state.schedules.find((s) => this.getDateString(s.date) === dateString) ||
      null
    );
  }

  /**
   * Set loading state
   */
  setLoading(loading: boolean): void {
    this._store.update((state) => ({
      ...state,
      loading,
    }));
  }

  /**
   * Set error state
   */
  setError(error: string | null): void {
    this._store.update((state) => ({
      ...state,
      error,
    }));
  }

  /**
   * Clear all schedules (for testing)
   */
  clearAllSchedules(): void {
    this._store.update((state) => ({
      ...state,
      schedules: [],
      lastUpdated: new Date(),
    }));
  }

  /**
   * Get a formatted date string for comparison
   */
  private getDateString(date: Date): string {
    return date.toISOString().split("T")[0];
  }
}

// Export singleton instance
export const scheduleStore = new ScheduleStore();

// Derived stores for common queries
export const todaySchedule = derived(scheduleStore, ($store) => {
  const today = new Date();
  const todayString = today.toISOString().split("T")[0];
  return (
    $store.schedules.find(
      (s) => s.date.toISOString().split("T")[0] === todayString
    ) || null
  );
});

export const yesterdaySchedule = derived(scheduleStore, ($store) => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayString = yesterday.toISOString().split("T")[0];
  return (
    $store.schedules.find(
      (s) => s.date.toISOString().split("T")[0] === yesterdayString
    ) || null
  );
});

// Helper functions for schedule management
export function createSchedule(data: ScheduleCreateData): Schedule {
  const now = new Date();
  return {
    id: generateId(),
    date: data.date,
    createdAt: now,
    updatedAt: now,
    tasks: data.tasks || [],
    unscheduledTasks: [],
    events: data.events || [],
    dailyNotePath: data.dailyNotePath,
    dailyNoteExists: false,
    isPlanned: false,
    planningCompletedAt: undefined,
    source: {
      extension: "daily-planning",
      keys: {},
    },
  };
}
