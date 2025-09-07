/**
 * TemplateManager Service
 * Manages template file creation and management for tasks, projects, and areas
 */

import { App, Vault, TFile } from 'obsidian';
import { TaskSyncSettings } from '../main';
import { generateTaskFrontMatter } from './base-definitions/FrontMatterGenerator';
import { PROPERTY_SETS, PROPERTY_REGISTRY, generateAreaFrontMatter as getAreaPropertyDefinitions, generateProjectFrontMatter as getProjectPropertyDefinitions, generateTaskFrontMatter as getTaskPropertyDefinitions } from './base-definitions/BaseConfigurations';
import matter from 'gray-matter';

export class TemplateManager {
  constructor(
    private app: App,
    private vault: Vault,
    private settings: TaskSyncSettings
  ) { }

  /**
   * Update settings reference (for when settings are changed)
   */
  updateSettings(newSettings: TaskSyncSettings): void {
    this.settings = newSettings;
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
      throw new Error(`Template file ${templateFileName} already exists. Please configure a different file or overwrite the current one.`);
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
    const propertyOrder = this.settings.taskPropertyOrder || PROPERTY_SETS.TASK_FRONTMATTER;

    // Validate property order - ensure all required properties are present
    const requiredProperties = PROPERTY_SETS.TASK_FRONTMATTER;
    const isValidOrder = requiredProperties.every(prop => propertyOrder.includes(prop)) &&
      propertyOrder.every(prop => requiredProperties.includes(prop as typeof requiredProperties[number]));

    // Use validated order or fall back to default
    const finalPropertyOrder = isValidOrder ? propertyOrder : requiredProperties;

    for (const propertyKey of finalPropertyOrder) {
      const prop = PROPERTY_REGISTRY[propertyKey as keyof typeof PROPERTY_REGISTRY];
      if (!prop) continue;

      // Use default values from property definitions
      if (prop.default !== undefined) {
        frontMatterData[prop.name] = prop.default;
      } else if (prop.type === 'array') {
        frontMatterData[prop.name] = [];
      } else {
        // Set specific defaults for key properties
        if (prop.name === 'Type') {
          frontMatterData[prop.name] = 'Task'; // Always 'Task' for task entities
        } else if (prop.name === 'Category') {
          frontMatterData[prop.name] = this.settings.taskTypes[0]?.name || 'Task';
        } else if (prop.name === 'Title') {
          frontMatterData[prop.name] = ''; // Title will be set by property handler
        } else {
          // Use empty string for other properties without defaults
          frontMatterData[prop.name] = '';
        }
      }
    }

    // Use gray-matter to generate the front-matter with default values
    return matter.stringify('{{description}}', frontMatterData);
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
      throw new Error(`Template file ${templateFileName} already exists. Please configure a different file or overwrite the current one.`);
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
      } else if (prop.type === 'array') {
        frontMatterData[prop.name] = [];
      } else {
        // Use empty string for properties without defaults
        frontMatterData[prop.name] = '';
      }
    }

    // Use gray-matter to generate the front-matter with default values
    return matter.stringify('{{description}}', frontMatterData);
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
      throw new Error(`Template file ${templateFileName} already exists. Please configure a different file or overwrite the current one.`);
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
      } else if (prop.type === 'array') {
        frontMatterData[prop.name] = [];
      } else {
        // Use empty string for properties without defaults
        frontMatterData[prop.name] = '';
      }
    }

    // Use gray-matter to generate the front-matter with default values
    return matter.stringify('{{description}}', frontMatterData);
  }

  /**
   * Create a Parent Task template file with proper front-matter and content
   */
  async createParentTaskTemplate(filename?: string): Promise<void> {
    const templateFileName = filename || this.settings.defaultParentTaskTemplate;
    const templatePath = `${this.settings.templateFolder}/${templateFileName}`;

    // Check if file already exists
    const fileExists = await this.vault.adapter.exists(templatePath);
    if (fileExists) {
      throw new Error(`Template file ${templateFileName} already exists. Please configure a different file or overwrite the current one.`);
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
      } else if (prop.type === 'array') {
        frontMatterData[prop.name] = [];
      } else {
        // Use empty string for properties without defaults
        frontMatterData[prop.name] = '';
      }
    }

    // Use gray-matter to generate the front-matter with clean structure
    const baseContent = matter.stringify('{{description}}', frontMatterData);

    // Add embedded base for sub-tasks
    return baseContent + '\n\n## Sub-tasks\n\n![[Bases/{{name}}.base]]';
  }

}
