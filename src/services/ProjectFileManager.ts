/**
 * ProjectFileManager Service
 * Concrete implementation of FileManager for project-specific file operations
 * Handles project file creation, property updates, and project-specific operations
 */

import { App, Vault, TFile } from "obsidian";
import { TaskSyncSettings } from "../main";
import { FileManager, FileCreationData } from "./FileManager";
import { generateProjectFrontMatter } from "./base-definitions/BaseConfigurations";
import { Project } from "../types/entities";

/**
 * Interface for project creation data
 */
export interface ProjectCreationData extends FileCreationData {
  title: string;
  areas?: string | string[];
  description?: string;
}

/**
 * ProjectFileManager - Handles all project file operations
 * Extends the abstract FileManager with project-specific functionality
 */
export class ProjectFileManager extends FileManager {
  constructor(app: App, vault: Vault, settings: TaskSyncSettings) {
    super(app, vault, settings);
  }

  /**
   * Create a project file with proper front-matter structure
   * @param data - Project creation data
   * @param content - Optional file content. If not provided, reads from template.
   * @returns Path of the created project file
   */
  async createProjectFile(
    data: ProjectCreationData,
    content?: string
  ): Promise<string> {
    const projectFolder = this.settings.projectsFolder;

    // Get content from template if not provided
    let fileContent = content;
    if (!fileContent) {
      fileContent = await this.getProjectTemplateContent(data);
    }

    // Process {{tasks}} variable in content
    const processedContent = this.processTasksVariable(fileContent, data.title);

    const filePath = await this.createFile(
      projectFolder,
      data.title,
      processedContent
    );
    const frontMatterData = this.generateProjectFrontMatterObject(data);

    await this.updateFrontMatter(filePath, frontMatterData);

    return filePath;
  }

  /**
   * Get template content for project creation
   * @param data - Project creation data
   * @returns Template content or default content if template not found
   */
  private async getProjectTemplateContent(
    data: ProjectCreationData
  ): Promise<string> {
    // Try to read template content
    try {
      return await this.readProjectTemplate();
    } catch (error) {
      // Template doesn't exist - use default content
      return [
        "",
        "## Notes",
        "",
        data.description || "",
        "",
        "## Tasks",
        "",
        "{{tasks}}",
        "",
      ].join("\n");
    }
  }

  /**
   * Read project template content from file
   * @returns Template content
   * @throws Error if template file is not found
   */
  private async readProjectTemplate(): Promise<string> {
    const templateFileName = this.settings.defaultProjectTemplate;
    return await this.readTemplate(templateFileName);
  }

  /**
   * Load a Project entity from an Obsidian TFile
   * @param file - The TFile to load
   * @returns Project entity
   * @throws Error if file is not a valid project
   */
  async loadEntity(file: TFile): Promise<Project> {
    const frontMatter = await this.waitForMetadataCache(file);

    if (frontMatter.Type !== "Project") {
      return;
    }

    return {
      id: this.generateId(),
      file,
      filePath: file.path,
      name: frontMatter.Name,
      type: frontMatter.Type,
      areas: frontMatter.Areas,
      tags: frontMatter.tags,
    };
  }

  /**
   * Implementation of abstract method from FileManager
   */
  async createEntityFile(data: FileCreationData): Promise<string> {
    return this.createProjectFile(data as ProjectCreationData);
  }

  /**
   * Get project properties in the correct order
   * @returns Array of property definitions in the correct order
   */
  getPropertiesInOrder(): any[] {
    return generateProjectFrontMatter();
  }

  /**
   * Update a project file's properties to match current schema and property order
   * @param filePath - Path to the project file
   * @returns Object with hasChanges and propertiesChanged count
   */
  async updateFileProperties(
    filePath: string
  ): Promise<{ hasChanges: boolean; propertiesChanged: number }> {
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (!file) {
      throw new Error(`File not found: ${filePath}`);
    }

    const fullContent = await this.vault.read(file as any);

    // Extract existing front-matter using Obsidian's metadata cache
    const existingFrontMatter = this.app.metadataCache.getFileCache(
      file as TFile
    )?.frontmatter;
    if (!existingFrontMatter) {
      throw new Error(`File ${filePath} has no front-matter`);
    }

    // Check if file has correct Type property for projects
    if (existingFrontMatter.Type && existingFrontMatter.Type !== "Project") {
      throw new Error(
        `File ${filePath} is not a project (Type: ${existingFrontMatter.Type})`
      );
    }

    // Get current schema for projects
    const properties = this.getPropertiesInOrder();
    const currentSchema: Record<string, any> = {};
    const propertyOrder: string[] = [];

    properties.forEach((prop: any) => {
      currentSchema[prop.name] = {
        type: prop.type,
        ...(prop.default !== undefined && { default: prop.default }),
        ...(prop.link && { link: prop.link }),
      };
      propertyOrder.push(prop.name);
    });

    let hasChanges = false;
    let propertiesChanged = 0;
    const updatedFrontMatter = { ...existingFrontMatter };

    // Add missing fields with default values
    for (const [fieldName, fieldConfig] of Object.entries(currentSchema)) {
      if (!(fieldName in updatedFrontMatter)) {
        const config = fieldConfig as any;
        if (config.default === undefined) {
          throw new Error(`Property ${fieldName} has no default value defined`);
        }
        updatedFrontMatter[fieldName] = config.default;
        hasChanges = true;
        propertiesChanged++;
      }
    }

    // Remove obsolete fields (fields not in current schema) - but be conservative
    const validFields = new Set(Object.keys(currentSchema));
    for (const fieldName of Object.keys(updatedFrontMatter)) {
      // Only remove fields that are clearly not part of the schema
      // Keep common fields that might be used by other plugins
      const commonFields = ["tags", "aliases", "cssclass", "publish"];
      if (!validFields.has(fieldName) && !commonFields.includes(fieldName)) {
        delete updatedFrontMatter[fieldName];
        hasChanges = true;
        propertiesChanged++;
      }
    }

    // Check if property order matches schema
    if (
      !hasChanges &&
      !this.isPropertyOrderCorrect(fullContent, currentSchema, propertyOrder)
    ) {
      hasChanges = true;
      propertiesChanged++; // Count order change as one property change
    }

    // Only update the file if there are changes
    if (hasChanges) {
      // Use Obsidian's native processFrontMatter to update with correct order
      await this.app.fileManager.processFrontMatter(
        file as TFile,
        (frontmatter) => {
          // Clear existing properties
          Object.keys(frontmatter).forEach((key) => delete frontmatter[key]);

          // Add properties in correct order
          for (const fieldName of propertyOrder) {
            const value = updatedFrontMatter[fieldName];
            if (value !== undefined) {
              frontmatter[fieldName] = value;
            }
          }

          // Add any additional fields that aren't in the schema but exist in the file
          for (const [key, value] of Object.entries(updatedFrontMatter)) {
            if (!propertyOrder.includes(key)) {
              frontmatter[key] = value;
            }
          }
        }
      );
    }

    return { hasChanges, propertiesChanged };
  }

  /**
   * Generate front-matter object for project files
   * @param data - Project creation data
   * @returns Front-matter object
   */
  private generateProjectFrontMatterObject(
    data: ProjectCreationData
  ): Record<string, any> {
    const areas = Array.isArray(data.areas)
      ? data.areas
      : data.areas
      ? data.areas.split(",").map((s) => s.trim())
      : [];

    return {
      Name: data.title,
      Type: "Project",
      Areas: areas,
    };
  }
}
