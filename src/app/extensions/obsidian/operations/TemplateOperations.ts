/**
 * Obsidian Template Operations
 * Manages template files and integrates with Obsidian vault
 */

import { App, TFile } from "obsidian";
import type { TaskSyncSettings } from "../../../types/settings";
import { TemplateService } from "../../../services/TemplateService";
import {
  templateOperations,
  templateQueries,
} from "../../../entities/Templates";
import type { Template } from "../../../core/template-entities";

export class ObsidianTemplateOperations {
  private templateService: TemplateService;

  constructor(private app: App, private settings: TaskSyncSettings) {
    this.templateService = new TemplateService(app, app.vault, settings);
  }

  /**
   * Update settings reference
   */
  updateSettings(newSettings: TaskSyncSettings): void {
    this.settings = newSettings;
    this.templateService.updateSettings(newSettings);
  }

  /**
   * Initialize templates - scan existing templates and ensure defaults exist
   */
  async initialize(): Promise<void> {
    try {
      // Scan existing template files
      await this.scanExistingTemplates();

      // Ensure default templates exist
      await this.templateService.ensureTemplatesExist();

      console.log("Template operations initialized successfully");
    } catch (error) {
      console.error("Failed to initialize template operations:", error);
      throw error;
    }
  }

  /**
   * Scan existing template files and populate the store
   */
  async scanExistingTemplates(): Promise<void> {
    try {
      const templateFolder = this.settings.templateFolder;
      const templateFiles = this.app.vault
        .getMarkdownFiles()
        .filter((file) => file.path.startsWith(templateFolder + "/"));

      for (const file of templateFiles) {
        await this.processTemplateFile(file);
      }

      console.log(`Scanned ${templateFiles.length} template files`);
    } catch (error) {
      console.error("Failed to scan existing templates:", error);
    }
  }

  /**
   * Process a template file and add/update it in the store
   */
  private async processTemplateFile(file: TFile): Promise<void> {
    try {
      const content = await this.app.vault.read(file);
      const templateType = this.detectTemplateType(file.path, content);

      if (!templateType) {
        return; // Skip non-template files
      }

      // Check if template already exists in store
      const existingTemplate = await templateQueries.getByFilePath(file.path);

      if (existingTemplate) {
        // Update existing template
        await templateOperations.update({
          ...existingTemplate,
          content,
          fileExists: true,
          variables: this.templateService.extractTemplateVariables(content),
        });
      } else {
        // Create new template
        const template: Omit<Template, "id" | "createdAt" | "updatedAt"> = {
          type: templateType,
          name: this.getTemplateNameFromFile(file),
          content,
          variables: this.templateService.extractTemplateVariables(content),
          filePath: file.path,
          fileExists: true,
          usageCount: 0,
        };

        await templateOperations.create(template);
      }
    } catch (error) {
      console.error(`Failed to process template file ${file.path}:`, error);
    }
  }

  /**
   * Detect template type from file path and content
   */
  private detectTemplateType(
    filePath: string,
    content: string
  ): "task" | "project" | "area" | "parent-task" | null {
    const fileName = filePath.split("/").pop()?.toLowerCase() || "";

    // Check against configured template names
    if (fileName === this.settings.defaultTaskTemplate.toLowerCase()) {
      return "task";
    }
    if (fileName === this.settings.defaultProjectTemplate.toLowerCase()) {
      return "project";
    }
    if (fileName === this.settings.defaultAreaTemplate.toLowerCase()) {
      return "area";
    }
    if (fileName === this.settings.defaultParentTaskTemplate.toLowerCase()) {
      return "parent-task";
    }

    // Check content for type hints
    if (content.includes('Type: "Task"')) {
      return content.includes("## Subtasks") ? "parent-task" : "task";
    }
    if (content.includes('Type: "Project"')) {
      return "project";
    }
    if (content.includes('Type: "Area"')) {
      return "area";
    }

    // Check filename patterns
    if (fileName.includes("task")) {
      return "task";
    }
    if (fileName.includes("project")) {
      return "project";
    }
    if (fileName.includes("area")) {
      return "area";
    }

    return null;
  }

  /**
   * Get template name from file
   */
  private getTemplateNameFromFile(file: TFile): string {
    return file.basename
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase());
  }

  /**
   * Create a new template file
   */
  async createTemplate(
    templateType: "task" | "area" | "project" | "parentTask",
    filename?: string
  ): Promise<void> {
    await this.templateService.createTemplate(templateType, filename);
  }

  /**
   * Read template content
   */
  async readTemplate(
    templateType: "task" | "area" | "project" | "parentTask"
  ): Promise<string | null> {
    return this.templateService.readTemplate(templateType);
  }

  /**
   * Process template with variables
   */
  async processTemplate(
    templatePath: string,
    variables: Record<string, any>
  ): Promise<string> {
    return this.templateService.processTemplate(templatePath, variables);
  }

  /**
   * Get available templates by type
   */
  async getAvailableTemplates(
    type?: "task" | "project" | "area" | "parent-task"
  ): Promise<readonly Template[]> {
    return templateQueries.getAvailableTemplates(type);
  }

  /**
   * Update template file exists status
   */
  async updateTemplateFileStatus(): Promise<void> {
    const templates = await templateQueries.getAll();

    for (const template of templates) {
      const fileExists = await this.app.vault.adapter.exists(template.filePath);
      if (template.fileExists !== fileExists) {
        await templateOperations.updateFileExists(template.id, fileExists);
      }
    }
  }

  /**
   * Refresh templates - rescan and update store
   */
  async refresh(): Promise<void> {
    await this.scanExistingTemplates();
    await this.updateTemplateFileStatus();
  }
}
