/**
 * ProjectPropertyHandler - Sets default property values on newly created projects
 * Handles PROJECT_CREATED events to ensure projects have proper default values
 */

import { App, TFile } from "obsidian";
import {
  EventHandler,
  EventType,
  PluginEvent,
  TaskEventData,
} from "../EventTypes";
import { TaskSyncSettings } from "../../main-old";

/**
 * Handler that sets default property values for newly created projects
 */
export class ProjectPropertyHandler implements EventHandler {
  constructor(private app: App, private settings: TaskSyncSettings) {}

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
    return [EventType.PROJECT_CREATED];
  }

  /**
   * Handle project creation events
   */
  async handle(event: PluginEvent): Promise<void> {
    if (event.type !== EventType.PROJECT_CREATED) {
      return;
    }

    const data = event.data as TaskEventData;

    // Only process files that already have the correct Type property
    // This ensures we only handle files created through plugin mechanisms
    if (!(await this.hasCorrectTypeProperty(data.filePath))) {
      return;
    }

    await this.setDefaultProperties(data.filePath);
  }

  /**
   * Check if a file should be processed by this handler
   * Process files in the Projects folder that either have the correct Type or need Type to be set
   */
  private async hasCorrectTypeProperty(filePath: string): Promise<boolean> {
    try {
      const file = this.app.vault.getAbstractFileByPath(filePath);
      if (!(file instanceof TFile)) {
        return false;
      }

      // Check if file is in the Projects folder
      if (!filePath.startsWith(this.settings.projectsFolder + "/")) {
        return false;
      }

      const cache = this.app.metadataCache.getFileCache(file);
      const frontmatterData = cache?.frontmatter || {};

      // Only process files that already have the correct Type property
      // Skip files with no Type property - they should not be processed by this handler
      return frontmatterData.Type === "Project";
    } catch (error) {
      console.error(
        `ProjectPropertyHandler: Error checking Type property for ${filePath}:`,
        error
      );
      return false;
    }
  }

  /**
   * Set default property values for null/empty properties in a project file
   */
  private async setDefaultProperties(filePath: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof TFile)) {
      throw new Error(`File not found: ${filePath}`);
    }

    await this.updatePropertiesInContent(filePath);
  }

  /**
   * Update properties in file content, setting defaults for null/empty values
   */
  private async updatePropertiesInContent(filePath: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(filePath) as TFile;
    if (!file) {
      throw new Error(`File not found: ${filePath}`);
    }

    await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
      // Check and update each property for projects
      // Note: Type property is never set by handlers - only by templates
      if (!frontmatter.Name || frontmatter.Name === "") {
        frontmatter.Name = this.getDefaultName(filePath);
      }
      // Only set default if Areas is missing or null, not if it's an empty array
      if (frontmatter.Areas === undefined || frontmatter.Areas === null) {
        frontmatter.Areas = this.getDefaultAreas();
      }
    });
  }

  /**
   * Get default values for properties
   */
  private getDefaultName(filePath: string): string {
    // Extract filename without extension from the file path
    const fileName = filePath.split("/").pop() || "";
    return fileName.replace(/\.md$/, "");
  }

  private getDefaultType(): string {
    return "Project";
  }

  private getDefaultAreas(): any[] {
    return [];
  }
}
