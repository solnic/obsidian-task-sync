/**
 * Calendar Extension for TaskSync
 * Provides calendar functionality through Day View (NOT integrated with Tasks tab)
 * Manages calendar services and provides calendar data access
 */

import { Plugin } from "obsidian";
import { Extension, extensionRegistry, EntityType } from "../../core/extension";
import { eventBus } from "../../core/events";
import { derived, writable, type Readable } from "svelte/store";
import { Task } from "../../core/entities";
import { ulid } from "ulid";
import {
  CalendarService,
  calendarServiceRegistry,
} from "./services/CalendarService";
import { calendarOperations } from "./entities/Calendar";
import type {
  Calendar,
  CalendarEvent,
  CalendarEventFetchOptions,
} from "../../types/calendar";
import type { TaskSyncSettings } from "../../types/settings";

export class CalendarExtension implements Extension {
  readonly id = "calendar";
  readonly name = "Calendar";
  readonly version = "1.0.0";
  readonly supportedEntities: readonly EntityType[] = ["task"]; // Support task entities

  private initialized = false;
  private plugin: Plugin;
  private settings: TaskSyncSettings;
  private calendarServices: CalendarService[] = [];

  // Internal state for calendar data
  private calendarsStore = writable<Calendar[]>([]);
  private eventsStore = writable<CalendarEvent[]>([]);
  private loadingStore = writable<boolean>(false);
  private errorStore = writable<string | null>(null);

  // Entity store - holds Task entities mapped from calendar events
  private rawEntityStore = writable<Task[]>([]);

