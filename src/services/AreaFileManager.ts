/**
 * AreaFileManager Service
 * Concrete implementation of FileManager for area-specific file operations
 * Handles area file creation, property updates, and area-specific operations
 */

import { App, Vault, TFile } from "obsidian";
import { TaskSyncSettings } from "../main";
import { FileManager } from "./FileManager";
import { generateAreaFrontMatter } from "./base-definitions/BaseConfigurations";
import { Area } from "../types/entities";

/**
 * Interface for area creation data
 */
export interface AreaCreationData {
  name: string;
  description?: string;
}

/**
 * AreaFileManager - Handles all area file operations
 * Extends the abstract FileManager with area-specific functionality
 */
export class AreaFileManager extends FileManager {
  constructor(app: App, vault: Vault, settings: TaskSyncSettings) {
    super(app, vault, settings);
  }

  /**
   * Create an area file with proper front-matter structure
   * @param data - Area creation data
   * @param content - Optional file content. If not provided, reads from template.
   * @returns Path of the created area file
   */
  async createAreaFile(
    data: AreaCreationData,
    content?: string
  ): Promise<string> {
    const areaFolder = this.settings.areasFolder;

    // Get content from template if not provided
    let fileContent = content;
    let rawTemplateContent: string | undefined;
    if (!fileContent) {
      // Read raw template content for front-matter extraction
      try {
        rawTemplateContent = await this.readAreaTemplate();
      } catch (error) {
        // Template doesn't exist, use default content
      }
      fileContent = await this.getAreaTemplateContent(data);
    }

    // Process {{tasks}} variable in content
    const processedContent = this.processTasksVariable(fileContent, data.name);

    const filePath = await this.createFile(
      areaFolder,
      data.name,
      processedContent
    );
    const frontMatterData = this.generateAreaFrontMatterObject(
      data,
      rawTemplateContent
    );
    await this.updateFrontMatter(filePath, frontMatterData);

    // Wait for the metadata cache to be updated after front-matter changes
    const file = this.app.vault.getAbstractFileByPath(filePath) as TFile;
    await this.waitForMetadataCache(file);

    return filePath;
  }

  /**
   * Get template content for area creation
   * @param data - Area creation data
   * @returns Template content or default content if template not found
   */
  private async getAreaTemplateContent(
    data: AreaCreationData
  ): Promise<string> {
    // Try to read template content
    try {
      const templateContent = await this.readAreaTemplate();
      // Extract only the body content (after front-matter) from template
      const bodyContent = this.extractBodyContent(templateContent);
      // Process {{description}} variable in template content
      return this.processDescriptionVariable(bodyContent, data.description);
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
   * Extract body content from template (content after front-matter)
   * @param content - Full template content including front-matter
   * @returns Body content without front-matter
   */
  private extractBodyContent(content: string): string {
    // Check if content starts with front-matter
    const frontMatterMatch = content.match(
      /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/
    );
    if (frontMatterMatch) {
      // Return content after front-matter
      return frontMatterMatch[2] || "";
    }
    // No front-matter found, return entire content
    return content;
  }

  /**
   * Read area template content from file
   * @returns Template content
   * @throws Error if template file is not found
   */
  private async readAreaTemplate(): Promise<string> {
    const templateFileName = this.settings.defaultAreaTemplate;
    return await this.readTemplate(templateFileName);
  }

  /**
   * Process {{description}} variable in content and replace with actual description
   * @param content - Content that may contain {{description}} variable
   * @param description - Description to replace the variable with
   * @returns Processed content with {{description}} replaced
   */
  private processDescriptionVariable(
    content: string,
    description?: string
  ): string {
    if (!content.includes("{{description}}")) {
      return content;
    }

    return content.replace(/\{\{description\}\}/g, description || "");
  }

  /**
   * Load an Area entity from an Obsidian TFile
   * @param file - The TFile to load
   * @param cache - Optional metadata cache to use instead of waiting for cache
   * @returns Area entity
   * @throws Error if file is not a valid area
   */
  async loadEntity(file: TFile, cache?: any): Promise<Area> {
    const frontMatter =
      cache?.frontmatter || (await this.waitForMetadataCache(file));

    if (frontMatter.Type !== "Area") {
      return;
    }

    return {
      id: this.generateId(),
      file,
      filePath: file.path,
      name: frontMatter.Name,
      type: frontMatter.Type,
      tags: frontMatter.tags,
    };
  }

  /**
   * Implementation of abstract method from FileManager
   */
  async createEntityFile(data: AreaCreationData): Promise<string> {
    return this.createAreaFile(data as AreaCreationData);
  }

  /**
   * Get area properties in the correct order
   * @returns Array of property definitions in the correct order
   */
  getPropertiesInOrder(): any[] {
    return generateAreaFrontMatter();
  }

  /**
   * Update an area file's properties to match current schema and property order
   * @param filePath - Path to the area file
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

    // Check if file has correct Type property for areas
    if (existingFrontMatter.Type && existingFrontMatter.Type !== "Area") {
      throw new Error(
        `File ${filePath} is not an area (Type: ${existingFrontMatter.Type})`
      );
    }

    // Get current schema for areas
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
   * Generate front-matter object for area files
   * @param data - Area creation data
   * @param templateContent - Template content to extract front-matter from
   * @returns Front-matter object
   */
  private generateAreaFrontMatterObject(
    data: AreaCreationData,
    templateContent?: string
  ): Record<string, any> {
    // Start with basic properties
    const frontMatterData: Record<string, any> = {
      Name: data.name,
      Type: "Area",
    };

    // If template content is provided, extract and merge front-matter from it
    if (templateContent) {
      const templateFrontMatter =
        this.extractTemplateFrontMatter(templateContent);
      if (templateFrontMatter) {
        // Merge template front-matter with basic properties
        // Basic properties take precedence over template properties
        Object.assign(templateFrontMatter, frontMatterData);
        return templateFrontMatter;
      }
    }

    return frontMatterData;
  }

  /**
   * Extract front-matter from template content using existing parsing utilities
   * @param content - Template content
   * @returns Parsed front-matter object or null if not found
   */
  private extractTemplateFrontMatter(
    content: string
  ): Record<string, any> | null {
    return this.extractFrontMatterData(content);
  }
}
