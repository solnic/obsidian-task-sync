/**
 * FileManager - Typed Note File Operations
 * Handles typed note creation, updates, and file operations with proper validation
 */

import type { App, Vault, TFile, TFolder } from "obsidian";
import { normalizePath } from "obsidian";
import type { NoteType, ValidationResult } from "./types";
import type { TypeRegistry } from "./registry";
import { NoteProcessor } from "./note-processor";
import { TemplateManager, type TemplatePreferences } from "./template-manager";
import { PropertyProcessor } from "./property-processor";
import { createValidResult, createInvalidResult, createValidationError } from "./validation";
import * as yaml from "js-yaml";

/**
 * File creation options
 */
export interface FileCreationOptions {
  /** Target folder for the file */
  folder?: string;
  
  /** Custom file name (will be sanitized) */
  fileName?: string;
  
  /** Properties to pre-fill */
  properties?: Record<string, any>;
  
  /** Whether to validate properties before creation */
  validateProperties?: boolean;
  
  /** Whether to overwrite existing files */
  overwrite?: boolean;
  
  /** Custom content (if not using template) */
  content?: string;
}

/**
 * File creation result
 */
export interface FileCreationResult {
  /** Whether creation was successful */
  success: boolean;
  
  /** Path of the created file */
  filePath?: string;
  
  /** The created TFile instance */
  file?: TFile;
  
  /** Validation errors */
  errors?: string[];
  
  /** Warnings */
  warnings?: string[];
}

/**
 * File update options
 */
export interface FileUpdateOptions {
  /** Properties to update */
  properties?: Record<string, any>;
  
  /** Whether to validate properties before update */
  validateProperties?: boolean;
  
  /** Whether to preserve existing content */
  preserveContent?: boolean;
  
  /** Whether to update modification time */
  updateModTime?: boolean;
}

/**
 * File update result
 */
export interface FileUpdateResult {
  /** Whether update was successful */
  success: boolean;
  
  /** Updated properties */
  updatedProperties?: Record<string, any>;
  
  /** Validation errors */
  errors?: string[];
  
  /** Warnings */
  warnings?: string[];
}

/**
 * File validation result
 */
export interface FileValidationResult {
  /** Whether file is valid */
  valid: boolean;
  
  /** Detected note type */
  noteType?: NoteType;
  
  /** Validated properties */
  properties?: Record<string, any>;
  
  /** Validation errors */
  errors?: string[];
  
  /** Warnings */
  warnings?: string[];
}

/**
 * FileManager handles all file operations for typed notes
 */
export class FileManager {
  private app: App;
  private vault: Vault;
  private registry: TypeRegistry;
  private noteProcessor: NoteProcessor;
  private templateManager: TemplateManager;
  private propertyProcessor: PropertyProcessor;

  constructor(
    app: App,
    registry: TypeRegistry,
    templatePreferences: TemplatePreferences
  ) {
    this.app = app;
    this.vault = app.vault;
    this.registry = registry;
    this.propertyProcessor = new PropertyProcessor();
    this.noteProcessor = new NoteProcessor(
      this.propertyProcessor,
      undefined, // TemplateEngine will be created by NoteProcessor
      registry
    );
    this.templateManager = new TemplateManager(app, registry, templatePreferences);
  }

