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
    const templateContent = await this.readTemplate();
    if (templateContent) {
      return templateContent;
    }

    // Fallback content if template doesn't exist
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

  /**
   * Read template content from file
   * @returns Template content or null if not found
   */
  private async readTemplate(): Promise<string | null> {
    const templateFileName = this.settings.defaultProjectTemplate;
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
   * Process {{tasks}} variable in content and replace with appropriate base embed
   * @param content - Content that may contain {{tasks}} variable
   * @param projectName - Name of the project for base embed
   * @returns Processed content with {{tasks}} replaced
   */
  private processTasksVariable(content: string, projectName: string): string {
    if (!content.includes("{{tasks}}")) {
      return content;
    }

    const baseEmbed = `![[${this.settings.basesFolder}/${projectName}.base]]`;
    return content.replace(/\{\{tasks\}\}/g, baseEmbed);
  }

  /**
   * Load a Project entity from an Obsidian TFile
   * @param file - The TFile to load
   * @returns Project entity or null if invalid
   */
  async loadEntity(file: TFile): Promise<Project | null> {
    try {
      // Wait for metadata cache to be ready for this file
      const frontMatter = await this.waitForMetadataCache(file);

      // Check if this is a valid project file
      if (frontMatter.Type !== "Project") {
        return null;
      }

      // Create Project entity from front-matter
      return {
        id: this.generateId(),
        file,
        filePath: file.path,
        name: frontMatter.Name || file.basename,
        type: frontMatter.Type,
        areas: Array.isArray(frontMatter.Areas) ? frontMatter.Areas : [],
        tags: Array.isArray(frontMatter.tags) ? frontMatter.tags : [],
      };
    } catch (error) {
      console.warn(`Failed to load project from ${file.path}:`, error);
      return null;
    }
  }

  /**
   * Wait for metadata cache to have front-matter for the given file
   */
  private async waitForMetadataCache(file: TFile): Promise<any> {
    // First try to get from cache immediately
    let frontMatter = this.app.metadataCache.getFileCache(file)?.frontmatter;

    if (frontMatter && Object.keys(frontMatter).length > 0) {
      return frontMatter;
    }

    // If not available, wait for metadata cache to be updated
    return new Promise((resolve) => {
      const checkCache = () => {
        const cache = this.app.metadataCache.getFileCache(file);
        if (cache?.frontmatter && Object.keys(cache.frontmatter).length > 0) {
          resolve(cache.frontmatter);
          return true;
        }
        return false;
      };

      // Check immediately in case it was just updated
      if (checkCache()) return;

      // Listen for metadata cache changes
      const onMetadataChange = (changedFile: TFile) => {
        if (changedFile.path === file.path && checkCache()) {
          this.app.metadataCache.off("changed", onMetadataChange);
        }
      };

      this.app.metadataCache.on("changed", onMetadataChange);

      // Fallback timeout to prevent hanging
      setTimeout(() => {
        this.app.metadataCache.off("changed", onMetadataChange);
        resolve(this.app.metadataCache.getFileCache(file)?.frontmatter || {});
      }, 1000);
    });
  }

  /**
   * Generate a unique ID for entities
   */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
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
      // No front-matter exists, skip this file
      return { hasChanges: false, propertiesChanged: 0 };
    }

    // Check if file has correct Type property for projects
    if (existingFrontMatter.Type && existingFrontMatter.Type !== "Project") {
      // Skip files that are not projects
      console.log(
        `Project FileManager: Skipping file with incorrect Type property: ${filePath} (expected: Project, found: ${existingFrontMatter.Type})`
      );
      return { hasChanges: false, propertiesChanged: 0 };
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
