/**
 * Schedule entity types for Daily Planning feature
 * Defines abstract Schedule class and DailySchedule specialization
 */

import { BaseEntity, Task } from "./entities";
import { CalendarEvent } from "./calendar";

/**
 * Abstract Schedule entity - base class for all schedule types
 */
export abstract class Schedule implements BaseEntity {
  id: string;
  file?: any; // TFile reference if persisted
  filePath?: string;

  // Schedule metadata
  date: Date; // The date this schedule is for
  createdAt: Date;
  updatedAt: Date;

  // Tasks included in this schedule
  tasks: Task[];

  // Calendar events for this schedule
  events: CalendarEvent[];

  constructor(id: string, date: Date) {
    this.id = id;
    this.date = date;
    this.createdAt = new Date();
    this.updatedAt = new Date();
    this.tasks = [];
    this.events = [];
  }

  /**
   * Add a task to this schedule
   */
  addTask(task: Task): void {
    if (!this.tasks.find(t => t.id === task.id)) {
      this.tasks.push(task);
      this.updatedAt = new Date();
    }
  }

  /**
   * Remove a task from this schedule
   */
  removeTask(taskId: string): void {
    const index = this.tasks.findIndex(t => t.id === taskId);
    if (index !== -1) {
      this.tasks.splice(index, 1);
      this.updatedAt = new Date();
    }
  }

  /**
   * Add calendar events to this schedule
   */
  addEvents(events: CalendarEvent[]): void {
    this.events = events;
    this.updatedAt = new Date();
  }

  /**
   * Get tasks grouped by completion status
   */
  getTasksByStatus(): { done: Task[]; notDone: Task[] } {
    return {
      done: this.tasks.filter(task => task.done === true),
      notDone: this.tasks.filter(task => task.done !== true)
    };
  }

  /**
   * Get the start and end dates for this schedule
   */
  abstract getStartDate(): Date;
  abstract getEndDate(): Date;

  /**
   * Check if this schedule is for today
   */
  isToday(): boolean {
    const today = new Date();
    const scheduleDate = this.date;
    return (
      today.getFullYear() === scheduleDate.getFullYear() &&
      today.getMonth() === scheduleDate.getMonth() &&
      today.getDate() === scheduleDate.getDate()
    );
  }

  /**
   * Check if this schedule is for yesterday
   */
  isYesterday(): boolean {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const scheduleDate = this.date;
    return (
      yesterday.getFullYear() === scheduleDate.getFullYear() &&
      yesterday.getMonth() === scheduleDate.getMonth() &&
      yesterday.getDate() === scheduleDate.getDate()
    );
  }
}

/**
 * Daily Schedule entity - represents a schedule for a specific day
 */
export class DailySchedule extends Schedule {
  // Daily note information
  dailyNotePath?: string;
  dailyNoteExists: boolean = false;

  // Planning state
  isPlanned: boolean = false;
  planningCompletedAt?: Date;

  constructor(id: string, date: Date, dailyNotePath?: string) {
    super(id, date);
    this.dailyNotePath = dailyNotePath;
  }

  /**
   * Get start of day for this schedule
   */
  getStartDate(): Date {
    const start = new Date(this.date);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  /**
   * Get end of day for this schedule
   */
  getEndDate(): Date {
    const end = new Date(this.date);
    end.setHours(23, 59, 59, 999);
    return end;
  }

  /**
   * Mark this schedule as planned
   */
  markAsPlanned(): void {
    this.isPlanned = true;
    this.planningCompletedAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * Set the daily note path for this schedule
   */
  setDailyNotePath(path: string): void {
    this.dailyNotePath = path;
    this.dailyNoteExists = true;
    this.updatedAt = new Date();
  }

  /**
   * Get a formatted date string for this schedule
   */
  getDateString(): string {
    return this.date.toISOString().split('T')[0]; // YYYY-MM-DD format
  }

  /**
   * Get a human-readable date string
   */
  getDisplayDate(): string {
    return this.date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  /**
   * Check if this schedule has any tasks or events
   */
  isEmpty(): boolean {
    return this.tasks.length === 0 && this.events.length === 0;
  }

  /**
   * Get summary statistics for this schedule
   */
  getSummary(): {
    totalTasks: number;
    doneTasks: number;
    pendingTasks: number;
    totalEvents: number;
  } {
    const { done, notDone } = this.getTasksByStatus();
    return {
      totalTasks: this.tasks.length,
      doneTasks: done.length,
      pendingTasks: notDone.length,
      totalEvents: this.events.length
    };
  }
}

/**
 * Interface for schedule persistence data
 */
export interface SchedulePersistenceData {
  schedules: DailySchedule[];
  lastSync: Date;
}

/**
 * Schedule creation data interface
 */
export interface ScheduleCreateData {
  date: Date;
  dailyNotePath?: string;
  tasks?: Task[];
  events?: CalendarEvent[];
}
