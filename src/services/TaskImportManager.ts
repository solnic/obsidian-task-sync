/**
 * TaskImportManager Service
 * Handles importing external tasks into Obsidian with proper organization and formatting
 */

import { App, Vault, TFile } from "obsidian";
import { ExternalTaskData, TaskImportConfig } from "../types/integrations";
import { TaskSyncSettings } from "../components/ui/settings/types";
import { sanitizeFileName } from "../utils/fileNameSanitizer";
import { AreaFileManager } from "./AreaFileManager";
import { PROPERTY_REGISTRY } from "../types/properties";
import { PROPERTY_SETS } from "./base-definitions/BaseConfigurations";

export class TaskImportManager {
  constructor(
    private app: App,
    private vault: Vault,
    private settings: TaskSyncSettings,
    private areaFileManager?: AreaFileManager
  ) {}

  /**
   * Update settings reference (for when settings are changed)
   */
  updateSettings(newSettings: TaskSyncSettings): void {
    this.settings = newSettings;
  }

  /**
   * Create Obsidian task from external task data
   */
  async createTaskFromData(
    taskData: ExternalTaskData,
    config: TaskImportConfig
  ): Promise<string> {
    const taskName = this.sanitizeTaskName(taskData.title);
    const taskFolder = this.determineTaskFolder(config);
    const taskPath = `${taskFolder}/${taskName}.md`;

    // Check if task already exists
    const taskExists = await this.taskExists(taskPath, taskData.id);

    if (taskExists) {
      const error = `Task already exists: ${taskPath}`;
      throw new Error(error);
    }

    // Ensure target area exists if specified
    if (config.targetArea) {
      await this.ensureAreaExists(config.targetArea);
    }

    await this.ensureFolderExists(taskFolder);
    const taskContent = this.generateCompleteTaskContent(taskData, config);

    await this.vault.create(taskPath, taskContent);

    return taskPath;
  }

  /**
   * Sanitize task name for file system compatibility
   */
  sanitizeTaskName(title: string): string {
    return sanitizeFileName(title);
  }

  /**
   * Determine the appropriate folder for the task based on configuration
   * All tasks go in the configured task directory - project/area context is stored in front-matter
   */
  determineTaskFolder(config: TaskImportConfig): string {
    // All tasks go in the configured task directory regardless of project/area context
    // The bases system expects all tasks to be in this single location
    return this.settings.tasksFolder;
  }

  /**
   * Generate complete task content including front-matter and body
   */
  private generateCompleteTaskContent(
    taskData: ExternalTaskData,
    config: TaskImportConfig
  ): string {
    const frontMatterData = this.generateTaskFrontMatter(taskData, config);
    const content = this.generateTaskContent(taskData);

    return this.generateFrontMatterString(frontMatterData) + "\n\n" + content;
  }

  /**
   * Generate front-matter string from data object
   */
  private generateFrontMatterString(
    frontMatterData: Record<string, any>
  ): string {
    const frontMatterLines = ["---"];
    for (const [key, value] of Object.entries(frontMatterData)) {
      if (Array.isArray(value)) {
        frontMatterLines.push(
          `${key}: [${value.map((v) => `"${v}"`).join(", ")}]`
        );
      } else if (typeof value === "string") {
        frontMatterLines.push(`${key}: "${value}"`);
      } else if (typeof value === "object" && value !== null) {
        // Handle nested objects like source
        frontMatterLines.push(`${key}:`);
        for (const [subKey, subValue] of Object.entries(value)) {
          frontMatterLines.push(`  ${subKey}: "${subValue}"`);
        }
      } else {
        frontMatterLines.push(`${key}: ${value}`);
      }
    }
    frontMatterLines.push("---");
    return frontMatterLines.join("\n");
  }

