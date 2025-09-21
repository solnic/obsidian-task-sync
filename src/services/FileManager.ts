/**
 * Abstract FileManager Base Class
 * Provides common file operations that can be shared across different file manager implementations
 * Uses Obsidian's native APIs for file system operations and front-matter handling
 */

import { App, Vault, TFile, normalizePath } from "obsidian";
import { TaskSyncSettings } from "../main";
import { sanitizeFileName } from "../utils/fileNameSanitizer";
import { generateId as generateUlid } from "../utils/idGenerator";

/**
 * Abstract base class for file management operations
 * Provides common functionality for file creation, front-matter handling, and content management
 */
export abstract class FileManager {
  protected app: App;
  protected vault: Vault;
  protected settings: TaskSyncSettings;

  constructor(app: App, vault: Vault, settings: TaskSyncSettings) {
    this.app = app;
    this.vault = vault;
    this.settings = settings;
  }

  /**
   * Create a file with sanitized and normalized path and content
   * @param folderPath - The folder where the file should be created
   * @param fileName - The desired file name (will be sanitized and normalized)
   * @param content - The file content
   * @returns The path of the created file
   */
  protected async createFile(
    folderPath: string,
    fileName: string,
    content: string
  ): Promise<string> {
    const sanitizedName = sanitizeFileName(fileName);
    const filePath = normalizePath(`${folderPath}/${sanitizedName}.md`);

    // Check if file already exists
    const existingFile = this.app.vault.getAbstractFileByPath(filePath);
    if (existingFile) {
      throw new Error(`File already exists: ${filePath}`);
    }

    // Create the file
    await this.vault.create(filePath, content);
    return filePath;
  }

  /**
   * Load and parse front-matter from a file using Obsidian's metadata cache
   * @param filePath - Path to the file
   * @returns Parsed front-matter object
   */
  async loadFrontMatter(filePath: string): Promise<any> {
    const file = this.app.vault.getAbstractFileByPath(filePath) as TFile;

    return await this.waitForMetadataCache(file);
  }

