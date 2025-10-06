/**
 * Obsidian Base Manager
 * Manages Obsidian Bases files - creates, updates, and maintains base configurations
 * This is Obsidian-specific because it manages .base files for Obsidian Bases plugin
 */

import { App, Vault, TFile, TFolder } from "obsidian";
import { TaskSyncSettings } from "../../types/settings";
import * as yaml from "js-yaml";
import { sanitizeFileName } from "../../utils/fileNameSanitizer";
import {
  generateTasksBase as generateTasksBaseConfig,
  generateAreaBase as generateAreaBaseConfig,
  generateProjectBase as generateProjectBaseConfig,
  ProjectAreaInfo,
} from "./BaseConfigurations";

export interface BaseProperty {
  displayName: string;
  type?: string;
  formula?: string;
}

export interface BaseConfig {
  formulas?: Record<string, string>;
  properties?: Record<string, BaseProperty>;
  views?: Array<{
    type: string;
    name: string;
    filters?: any;
    order?: string[];
    sort?: Array<{ property: string; direction: string }>;
    columnSize?: Record<string, number>;
  }>;
}

/**
 * Obsidian Base Manager
 * Manages .base files for the Obsidian Bases plugin
 */
export class ObsidianBaseManager {
  // Static regex pattern for base embeddings
  private static readonly BASE_EMBED_PATTERN = /!\[\[.*\.base(\|.*?)?\]\]/g;

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
   * Generate the main Tasks.base file with all task properties and default views
   */
  async generateTasksBase(
    projectsAndAreas: ProjectAreaInfo[]
  ): Promise<string> {
    return generateTasksBaseConfig(this.settings, projectsAndAreas);
  }

  /**
   * Generate the Area base file content
   */
  async generateAreaBase(area: ProjectAreaInfo): Promise<string> {
    return generateAreaBaseConfig(this.settings, area);
  }

  /**
   * Generate the Project base file content
   */
  async generateProjectBase(project: ProjectAreaInfo): Promise<string> {
    return generateProjectBaseConfig(this.settings, project);
  }

  /**
   * Parse existing base file content
   */
  async parseBaseFile(content: string): Promise<BaseConfig | null> {
    try {
      return yaml.load(content) as BaseConfig;
    } catch (error) {
      console.error("Failed to parse base file:", error);
      return null;
    }
  }

