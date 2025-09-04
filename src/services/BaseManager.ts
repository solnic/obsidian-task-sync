/**
 * BaseManager Service
 * Manages Obsidian Bases files - creates, updates, and maintains base configurations
 * with proper properties and views for task management
 */

import { App, Vault, TFile } from 'obsidian';
import { TaskSyncSettings } from '../main';
import * as yaml from 'js-yaml';
import { sanitizeFileName } from '../utils/fileNameSanitizer';
import {
  TasksBaseDefinition,
  AreaBaseDefinition,
  ProjectBaseDefinition
} from './base-definitions';

export interface BaseProperty {
  displayName: string;
  type?: string;
  formula?: string;
}

export interface BaseView {
  type: 'table' | 'kanban' | 'calendar';
  name: string;
  filters?: {
    and?: Array<string>;
    or?: Array<string>;
  };
  order?: string[];
  sort?: Array<{
    property: string;
    direction: 'ASC' | 'DESC';
  }>;
  columnSize?: Record<string, number>;
}

export interface BaseConfig {
  formulas?: Record<string, string>;
  properties: Record<string, BaseProperty>;
  views: BaseView[];
}

export interface ProjectAreaInfo {
  name: string;
  path: string;
  type: 'project' | 'area';
}

export class BaseManager {
  constructor(
    private app: App,
    private vault: Vault,
    private settings: TaskSyncSettings
  ) { }



  /**
   * Generate the main Tasks.base file with all task properties and default views
   */
  async generateTasksBase(projectsAndAreas: ProjectAreaInfo[]): Promise<string> {
    const definition = new TasksBaseDefinition({
      settings: this.settings,
      projectsAndAreas
    });
    return definition.generateYAML();
  }



  /**
   * Parse existing base file content
   */
  async parseBaseFile(content: string): Promise<BaseConfig | null> {
    try {
      return yaml.load(content) as BaseConfig;
    } catch (error) {
      console.error('Failed to parse base file:', error);
      return null;
    }
  }

  /**
   * Create or update the Tasks.base file
   */
  async createOrUpdateTasksBase(projectsAndAreas: ProjectAreaInfo[]): Promise<void> {
    const baseFilePath = `${this.settings.basesFolder}/${this.settings.tasksBaseFile}`;
    const content = await this.generateTasksBase(projectsAndAreas);

    await this.createOrUpdateBaseFile(baseFilePath, content, 'Tasks');
  }

  /**
   * Ensure the bases folder exists
   */
  async ensureBasesFolder(): Promise<void> {
    const folderExists = await this.vault.adapter.exists(this.settings.basesFolder);
    if (!folderExists) {
      await this.vault.createFolder(this.settings.basesFolder);
      console.log(`Created bases folder: ${this.settings.basesFolder}`);
    }
  }

  /**
   * Helper method to create or update a base file with robust error handling
   */
  private async createOrUpdateBaseFile(baseFilePath: string, content: string, type: string): Promise<void> {
    try {
      // Use more reliable file existence check
      const fileExists = await this.vault.adapter.exists(baseFilePath);

      if (fileExists) {
        // File exists, get it and update
        const existingFile = this.vault.getAbstractFileByPath(baseFilePath);
        if (existingFile instanceof TFile) {
          await this.vault.modify(existingFile, content);
          console.log(`Updated ${type} base file: ${baseFilePath}`);
        } else {
          // File exists but not in cache, try to create and handle error
          try {
            await this.vault.create(baseFilePath, content);
            console.log(`Created ${type} base file: ${baseFilePath}`);
          } catch (createError) {
            // If create fails due to existing file, try to get and modify
            const retryFile = this.vault.getAbstractFileByPath(baseFilePath);
            if (retryFile instanceof TFile) {
              await this.vault.modify(retryFile, content);
              console.log(`Updated ${type} base file after retry: ${baseFilePath}`);
            } else {
              throw createError;
            }
          }
        }
      } else {
        // File doesn't exist, create it
        try {
          await this.vault.create(baseFilePath, content);
          console.log(`Created ${type} base file: ${baseFilePath}`);
        } catch (createError) {
          // If create fails, the file might have been created by another process
          if (createError.message?.includes('already exists')) {
            const existingFile = this.vault.getAbstractFileByPath(baseFilePath);
            if (existingFile instanceof TFile) {
              await this.vault.modify(existingFile, content);
              console.log(`Updated ${type} base file after creation conflict: ${baseFilePath}`);
            } else {
              throw createError;
            }
          } else {
            throw createError;
          }
        }
      }
    } catch (error) {
      console.error(`Failed to create/update ${type} base file: ${error}`);
      throw error;
    }
  }

