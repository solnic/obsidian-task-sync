/**
 * Schedules entity with Queries and Operations
 * Implements schedule management functionality
 */

import { get } from "svelte/store";
import { Schedule } from "../core/entities";
import { scheduleStore as store } from "../stores/scheduleStore";
import { eventBus } from "../core/events";
import { getDateString } from "../utils/dateFiltering";
import { generateId } from "../utils/idGenerator";
import { EntityOperations } from "../core/extension";

export namespace Schedules {
  export class Queries {
    public readonly entityType = "schedule" as const;

    async getAll(): Promise<readonly Schedule[]> {
      return get(store).schedules;
    }

    async getById(id: string): Promise<Schedule | null> {
      const schedule = get(store).schedules.find((s) => s.id === id);
      return schedule || null;
    }

    async getByExtension(extensionId: string): Promise<readonly Schedule[]> {
      return get(store).schedules.filter(
        (s) => s.source?.extension === extensionId
      );
    }

    /**
     * Get schedule by date
     */
    async getByDate(date: Date): Promise<Schedule | null> {
      const dateString = getDateString(date); // Use local timezone
      const schedule = get(store).schedules.find(
        (s) => getDateString(s.date) === dateString
      );
      return schedule || null;
    }

    /**
     * Get today's schedule
     */
    async getToday(): Promise<Schedule | null> {
      return this.getByDate(new Date());
    }

    /**
     * Get yesterday's schedule
     */
    async getYesterday(): Promise<Schedule | null> {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      return this.getByDate(yesterday);
    }

    /**
     * Get schedules within a date range
     */
    async getByDateRange(
      startDate: Date,
      endDate: Date
    ): Promise<readonly Schedule[]> {
      return get(store).schedules.filter((s) => {
        const scheduleDate = s.date;
        return scheduleDate >= startDate && scheduleDate <= endDate;
      });
    }

    /**
     * Get planned schedules
     */
    async getPlanned(): Promise<readonly Schedule[]> {
      return get(store).schedules.filter((s) => s.isPlanned);
    }

    /**
     * Get unplanned schedules
     */
    async getUnplanned(): Promise<readonly Schedule[]> {
      return get(store).schedules.filter((s) => !s.isPlanned);
    }
  }

  export class Operations extends EntityOperations<Schedule> {
    public readonly entityType = "schedule" as const;

    constructor() {
      super({ id: "schedules-operations" });
    }

    private buildEntity(
      scheduleData: Omit<Schedule, "id" | "createdAt" | "updatedAt">
    ): Schedule {
      const now = this.timestamp();

      return {
        id: generateId(),
        createdAt: now,
        updatedAt: now,
        tasks: [],
        unscheduledTasks: [],
        events: [],
        dailyNoteExists: false,
        isPlanned: false,
        ...scheduleData,
      } as Schedule;
    }

    private timestamp(): Date {
      return new Date();
    }

    // EntityOperations interface methods
    async getAll(): Promise<Schedule[]> {
      return [...get(store).schedules];
    }

    async getById(id: string): Promise<Schedule | undefined> {
      return get(store).schedules.find((s) => s.id === id);
    }

    async create(
      scheduleData: Omit<Schedule, "id" | "createdAt" | "updatedAt">
    ): Promise<Schedule> {
      const schedule = this.buildEntity(scheduleData);

      store.addSchedule(schedule);

      eventBus.trigger({ type: "schedules.created", schedule });

      return schedule;
    }

    async update(id: string, updates: Partial<Schedule>): Promise<Schedule> {
      const existingSchedule = await this.getById(id);
      if (!existingSchedule) {
        throw new Error(`Schedule with id ${id} not found`);
      }

      const updatedSchedule: Schedule = {
        ...existingSchedule,
        ...updates,
        id, // Ensure id doesn't change
        updatedAt: this.timestamp(),
      };

      // Check if anything actually changed (excluding updatedAt)
      const hasChanges = this.hasScheduleChanges(
        existingSchedule,
        updatedSchedule
      );

      if (!hasChanges) {
        // No actual changes, return existing schedule without triggering event
        return existingSchedule;
      }

      store.updateSchedule(updatedSchedule);

      eventBus.trigger({
        type: "schedules.updated",
        schedule: updatedSchedule,
      });

      return updatedSchedule;
    }

    /**
     * Check if two schedules have meaningful differences (excluding updatedAt)
     */
    private hasScheduleChanges(
      oldSchedule: Schedule,
      newSchedule: Schedule
    ): boolean {
      // Compare all fields except updatedAt
      const oldWithoutTimestamp = { ...oldSchedule };
      const newWithoutTimestamp = { ...newSchedule };
      delete (oldWithoutTimestamp as any).updatedAt;
      delete (newWithoutTimestamp as any).updatedAt;

      return (
        JSON.stringify(oldWithoutTimestamp) !==
        JSON.stringify(newWithoutTimestamp)
      );
    }

    async delete(id: string): Promise<boolean> {
      const existingSchedule = await this.getById(id);
      if (!existingSchedule) {
        return false;
      }

      store.removeSchedule(id);
      eventBus.trigger({ type: "schedules.deleted", scheduleId: id });
      return true;
    }

    /**
     * Add a task to a schedule
     */
    async addTask(scheduleId: string, task: any): Promise<Schedule> {
      const schedule = store.findScheduleById(scheduleId);
      if (!schedule) {
        throw new Error(`Schedule with id ${scheduleId} not found`);
      }

      return this.update(scheduleId, {
        tasks: [...schedule.tasks, task],
      });
    }

    /**
     * Remove a task from a schedule
     */
    async removeTask(scheduleId: string, taskId: string): Promise<Schedule> {
      const schedule = store.findScheduleById(scheduleId);
      if (!schedule) {
        throw new Error(`Schedule with id ${scheduleId} not found`);
      }

      return this.update(scheduleId, {
        tasks: schedule.tasks.filter((t) => t.id !== taskId),
      });
    }
  }
}

// Export singleton instances for convenience
export const scheduleQueries = new Schedules.Queries();
export const scheduleOperations = new Schedules.Operations();
