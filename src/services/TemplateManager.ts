/**
 * TemplateManager Service
 * Manages template file creation and management for tasks, projects, and areas
 */

import { App, Vault, TFile } from "obsidian";
import { TaskSyncSettings } from "../main";
import { PROPERTY_REGISTRY } from "../types/properties";
import {
  PROPERTY_SETS,
  generateAreaFrontMatter as getAreaPropertyDefinitions,
  generateProjectFrontMatter as getProjectPropertyDefinitions,
  generateTaskFrontMatter as getTaskPropertyDefinitions,
} from "./base-definitions/BaseConfigurations";

export class TemplateManager {
  constructor(
    private app: App,
    private vault: Vault,
    private settings: TaskSyncSettings
  ) {}

  /**
   * Generate front-matter string from data object
   */
  private generateFrontMatter(frontMatterData: Record<string, any>): string {
    const frontMatterLines = ["---"];
    for (const [key, value] of Object.entries(frontMatterData)) {
      if (Array.isArray(value)) {
        frontMatterLines.push(
          `${key}: [${value.map((v) => `"${v}"`).join(", ")}]`
        );
      } else if (typeof value === "string") {
        frontMatterLines.push(`${key}: "${value}"`);
      } else {
        frontMatterLines.push(`${key}: ${value}`);
      }
    }
    frontMatterLines.push("---");
    return frontMatterLines.join("\n");
  }

  /**
   * Update settings reference (for when settings are changed)
   */
  updateSettings(newSettings: TaskSyncSettings): void {
    this.settings = newSettings;
  }

  /**
   * Ensure all required template files exist, creating them with default content if missing
   * This should be called when the plugin loads
   */
  async ensureTemplatesExist(): Promise<void> {
    try {
      // Create task template if missing
      const taskTemplatePath = `${this.settings.templateFolder}/${this.settings.defaultTaskTemplate}`;
      const taskTemplateExists = await this.app.vault.adapter.exists(
        taskTemplatePath
      );

      if (!taskTemplateExists) {
        console.log(
          `Task Sync: Task template '${this.settings.defaultTaskTemplate}' not found, creating it...`
        );
        try {
          await this.createTaskTemplate(this.settings.defaultTaskTemplate);
          console.log(`Task Sync: Created task template: ${taskTemplatePath}`);
        } catch (error) {
          console.error(`Task Sync: Failed to create task template:`, error);
        }
      }

      // Create area template if missing
      const areaTemplatePath = `${this.settings.templateFolder}/${this.settings.defaultAreaTemplate}`;
      const areaTemplateExists = await this.app.vault.adapter.exists(
        areaTemplatePath
      );

      if (!areaTemplateExists) {
        console.log(
          `Task Sync: Area template '${this.settings.defaultAreaTemplate}' not found, creating it...`
        );
        try {
          await this.createAreaTemplate(this.settings.defaultAreaTemplate);
          console.log(`Task Sync: Created area template: ${areaTemplatePath}`);
        } catch (error) {
          console.error(`Task Sync: Failed to create area template:`, error);
        }
      }

      // Create project template if missing
      const projectTemplatePath = `${this.settings.templateFolder}/${this.settings.defaultProjectTemplate}`;
      const projectTemplateExists = await this.app.vault.adapter.exists(
        projectTemplatePath
      );

      if (!projectTemplateExists) {
        console.log(
          `Task Sync: Project template '${this.settings.defaultProjectTemplate}' not found, creating it...`
        );
        try {
          await this.createProjectTemplate(
            this.settings.defaultProjectTemplate
          );
          console.log(
            `Task Sync: Created project template: ${projectTemplatePath}`
          );
        } catch (error) {
          console.error(`Task Sync: Failed to create project template:`, error);
        }
      }

      // Create parent task template if missing
      const parentTaskTemplatePath = `${this.settings.templateFolder}/${this.settings.defaultParentTaskTemplate}`;
      const parentTaskTemplateExists = await this.app.vault.adapter.exists(
        parentTaskTemplatePath
      );

      if (!parentTaskTemplateExists) {
        console.log(
          `Task Sync: Parent task template '${this.settings.defaultParentTaskTemplate}' not found, creating it...`
        );
        try {
          await this.createParentTaskTemplate(
            this.settings.defaultParentTaskTemplate
          );
          console.log(
            `Task Sync: Created parent task template: ${parentTaskTemplatePath}`
          );
        } catch (error) {
          console.error(
            `Task Sync: Failed to create parent task template:`,
            error
          );
        }
      }
    } catch (error) {
      console.error("Task Sync: Failed to ensure templates exist:", error);
    }
  }

