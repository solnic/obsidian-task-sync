/**
 * TemplateManager Service
 * Manages template file creation and management for tasks, projects, and areas
 */

import { App, Vault, TFile } from 'obsidian';
import { TaskSyncSettings } from '../main';
import { generateTaskFrontMatter } from './base-definitions/FrontMatterGenerator';
import { PROPERTY_SETS, PROPERTY_REGISTRY, generateAreaFrontMatter as getAreaPropertyDefinitions, generateProjectFrontMatter as getProjectPropertyDefinitions } from './base-definitions/BaseConfigurations';
import matter from 'gray-matter';

export class TemplateManager {
  constructor(
    private app: App,
    private vault: Vault,
    private settings: TaskSyncSettings
  ) { }

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

    // Generate template content
    const templateContent = this.generateTaskTemplateContent();

    // Create the template file (Obsidian will create the folder automatically if needed)
    await this.vault.create(templatePath, templateContent);
    console.log(`Created task template: ${templatePath}`);
  }

  /**
   * Generate the default task template content with clean front-matter structure
   */
  private generateTaskTemplateContent(): string {
    return this.generateCleanTaskTemplate();
  }

  /**
   * Generate a clean task template without pre-filled values
   */
  private generateCleanTaskTemplate(): string {
    // Create clean front-matter structure using property definitions
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

      // Set clean values based on property type
      if (prop.type === 'array') {
        frontMatterData[prop.name] = [];
      } else {
        // Use empty string for clean template values
        frontMatterData[prop.name] = '';
      }
    }

    // Use gray-matter to generate the front-matter with clean structure
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
   * Generate the default area template content with clean front-matter structure
   */
  private generateAreaTemplateContent(): string {
    return this.generateCleanAreaTemplate();
  }

  /**
   * Generate a clean area template without pre-filled values
   */
  private generateCleanAreaTemplate(): string {
    // Create clean front-matter structure using property definitions
    const frontMatterData: Record<string, any> = {};

    // Get area property definitions in the correct order
    const areaProperties = getAreaPropertyDefinitions();

    for (const prop of areaProperties) {
      // Set clean values based on property type
      if (prop.type === 'array') {
        frontMatterData[prop.name] = [];
      } else {
        // Use empty string for clean template values
        frontMatterData[prop.name] = '';
      }
    }

    // Use gray-matter to generate the front-matter with clean structure
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
   * Generate the default project template content with clean front-matter structure
   */
  private generateProjectTemplateContent(): string {
    return this.generateCleanProjectTemplate();
  }

  /**
   * Generate a clean project template without pre-filled values
   */
  private generateCleanProjectTemplate(): string {
    // Create clean front-matter structure using property definitions
    const frontMatterData: Record<string, any> = {};

    // Get project property definitions in the correct order
    const projectProperties = getProjectPropertyDefinitions();

    for (const prop of projectProperties) {
      // Set clean values based on property type
      if (prop.type === 'array') {
        frontMatterData[prop.name] = [];
      } else {
        // Use empty string for clean template values
        frontMatterData[prop.name] = '';
      }
    }

    // Use gray-matter to generate the front-matter with clean structure
    return matter.stringify('{{description}}', frontMatterData);
  }

}