  /**
   * Generate front-matter for the task based on external data and configuration
   * Ensures all task properties from base configuration are included with defaults
   */
  generateTaskFrontMatter(
    taskData: ExternalTaskData,
    config: TaskImportConfig
  ): Record<string, any> {
    const frontMatter: Record<string, any> = {};

    // First, set all front-matter properties with their default values from the registry
    PROPERTY_SETS.TASK_FRONTMATTER.forEach((propertyKey) => {
      const propertyDef = PROPERTY_REGISTRY[propertyKey];
      if (!propertyDef) return;

      const frontMatterKey = propertyDef.name;

      // Set default value if defined
      if (propertyDef.default !== undefined) {
        frontMatter[frontMatterKey] = propertyDef.default;
      }
    });

    // Then override with specific values from task data and config
    frontMatter.Title = taskData.title;
    frontMatter.Type = "Task";
    frontMatter.Category = config.taskType || "Task";
    frontMatter.Priority = this.extractPriority(taskData) || null; // Use null as default from registry
    frontMatter.Areas = config.targetArea ? [`[[${config.targetArea}]]`] : [];

    if (config.targetProject) {
      frontMatter.Project = `[[${config.targetProject}]]`;
    }

    frontMatter.Done = false;
    frontMatter.Status = this.mapExternalStatus(taskData.status);
    frontMatter["Parent task"] = "";

    if (config.importLabelsAsTags && taskData.labels) {
      frontMatter.tags = taskData.labels;
    } else {
      frontMatter.tags = [];
    }

    if (config.doDate) {
      frontMatter["Do Date"] = config.doDate.toISOString().split("T")[0];
    }

    if (taskData.dueDate) {
      frontMatter["Due Date"] = taskData.dueDate.toISOString().split("T")[0];
    }

    if (taskData.reminders && taskData.reminders.length > 0) {
      frontMatter.Reminders = taskData.reminders.map((reminder) =>
        reminder.toISOString()
      );
    } else {
      frontMatter.Reminders = [];
    }

    // Note: Source is no longer stored in front-matter
    // It will be set as an internal property after task creation

    return frontMatter;
  }

  /**
   * Get display name for source based on task data
   */
  private getSourceDisplayName(taskData: ExternalTaskData): string {
    return taskData.sourceType;
  }

  /**
   * Generate task content body with external reference
   */
  generateTaskContent(taskData: ExternalTaskData): string {
    let content = "";

    // Add description if available
    if (taskData.description) {
      content += taskData.description + "\n\n";
    }

    // Add external reference section
    content += "## External Reference\n\n";
    content += `**Source:** ${taskData.sourceType}\n`;
    content += `**External ID:** ${taskData.id}\n`;
    content += `**URL:** [View in ${taskData.sourceType}](${taskData.externalUrl})\n`;
    content += `**Created:** ${
      taskData.createdAt.toISOString().split("T")[0]
    }\n`;
    content += `**Updated:** ${
      taskData.updatedAt.toISOString().split("T")[0]
    }\n`;

    // Add assignee if available
    if (taskData.assignee) {
      content += `**Assignee:** ${taskData.assignee}\n`;
    }

    // Add labels if available
    if (taskData.labels && taskData.labels.length > 0) {
      content += `**Labels:** ${taskData.labels.join(", ")}\n`;
    }

    return content;
  }

  /**
   * Check if a task already exists at the given path
   */
  async taskExists(taskPath: string, externalId: string): Promise<boolean> {
    const file = this.vault.getAbstractFileByPath(taskPath);
    return file instanceof TFile;
  }

  /**
   * Ensure an area exists, creating it if necessary
   */
  async ensureAreaExists(areaName: string): Promise<void> {
    if (!this.areaFileManager) {
      return; // Skip if area file manager not available
    }

    // Check if area already exists
    const areaFolder = this.settings.areasFolder;
    const areaPath = `${areaFolder}/${areaName}.md`;
    const existingArea = this.vault.getAbstractFileByPath(areaPath);

    if (existingArea instanceof TFile) {
      return; // Area already exists
    }

    // Create the area
    try {
      await this.areaFileManager.createAreaFile({
        name: areaName,
        description: `Auto-created area for ${areaName}`,
      });
    } catch (error) {
      console.warn(`Failed to create area "${areaName}":`, error);
      // Don't throw error - continue with task creation even if area creation fails
    }
  }