  /**
   * Add base embedding to project/area files if missing
   */
  async ensureBaseEmbedding(filePath: string): Promise<void> {
    try {
      const file = this.vault.getAbstractFileByPath(filePath);
      if (!(file instanceof TFile)) return;

      const content = await this.vault.read(file);

      // Check if any base embedding already exists (including display text)
      const anyBasePattern = /!\[\[.*\.base(\|.*?)?\]\]/;
      if (anyBasePattern.test(content)) {
        return; // Already has some base embedding, don't add another
      }

      // Only add Tasks.base if no base embedding exists at all
      const baseFilePath = `${this.settings.basesFolder}/${this.settings.tasksBaseFile}`;
      const updatedContent = content.trim() + `\n\n## Tasks\n![[${baseFilePath}]]`;
      await this.vault.modify(file, updatedContent);
      console.log(`Added base embedding to: ${filePath}`);
    } catch (error) {
      console.error(`Failed to add base embedding to ${filePath}:`, error);
    }
  }

  /**
   * Get all projects and areas for base view generation
   */
  async getProjectsAndAreas(): Promise<ProjectAreaInfo[]> {
    const items: ProjectAreaInfo[] = [];

    // Scan projects folder for files with Type: Project
    try {
      const projectsFolder = this.vault.getAbstractFileByPath(this.settings.projectsFolder);
      if (projectsFolder) {
        const projectFiles = this.vault.getMarkdownFiles().filter(file =>
          file.path.startsWith(this.settings.projectsFolder + '/')
        );

        for (const file of projectFiles) {
          const cache = this.app.metadataCache.getFileCache(file);
          const frontmatter = cache?.frontmatter;

          // Only include files with Type: Project
          if (frontmatter?.Type === 'Project') {
            items.push({
              name: file.basename,
              path: file.path,
              type: 'project'
            });
          }
        }
      }
    } catch (error) {
      console.error('Failed to scan projects folder:', error);
    }

    // Scan areas folder for files with Type: Area
    try {
      const areasFolder = this.vault.getAbstractFileByPath(this.settings.areasFolder);
      if (areasFolder) {
        const areaFiles = this.vault.getMarkdownFiles().filter(file =>
          file.path.startsWith(this.settings.areasFolder + '/')
        );

        for (const file of areaFiles) {
          const cache = this.app.metadataCache.getFileCache(file);
          const frontmatter = cache?.frontmatter;

          // Only include files with Type: Area
          if (frontmatter?.Type === 'Area') {
            items.push({
              name: file.basename,
              path: file.path,
              type: 'area'
            });
          }
        }
      }
    } catch (error) {
      console.error('Failed to scan areas folder:', error);
    }

    return items;
  }

  /**
   * Sync area and project bases when settings change
   */
  async syncAreaProjectBases(): Promise<void> {
    if (!this.settings.areaBasesEnabled && !this.settings.projectBasesEnabled) {
      console.log('Area and project bases are disabled, skipping sync');
      return;
    }

    const projectsAndAreas = await this.getProjectsAndAreas();

    // Create individual bases for areas if enabled
    if (this.settings.areaBasesEnabled) {
      const areas = projectsAndAreas.filter(item => item.type === 'area');
      for (const area of areas) {
        await this.createOrUpdateAreaBase(area);
      }
    }

    // Create individual bases for projects if enabled
    if (this.settings.projectBasesEnabled) {
      const projects = projectsAndAreas.filter(item => item.type === 'project');
      for (const project of projects) {
        await this.createOrUpdateProjectBase(project);
      }
    }

    console.log('Area and project bases synced successfully');
  }

