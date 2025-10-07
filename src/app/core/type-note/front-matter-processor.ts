/**
 * FrontMatterProcessor - Safe Front-Matter Modification System
 * Provides safe front-matter modification that preserves existing content while updating typed properties
 */

import type { App, TFile } from "obsidian";
import type { NoteType, ValidationResult } from "./types";
import type { TypeRegistry } from "./registry";
import { PropertyProcessor } from "./property-processor";
import { createValidResult, createInvalidResult, createValidationError } from "./validation";
import * as yaml from "js-yaml";

/**
 * Front-matter modification options
 */
export interface FrontMatterModificationOptions {
  /** Whether to validate properties before modification */
  validateProperties?: boolean;
  
  /** Whether to preserve unknown properties */
  preserveUnknownProperties?: boolean;
  
  /** Whether to apply property transformations */
  applyTransformations?: boolean;
  
  /** Whether to use default values for missing required properties */
  useDefaults?: boolean;
  
  /** Whether to update modification timestamp */
  updateModTime?: boolean;
  
  /** Custom properties to preserve (in addition to note type properties) */
  preserveProperties?: string[];
}

/**
 * Front-matter modification result
 */
export interface FrontMatterModificationResult {
  /** Whether modification was successful */
  success: boolean;
  
  /** Modified properties */
  modifiedProperties?: Record<string, any>;
  
  /** Properties that were preserved */
  preservedProperties?: Record<string, any>;
  
  /** Properties that were removed */
  removedProperties?: string[];
  
  /** Validation errors */
  errors?: string[];
  
  /** Warnings */
  warnings?: string[];
}

/**
 * Front-matter backup entry
 */
export interface FrontMatterBackup {
  /** File path */
  filePath: string;
  
  /** Original front-matter */
  originalFrontMatter: Record<string, any>;
  
  /** Backup timestamp */
  timestamp: Date;
  
  /** Note type ID at time of backup */
  noteTypeId?: string;
}

/**
 * FrontMatterProcessor provides safe front-matter modification capabilities
 */
export class FrontMatterProcessor {
  private app: App;
  private registry: TypeRegistry;
  private propertyProcessor: PropertyProcessor;
  private backups: Map<string, FrontMatterBackup[]> = new Map();

  constructor(app: App, registry: TypeRegistry) {
    this.app = app;
    this.registry = registry;
    this.propertyProcessor = new PropertyProcessor();
  }