  /**
   * Read template content from file
   */
  async readTemplate(
    templateType: "task" | "area" | "project" | "parentTask"
  ): Promise<string | null> {
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
        return null;
    }

    const templatePath = `${this.settings.templateFolder}/${templateFileName}`;

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
   * Create a Task template file with proper front-matter and content
   */
  async createTaskTemplate(filename?: string): Promise<void> {
    const templateFileName = filename || this.settings.defaultTaskTemplate;
    const templatePath = `${this.settings.templateFolder}/${templateFileName}`;

    // Check if file already exists
    const fileExists = await this.vault.adapter.exists(templatePath);
    if (fileExists) {
      throw new Error(
        `Template file ${templateFileName} already exists. Please configure a different file or overwrite the current one.`
      );
    }

    // Generate template content with configured default values
    const templateContent = this.generateTaskTemplateWithDefaults();

    // Create the template file (Obsidian will create the folder automatically if needed)
    await this.vault.create(templatePath, templateContent);
    console.log(`Created task template: ${templatePath}`);
  }

  /**
   * Generate a task template with default values for auto-creation
   */
  private generateTaskTemplateWithDefaults(): string {
    // Create front-matter structure using property definitions with defaults
    const frontMatterData: Record<string, any> = {};

    // Get property order from settings or use default
    const propertyOrder =
      this.settings.taskPropertyOrder || PROPERTY_SETS.TASK_FRONTMATTER;

    // Validate property order - ensure all required properties are present
    const requiredProperties = PROPERTY_SETS.TASK_FRONTMATTER;
    const isValidOrder =
      requiredProperties.every((prop) => propertyOrder.includes(prop)) &&
      propertyOrder.every((prop) =>
        requiredProperties.includes(prop as (typeof requiredProperties)[number])
      );

    // Use validated order or fall back to default
    const finalPropertyOrder = isValidOrder
      ? propertyOrder
      : requiredProperties;

    for (const propertyKey of finalPropertyOrder) {
      const prop =
        PROPERTY_REGISTRY[propertyKey as keyof typeof PROPERTY_REGISTRY];
      if (!prop) continue;

      // Use default values from property definitions
      if (prop.default !== undefined) {
        frontMatterData[prop.name] = prop.default;
      } else if (prop.type === "array") {
        frontMatterData[prop.name] = [];
      } else {
        // Set specific defaults for key properties
        if (prop.name === "Type") {
          frontMatterData[prop.name] = "Task"; // Always 'Task' for task entities
        } else if (prop.name === "Category") {
          frontMatterData[prop.name] = this.settings.taskTypes[0].name;
        } else if (prop.name === "Title") {
          frontMatterData[prop.name] = ""; // Title will be set by property handler
        } else {
          // Use empty string for other properties without defaults
          frontMatterData[prop.name] = "";
        }
      }
    }

    return this.generateFrontMatter(frontMatterData);
  }

  /**
   * Create an Area template file with proper front-matter and content
   */
  async createAreaTemplate(filename?: string): Promise<void> {
    const templateFileName = filename || this.settings.defaultAreaTemplate;
    const templatePath = `${this.settings.templateFolder}/${templateFileName}`;

    // Check if file already exists
    const fileExists = await this.vault.adapter.exists(templatePath);
    if (fileExists) {
      throw new Error(
        `Template file ${templateFileName} already exists. Please configure a different file or overwrite the current one.`
      );
    }

    // Generate template content
    const templateContent = this.generateAreaTemplateContent();

    // Create the template file (Obsidian will create the folder automatically if needed)
    await this.vault.create(templatePath, templateContent);
    console.log(`Created area template: ${templatePath}`);
  }

  /**
   * Generate the default area template content with default values
   */
  private generateAreaTemplateContent(): string {
    return this.generateAreaTemplateWithDefaults();
  }

