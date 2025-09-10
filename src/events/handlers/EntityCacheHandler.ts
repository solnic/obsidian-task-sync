/**
 * EntityCacheHandler - Automatically caches entities when they are created
 * Handles TASK_CREATED, PROJECT_CREATED, AREA_CREATED events to cache entities in storage
 */

import { App, TFile } from "obsidian";
import {
  EventHandler,
  EventType,
  PluginEvent,
  TaskEventData,
  StatusChangedEventData,
  DoneChangedEventData,
} from "../EventTypes";
import { TaskSyncSettings } from "../../main";
import { taskStore } from "../../stores/taskStore";
import { projectStore } from "../../stores/projectStore";
import { areaStore } from "../../stores/areaStore";

/**
 * Handler that automatically caches entities when they are created
 */
export class EntityCacheHandler implements EventHandler {
  constructor(private app: App, private settings: TaskSyncSettings) {}

  /**
   * Update the settings reference for this handler
   */
  updateSettings(newSettings: TaskSyncSettings): void {
    this.settings = newSettings;
  }

  /**
   * Get the event types this handler supports
   * Only handle business logic events - stores handle file system events automatically
   */
  getSupportedEventTypes(): EventType[] {
    return [EventType.STATUS_CHANGED, EventType.DONE_CHANGED];
  }

  /**
   * Handle business logic events - stores handle file system events automatically
   */
  async handle(event: PluginEvent): Promise<void> {
    try {
      switch (event.type) {
        case EventType.STATUS_CHANGED:
        case EventType.DONE_CHANGED:
          await this.updateCachedEntity(
            event.data as StatusChangedEventData | DoneChangedEventData
          );
          break;
      }
    } catch (error) {
      const filePath = (event.data as any).filePath || "unknown";
      console.error(
        `EntityCacheHandler: Error handling business logic for ${filePath}:`,
        error
      );
    }
  }

  /**
   * Update cached entity when file properties change
   * Since stores handle file changes automatically, just trigger refreshes
   */
  private async updateCachedEntity(
    data: StatusChangedEventData | DoneChangedEventData
  ): Promise<void> {
    const { filePath } = data;

    // Determine entity type from file path and refresh the appropriate store
    const entityType = this.getEntityType(filePath);

    if (entityType === "task") {
      await taskStore.refreshEntities();
    } else if (entityType === "project") {
      await projectStore.refreshEntities();
    } else if (entityType === "area") {
      await areaStore.refreshEntities();
    }
  }

  /**
   * Determine entity type from file path
   */
  private getEntityType(filePath: string): "task" | "project" | "area" {
    if (filePath.startsWith(this.settings.tasksFolder + "/")) {
      return "task";
    } else if (filePath.startsWith(this.settings.projectsFolder + "/")) {
      return "project";
    } else if (filePath.startsWith(this.settings.areasFolder + "/")) {
      return "area";
    }
    return "task"; // Default fallback
  }
}