  /**
   * Create or update an individual area base file
   */
  async createOrUpdateAreaBase(area: ProjectAreaInfo): Promise<void> {
    const sanitizedName = sanitizeFileName(area.name);
    const baseFileName = `${sanitizedName}.base`;
    const baseFilePath = `${this.settings.basesFolder}/${baseFileName}`;
    const content = await this.generateAreaBase(area);

    try {
      await this.createOrUpdateBaseFile(baseFilePath, content, 'area');
      // Update the area file to embed the specific base
      await this.ensureSpecificBaseEmbedding(area.path, baseFileName);
    } catch (error) {
      console.error(`Failed to create/update area base file: ${error}`);
      throw error;
    }
  }

  /**
   * Create or update an individual project base file
   */
  async createOrUpdateProjectBase(project: ProjectAreaInfo): Promise<void> {
    const sanitizedName = sanitizeFileName(project.name);
    const baseFileName = `${sanitizedName}.base`;
    const baseFilePath = `${this.settings.basesFolder}/${baseFileName}`;
    const content = await this.generateProjectBase(project);

    try {
      await this.createOrUpdateBaseFile(baseFilePath, content, 'project');
      // Update the project file to embed the specific base
      await this.ensureSpecificBaseEmbedding(project.path, baseFileName);
    } catch (error) {
      console.error(`Failed to create/update project base file: ${error}`);
      throw error;
    }
  }

  /**
   * Generate base configuration for a specific area
   */
  async generateAreaBase(area: ProjectAreaInfo): Promise<string> {
    const definition = new AreaBaseDefinition({
      settings: this.settings,
      area
    });
    return definition.generateYAML();
  }

  /**
   * Generate base configuration for a specific project
   */
  async generateProjectBase(project: ProjectAreaInfo): Promise<string> {
    const definition = new ProjectBaseDefinition({
      settings: this.settings,
      project
    });
    return definition.generateYAML();
  }

  /**
   * Ensure specific base embedding in area/project files
   */
  async ensureSpecificBaseEmbedding(filePath: string, baseFileName: string): Promise<void> {
    try {
      const file = this.vault.getAbstractFileByPath(filePath);
      if (!(file instanceof TFile)) return;

      const content = await this.vault.read(file);
      const baseFilePath = `${this.settings.basesFolder}/${baseFileName}`;
      const specificBasePattern = new RegExp(`!\\[\\[${baseFilePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\|.*?)?\\]\\]`);

      // If the specific base embed already exists, we're done
      if (specificBasePattern.test(content)) {
        return;
      }

      let updatedContent = content;

      // Remove any existing base embeds to prevent duplicates
      const allBasePatterns = [
        /!\[\[.*Tasks\.base(\|.*?)?\]\]/g,
        /!\[\[.*\.base(\|.*?)?\]\]/g
      ];

      for (const pattern of allBasePatterns) {
        updatedContent = updatedContent.replace(pattern, '');
      }

      // Clean up any empty "## Tasks" sections that might be left
      updatedContent = updatedContent.replace(/## Tasks\s*\n\s*\n/g, '');

      // Add the specific base embedding with proper path
      if (!updatedContent.trim().endsWith('## Tasks')) {
        updatedContent = updatedContent.trim() + `\n\n## Tasks\n![[${baseFilePath}]]`;
      } else {
        updatedContent = updatedContent.trim() + `\n![[${baseFilePath}]]`;
      }

      await this.vault.modify(file, updatedContent);
      console.log(`Updated base embedding to ${baseFileName} in: ${filePath}`);
    } catch (error) {
      console.error(`Failed to update base embedding in ${filePath}:`, error);
    }
  }
}