  /**
   * Safely modify front-matter properties
   */
  async modifyFrontMatter(
    file: TFile,
    noteTypeId: string,
    properties: Record<string, any>,
    options: FrontMatterModificationOptions = {}
  ): Promise<FrontMatterModificationResult> {
    const {
      validateProperties = true,
      preserveUnknownProperties = true,
      applyTransformations = true,
      useDefaults = false,
      updateModTime = true,
      preserveProperties = [],
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

      // Create backup before modification
      await this.createBackup(file, noteTypeId);

      // Get current front-matter
      const currentFrontMatter = this.app.metadataCache.getFileCache(file)?.frontmatter || {};

      // Validate new properties if requested
      if (validateProperties) {
        const validationResult = this.propertyProcessor.process(
          noteType,
          properties,
          {
            validateRequired: false, // Don't require all properties for updates
            applyTransformations,
            useDefaults,
          }
        );

        if (!validationResult.success) {
          return {
            success: false,
            errors: validationResult.errors.map(e => e.message),
            warnings: validationResult.warnings.map(w => w.message),
          };
        }
      }

      // Track modifications
      const modifiedProperties: Record<string, any> = {};
      const preservedProperties: Record<string, any> = {};
      const removedProperties: string[] = [];

      // Apply modifications using processFrontMatter
      await this.app.fileManager.processFrontMatter(file, (frontMatter) => {
        // Preserve existing properties based on options
        if (preserveUnknownProperties) {
          // Get all note type property keys
          const noteTypePropertyKeys = new Set(
            Object.values(noteType.properties).map(p => p.frontMatterKey)
          );
          
          // Preserve properties not defined in note type
          for (const [key, value] of Object.entries(frontMatter)) {
            if (!noteTypePropertyKeys.has(key) && !properties.hasOwnProperty(key)) {
              preservedProperties[key] = value;
            }
          }
        }

        // Preserve explicitly requested properties
        for (const key of preserveProperties) {
          if (frontMatter.hasOwnProperty(key) && !properties.hasOwnProperty(key)) {
            preservedProperties[key] = frontMatter[key];
          }
        }

        // Clear existing front-matter
        for (const key of Object.keys(frontMatter)) {
          delete frontMatter[key];
        }

        // Add preserved properties back
        Object.assign(frontMatter, preservedProperties);

        // Add new/modified properties
        for (const [key, value] of Object.entries(properties)) {
          frontMatter[key] = value;
          modifiedProperties[key] = value;
        }

        // Update modification time if requested
        if (updateModTime) {
          frontMatter.updatedAt = new Date().toISOString();
          modifiedProperties.updatedAt = frontMatter.updatedAt;
        }
      });

      return {
        success: true,
        modifiedProperties,
        preservedProperties,
        removedProperties,
      };

    } catch (error) {
      return {
        success: false,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  /**
   * Update a single property safely
   */
  async updateProperty(
    file: TFile,
    noteTypeId: string,
    propertyKey: string,
    value: any,
    options: FrontMatterModificationOptions = {}
  ): Promise<FrontMatterModificationResult> {
    return this.modifyFrontMatter(file, noteTypeId, { [propertyKey]: value }, options);
  }

  /**
   * Remove properties safely
   */
  async removeProperties(
    file: TFile,
    noteTypeId: string,
    propertyKeys: string[],
    options: FrontMatterModificationOptions = {}
  ): Promise<FrontMatterModificationResult> {
    try {
      // Create backup before modification
      await this.createBackup(file, noteTypeId);

      const removedProperties: string[] = [];

      // Remove properties using processFrontMatter
      await this.app.fileManager.processFrontMatter(file, (frontMatter) => {
        for (const key of propertyKeys) {
          if (frontMatter.hasOwnProperty(key)) {
            delete frontMatter[key];
            removedProperties.push(key);
          }
        }

        // Update modification time if requested
        if (options.updateModTime !== false) {
          frontMatter.updatedAt = new Date().toISOString();
        }
      });

      return {
        success: true,
        removedProperties,
      };

    } catch (error) {
      return {
        success: false,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  /**
   * Create a backup of current front-matter
   */
  async createBackup(file: TFile, noteTypeId?: string): Promise<void> {
    const currentFrontMatter = this.app.metadataCache.getFileCache(file)?.frontmatter || {};
    
    const backup: FrontMatterBackup = {
      filePath: file.path,
      originalFrontMatter: { ...currentFrontMatter },
      timestamp: new Date(),
      noteTypeId,
    };

    // Store backup
    const fileBackups = this.backups.get(file.path) || [];
    fileBackups.push(backup);
    
    // Keep only last 10 backups per file
    if (fileBackups.length > 10) {
      fileBackups.shift();
    }
    
    this.backups.set(file.path, fileBackups);
  }

  /**
   * Restore from backup
   */
  async restoreFromBackup(
    file: TFile,
    backupIndex: number = 0
  ): Promise<FrontMatterModificationResult> {
    try {
      const fileBackups = this.backups.get(file.path);
      if (!fileBackups || fileBackups.length === 0) {
        return {
          success: false,
          errors: [`No backups found for file: ${file.path}`],
        };
      }

      const backup = fileBackups[fileBackups.length - 1 - backupIndex];
      if (!backup) {
        return {
          success: false,
          errors: [`Backup index ${backupIndex} not found for file: ${file.path}`],
        };
      }

      // Restore front-matter
      await this.app.fileManager.processFrontMatter(file, (frontMatter) => {
        // Clear current front-matter
        for (const key of Object.keys(frontMatter)) {
          delete frontMatter[key];
        }

        // Restore from backup
        Object.assign(frontMatter, backup.originalFrontMatter);
      });

      return {
        success: true,
        modifiedProperties: backup.originalFrontMatter,
      };

    } catch (error) {
      return {
        success: false,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  /**
   * Get backups for a file
   */
  getBackups(filePath: string): FrontMatterBackup[] {
    return this.backups.get(filePath) || [];
  }

  /**
   * Clear backups for a file
   */
  clearBackups(filePath: string): void {
    this.backups.delete(filePath);
  }

  /**
   * Clear all backups
   */
  clearAllBackups(): void {
    this.backups.clear();
  }

  /**
   * Validate front-matter against note type
   */
  async validateFrontMatter(
    file: TFile,
    noteTypeId: string
  ): Promise<ValidationResult> {
    try {
      const noteType = this.registry.get(noteTypeId);
      if (!noteType) {
        return createInvalidResult([
          createValidationError(`Note type "${noteTypeId}" not found`, "NOTE_TYPE_NOT_FOUND"),
        ]);
      }

      const frontMatter = this.app.metadataCache.getFileCache(file)?.frontmatter || {};
      
      const result = this.propertyProcessor.process(noteType, frontMatter);
      
      return result.success ? createValidResult(result.properties) : createInvalidResult(result.errors);

    } catch (error) {
      return createInvalidResult([
        createValidationError(
          error instanceof Error ? error.message : String(error),
          "VALIDATION_ERROR"
        ),
      ]);
    }
  }
}
