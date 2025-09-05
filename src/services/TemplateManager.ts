/**
 * TemplateManager Service
 * Manages template file creation and management for tasks, projects, and areas
 */

import { App, Vault, TFile } from 'obsidian';
import { TaskSyncSettings } from '../main';
import { generateTaskFrontMatter } from './base-definitions/FrontMatterGenerator';

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
   * Generate the default task template content
   */
  private generateTaskTemplateContent(): string {
    // Create mock task data for front-matter generation
    const mockTaskData = {
      name: '',
      description: '',
      areas: [] as string[],
      project: '',
      priority: 'Low',
      status: '',
      parentTask: '',
      subTasks: [] as string[],
      tags: [] as string[]
    };

    // Generate front-matter using the existing generator
    const frontMatterContent = generateTaskFrontMatter(mockTaskData as any, {
      templateContent: '{{description}}'
    });

    return frontMatterContent;
  }


}
