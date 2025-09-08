/**
 * AreaPropertyHandler - Sets default property values on newly created areas
 * Handles AREA_CREATED events to ensure areas have proper default values
 */

import { App, TFile } from 'obsidian';
import {
  EventHandler,
  EventType,
  PluginEvent,
  TaskEventData
} from '../EventTypes';
import { TaskSyncSettings } from '../../main';
import matter from 'gray-matter';

/**
 * Handler that sets default property values for newly created areas
 */
export class AreaPropertyHandler implements EventHandler {
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
    return [EventType.AREA_CREATED];
  }

  /**
   * Handle area creation events
   */
  async handle(event: PluginEvent): Promise<void> {
    if (event.type !== EventType.AREA_CREATED) {
      return;
    }

    const data = event.data as TaskEventData;

    // Only process files that already have the correct Type property
    // This ensures we only handle files created through plugin mechanisms
    if (!await this.hasCorrectTypeProperty(data.filePath)) {
      console.log(`AreaPropertyHandler: Skipping file without correct Type property: ${data.filePath}`);
      return;
    }

    await this.setDefaultProperties(data.filePath);
  }

  /**
   * Check if a file should be processed by this handler
   * Process files in the Areas folder that either have the correct Type or need Type to be set
   */
  private async hasCorrectTypeProperty(filePath: string): Promise<boolean> {
    try {
      const file = this.app.vault.getAbstractFileByPath(filePath);
      if (!(file instanceof TFile)) {
        return false;
      }

      // Check if file is in the Areas folder
      if (!filePath.startsWith(this.settings.areasFolder + '/')) {
        return false;
      }

      const content = await this.app.vault.read(file);
      const parsed = matter(content);
      const frontmatterData = parsed.data || {};

      // Only process files that already have the correct Type property
      // Skip files with no Type property - they should not be processed by this handler
      return frontmatterData.Type === 'Area';
    } catch (error) {
      console.error(`AreaPropertyHandler: Error checking Type property for ${filePath}:`, error);
      return false;
    }
  }

  /**
   * Set default property values for null/empty properties in an area file
   */
  private async setDefaultProperties(filePath: string): Promise<void> {
    try {
      const file = this.app.vault.getAbstractFileByPath(filePath);
      if (!(file instanceof TFile)) {
        console.error(`AreaPropertyHandler: File not found: ${filePath}`);
        return;
      }

      const content = await this.app.vault.read(file);
      const updatedContent = this.updatePropertiesInContent(content, filePath);

      if (updatedContent !== content) {
        await this.app.vault.modify(file, updatedContent);
        console.log(`AreaPropertyHandler: Updated default properties in ${filePath}`);
      }
    } catch (error) {
      console.error(`AreaPropertyHandler: Error setting default properties for ${filePath}:`, error);
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

      // Check and update each property for areas
      // Note: Type property is never set by handlers - only by templates
      if (!frontmatterData.Name || frontmatterData.Name === '') {
        frontmatterData.Name = this.getDefaultName(filePath);
      }

      // Use gray-matter to regenerate the content with updated front-matter
      return matter.stringify(parsed.content, frontmatterData);
    } catch (error) {
      console.error('AreaPropertyHandler: Error parsing YAML:', error);
      return content;
    }
  }



  /**
   * Get default values for properties
   */
  private getDefaultName(filePath: string): string {
    // Extract filename without extension from the file path
    const fileName = filePath.split('/').pop() || '';
    return fileName.replace(/\.md$/, '');
  }

  private getDefaultType(): string {
    return 'Area';
  }
}
