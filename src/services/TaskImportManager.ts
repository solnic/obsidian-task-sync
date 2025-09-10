/**
 * TaskImportManager Service
 * Handles importing external tasks into Obsidian with proper organization and formatting
 */

import { App, Vault, TFile } from "obsidian";
import { ExternalTaskData, TaskImportConfig } from "../types/integrations";
import { TaskSyncSettings } from "../components/ui/settings/types";
import { sanitizeFileName } from "../utils/fileNameSanitizer";
import matter from "gray-matter";

export class TaskImportManager {
  constructor(
    private app: App,
    private vault: Vault,
    private settings: TaskSyncSettings,
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
    config: TaskImportConfig,
  ): Promise<string> {
    const taskName = this.sanitizeTaskName(taskData.title);
    const taskFolder = this.determineTaskFolder(config);
    const taskPath = `${taskFolder}/${taskName}.md`;

    // Check if task already exists
    if (await this.taskExists(taskPath, taskData.id)) {
      throw new Error(`Task already exists: ${taskPath}`);
    }

    // Ensure the task folder exists before creating the file
    await this.ensureFolderExists(taskFolder);

    // Generate task content with front-matter and body
    const taskContent = this.generateCompleteTaskContent(taskData, config);

    // Create the task file
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
    config: TaskImportConfig,
  ): string {
    const frontMatterData = this.generateTaskFrontMatter(taskData, config);
    const content = this.generateTaskContent(taskData);

    return matter.stringify(content, frontMatterData);
  }

  /**
   * Generate front-matter for the task based on external data and configuration
   */
  generateTaskFrontMatter(
    taskData: ExternalTaskData,
    config: TaskImportConfig,
  ): Record<string, any> {
    const frontMatter: Record<string, any> = {};

    // Title (required)
    frontMatter.Title = taskData.title;

    // Type is always 'Task' for task entities
    frontMatter.Type = "Task";

    // Category from config or default
    frontMatter.Category = config.taskType || "Task";

    // Priority - extract from external data or labels
    frontMatter.Priority = this.extractPriority(taskData) || "Low";

    // Areas - from config (using Obsidian note linking syntax)
    frontMatter.Areas = config.targetArea ? [`[[${config.targetArea}]]`] : [];

    // Project - from config (using Obsidian note linking syntax)
    if (config.targetProject) {
      frontMatter.Project = `[[${config.targetProject}]]`;
    }

    // Done status - always false for new imports
    frontMatter.Done = false;

    // Status - map external status to internal status
    frontMatter.Status = this.mapExternalStatus(taskData.status);

    // Parent task - empty for imports
    frontMatter["Parent task"] = "";

    // Tags - from labels if configured
    if (config.importLabelsAsTags && taskData.labels) {
      frontMatter.tags = taskData.labels;
    } else {
      frontMatter.tags = [];
    }

    // Source - internal tracking for imported tasks
    frontMatter.source = {
      name: taskData.sourceType,
      key: taskData.id,
      url: taskData.externalUrl,
    };

    return frontMatter;
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
   */
  private mapExternalStatus(externalStatus: string): string {
    const status = externalStatus.toLowerCase();

    switch (status) {
      case "open":
      case "todo":
      case "new":
        return "todo";
      case "in_progress":
      case "in-progress":
      case "working":
        return "in-progress";
      case "closed":
      case "done":
      case "completed":
        return "done";
      case "cancelled":
      case "canceled":
        return "cancelled";
      default:
        return "todo";
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
