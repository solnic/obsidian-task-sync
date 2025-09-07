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

    // Only process files that already have the correct Type property
    // This ensures we only handle files created through plugin mechanisms
    if (!await this.hasCorrectTypeProperty(data.filePath)) {
      console.log(`TaskPropertyHandler: Skipping file without correct Type property: ${data.filePath}`);
      return;
    }

    await this.setDefaultProperties(data.filePath);
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

      // Process files that either have a valid configured task type or need Type to be set
      // This allows us to set default Type for files with null/empty Type
      return configuredTaskTypes.includes(frontmatterData.Type) ||
        !frontmatterData.Type ||
        frontmatterData.Type === '';
    } catch (error) {
      console.error(`TaskPropertyHandler: Error checking Type property for ${filePath}:`, error);
      return false;
    }
  }

  /**
   * Set default property values for null/empty properties in a task file
   */
  private async setDefaultProperties(filePath: string): Promise<void> {
    try {
      const file = this.app.vault.getAbstractFileByPath(filePath);
      if (!(file instanceof TFile)) {
        console.error(`TaskPropertyHandler: File not found: ${filePath}`);
        return;
      }

      const content = await this.app.vault.read(file);
      const updatedContent = this.updatePropertiesInContent(content, filePath);

      if (updatedContent !== content) {
        await this.app.vault.modify(file, updatedContent);
        console.log(`TaskPropertyHandler: Updated default properties in ${filePath}`);
      }
    } catch (error) {
      console.error(`TaskPropertyHandler: Error setting default properties for ${filePath}:`, error);
    }
  }

  /**
   * Update properties in file content, setting defaults for null/empty values
   */
  private updatePropertiesInContent(content: string, filePath: string): string {
    // Parse YAML using gray-matter to check actual values
    try {
      const parsed = matter(content);
      const frontmatterData = parsed.data || {};

      // Check and update each property for tasks
      if (!frontmatterData.Title || frontmatterData.Title === '') {
        frontmatterData.Title = this.getDefaultTitle(filePath);
      }
      if (!frontmatterData.Type || frontmatterData.Type === '') {
        frontmatterData.Type = 'Task'; // Always 'Task' for task entities
      }
      if (!frontmatterData.Category || frontmatterData.Category === '') {
        frontmatterData.Category = this.getDefaultCategory();
      }
      if (!frontmatterData.Priority || frontmatterData.Priority === '') {
        frontmatterData.Priority = this.getDefaultPriority();
      }
      if (frontmatterData.Done === null || frontmatterData.Done === undefined || frontmatterData.Done === '') {
        frontmatterData.Done = this.getDefaultDone();
      }
      if (!frontmatterData.Status || frontmatterData.Status === '') {
        frontmatterData.Status = this.getDefaultStatus();
      }
      // Only set defaults for arrays if they are missing or null, not if they're empty arrays
      if (frontmatterData.Areas === undefined || frontmatterData.Areas === null) {
        frontmatterData.Areas = this.getDefaultAreas();
      }
      if (frontmatterData['Sub-tasks'] === undefined || frontmatterData['Sub-tasks'] === null) {
        frontmatterData['Sub-tasks'] = this.getDefaultSubTasks();
      }
      if (frontmatterData.tags === undefined || frontmatterData.tags === null) {
        frontmatterData.tags = this.getDefaultTags();
      }

      // Use gray-matter to regenerate the content with updated front-matter
      return matter.stringify(parsed.content, frontmatterData);
    } catch (error) {
      console.error('TaskPropertyHandler: Error parsing YAML:', error);
      return content;
    }
  }



  /**
   * Get default values for properties
   */
  private getDefaultTitle(filePath: string): string {
    // Extract filename without extension from the file path
    const fileName = filePath.split('/').pop() || '';
    return fileName.replace(/\.md$/, '');
  }

  private getDefaultCategory(): string {
    return this.settings.taskTypes[0]?.name || 'Task';
  }

  private getDefaultPriority(): string {
    return PROPERTY_REGISTRY.PRIORITY.default;
  }

  private getDefaultDone(): boolean {
    return PROPERTY_REGISTRY.DONE.default;
  }

  private getDefaultStatus(): string {
    return this.settings.taskStatuses[0]?.name;
  }

  private getDefaultAreas(): any[] {
    return PROPERTY_REGISTRY.AREAS.default;
  }

  private getDefaultSubTasks(): any[] {
    return PROPERTY_REGISTRY.SUB_TASKS.default;
  }

  private getDefaultTags(): any[] {
    return PROPERTY_REGISTRY.TAGS.default;
  }
}