  /**
   * Create or update a base file
   */
  async createOrUpdateBaseFile(
    baseFilePath: string,
    content: string,
    type: string
  ): Promise<void> {
    try {
      // Ensure the bases folder exists
      await this.ensureBasesFolder();

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
              console.log(
                `Updated ${type} base file after retry: ${baseFilePath}`
              );
            } else {
              throw createError;
            }
          }
        }
      } else {
        // File doesn't exist, create it
        await this.vault.create(baseFilePath, content);
        console.log(`Created ${type} base file: ${baseFilePath}`);
      }
    } catch (error) {
      console.error(`Failed to create/update ${type} base file:`, error);
      throw error;
    }
  }

  /**
   * Ensure the bases folder exists
   */
  private async ensureBasesFolder(): Promise<void> {
    const folderExists = await this.vault.adapter.exists(
      this.settings.basesFolder
    );
    if (!folderExists) {
      await this.vault.createFolder(this.settings.basesFolder);
      console.log(`Created bases folder: ${this.settings.basesFolder}`);
    }
  }

  /**
   * Get all projects from the vault
   */
  async getProjects(): Promise<ProjectAreaInfo[]> {
    const projects: ProjectAreaInfo[] = [];
    const projectsFolder = this.vault.getAbstractFileByPath(
      this.settings.projectsFolder
    );

    if (projectsFolder instanceof TFolder) {
      for (const child of projectsFolder.children) {
        if (child instanceof TFile && child.extension === "md") {
          const projectName = child.basename;
          projects.push({
            name: projectName,
            path: child.path,
            type: "project",
          });
        }
      }
    }

    return projects;
  }

  /**
   * Get all areas from the vault
   */
  async getAreas(): Promise<ProjectAreaInfo[]> {
    const areas: ProjectAreaInfo[] = [];
    const areasFolder = this.vault.getAbstractFileByPath(
      this.settings.areasFolder
    );

    if (areasFolder instanceof TFolder) {
      for (const child of areasFolder.children) {
        if (child instanceof TFile && child.extension === "md") {
          const areaName = child.basename;
          areas.push({
            name: areaName,
            path: child.path,
            type: "area",
          });
        }
      }
    }

    return areas;
  }

  /**
   * Get all projects and areas for base view generation
   */
  async getProjectsAndAreas(): Promise<ProjectAreaInfo[]> {
    const projects = await this.getProjects();
    const areas = await this.getAreas();
    return [...projects, ...areas];
  }

  /**
   * Create or update the Tasks.base file
   */
  async createOrUpdateTasksBase(
    projectsAndAreas: ProjectAreaInfo[]
  ): Promise<void> {
    const baseFilePath = `${this.settings.basesFolder}/${this.settings.tasksBaseFile}`;
    const content = await this.generateTasksBase(projectsAndAreas);

    await this.createOrUpdateBaseFile(baseFilePath, content, "Tasks");
  }

  /**
   * Ensure a specific base embedding exists in a file
   */
  async ensureSpecificBaseEmbedding(
    filePath: string,
    baseFileName: string
  ): Promise<void> {
    try {
      const file = this.vault.getAbstractFileByPath(filePath);
      if (!(file instanceof TFile)) {
        console.warn(`File not found for base embedding: ${filePath}`);
        return;
      }

      const content = await this.vault.read(file);
      const specificBaseEmbed = `![[${this.settings.basesFolder}/${baseFileName}]]`;

      // Check if any base embedding exists
      if (ObsidianBaseManager.BASE_EMBED_PATTERN.test(content)) {
        // Replace existing base embedding with the specific one
        // Reset lastIndex since we're reusing the static regex
        ObsidianBaseManager.BASE_EMBED_PATTERN.lastIndex = 0;
        const updatedContent = content.replace(
          ObsidianBaseManager.BASE_EMBED_PATTERN,
          specificBaseEmbed
        );
        await this.vault.modify(file, updatedContent);
        console.log(`Updated base embedding in: ${filePath}`);
      } else {
        // Add new base embedding
        const updatedContent =
          content.trim() + `\n\n## Tasks\n${specificBaseEmbed}`;
        await this.vault.modify(file, updatedContent);
        console.log(`Added base embedding to: ${filePath}`);
      }
    } catch (error) {
      console.error(`Failed to add base embedding to ${filePath}:`, error);
    }
  }

  /**
   * Sync area bases - create individual bases for areas
   */
  async syncAreaBases(): Promise<void> {
    if (!this.settings.areaBasesEnabled) {
      console.log("Area bases disabled, skipping sync");
      return;
    }

    console.log("ObsidianBaseManager: Starting area bases sync");

    const areas = await this.getAreas();
    console.log(
      `ObsidianBaseManager: Found ${areas.length} areas to create bases for:`,
      areas.map((a) => a.name)
    );

    for (const area of areas) {
      console.log(`ObsidianBaseManager: Creating area base for: ${area.name}`);
      await this.createOrUpdateAreaBase(area);
    }

    console.log("Area bases synced successfully");
  }

  /**
   * Sync project bases - create individual bases for projects
   */
  async syncProjectBases(): Promise<void> {
    if (!this.settings.projectBasesEnabled) {
      console.log("Project bases disabled, skipping sync");
      return;
    }

    console.log("ObsidianBaseManager: Starting project bases sync");

    const projects = await this.getProjects();
    console.log(
      `ObsidianBaseManager: Found ${projects.length} projects to create bases for:`,
      projects.map((p) => p.name)
    );

    for (const project of projects) {
      console.log(
        `ObsidianBaseManager: Creating project base for: ${project.name}`
      );
      await this.createOrUpdateProjectBase(project);
    }

    console.log("Project bases synced successfully");
  }

  /**
   * Sync both area and project bases
   */
  async syncAreaProjectBases(): Promise<void> {
    if (this.settings.areaBasesEnabled) {
      await this.syncAreaBases();
    }
    if (this.settings.projectBasesEnabled) {
      await this.syncProjectBases();
    }
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
      await this.createOrUpdateBaseFile(baseFilePath, content, "area");
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
      await this.createOrUpdateBaseFile(baseFilePath, content, "project");
      // Update the project file to embed the specific base
      await this.ensureSpecificBaseEmbedding(project.path, baseFileName);
    } catch (error) {
      console.error(`Failed to create/update project base file: ${error}`);
      throw error;
    }
  }
}