  /**
   * Extract priority from external task data
   */
  private extractPriority(taskData: ExternalTaskData): string | undefined {
    // Check explicit priority field
    if (taskData.priority) {
      return this.normalizePriority(taskData.priority);
    }

    // Check labels for priority indicators
    if (taskData.labels) {
      for (const label of taskData.labels) {
        if (label.toLowerCase().includes("priority:")) {
          const priority = label.split(":")[1]?.trim();
          if (priority) {
            return this.normalizePriority(priority);
          }
        }

        // Check for common priority labels
        const lowerLabel = label.toLowerCase();
        if (lowerLabel.includes("urgent") || lowerLabel.includes("critical")) {
          return "Urgent";
        }
        if (lowerLabel.includes("high")) {
          return "High";
        }
        if (lowerLabel.includes("medium")) {
          return "Medium";
        }
        if (lowerLabel.includes("low")) {
          return "Low";
        }
      }
    }

    return undefined;
  }

  /**
   * Normalize priority values to standard format
   */
  private normalizePriority(priority: string): string {
    const normalized = priority.toLowerCase();

    if (normalized.includes("urgent") || normalized.includes("critical")) {
      return "Urgent";
    }
    if (normalized.includes("high")) {
      return "High";
    }
    if (normalized.includes("medium") || normalized.includes("normal")) {
      return "Medium";
    }
    if (normalized.includes("low")) {
      return "Low";
    }

    // Capitalize first letter for unknown priorities
    return priority.charAt(0).toUpperCase() + priority.slice(1).toLowerCase();
  }

  /**
   * Map external status to internal status format
   * Uses configured task statuses from settings instead of hardcoded values
   */
  private mapExternalStatus(externalStatus: string): string {
    const status = externalStatus.toLowerCase();
    const taskStatuses = this.settings.taskStatuses;

    // Find appropriate status based on external status
    switch (status) {
      case "open":
      case "todo":
      case "new":
        // Find first non-done, non-in-progress status (typically "Backlog")
        const backlogStatus = taskStatuses.find(
          (s) => !s.isDone && !s.isInProgress
        );
        return backlogStatus?.name || taskStatuses[0]?.name || "Backlog";

      case "in_progress":
      case "in-progress":
      case "working":
        // Find first in-progress status
        const inProgressStatus = taskStatuses.find((s) => s.isInProgress);
        return inProgressStatus?.name || "In Progress";

      case "closed":
      case "done":
      case "completed":
        // Find first done status
        const doneStatus = taskStatuses.find((s) => s.isDone);
        return doneStatus?.name || "Done";

      case "cancelled":
      case "canceled":
        // Look for a cancelled status, otherwise use first non-done status
        const cancelledStatus = taskStatuses.find((s) =>
          s.name.toLowerCase().includes("cancel")
        );
        return (
          cancelledStatus?.name ||
          taskStatuses.find((s) => !s.isDone)?.name ||
          taskStatuses[0]?.name ||
          "Backlog"
        );

      default:
        // Default to first configured status (typically "Backlog")
        return taskStatuses[0]?.name || "Backlog";
    }
  }

  /**
   * Ensure that a folder exists, creating it and any parent folders if necessary
   */
  private async ensureFolderExists(folderPath: string): Promise<void> {
    try {
      // Check if folder already exists
      const exists = await this.vault.adapter.exists(folderPath);
      if (exists) {
        return;
      }

      // Create the folder (this will create parent folders automatically)
      await this.vault.createFolder(folderPath);
    } catch (error: any) {
      // If the error is that the folder already exists, that's fine
      if (error.message && error.message.includes("already exists")) {
        return;
      }
      // Re-throw other errors
      throw error;
    }
  }
}
