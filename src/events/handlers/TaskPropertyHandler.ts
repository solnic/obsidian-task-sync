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
    await this.setDefaultProperties(data.filePath);
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
    const frontmatterRegex = /^(---\n)([\s\S]*?)(\n---)/;
    const match = content.match(frontmatterRegex);

    if (!match) {
      // No frontmatter exists, don't modify
      return content;
    }

    const [fullMatch, start, frontmatterContent, end] = match;
    const lines = frontmatterContent.split('\n');
    const updatedLines = [...lines];

    // Check and update each property
    this.updatePropertyIfNull(updatedLines, 'Title', this.getDefaultTitle(filePath));
    this.updatePropertyIfNull(updatedLines, 'Type', this.getDefaultType());
    this.updatePropertyIfNull(updatedLines, 'Priority', this.getDefaultPriority());
    this.updatePropertyIfNull(updatedLines, 'Done', this.getDefaultDone());
    this.updatePropertyIfNull(updatedLines, 'Status', this.getDefaultStatus());
    this.updatePropertyIfNull(updatedLines, 'Areas', this.getDefaultAreas());
    this.updatePropertyIfNull(updatedLines, 'Sub-tasks', this.getDefaultSubTasks());
    this.updatePropertyIfNull(updatedLines, 'tags', this.getDefaultTags());

    const updatedFrontmatter = updatedLines.join('\n');
    return content.replace(frontmatterRegex, `${start}${updatedFrontmatter}${end}`);
  }

  /**
   * Update a property if it's null, empty, or missing
   */
  private updatePropertyIfNull(lines: string[], propertyName: string, defaultValue: any): void {
    let propertyFound = false;
    let propertyIndex = -1;

    // Find the property line
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const colonIndex = line.indexOf(':');
      if (colonIndex !== -1) {
        const key = line.substring(0, colonIndex).trim();
        if (key === propertyName) {
          propertyFound = true;
          propertyIndex = i;
          const value = line.substring(colonIndex + 1).trim();

          // Check if value is null, empty, or just whitespace
          if (!value || value === 'null' || value === '""' || value === "''") {
            lines[i] = `${propertyName}: ${this.formatValue(defaultValue)}`;
          }
          break;
        }
      }
    }

    // If property not found, add it
    if (!propertyFound) {
      lines.push(`${propertyName}: ${this.formatValue(defaultValue)}`);
    }
  }

  /**
   * Format a value for YAML output
   */
  private formatValue(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'boolean') {
      return value.toString();
    }
    if (Array.isArray(value)) {
      return JSON.stringify(value);
    }
    if (typeof value === 'string') {
      return value;
    }
    return String(value);
  }

  /**
   * Get default values for properties
   */
  private getDefaultTitle(filePath: string): string {
    // Extract filename without extension from the file path
    const fileName = filePath.split('/').pop() || '';
    return fileName.replace(/\.md$/, '');
  }

  private getDefaultType(): string {
    return this.settings.taskTypes[0]?.name || 'Task';
  }

  private getDefaultPriority(): string {
    return PROPERTY_REGISTRY.PRIORITY.default || 'Low';
  }

  private getDefaultDone(): boolean {
    return PROPERTY_REGISTRY.DONE.default || false;
  }

  private getDefaultStatus(): string {
    return this.settings.taskStatuses[0]?.name || 'Backlog';
  }

  private getDefaultAreas(): any[] {
    return PROPERTY_REGISTRY.AREAS.default || [];
  }

  private getDefaultSubTasks(): any[] {
    return PROPERTY_REGISTRY.SUB_TASKS.default || [];
  }

  private getDefaultTags(): any[] {
    return PROPERTY_REGISTRY.TAGS.default || [];
  }
}
