/**
 * Abstract FileManager Base Class
 * Provides common file operations that can be shared across different file manager implementations
 * Uses Obsidian's native APIs for file system operations and front-matter handling
 */

import { App, Vault, TFile, normalizePath } from "obsidian";
import { TaskSyncSettings } from "../main";
import { sanitizeFileName } from "../utils/fileNameSanitizer";
import matter from "gray-matter";

/**
 * Interface for file creation data
 */
export interface FileCreationData {
  title: string;
  [key: string]: any;
}

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
    content: string,
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
   * Load and parse front-matter from a file
   * @param filePath - Path to the file
   * @returns Parsed front-matter object
   */
  async loadFrontMatter(filePath: string): Promise<Record<string, any>> {
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (!file || !(file instanceof TFile)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const content = await this.vault.read(file);
    const parsed = matter(content);
    return parsed.data || {};
  }

  /**
   * Extract file content after front-matter
   * @param filePath - Path to the file
   * @returns Content after front-matter
   */
  async getFileContent(filePath: string): Promise<string> {
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (!file || !(file instanceof TFile)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const content = await this.vault.read(file);
    const parsed = matter(content);
    return parsed.content || "";
  }

  /**
   * Update front-matter structure using Obsidian's native processFrontMatter
   * @param filePath - Path to the file
   * @param updates - Object with properties to update
   */
  async updateFrontMatter(
    filePath: string,
    updates: Record<string, any>,
  ): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (!file || !(file instanceof TFile)) {
      throw new Error(`File not found: ${filePath}`);
    }

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
    value: any,
  ): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (!file || !(file instanceof TFile)) {
      throw new Error(`File not found: ${filePath}`);
    }

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
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (!file || !(file instanceof TFile)) {
      throw new Error(`File not found: ${filePath}`);
    }

    await this.vault.delete(file);
  }

  /**
   * Rename a file
   * @param oldPath - Current file path
   * @param newPath - New file path
   */
  async renameFile(oldPath: string, newPath: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(oldPath);
    if (!file || !(file instanceof TFile)) {
      throw new Error(`File not found: ${oldPath}`);
    }

    await this.vault.rename(file, newPath);
  }

  /**
   * Copy a file
   * @param sourcePath - Source file path
   * @param targetPath - Target file path
   */
  async copyFile(sourcePath: string, targetPath: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(sourcePath);
    if (!file || !(file instanceof TFile)) {
      throw new Error(`File not found: ${sourcePath}`);
    }

    await this.vault.copy(file, targetPath);
  }

  /**
   * Get file modification time
   * @param filePath - Path to the file
   * @returns Last modification time
   */
  async getFileModTime(filePath: string): Promise<number> {
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (!file || !(file instanceof TFile)) {
      throw new Error(`File not found: ${filePath}`);
    }

    return file.stat.mtime;
  }

  /**
   * Get file size
   * @param filePath - Path to the file
   * @returns File size in bytes
   */
  async getFileSize(filePath: string): Promise<number> {
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (!file || !(file instanceof TFile)) {
      throw new Error(`File not found: ${filePath}`);
    }

    return file.stat.size;
  }

  /**
   * Abstract method for creating entity-specific files
   * Must be implemented by concrete classes
   */
  abstract createEntityFile(data: FileCreationData): Promise<string>;

  /**
   * Update settings reference (for when settings are changed)
   */
  updateSettings(newSettings: TaskSyncSettings): void {
    this.settings = newSettings;
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
    content: string,
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
        const [, key, value] = match;
        data[key.trim()] = value.trim();
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
    expectedOrder: string[],
  ): boolean {
    const currentOrder = this.extractPropertyOrder(content);

    // Filter current order to only include properties that are in the schema
    const currentSchemaProperties = currentOrder.filter(
      (prop) => prop in schema,
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

  /**
   * Abstract method to get properties in order for specific file type
   * Must be implemented by subclasses
   */
  abstract getPropertiesInOrder(): any[];

  /**
   * Abstract method to update file properties with correct ordering
   * Must be implemented by subclasses
   */
  abstract updateFileProperties(
    filePath: string,
  ): Promise<{ hasChanges: boolean; propertiesChanged: number }>;
}
