/**
 * Template Service
 * Core template management service for creating, reading, and processing templates
 * Ported from old-stuff TemplateManager to new architecture
 */

import { App, Vault, TFile } from "obsidian";
import type { TaskSyncSettings } from "../types/settings";
import type { Template, TemplateInfo, TemplateVariable, ValidationResult } from "../core/template-entities";
import { templateOperations, templateQueries } from "../entities/Templates";
import { generateId } from "../utils/idGenerator";

export class TemplateService {
  constructor(
    private app: App,
    private vault: Vault,
    private settings: TaskSyncSettings
  ) {}

  /**
   * Update settings reference (for when settings are changed)
   */
  updateSettings(newSettings: TaskSyncSettings): void {
    this.settings = newSettings;
  }

  /**
   * Ensure all required template files exist, creating them with default content if missing
   */
  async ensureTemplatesExist(): Promise<void> {
    try {
      const templateTypes: Array<"task" | "area" | "project" | "parentTask"> = [
        "task", "area", "project", "parentTask"
      ];

      for (const templateType of templateTypes) {
        await this.ensureTemplateExists(templateType);
      }

      console.log("All template files ensured");
    } catch (error) {
      console.error("Failed to ensure templates exist:", error);
      throw error;
    }
  }

  /**
   * Ensure a specific template exists
   */
  async ensureTemplateExists(templateType: "task" | "area" | "project" | "parentTask"): Promise<void> {
    const templatePath = this.getTemplatePath(templateType);
    const templateExists = await this.vault.adapter.exists(templatePath);

    if (!templateExists) {
      await this.createTemplate(templateType);
    }
  }

  /**
   * Read template content from file
   */
  async readTemplate(templateType: "task" | "area" | "project" | "parentTask"): Promise<string | null> {
    const templatePath = this.getTemplatePath(templateType);

    try {
      const templateFile = this.vault.getAbstractFileByPath(templatePath);
      if (templateFile instanceof TFile) {
        return await this.vault.read(templateFile);
      }
    } catch (error) {
      console.warn(`Could not read template ${templatePath}:`, error);
    }

    return null;
  }

  /**
   * Create a template file with proper front-matter and content
   */
  async createTemplate(templateType: "task" | "area" | "project" | "parentTask", filename?: string): Promise<void> {
    const templatePath = filename ? 
      `${this.settings.templateFolder}/${filename}` : 
      this.getTemplatePath(templateType);

    // Check if file already exists
    const fileExists = await this.vault.adapter.exists(templatePath);
    if (fileExists) {
      throw new Error(
        `Template file already exists at ${templatePath}. Please configure a different file or overwrite the current one.`
      );
    }

    // Generate template content based on type
    const templateContent = this.generateTemplateContent(templateType);

    // Create the template file (Obsidian will create the folder automatically if needed)
    await this.vault.create(templatePath, templateContent);
    console.log(`Created ${templateType} template: ${templatePath}`);

    // Create Template entity and add to store
    const template: Omit<Template, "id" | "createdAt" | "updatedAt"> = {
      type: templateType === "parentTask" ? "parent-task" : templateType,
      name: this.getTemplateDisplayName(templateType),
      content: templateContent,
      variables: this.extractTemplateVariables(templateContent),
      filePath: templatePath,
      fileExists: true,
      usageCount: 0,
    };

    await templateOperations.create(template);
  }

  /**
   * Get template file path for a given type
   */
  private getTemplatePath(templateType: "task" | "area" | "project" | "parentTask"): string {
    let templateFileName: string;

    switch (templateType) {
      case "task":
        templateFileName = this.settings.defaultTaskTemplate;
        break;
      case "area":
        templateFileName = this.settings.defaultAreaTemplate;
        break;
      case "project":
        templateFileName = this.settings.defaultProjectTemplate;
        break;
      case "parentTask":
        templateFileName = this.settings.defaultParentTaskTemplate;
        break;
      default:
        throw new Error(`Unknown template type: ${templateType}`);
    }

    return `${this.settings.templateFolder}/${templateFileName}`;
  }

  /**
   * Get display name for template type
   */
  private getTemplateDisplayName(templateType: "task" | "area" | "project" | "parentTask"): string {
    switch (templateType) {
      case "task":
        return "Task Template";
      case "area":
        return "Area Template";
      case "project":
        return "Project Template";
      case "parentTask":
        return "Parent Task Template";
      default:
        return "Unknown Template";
    }
  }

  /**
   * Generate template content based on type
   */
  private generateTemplateContent(templateType: "task" | "area" | "project" | "parentTask"): string {
    switch (templateType) {
      case "task":
        return this.generateTaskTemplateContent();
      case "area":
        return this.generateAreaTemplateContent();
      case "project":
        return this.generateProjectTemplateContent();
      case "parentTask":
        return this.generateParentTaskTemplateContent();
      default:
        return "";
    }
  }

  /**
   * Generate task template content
   */
  private generateTaskTemplateContent(): string {
    return `---
Title: "{{title}}"
Type: "Task"
Category: ""
Priority: ""
Areas: []
Project: ""
Done: false
Status: "Backlog"
DoDate: ""
DueDate: ""
---

# {{title}}

{{description}}`;
  }

  /**
   * Generate area template content
   */
  private generateAreaTemplateContent(): string {
    return `---
Name: "{{name}}"
Type: "Area"
---

# {{name}}

{{description}}`;
  }

  /**
   * Generate project template content
   */
  private generateProjectTemplateContent(): string {
    return `---
Name: "{{name}}"
Type: "Project"
Areas: []
---

# {{name}}

{{description}}`;
  }

  /**
   * Generate parent task template content
   */
  private generateParentTaskTemplateContent(): string {
    return `---
Title: "{{title}}"
Type: "Task"
Category: ""
Priority: ""
Areas: []
Project: ""
Done: false
Status: "Backlog"
DoDate: ""
DueDate: ""
---

# {{title}}

{{description}}

## Subtasks

- [ ] `;
  }

  /**
   * Extract template variables from content
   */
  extractTemplateVariables(content: string): TemplateVariable[] {
    const variables: TemplateVariable[] = [];
    const variablePattern = /\{\{(\w+)\}\}/g;
    let match;

    while ((match = variablePattern.exec(content)) !== null) {
      const variableName = match[1];
      if (!variables.some(v => v.name === variableName)) {
        variables.push({
          name: variableName,
          type: "text",
          required: true,
        });
      }
    }

    return variables;
  }

  /**
   * Process template with variables
   */
  async processTemplate(templatePath: string, variables: Record<string, any>): Promise<string> {
    const content = await this.readTemplateByPath(templatePath);
    if (!content) {
      throw new Error(`Template not found: ${templatePath}`);
    }

    let processedContent = content;
    for (const [key, value] of Object.entries(variables)) {
      const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      processedContent = processedContent.replace(pattern, String(value));
    }

    return processedContent;
  }

  /**
   * Read template content by file path
   */
  private async readTemplateByPath(templatePath: string): Promise<string | null> {
    try {
      const templateFile = this.vault.getAbstractFileByPath(templatePath);
      if (templateFile instanceof TFile) {
        return await this.vault.read(templateFile);
      }
    } catch (error) {
      console.warn(`Could not read template ${templatePath}:`, error);
    }

    return null;
  }

  /**
   * Validate template variables
   */
  validateTemplateVariables(variables: Record<string, any>, template: Template): ValidationResult {
    const errors: string[] = [];

    for (const templateVar of template.variables) {
      if (templateVar.required && !variables[templateVar.name]) {
        errors.push(`Required variable '${templateVar.name}' is missing`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