  /**
   * Extract file content after front-matter using Obsidian API
   * @param filePath - Path to the file
   * @returns Content after front-matter
   */
  async getFileContent(filePath: string): Promise<string> {
    const file = this.app.vault.getAbstractFileByPath(filePath) as TFile;
    const content = await this.vault.read(file);

    // Extract content after front-matter manually
    const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---\n?/);
    return content.substring(frontMatterMatch[0].length);
  }

  /**
   * Update front-matter structure using Obsidian's native processFrontMatter
   * @param filePath - Path to the file
   * @param updates - Object with properties to update
   */
  async updateFrontMatter(
    filePath: string,
    updates: Record<string, any>
  ): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(filePath) as TFile;
    await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
      Object.assign(frontmatter, updates);
    });
  }

  /**
   * Update a specific property in the front-matter
   * @param filePath - Path to the file
   * @param propertyKey - The property key to update
   * @param value - The new value
   */
  async updateProperty(
    filePath: string,
    propertyKey: string,
    value: any
  ): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(filePath) as TFile;
    await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
      frontmatter[propertyKey] = value;
    });
  }

  /**
   * Check if a file exists
   * @param filePath - Path to the file
   * @returns True if file exists, false otherwise
   */
  async fileExists(filePath: string): Promise<boolean> {
    const file = this.app.vault.getAbstractFileByPath(filePath);
    return file instanceof TFile;
  }

  /**
   * Delete a file
   * @param filePath - Path to the file to delete
   */
  async deleteFile(filePath: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(filePath) as TFile;
    await this.vault.delete(file);
  }

  /**
   * Rename a file
   * @param oldPath - Current file path
   * @param newPath - New file path
   */
  async renameFile(oldPath: string, newPath: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(oldPath) as TFile;
    await this.vault.rename(file, newPath);
  }

  /**
   * Copy a file
   * @param sourcePath - Source file path
   * @param targetPath - Target file path
   */
  async copyFile(sourcePath: string, targetPath: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(sourcePath) as TFile;
    await this.vault.copy(file, targetPath);
  }

  /**
   * Get file modification time
   * @param filePath - Path to the file
   * @returns Last modification time
   */
  async getFileModTime(filePath: string): Promise<number> {
    const file = this.app.vault.getAbstractFileByPath(filePath) as TFile;
    return file.stat.mtime;
  }

  /**
   * Get file size
   * @param filePath - Path to the file
   * @returns File size in bytes
   */
  async getFileSize(filePath: string): Promise<number> {
    const file = this.app.vault.getAbstractFileByPath(filePath) as TFile;
    return file.stat.size;
  }

  /**
   * Update settings reference (for when settings are changed)
   */
  updateSettings(newSettings: TaskSyncSettings): void {
    this.settings = newSettings;
  }

  /**
   * Read template content from file
   * @param templateFileName - Name of the template file
   * @returns Template content
   * @throws Error if template file is not found or cannot be read
   */
  protected async readTemplate(templateFileName: string): Promise<string> {
    const templatePath = `${this.settings.templateFolder}/${templateFileName}`;
    const templateFile = this.vault.getAbstractFileByPath(templatePath);

    if (!(templateFile instanceof TFile)) {
      throw new Error(`Template file not found: ${templatePath}`);
    }

    return await this.vault.read(templateFile);
  }

  /**
   * Process {{tasks}} variable in content and replace with appropriate base embed
   * @param content - Content that may contain {{tasks}} variable
   * @param entityName - Name of the entity for base embed
   * @returns Processed content with {{tasks}} replaced
   */
  protected processTasksVariable(content: string, entityName: string): string {
    if (!content.includes("{{tasks}}")) {
      return content;
    }

    const baseEmbed = `![[${this.settings.basesFolder}/${entityName}.base]]`;
    return content.replace(/\{\{tasks\}\}/g, baseEmbed);
  }

  /**
   * Abstract method for getting properties in order
   * Must be implemented by concrete classes
   */
  abstract getPropertiesInOrder(): any[];

  /**
   * Abstract method for updating file properties
   * Must be implemented by concrete classes
   */
  abstract updateFileProperties(
    filePath: string
  ): Promise<{ hasChanges: boolean; propertiesChanged: number }>;

  /**
   * Abstract method for loading entity from file
   * Must be implemented by concrete classes
   */
  abstract loadEntity(file: TFile, cache?: any): Promise<any>;

  // ============================================================================
  // TEMPLATE MANAGEMENT INTERFACE
  // ============================================================================

  /**
   * Abstract method for creating template files
   * Must be implemented by concrete classes to handle their specific template types
   * @param filename - Optional filename override
   */
  abstract createTemplate(filename?: string): Promise<void>;

  /**
   * Abstract method for ensuring template exists
   * Must be implemented by concrete classes to check and create missing templates
   */
  abstract ensureTemplateExists(): Promise<void>;

  /**
   * Abstract method for updating template properties
   * Must be implemented by concrete classes to handle template property reordering
   * @param content - Template content to update
   * @returns Updated template content
   */
  abstract updateTemplateProperties(content: string): Promise<string>;

  /**
   * Wait for metadata cache to have front-matter for the given file
   * Uses event-driven approach with fallback polling for better performance
   */
  public async waitForMetadataCache(file: TFile): Promise<any> {
    // Helper function to check if frontmatter is complete (has non-null values)
    const isCompleteFrontmatter = (frontmatter: any): boolean => {
      if (!frontmatter || Object.keys(frontmatter).length === 0) {
        return false;
      }
      // Check if essential properties have non-null values
      // For tasks, we expect at least Title and Type to have values
      if (frontmatter.Type === "Task") {
        return frontmatter.Title !== null && frontmatter.Title !== undefined;
      }
      // For other entity types, just check that we have some non-null values
      return Object.values(frontmatter).some(
        (value) => value !== null && value !== undefined
      );
    };

    // First check if metadata is already available and complete
    const existingCache = this.app.metadataCache.getFileCache(file);
    if (
      existingCache?.frontmatter &&
      isCompleteFrontmatter(existingCache.frontmatter)
    ) {
      return existingCache.frontmatter;
    }

    // Use event-driven approach with timeout
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.app.metadataCache.off("changed", onMetadataChanged);
        reject(new Error(`Metadata cache timeout for file: ${file.path}`));
      }, 5000); // 5 second timeout instead of 10 seconds

      const onMetadataChanged = (
        changedFile: TFile,
        _data: string,
        cache: any
      ) => {
        if (
          changedFile.path === file.path &&
          cache?.frontmatter &&
          isCompleteFrontmatter(cache.frontmatter)
        ) {
          clearTimeout(timeout);
          this.app.metadataCache.off("changed", onMetadataChanged);
          resolve(cache.frontmatter);
        }
      };

      // Listen for metadata changes
      this.app.metadataCache.on("changed", onMetadataChanged);

      // Fallback: check again after a short delay in case the event was missed
      setTimeout(() => {
        const cache = this.app.metadataCache.getFileCache(file);
        if (cache?.frontmatter && isCompleteFrontmatter(cache.frontmatter)) {
          clearTimeout(timeout);
          this.app.metadataCache.off("changed", onMetadataChanged);
          resolve(cache.frontmatter);
        }
      }, 100);
    });
  }

  /**
   * Generate a unique ID for entities
   * Common method used by all file managers for entity ID generation
   */
  protected generateId(): string {
    return generateUlid();
  }

  // ============================================================================
  // PROPERTY ORDERING FUNCTIONALITY (moved from TaskFileManager)
  // ============================================================================

  /**
   * Extract front-matter data from file content
   * @param content - File content
   * @returns Parsed front-matter data or null if not found
   */
  protected extractFrontMatterData(
    content: string
  ): Record<string, any> | null {
    const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontMatterMatch) {
      return null;
    }

    const frontMatterText = frontMatterMatch[1];
    const data: Record<string, any> = {};

    // Simple YAML-like parsing for front-matter
    const lines = frontMatterText.split("\n");
    for (const line of lines) {
      const match = line.match(/^([^:]+):\s*(.*)$/);
      if (match) {
        const [, key, rawValue] = match;
        const value = rawValue.trim();

        // Basic type conversion for common YAML values
        let parsedValue: any = value;
        if (value === "true") {
          parsedValue = true;
        } else if (value === "false") {
          parsedValue = false;
        } else if (value === "null" || value === "") {
          parsedValue = null;
        } else if (/^\d+$/.test(value)) {
          parsedValue = parseInt(value, 10);
        } else if (/^\d+\.\d+$/.test(value)) {
          parsedValue = parseFloat(value);
        } else if (value.startsWith("[") && value.endsWith("]")) {
          // Simple array parsing for basic arrays
          try {
            parsedValue = JSON.parse(value);
          } catch {
            parsedValue = value; // Keep as string if parsing fails
          }
        }

        data[key.trim()] = parsedValue;
      }
    }

    return data;
  }

  /**
   * Extract property order from front-matter content
   * @param content - File content
   * @returns Array of property names in order
   */
  protected extractPropertyOrder(content: string): string[] {
    const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontMatterMatch) {
      return [];
    }

    const frontMatterText = frontMatterMatch[1];
    const properties: string[] = [];

    const lines = frontMatterText.split("\n");
    for (const line of lines) {
      const match = line.match(/^([^:]+):\s*/);
      if (match) {
        properties.push(match[1].trim());
      }
    }

    return properties;
  }

  /**
   * Check if property order matches the expected schema order
   * @param content - File content
   * @param schema - Schema object with property definitions
   * @param expectedOrder - Expected property order
   * @returns True if order is correct
   */
  protected isPropertyOrderCorrect(
    content: string,
    schema: Record<string, any>,
    expectedOrder: string[]
  ): boolean {
    const currentOrder = this.extractPropertyOrder(content);

    // Filter current order to only include properties that are in the schema
    const currentSchemaProperties = currentOrder.filter(
      (prop) => prop in schema
    );

    // Compare the order of schema properties
    for (
      let i = 0;
      i < Math.min(currentSchemaProperties.length, expectedOrder.length);
      i++
    ) {
      if (currentSchemaProperties[i] !== expectedOrder[i]) {
        return false;
      }
    }

    return currentSchemaProperties.length === expectedOrder.length;
  }

  /**
   * Format property value for YAML output
   * @param value - Property value to format
   * @returns Formatted value string
   */
  protected formatPropertyValue(value: any): string {
    if (value === null || value === undefined) {
      return "";
    }
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return "[]";
      }
      return `[${value.map((v) => `"${v}"`).join(", ")}]`;
    }
    if (typeof value === "boolean") {
      return value.toString();
    }
    if (typeof value === "string" && value.includes("\n")) {
      return `"${value.replace(/"/g, '\\"')}"`;
    }
    return value.toString();
  }
}
