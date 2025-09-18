/**
 * Schedule Store - Manages daily schedules with persistence
 * Handles CRUD operations for schedules and provides reactive updates
 */

import {
  derived,
  writable,
  get,
  type Writable,
  type Readable,
} from "svelte/store";
import { App, Plugin } from "obsidian";
import { generatePrefixedId } from "../utils/idGenerator";
import {
  DailySchedule,
  SchedulePersistenceData,
  SchedulePersistenceItem,
  ScheduleCreateData,
} from "../types/schedule";
import { Task } from "../types/entities";
import { CalendarEvent } from "../types/calendar";
import { taskStore } from "./taskStore";

export interface ScheduleStoreState {
  schedules: DailySchedule[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

export class ScheduleStore {
  private app: App | null = null;
  private plugin: Plugin | null = null;
  private storageKey = "scheduleStore";

  // Core store
  private _store: Writable<ScheduleStoreState>;

  // Public store interface
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
   * Initialize the store with Obsidian app instance and plugin
   */
  async initialize(app: App, plugin: Plugin) {
    this.app = app;
    this.plugin = plugin;

    // Load persisted data
    await this.loadPersistedData();

    console.log(`${this.storageKey}: Store initialized`);
  }

  /**
   * Create a new daily schedule
   */
  async createSchedule(data: ScheduleCreateData): Promise<DailySchedule> {
    const schedule = new DailySchedule(
      this.generateId(),
      data.date,
      data.dailyNotePath
    );

    if (data.tasks) {
      data.tasks.forEach((task) => schedule.addTask(task));
    }

    if (data.events) {
      schedule.addEvents(data.events);
    }

    await this.upsertSchedule(schedule);
    return schedule;
  }

  /**
   * Add or update a schedule in the store
   */
  async upsertSchedule(schedule: DailySchedule): Promise<void> {
    this._store.update((state) => {
      const existingIndex = state.schedules.findIndex(
        (s) => s.id === schedule.id
      );

      let updatedSchedules: DailySchedule[];
      if (existingIndex !== -1) {
        updatedSchedules = [...state.schedules];
        updatedSchedules[existingIndex] = schedule;
      } else {
        updatedSchedules = [...state.schedules, schedule];
      }

      return {
        ...state,
        schedules: updatedSchedules,
        lastUpdated: new Date(),
      };
    });

    await this.persistData();
  }

  /**
   * Remove a schedule from the store
   */
  async removeSchedule(scheduleId: string): Promise<void> {
    this._store.update((state) => ({
      ...state,
      schedules: state.schedules.filter((s) => s.id !== scheduleId),
      lastUpdated: new Date(),
    }));

    await this.persistData();
  }

  /**
   * Get all schedules
   */
  getSchedules(): DailySchedule[] {
    const state = get(this._store);
    return [...state.schedules];
  }

  /**
   * Find a schedule by ID
   */
  findScheduleById(scheduleId: string): DailySchedule | null {
    const state = get(this._store);
    return state.schedules.find((s) => s.id === scheduleId) || null;
  }

  /**
   * Find a schedule by date
   */
  findScheduleByDate(date: Date): DailySchedule | null {
    const state = get(this._store);
    const dateString = date.toISOString().split("T")[0];
    return (
      state.schedules.find((s) => s.getDateString() === dateString) || null
    );
  }

  /**
   * Get or create a schedule for today
   */
  async getTodaySchedule(): Promise<DailySchedule> {
    const today = new Date();
    let schedule = this.findScheduleByDate(today);

    if (!schedule) {
      schedule = await this.createSchedule({ date: today });
    }

    return schedule;
  }

  /**
   * Get or create a schedule for yesterday
   */
  async getYesterdaySchedule(): Promise<DailySchedule> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    let schedule = this.findScheduleByDate(yesterday);

    if (!schedule) {
      schedule = await this.createSchedule({ date: yesterday });
    }

    return schedule;
  }

  /**
   * Add a task to a schedule
   */
  async addTaskToSchedule(scheduleId: string, task: Task): Promise<void> {
    const schedule = this.findScheduleById(scheduleId);
    if (schedule) {
      schedule.addTask(task);
      await this.upsertSchedule(schedule);
    }
  }

  /**
   * Remove a task from a schedule
   */
  async removeTaskFromSchedule(
    scheduleId: string,
    taskId: string
  ): Promise<void> {
    const schedule = this.findScheduleById(scheduleId);
    if (schedule) {
      schedule.removeTask(taskId);
      await this.upsertSchedule(schedule);
    }
  }

  /**
   * Add events to a schedule
   */
  async addEventsToSchedule(
    scheduleId: string,
    events: CalendarEvent[]
  ): Promise<void> {
    const schedule = this.findScheduleById(scheduleId);
    if (schedule) {
      schedule.addEvents(events);
      await this.upsertSchedule(schedule);
    }
  }

  /**
   * Mark a schedule as planned
   */
  async markScheduleAsPlanned(scheduleId: string): Promise<void> {
    const schedule = this.findScheduleById(scheduleId);
    if (schedule) {
      schedule.markAsPlanned();
      await this.upsertSchedule(schedule);
    }
  }

  /**
   * Clear all schedules (for testing)
   */
  async clearAllSchedules(): Promise<void> {
    this._store.update((state) => ({
      ...state,
      schedules: [],
      lastUpdated: new Date(),
    }));

    await this.persistData();
  }

  /**
   * Generate a unique ID for schedules
   */
  private generateId(): string {
    return generatePrefixedId("schedule");
  }

  /**
   * Load persisted data from plugin storage
   */
  private async loadPersistedData() {
    if (!this.plugin) return;

    try {
      const data = await this.plugin.loadData();
      if (data && data[this.storageKey]) {
        const persistedData: SchedulePersistenceData = data[this.storageKey];

        if (persistedData.schedules && persistedData.schedules.length > 0) {
          // Restore schedules from persisted data
          const restoredSchedules = persistedData.schedules.map(
            (scheduleData: SchedulePersistenceItem) => {
              const schedule = new DailySchedule(
                scheduleData.id,
                new Date(scheduleData.date),
                scheduleData.dailyNotePath
              );

              // Restore properties
              schedule.createdAt = new Date(scheduleData.createdAt);
              schedule.updatedAt = new Date(scheduleData.updatedAt);
              schedule.dailyNoteExists = scheduleData.dailyNoteExists || false;
              schedule.isPlanned = scheduleData.isPlanned || false;
              schedule.planningCompletedAt = scheduleData.planningCompletedAt
                ? new Date(scheduleData.planningCompletedAt)
                : undefined;

              // Restore tasks from task IDs, filtering out missing tasks
              if (scheduleData.taskIds) {
                const allTasks = taskStore.getEntities();
                schedule.tasks = scheduleData.taskIds
                  .map((taskId) => allTasks.find((task) => task.id === taskId))
                  .filter((task): task is Task => task !== undefined);
              }

              // Restore unscheduled tasks from task IDs, filtering out missing tasks
              if (scheduleData.unscheduledTaskIds) {
                const allTasks = taskStore.getEntities();
                schedule.unscheduledTasks = scheduleData.unscheduledTaskIds
                  .map((taskId) => allTasks.find((task) => task.id === taskId))
                  .filter((task): task is Task => task !== undefined);
              }

              // Restore events (stored as full objects)
              schedule.events = scheduleData.events || [];

              return schedule;
            }
          );

          // Update store with restored schedules
          this._store.update((state) => ({
            ...state,
            schedules: restoredSchedules,
            lastUpdated: persistedData.lastSync
              ? new Date(persistedData.lastSync)
              : new Date(),
          }));

          console.log(
            `${this.storageKey}: Restored ${restoredSchedules.length} schedules from storage`
          );
        }
      }
    } catch (error) {
      console.error(`Failed to load persisted ${this.storageKey} data:`, error);
    }
  }

  /**
   * Persist current store data to plugin storage
   */
  async persistData(): Promise<void> {
    if (!this.plugin) return;

    try {
      const state = get(this._store);
      const existingData = (await this.plugin.loadData()) || {};

      // Convert schedules to persistence format with task IDs
      const persistenceSchedules: SchedulePersistenceItem[] =
        state.schedules.map((schedule) => ({
          id: schedule.id,
          date: schedule.date.toISOString(),
          dailyNotePath: schedule.dailyNotePath,
          dailyNoteExists: schedule.dailyNoteExists,
          isPlanned: schedule.isPlanned,
          planningCompletedAt: schedule.planningCompletedAt?.toISOString(),
          createdAt: schedule.createdAt.toISOString(),
          updatedAt: schedule.updatedAt.toISOString(),
          taskIds: schedule.tasks.map((task) => task.id),
          unscheduledTaskIds: schedule.unscheduledTasks.map((task) => task.id),
          events: schedule.events,
        }));

      const persistenceData: SchedulePersistenceData = {
        schedules: persistenceSchedules,
        lastSync: new Date(),
      };

      const updatedData = {
        ...existingData,
        [this.storageKey]: persistenceData,
      };

      await this.plugin.saveData(updatedData);
    } catch (error) {
      console.error(`Failed to persist ${this.storageKey} data:`, error);
    }
  }
}

// Export singleton instance
export const scheduleStore = new ScheduleStore();

// Derived stores for common queries
export const todaySchedule = derived(scheduleStore, ($store) => {
  const today = new Date().toISOString().split("T")[0];
  return $store.schedules.find((s) => s.getDateString() === today) || null;
});

export const yesterdaySchedule = derived(scheduleStore, ($store) => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayString = yesterday.toISOString().split("T")[0];
  return (
    $store.schedules.find((s) => s.getDateString() === yesterdayString) || null
  );
});