  /**
   * Create a new typed note file
   */
  async createTypedNote(
    noteTypeId: string,
    options: FileCreationOptions = {}
  ): Promise<FileCreationResult> {
    const {
      folder = "",
      fileName,
      properties = {},
      validateProperties = true,
      overwrite = false,
      content,
    } = options;

    try {
      // Get note type
      const noteType = this.registry.get(noteTypeId);
      if (!noteType) {
        return {
          success: false,
          errors: [`Note type "${noteTypeId}" not found`],
        };
      }

      // Generate file name if not provided
      const finalFileName = fileName || this.generateFileName(noteType, properties);
      const sanitizedFileName = this.sanitizeFileName(finalFileName);
      const filePath = normalizePath(`${folder}/${sanitizedFileName}.md`);

      // Check if file exists
      const existingFile = this.vault.getAbstractFileByPath(filePath);
      if (existingFile && !overwrite) {
        return {
          success: false,
          errors: [`File already exists: ${filePath}`],
        };
      }

      // Generate content
      let fileContent: string;
      if (content) {
        fileContent = content;
      } else {
        // Use template to generate content
        const templateResult = await this.templateManager.applyTemplate(noteTypeId, {
          properties,
          validateProperties,
        });

        if (!templateResult.success) {
          return {
            success: false,
            errors: templateResult.errors,
            warnings: templateResult.warnings,
          };
        }

        fileContent = templateResult.content!;
      }

      // Create or update file
      let file: TFile;
      if (existingFile && overwrite) {
        await this.vault.modify(existingFile as TFile, fileContent);
        file = existingFile as TFile;
      } else {
        file = await this.vault.create(filePath, fileContent);
      }

      return {
        success: true,
        filePath,
        file,
      };

    } catch (error) {
      return {
        success: false,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  /**
   * Update an existing typed note file
   */
  async updateTypedNote(
    filePath: string,
    options: FileUpdateOptions = {}
  ): Promise<FileUpdateResult> {
    const {
      properties = {},
      validateProperties = true,
      preserveContent = true,
      updateModTime = true,
    } = options;

    try {
      // Get file
      const file = this.vault.getAbstractFileByPath(filePath);
      if (!file || !(file instanceof TFile)) {
        return {
          success: false,
          errors: [`File not found: ${filePath}`],
        };
      }

      // Read current content
      const currentContent = await this.vault.read(file);

      // Process current note to get note type and existing properties
      const noteResult = this.noteProcessor.processNote(currentContent, filePath);
      if (!noteResult.valid || !noteResult.noteType) {
        return {
          success: false,
          errors: [`Could not process note: ${noteResult.errors.map(e => e.message).join(", ")}`],
        };
      }

      // Validate new properties if requested
      if (validateProperties && Object.keys(properties).length > 0) {
        const propertyResult = this.propertyProcessor.process(
          noteResult.noteType,
          properties,
          { validateRequired: false } // Don't require all properties for updates
        );

        if (!propertyResult.success) {
          return {
            success: false,
            errors: propertyResult.errors.map(e => e.message),
            warnings: propertyResult.warnings.map(w => w.message),
          };
        }
      }

      // Update front-matter using Obsidian's processFrontMatter
      await this.app.fileManager.processFrontMatter(file, (frontMatter) => {
        Object.assign(frontMatter, properties);
        
        if (updateModTime) {
          frontMatter.updatedAt = new Date().toISOString();
        }
      });

      return {
        success: true,
        updatedProperties: properties,
      };

    } catch (error) {
      return {
        success: false,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  /**
   * Validate a typed note file
   */
  async validateTypedNote(filePath: string): Promise<FileValidationResult> {
    try {
      // Get file
      const file = this.vault.getAbstractFileByPath(filePath);
      if (!file || !(file instanceof TFile)) {
        return {
          valid: false,
          errors: [`File not found: ${filePath}`],
        };
      }

      // Read and process content
      const content = await this.vault.read(file);
      const result = this.noteProcessor.processNote(content, filePath);

      return {
        valid: result.valid,
        noteType: result.noteType || undefined,
        properties: result.properties,
        errors: result.errors.map(e => e.message),
        warnings: result.warnings.map(w => w.message),
      };

    } catch (error) {
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  /**
   * Check if a file is a typed note
   */
  async isTypedNote(filePath: string): Promise<boolean> {
    const validation = await this.validateTypedNote(filePath);
    return validation.valid && validation.noteType !== undefined;
  }

  /**
   * Get note type for a file
   */
  async getNoteType(filePath: string): Promise<NoteType | null> {
    const validation = await this.validateTypedNote(filePath);
    return validation.noteType || null;
  }

  /**
   * Generate a file name from note type and properties
   */
  private generateFileName(noteType: NoteType, properties: Record<string, any>): string {
    // Try to use a title or name property
    const titleProperty = properties.title || properties.name || properties.displayName;
    if (titleProperty && typeof titleProperty === "string") {
      return titleProperty;
    }

    // Fall back to note type name with timestamp
    const timestamp = new Date().toISOString().slice(0, 16).replace(/[T:]/g, "-");
    return `${noteType.name}-${timestamp}`;
  }

  /**
   * Sanitize file name for safe file system usage
   */
  private sanitizeFileName(fileName: string): string {
    // Remove or replace invalid characters
    return fileName
      .replace(/[<>:"/\\|?*]/g, "-") // Replace invalid chars with dash
      .replace(/\s+/g, " ") // Normalize whitespace
      .trim()
      .substring(0, 255); // Limit length
  }

  /**
   * Ensure folder exists
   */
  async ensureFolder(folderPath: string): Promise<void> {
    const normalizedPath = normalizePath(folderPath);
    const folder = this.vault.getAbstractFileByPath(normalizedPath);
    
    if (!folder) {
      await this.vault.createFolder(normalizedPath);
    } else if (!(folder instanceof TFolder)) {
      throw new Error(`Path exists but is not a folder: ${normalizedPath}`);
    }
  }
}
