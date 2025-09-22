/**
 * TaskSchedulingService - Manages scheduling tasks as calendar events
 * Implements the SchedulingService interface and provides caching for scheduled tasks
 */

import { AbstractService } from "./AbstractService";
import { CacheManager } from "../cache/CacheManager";
import { SchemaCache } from "../cache/SchemaCache";
import {
  ScheduledTasksMetadataSchema,
  ScheduledTasksMetadata,
  ScheduledTaskMetadata,
} from "../cache/schemas/task-scheduling";
import {
  SchedulingService,
  TaskSchedulingConfig,
  TaskSchedulingResult,
  ScheduledTaskMetadata as IScheduledTaskMetadata,
} from "../types/scheduling";
import { Task } from "../types/entities";
import {
  Calendar,
  CalendarService,
  CalendarEventCreateData,
} from "../types/calendar";
import { TaskSyncSettings } from "../components/ui/settings/types";

export class TaskSchedulingService
  extends AbstractService
  implements SchedulingService
{
  readonly serviceName = "task-scheduling";

  private scheduledTasksCache?: SchemaCache<ScheduledTasksMetadata>;
  private calendarService?: CalendarService;

  constructor(settings: TaskSyncSettings) {
    super(settings);
  }

  /**
   * Set the calendar service to use for scheduling
   */
  setCalendarService(calendarService: CalendarService): void {
    this.calendarService = calendarService;
  }

  /**
   * Setup task scheduling-specific caches
   */
  protected async setupCaches(): Promise<void> {
    this.scheduledTasksCache = this.createCache(
      "scheduled-tasks",
      ScheduledTasksMetadataSchema
    );
  }

  /**
   * Check if service is enabled
   */
  isEnabled(): boolean {
    return (
      this.settings.integrations.appleCalendar?.enabled &&
      this.settings.integrations.appleCalendar?.schedulingEnabled &&
      !!this.calendarService?.isEnabled()
    );
  }

  /**
   * Check if platform is supported
   */
  isPlatformSupported(): boolean {
    return this.calendarService?.isPlatformSupported() ?? false;
  }

  /**
   * Get available calendars for scheduling
   */
  async getAvailableCalendars(): Promise<Calendar[]> {
    if (!this.calendarService) {
      throw new Error("Calendar service not configured");
    }
    return this.calendarService.getCalendars();
  }

  /**
   * Schedule a task as a calendar event
   */
  async scheduleTask(
    task: Task,
    config: TaskSchedulingConfig
  ): Promise<TaskSchedulingResult> {
    if (!this.calendarService) {
      return {
        success: false,
        error: "Calendar service not configured",
      };
    }

    if (!this.isEnabled()) {
      return {
        success: false,
        error: "Task scheduling is not enabled",
      };
    }

    try {
      // Check if task is already scheduled
      const existingMetadata = await this.getSchedulingMetadata(
        task.filePath || ""
      );
      if (existingMetadata) {
        return {
          success: false,
          error: "Task is already scheduled",
        };
      }

      // Determine target calendar
      const targetCalendar =
        config.targetCalendar ||
        this.settings.integrations.appleCalendar.defaultSchedulingCalendar;

      if (!targetCalendar) {
        return {
          success: false,
          error: "No target calendar specified",
        };
      }

      // Calculate end date if not provided
      const endDate =
        config.endDate ||
        new Date(
          config.startDate.getTime() +
            this.settings.integrations.appleCalendar.defaultEventDuration *
              60 *
              1000
        );

      // Prepare event data
      const eventData: CalendarEventCreateData = {
        title: task.title,
        description: this.generateEventDescription(task, config),
        location: config.location,
        startDate: config.startDate,
        endDate: endDate,
        allDay: config.allDay || false,
        calendarId: targetCalendar,
        reminders:
          config.reminders ||
          this.settings.integrations.appleCalendar.defaultReminders,
      };

      // Create the calendar event
      const result = await this.calendarService.createEvent(eventData);

      if (result.success && result.event && result.externalEventId) {
        // Cache the scheduling metadata
        const metadata: ScheduledTaskMetadata = {
          taskPath: task.filePath || "",
          taskTitle: task.title,
          externalEventId: result.externalEventId,
          calendarService: this.calendarService.serviceName,
          targetCalendar: targetCalendar,
          scheduledAt: new Date(),
          eventStartDate: config.startDate,
          eventEndDate: endDate,
          allDay: config.allDay || false,
          eventUrl: result.eventUrl,
          schedulingConfig: config,
        };

        await this.addScheduledTaskMetadata(metadata);

        return {
          success: true,
          event: result.event,
          externalEventId: result.externalEventId,
          eventUrl: result.eventUrl,
        };
      } else {
        return {
          success: false,
          error: result.error || "Failed to create calendar event",
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to schedule task: ${error.message}`,
      };
    }
  }

  /**
   * Update an existing scheduled event
   */
  async updateScheduledEvent(
    externalEventId: string,
    config: TaskSchedulingConfig
  ): Promise<TaskSchedulingResult> {
    if (!this.calendarService) {
      return {
        success: false,
        error: "Calendar service not configured",
      };
    }

    try {
      // Find the scheduled task metadata
      const metadata = await this.findScheduledTaskByEventId(externalEventId);
      if (!metadata) {
        return {
          success: false,
          error: "Scheduled task not found",
        };
      }

      // Calculate end date if not provided
      const endDate =
        config.endDate ||
        new Date(
          config.startDate.getTime() +
            this.settings.integrations.appleCalendar.defaultEventDuration *
              60 *
              1000
        );

      // Prepare updated event data
      const eventData: Partial<CalendarEventCreateData> = {
        title: metadata.taskTitle,
        description: config.notes,
        location: config.location,
        startDate: config.startDate,
        endDate: endDate,
        allDay: config.allDay || false,
        calendarId: metadata.targetCalendar,
        reminders:
          config.reminders ||
          this.settings.integrations.appleCalendar.defaultReminders,
      };

      // Update the calendar event
      const result = await this.calendarService.updateEvent(
        externalEventId,
        eventData
      );

      if (result.success) {
        // Update the cached metadata
        metadata.eventStartDate = config.startDate;
        metadata.eventEndDate = endDate;
        metadata.allDay = config.allDay || false;
        metadata.schedulingConfig = config;
        metadata.eventUrl = result.eventUrl;

        await this.updateScheduledTaskMetadata(metadata);

        return {
          success: true,
          event: result.event,
          externalEventId: result.externalEventId,
          eventUrl: result.eventUrl,
        };
      } else {
        return {
          success: false,
          error: result.error || "Failed to update calendar event",
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to update scheduled event: ${error.message}`,
      };
    }
  }

  /**
   * Cancel/delete a scheduled event
   */
  async cancelScheduledEvent(externalEventId: string): Promise<boolean> {
    if (!this.calendarService) {
      return false;
    }

    try {
      // Delete the calendar event
      const deleteSuccess = await this.calendarService.deleteEvent(
        externalEventId
      );

      if (deleteSuccess) {
        // Remove from cache
        await this.removeScheduledTaskMetadata(externalEventId);
        return true;
      }

      return false;
    } catch (error: any) {
      console.error("Failed to cancel scheduled event:", error);
      return false;
    }
  }

  /**
   * Check if a task is already scheduled
   */
  async isTaskScheduled(taskPath: string): Promise<boolean> {
    const metadata = await this.getSchedulingMetadata(taskPath);
    return !!metadata;
  }

  /**
   * Get scheduling metadata for a task
   */
  async getSchedulingMetadata(
    taskPath: string
  ): Promise<IScheduledTaskMetadata | null> {
    if (!this.scheduledTasksCache) {
      return null;
    }

    try {
      const allMetadata =
        (await this.scheduledTasksCache.get("scheduled-tasks")) || [];
      return allMetadata.find((m) => m.taskPath === taskPath) || null;
    } catch (error) {
      console.error("Failed to get scheduling metadata:", error);
      return null;
    }
  }

  /**
   * Clear scheduling cache
   */
  async clearSchedulingCache(): Promise<void> {
    if (this.scheduledTasksCache) {
      await this.scheduledTasksCache.clear();
    }
  }

  /**
   * Clear service-specific caches
   */
  async clearCache(): Promise<void> {
    await this.clearSchedulingCache();
  }

  /**
   * Generate event description from task and config
   */
  private generateEventDescription(
    task: Task,
    config: TaskSchedulingConfig
  ): string {
    let description = "";

    if (config.notes) {
      description += config.notes;
    }

    if (
      config.includeTaskDetails ||
      this.settings.integrations.appleCalendar.includeTaskDetailsInEvent
    ) {
      if (description) description += "\n\n";
      description += "Task Details:\n";

      if (task.category) {
        description += `Category: ${task.category}\n`;
      }

      if (task.priority) {
        description += `Priority: ${task.priority}\n`;
      }

      if (task.status) {
        description += `Status: ${task.status}\n`;
      }

      if (task.project) {
        description += `Project: ${task.project}\n`;
      }

      if (task.areas && task.areas.length > 0) {
        description += `Areas: ${task.areas.join(", ")}\n`;
      }

      if (task.filePath) {
        description += `Task File: ${task.filePath}`;
      }
    }

    return description;
  }

  /**
   * Add scheduled task metadata to cache
   */
  private async addScheduledTaskMetadata(
    metadata: ScheduledTaskMetadata
  ): Promise<void> {
    if (!this.scheduledTasksCache) {
      return;
    }

    try {
      const allMetadata =
        (await this.scheduledTasksCache.get("scheduled-tasks")) || [];
      allMetadata.push(metadata);
      await this.scheduledTasksCache.set("scheduled-tasks", allMetadata);
    } catch (error) {
      console.error("Failed to add scheduled task metadata:", error);
    }
  }

  /**
   * Update scheduled task metadata in cache
   */
  private async updateScheduledTaskMetadata(
    metadata: ScheduledTaskMetadata
  ): Promise<void> {
    if (!this.scheduledTasksCache) {
      return;
    }

    try {
      const allMetadata =
        (await this.scheduledTasksCache.get("scheduled-tasks")) || [];
      const index = allMetadata.findIndex(
        (m) => m.externalEventId === metadata.externalEventId
      );

      if (index !== -1) {
        allMetadata[index] = metadata;
        await this.scheduledTasksCache.set("scheduled-tasks", allMetadata);
      }
    } catch (error) {
      console.error("Failed to update scheduled task metadata:", error);
    }
  }

  /**
   * Remove scheduled task metadata from cache
   */
  private async removeScheduledTaskMetadata(
    externalEventId: string
  ): Promise<void> {
    if (!this.scheduledTasksCache) {
      return;
    }

    try {
      const allMetadata =
        (await this.scheduledTasksCache.get("scheduled-tasks")) || [];
      const filteredMetadata = allMetadata.filter(
        (m) => m.externalEventId !== externalEventId
      );
      await this.scheduledTasksCache.set("scheduled-tasks", filteredMetadata);
    } catch (error) {
      console.error("Failed to remove scheduled task metadata:", error);
    }
  }

  /**
   * Find scheduled task by external event ID
   */
  private async findScheduledTaskByEventId(
    externalEventId: string
  ): Promise<ScheduledTaskMetadata | null> {
    if (!this.scheduledTasksCache) {
      return null;
    }

    try {
      const allMetadata =
        (await this.scheduledTasksCache.get("scheduled-tasks")) || [];
      return (
        allMetadata.find((m) => m.externalEventId === externalEventId) || null
      );
    } catch (error) {
      console.error("Failed to find scheduled task by event ID:", error);
      return null;
    }
  }

  /**
   * Get all scheduled tasks
   */
  async getAllScheduledTasks(): Promise<ScheduledTaskMetadata[]> {
    if (!this.scheduledTasksCache) {
      return [];
    }

    try {
      return (await this.scheduledTasksCache.get("scheduled-tasks")) || [];
    } catch (error) {
      console.error("Failed to get all scheduled tasks:", error);
      return [];
    }
  }
}