  constructor(settings: TaskSyncSettings, plugin: Plugin) {
    this.settings = settings;
    this.plugin = plugin;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      console.log("Initializing CalendarExtension...");

      // Initialize calendar services (will be added as they're created)
      // For now, we'll add services when they're registered

      // Register extension
      extensionRegistry.register(this);

      // Trigger extension registered event
      eventBus.trigger({
        type: "extension.registered",
        extension: this.id,
        supportedEntities: this.supportedEntities,
      });

      this.initialized = true;
      console.log("CalendarExtension initialized successfully");
    } catch (error) {
      console.error("Failed to initialize CalendarExtension:", error);
      throw error;
    }
  }

  async load(): Promise<void> {
    if (!this.initialized) {
      throw new Error("CalendarExtension must be initialized before loading");
    }

    try {
      console.log("Loading CalendarExtension...");

      // Load initial calendar data if any services are enabled
      await this.refreshCalendarData();

      // Trigger extension loaded event
      eventBus.trigger({
        type: "extension.loaded",
        extension: this.id,
        supportedEntities: this.supportedEntities,
      });

      console.log("CalendarExtension loaded successfully");
    } catch (error) {
      console.error("Failed to load CalendarExtension:", error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    if (!this.initialized) return;

    // Dispose of calendar services
    for (const service of this.calendarServices) {
      if (service.dispose) {
        service.dispose();
      }
    }

    eventBus.trigger({
      type: "extension.unregistered",
      extension: this.id,
    });

    this.initialized = false;
  }

  async isHealthy(): Promise<boolean> {
    return this.initialized;
  }

  /**
   * Get observable tasks for this extension
   * Returns tasks mapped from calendar events
   */
  getTasks(): Readable<readonly Task[]> {
    return this.rawEntityStore;
  }

  /**
   * Get the extension's entity store (read-only)
   */
  getEntityStore(): Readable<Task[]> {
    return this.rawEntityStore;
  }

  /**
   * Update the extension's entity store
   */
  updateEntityStore(tasks: Task[]): void {
    this.rawEntityStore.set(tasks);
  }

  /**
   * Transform a calendar event to a task entity
   */
  transformEventToTask(event: CalendarEvent): Task {
    const now = new Date();

    return {
      id: ulid(),
      title: event.title,
      description: event.description,
      status: "scheduled", // Calendar events are considered scheduled
      done: false,
      category: undefined,
      priority: undefined,
      parentTask: undefined,
      project: undefined,
      areas: [],
      tags: [],
      doDate: event.startDate,
      dueDate: event.allDay ? event.endDate : event.startDate,
      source: {
        extension: "calendar",
        keys: {
          calendar: event.id,
        },
        data: {
          calendarEventId: event.id,
          calendarId: event.calendar.id,
          calendarName: event.calendar.name,
          location: event.location,
          allDay: event.allDay,
          eventUrl: event.url,
        },
      },
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Convert calendar events to tasks and update entity store
   */
  private updateTasksFromEvents(events: CalendarEvent[]): void {
    const tasks = events.map((event) => this.transformEventToTask(event));
    this.updateEntityStore(tasks);
  }

  /**
   * Register a calendar service with this extension
   */
  registerCalendarService(service: CalendarService): void {
    this.calendarServices.push(service);
    calendarOperations.addCalendarService(service);
    calendarServiceRegistry.register(service);

    console.log(`Registered calendar service: ${service.serviceName}`);
  }

  /**
   * Unregister a calendar service from this extension
   */
  unregisterCalendarService(serviceName: string): void {
    this.calendarServices = this.calendarServices.filter(
      (service) => service.serviceName !== serviceName
    );
    calendarOperations.removeCalendarService(serviceName);
    calendarServiceRegistry.unregister(serviceName);

    console.log(`Unregistered calendar service: ${serviceName}`);
  }

  /**
   * Get all registered calendar services
   */
  getCalendarServices(): CalendarService[] {
    return [...this.calendarServices];
  }

  /**
   * Get enabled calendar services
   */
  getEnabledCalendarServices(): CalendarService[] {
    return this.calendarServices.filter(
      (service) => service.isEnabled() && service.isPlatformSupported()
    );
  }

  /**
   * Get observable calendars
   */
  getCalendars(): Readable<Calendar[]> {
    return this.calendarsStore;
  }

  /**
   * Get observable events
   */
  getEvents(): Readable<CalendarEvent[]> {
    return this.eventsStore;
  }

  /**
   * Get observable loading state
   */
  getLoading(): Readable<boolean> {
    return this.loadingStore;
  }

  /**
   * Get observable error state
   */
  getError(): Readable<string | null> {
    return this.errorStore;
  }

  /**
   * Refresh calendar data by fetching from all enabled services
   */
  async refresh(): Promise<void> {
    await this.refreshCalendarData();

    // Also fetch today's events and convert to tasks for the entity store
    try {
      const events = await this.getTodayEvents();
      this.updateTasksFromEvents(events);
    } catch (error) {
      console.error("Failed to update task entities from calendar events:", error);
    }
  }

  /**
   * Search tasks by query string
   */
  searchTasks(query: string, tasks: readonly Task[]): readonly Task[] {
    if (!query.trim()) {
      return tasks;
    }

    const lowerQuery = query.toLowerCase();
    return tasks.filter((task) => {
      // Search in title
      if (task.title.toLowerCase().includes(lowerQuery)) {
        return true;
      }

      // Search in description
      if (task.description && task.description.toLowerCase().includes(lowerQuery)) {
        return true;
      }

      // Search in calendar event metadata
      const eventData = task.source.data;
      if (eventData) {
        if (eventData.location && eventData.location.toLowerCase().includes(lowerQuery)) {
          return true;
        }
        if (eventData.calendarName && eventData.calendarName.toLowerCase().includes(lowerQuery)) {
          return true;
        }
      }

      return false;
    });
  }

  /**
   * Sort tasks
   */
  sortTasks(
    tasks: readonly Task[],
    sortFields: Array<{ key: string; direction: "asc" | "desc" }>
  ): readonly Task[] {
    const tasksCopy = [...tasks];

    tasksCopy.sort((a, b) => {
      for (const { key, direction } of sortFields) {
        let comparison = 0;

        switch (key) {
          case "title":
            comparison = a.title.localeCompare(b.title);
            break;
          case "doDate":
          case "startDate":
            comparison = (a.doDate?.getTime() || 0) - (b.doDate?.getTime() || 0);
            break;
          case "dueDate":
          case "endDate":
            comparison = (a.dueDate?.getTime() || 0) - (b.dueDate?.getTime() || 0);
            break;
          case "createdAt":
            comparison = (a.createdAt?.getTime() || 0) - (b.createdAt?.getTime() || 0);
            break;
          case "updatedAt":
            comparison = (a.updatedAt?.getTime() || 0) - (b.updatedAt?.getTime() || 0);
            break;
          default:
            comparison = 0;
        }

        if (comparison !== 0) {
          return direction === "asc" ? comparison : -comparison;
        }
      }

      return 0;
    });

    return tasksCopy;
  }

  /**
   * Filter tasks
   */
  filterTasks(
    tasks: readonly Task[],
    criteria: {
      project?: string | null;
      area?: string | null;
      source?: string | null;
      showCompleted?: boolean;
      calendarId?: string | null;
    }
  ): readonly Task[] {
    return tasks.filter((task) => {
      // Filter by calendar ID if specified
      if (criteria.calendarId && task.source.data?.calendarId !== criteria.calendarId) {
        return false;
      }

      // Filter by completion status
      if (!criteria.showCompleted && task.done) {
        return false;
      }

      return true;
    });
  }

  /**
   * Get events for a specific date range
   */
  async getEventsForDateRange(
    startDate: Date,
    endDate: Date,
    options?: CalendarEventFetchOptions
  ): Promise<CalendarEvent[]> {
    try {
      return await calendarOperations.getAllEvents(startDate, endDate, options);
    } catch (error) {
      console.error("Failed to get events for date range:", error);
      this.errorStore.set(
        error instanceof Error ? error.message : "Unknown error"
      );
      return [];
    }
  }

  /**
   * Get today's events
   */
  async getTodayEvents(calendarIds?: string[]): Promise<CalendarEvent[]> {
    try {
      return await calendarOperations.getTodayEvents(calendarIds);
    } catch (error) {
      console.error("Failed to get today's events:", error);
      this.errorStore.set(
        error instanceof Error ? error.message : "Unknown error"
      );
      return [];
    }
  }

  // Event handler methods required by Extension interface
  async onEntityCreated(_event: any): Promise<void> {
    // Calendar extension doesn't respond to entity creation events
  }

  async onEntityUpdated(_event: any): Promise<void> {
    // Calendar extension doesn't respond to entity update events
  }

  async onEntityDeleted(_event: any): Promise<void> {
    // Calendar extension doesn't respond to entity deletion events
  }

  /**
   * Internal method to refresh calendar data
   */
  private async refreshCalendarData(): Promise<void> {
    try {
      this.loadingStore.set(true);
      this.errorStore.set(null);

      // Fetch calendars from all enabled services
      const calendars = await calendarOperations.getAllCalendars();
      this.calendarsStore.set(calendars);

      console.log(
        `Loaded ${calendars.length} calendars from calendar services`
      );
    } catch (error) {
      console.error("Failed to refresh calendar data:", error);
      this.errorStore.set(
        error instanceof Error ? error.message : "Unknown error"
      );
    } finally {
      this.loadingStore.set(false);
    }
  }
}