  /**
   * Generate an area template with default values
   */
  private generateAreaTemplateWithDefaults(): string {
    // Create front-matter structure using property definitions with defaults
    const frontMatterData: Record<string, any> = {};

    // Get area property definitions in the correct order
    const areaProperties = getAreaPropertyDefinitions();

    for (const prop of areaProperties) {
      // Use default values from property definitions
      if (prop.default !== undefined) {
        frontMatterData[prop.name] = prop.default;
      } else if (prop.type === "array") {
        frontMatterData[prop.name] = [];
      } else {
        // Use empty string for properties without defaults
        frontMatterData[prop.name] = "";
      }
    }

    // Always set Type to 'Area' for area templates
    frontMatterData.Type = "Area";

    const baseContent = this.generateFrontMatter(frontMatterData);

    // Add content section with description and tasks variables
    return baseContent + "\n\n{{description}}\n\n## Tasks\n\n{{tasks}}";
  }

  /**
   * Create a Project template file with proper front-matter and content
   */
  async createProjectTemplate(filename?: string): Promise<void> {
    const templateFileName = filename || this.settings.defaultProjectTemplate;
    const templatePath = `${this.settings.templateFolder}/${templateFileName}`;

    // Check if file already exists
    const fileExists = await this.vault.adapter.exists(templatePath);
    if (fileExists) {
      throw new Error(
        `Template file ${templateFileName} already exists. Please configure a different file or overwrite the current one.`
      );
    }

    // Generate template content
    const templateContent = this.generateProjectTemplateContent();

    // Create the template file (Obsidian will create the folder automatically if needed)
    await this.vault.create(templatePath, templateContent);
    console.log(`Created project template: ${templatePath}`);
  }

  /**
   * Generate the default project template content with default values
   */
  private generateProjectTemplateContent(): string {
    return this.generateProjectTemplateWithDefaults();
  }

  /**
   * Generate a project template with default values
   */
  private generateProjectTemplateWithDefaults(): string {
    // Create front-matter structure using property definitions with defaults
    const frontMatterData: Record<string, any> = {};

    // Get project property definitions in the correct order
    const projectProperties = getProjectPropertyDefinitions();

    for (const prop of projectProperties) {
      // Use default values from property definitions
      if (prop.default !== undefined) {
        frontMatterData[prop.name] = prop.default;
      } else if (prop.type === "array") {
        frontMatterData[prop.name] = [];
      } else {
        // Use empty string for properties without defaults
        frontMatterData[prop.name] = "";
      }
    }

    // Always set Type to 'Project' for project templates
    frontMatterData.Type = "Project";

    const baseContent = this.generateFrontMatter(frontMatterData);

    // Add content section with description and tasks variables
    return baseContent + "\n\n{{description}}\n\n## Tasks\n\n{{tasks}}";
  }

  /**
   * Create a Parent Task template file with proper front-matter and content
   */
  async createParentTaskTemplate(filename?: string): Promise<void> {
    const templateFileName =
      filename || this.settings.defaultParentTaskTemplate;
    const templatePath = `${this.settings.templateFolder}/${templateFileName}`;

    // Check if file already exists
    const fileExists = await this.vault.adapter.exists(templatePath);
    if (fileExists) {
      throw new Error(
        `Template file ${templateFileName} already exists. Please configure a different file or overwrite the current one.`
      );
    }

    // Generate template content
    const templateContent = this.generateParentTaskTemplateContent();

    // Create the template file (Obsidian will create the folder automatically if needed)
    await this.vault.create(templatePath, templateContent);
    console.log(`Created parent task template: ${templatePath}`);
  }

  /**
   * Generate the default parent task template content with default values
   */
  private generateParentTaskTemplateContent(): string {
    return this.generateParentTaskTemplateWithDefaults();
  }

  /**
   * Generate a parent task template with default values
   */
  private generateParentTaskTemplateWithDefaults(): string {
    // Create front-matter structure using property definitions with defaults
    const frontMatterData: Record<string, any> = {};

    // Get task property definitions in the correct order
    const taskProperties = getTaskPropertyDefinitions();

    for (const prop of taskProperties) {
      // Use default values from property definitions
      if (prop.default !== undefined) {
        frontMatterData[prop.name] = prop.default;
      } else if (prop.type === "array") {
        frontMatterData[prop.name] = [];
      } else {
        // Use empty string for properties without defaults
        frontMatterData[prop.name] = "";
      }
    }

    const baseContent = this.generateFrontMatter(frontMatterData);

    // Add embedded base for related tasks using {{tasks}} variable
    return baseContent + "\n\n## Related Tasks\n\n{{tasks}}";
  }
}
