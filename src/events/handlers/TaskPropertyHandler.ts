/**
 * TaskPropertyHandler - Sets default property values on newly created tasks
 * Handles TASK_CREATED events to ensure tasks have proper default values
 */

import { App, TFile } from 'obsidian';
import {
  EventHandler,
  EventType,
  PluginEvent,
  TaskEventData
} from '../EventTypes';
import { TaskSyncSettings } from '../../main';
import { PROPERTY_REGISTRY } from '../../services/base-definitions/BaseConfigurations';
import matter from 'gray-matter';

/**
 * Handler that sets default property values for newly created tasks
 */
export class TaskPropertyHandler implements EventHandler {
  constructor(
    private app: App,
    private settings: TaskSyncSettings
  ) { }

  /**
   * Update the settings reference for this handler
   */
  updateSettings(newSettings: TaskSyncSettings): void {
    this.settings = newSettings;
  }

  /**
   * Get the event types this handler supports
   */
  getSupportedEventTypes(): EventType[] {
    return [EventType.TASK_CREATED];
  }

  /**
   * Handle task creation events
   */
  async handle(event: PluginEvent): Promise<void> {
    if (event.type !== EventType.TASK_CREATED) {
      return;
    }

    const data = event.data as TaskEventData;

    if (!await this.hasCorrectTypeProperty(data.filePath)) {
      return;
    }

    // This is a no-op for now.
    return;
  }

  /**
   * Check if a file should be processed by this handler
   * Process task files in any Tasks folder (main, area-specific, or project-specific)
   */
  private async hasCorrectTypeProperty(filePath: string): Promise<boolean> {
    try {
      const file = this.app.vault.getAbstractFileByPath(filePath);
      if (!(file instanceof TFile)) {
        return false;
      }

      // Check if file is in the configured tasks folder
      // All tasks should be in the single configured tasks directory
      if (!filePath.startsWith(`${this.settings.tasksFolder}/`)) {
        return false;
      }

      const content = await this.app.vault.read(file);
      const parsed = matter(content);
      const frontmatterData = parsed.data || {};

      // Get all configured task type names
      const configuredTaskTypes = this.settings.taskTypes.map(taskType => taskType.name);

      // Only process files that already have a valid configured task type
      // Skip files with no Type property - they should not be processed by this handler
      return configuredTaskTypes.includes(frontmatterData.Type);
    } catch (error) {
      console.error(`TaskPropertyHandler: Error checking Type property for ${filePath}:`, error);
      return false;
    }
  }
}
