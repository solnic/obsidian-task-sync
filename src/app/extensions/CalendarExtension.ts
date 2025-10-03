/**
 * Calendar Extension for TaskSync
 * Provides calendar functionality through Day View (NOT integrated with Tasks tab)
 * Manages calendar services and provides calendar data access
 */

import { Plugin } from "obsidian";
import { Extension, extensionRegistry, EntityType } from "../core/extension";
import { eventBus } from "../core/events";
import { derived, writable, type Readable } from "svelte/store";
import type { Task } from "../core/entities";
import {
  CalendarService,
  calendarServiceRegistry,
} from "../services/CalendarService";
import { calendarOperations } from "../entities/Calendar";
import type {
  Calendar,
  CalendarEvent,
  CalendarEventFetchOptions,
} from "../types/calendar";
import type { TaskSyncSettings } from "../types/settings";

export class CalendarExtension implements Extension {
  readonly id = "calendar";
  readonly name = "Calendar";
  readonly version = "1.0.0";
  readonly supportedEntities: readonly EntityType[] = []; // No task integration

  private initialized = false;
  private plugin: Plugin;
  private settings: TaskSyncSettings;
  private calendarServices: CalendarService[] = [];

  // Internal state for calendar data
  private calendarsStore = writable<Calendar[]>([]);
  private eventsStore = writable<CalendarEvent[]>([]);
  private loadingStore = writable<boolean>(false);
  private errorStore = writable<string | null>(null);

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
   * Returns empty array since calendar extension doesn't provide tasks
   */
  getTasks(): Readable<readonly Task[]> {
    return derived([], () => []);
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
  }

  /**
   * Search tasks by query string (not applicable for calendar extension)
   */
  searchTasks(query: string, tasks: readonly Task[]): readonly Task[] {
    return [];
  }

  /**
   * Sort tasks (not applicable for calendar extension)
   */
  sortTasks(
    tasks: readonly Task[],
    sortFields: Array<{ key: string; direction: "asc" | "desc" }>
  ): readonly Task[] {
    return [];
  }

  /**
   * Filter tasks (not applicable for calendar extension)
   */
  filterTasks(
    tasks: readonly Task[],
    criteria: {
      project?: string | null;
      area?: string | null;
      source?: string | null;
      showCompleted?: boolean;
    }
  ): readonly Task[] {
    return [];
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
