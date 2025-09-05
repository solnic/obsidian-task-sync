/**
 * TemplateManager Service
 * Manages template file creation and management for tasks, projects, and areas
 */

import { App, Vault, TFile } from 'obsidian';
import { TaskSyncSettings } from '../main';
import { generateTaskFrontMatter } from './base-definitions/FrontMatterGenerator';
import { PROPERTY_SETS, PROPERTY_REGISTRY } from './base-definitions/BaseConfigurations';
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

    // Get task property definitions in the correct order
    const taskProperties = PROPERTY_SETS.TASK_FRONTMATTER;

    for (const propertyKey of taskProperties) {
      const prop = PROPERTY_REGISTRY[propertyKey as keyof typeof PROPERTY_REGISTRY];
      if (!prop) continue;

      // Set clean values based on property type
      if (prop.type === 'array') {
        frontMatterData[prop.name] = [];
      } else {
        frontMatterData[prop.name] = '';
      }
    }

    // Use gray-matter to generate the front-matter with clean structure
    return matter.stringify('{{description}}', frontMatterData);
  }


}
