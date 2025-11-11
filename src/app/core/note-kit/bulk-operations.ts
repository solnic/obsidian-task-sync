/**
 * BulkOperations - Bulk Operations System for Note Type Migrations
 * Handles bulk operations for migrating notes between different note type versions
 */

import type { App, TFile, Vault } from "obsidian";
import type { NoteType, SemanticVersion, ValidationResult } from "./types";
import type { TypeRegistry } from "./registry";
import { NoteProcessor } from "./note-processor";
import { FrontMatterProcessor } from "./front-matter-processor";
import { PropertyProcessor } from "./property-processor";
import { TemplateEngine } from "./template-engine";
import { compareVersions, VersionComparison } from "./version";
import { createValidResult, createInvalidResult, createValidationError } from "./validation";

/**
 * Migration operation types
 */
export type MigrationOperationType = 
  | "update-version"
  | "add-property"
  | "remove-property"
  | "rename-property"
  | "transform-property"
  | "update-template";

/**
 * Migration operation
 */
export interface MigrationOperation {
  /** Type of operation */
  type: MigrationOperationType;
  
  /** Source property key (for property operations) */
  sourceProperty?: string;
  
  /** Target property key (for property operations) */
  targetProperty?: string;
  
  /** Default value (for add-property operations) */
  defaultValue?: any;
  
  /** Transformation function (for transform-property operations) */
  transform?: (value: any) => any;
  
  /** Description of the operation */
  description?: string;
}

/**
 * Migration plan
 */
export interface MigrationPlan {
  /** Source note type ID */
  sourceNoteTypeId: string;
  
  /** Source version */
  sourceVersion: SemanticVersion;
  
  /** Target note type ID */
  targetNoteTypeId: string;
  
  /** Target version */
  targetVersion: SemanticVersion;
  
  /** List of operations to perform */
  operations: MigrationOperation[];
  
  /** Whether this migration is backwards compatible */
  isBackwardsCompatible: boolean;
  
  /** Migration description */
  description?: string;
}

/**
 * Bulk operation options
 */
export interface BulkOperationOptions {
  /** Whether to create backups before migration */
  createBackups?: boolean;
  
  /** Whether to validate after migration */
  validateAfterMigration?: boolean;
  
  /** Whether to continue on errors */
  continueOnErrors?: boolean;
  
  /** Maximum number of files to process in parallel */
  maxConcurrency?: number;
  
  /** Progress callback */
  onProgress?: (processed: number, total: number, currentFile: string) => void;
  
  /** Error callback */
  onError?: (file: TFile, error: string) => void;
}

/**
 * Bulk operation result
 */
export interface BulkOperationResult {
  /** Whether operation was successful */
  success: boolean;
  
  /** Total files processed */
  totalFiles: number;
  
  /** Successfully processed files */
  successfulFiles: number;
  
  /** Failed files */
  failedFiles: number;
  
  /** List of processed file paths */
  processedFiles: string[];
  
  /** List of failed file paths with errors */
  failedFileErrors: Array<{ filePath: string; error: string }>;
  
  /** Overall errors */
  errors?: string[];
  
  /** Warnings */
  warnings?: string[];
}

/**
 * File migration result
 */
export interface FileMigrationResult {
  /** Whether migration was successful */
  success: boolean;
  
  /** File path */
  filePath: string;
  
  /** Operations performed */
  operationsPerformed: MigrationOperation[];
  
  /** Validation result after migration */
  validationResult?: ValidationResult;
  
  /** Errors */
  errors?: string[];
  
  /** Warnings */
  warnings?: string[];
}

/**
 * BulkOperations handles bulk operations for note type migrations
 */
export class BulkOperations {
  private app: App;
  private vault: Vault;
  private registry: TypeRegistry;
  private noteProcessor: NoteProcessor;
  private frontMatterProcessor: FrontMatterProcessor;
  private propertyProcessor: PropertyProcessor;

  constructor(app: App, registry: TypeRegistry) {
    this.app = app;
    this.vault = app.vault;
    this.registry = registry;
    
    // Initialize processors
    this.propertyProcessor = new PropertyProcessor();
    const templateEngine = new TemplateEngine();
    this.noteProcessor = new NoteProcessor(this.propertyProcessor, templateEngine, registry);
    this.frontMatterProcessor = new FrontMatterProcessor(app, registry);
  }

  /**
   * Create migration plan between note type versions
   */
  createMigrationPlan(
    sourceNoteTypeId: string,
    sourceVersion: SemanticVersion,
    targetNoteTypeId: string,
    targetVersion: SemanticVersion
  ): MigrationPlan | null {
    const sourceNoteType = this.registry.get(sourceNoteTypeId);
    const targetNoteType = this.registry.get(targetNoteTypeId);
    
    if (!sourceNoteType || !targetNoteType) {
      return null;
    }

    const operations: MigrationOperation[] = [];
    
    // Version update operation
    if (sourceNoteTypeId === targetNoteTypeId && sourceVersion !== targetVersion) {
      operations.push({
        type: "update-version",
        description: `Update version from ${sourceVersion} to ${targetVersion}`,
      });
    }

    // Compare properties to determine operations
    const sourceProperties = new Set(Object.keys(sourceNoteType.properties));
    const targetProperties = new Set(Object.keys(targetNoteType.properties));

    // Find added properties
    for (const propKey of targetProperties) {
      if (!sourceProperties.has(propKey)) {
        const targetProp = targetNoteType.properties[propKey];
        operations.push({
          type: "add-property",
          targetProperty: propKey,
          defaultValue: targetProp.defaultValue,
          description: `Add property '${targetProp.name}'`,
        });
      }
    }

    // Find removed properties
    for (const propKey of sourceProperties) {
      if (!targetProperties.has(propKey)) {
        const sourceProp = sourceNoteType.properties[propKey];
        operations.push({
          type: "remove-property",
          sourceProperty: propKey,
          description: `Remove property '${sourceProp.name}'`,
        });
      }
    }

    // Check for backwards compatibility
    const isBackwardsCompatible = compareVersions(targetVersion, sourceVersion) !== VersionComparison.LESS_THAN;

    return {
      sourceNoteTypeId,
      sourceVersion,
      targetNoteTypeId,
      targetVersion,
      operations,
      isBackwardsCompatible,
      description: `Migrate from ${sourceNoteTypeId}@${sourceVersion} to ${targetNoteTypeId}@${targetVersion}`,
    };
  }

  /**
   * Execute bulk migration
   */
  async executeBulkMigration(
    files: TFile[],
    migrationPlan: MigrationPlan,
    options: BulkOperationOptions = {}
  ): Promise<BulkOperationResult> {
    const {
      createBackups = true,
      validateAfterMigration = true,
      continueOnErrors = true,
      maxConcurrency = 5,
      onProgress,
      onError,
    } = options;

    const result: BulkOperationResult = {
      success: true,
      totalFiles: files.length,
      successfulFiles: 0,
      failedFiles: 0,
      processedFiles: [],
      failedFileErrors: [],
      errors: [],
      warnings: [],
    };

    // Process files in batches to control concurrency
    const batches = this.createBatches(files, maxConcurrency);
    let processedCount = 0;

    for (const batch of batches) {
      const batchPromises = batch.map(async (file) => {
        try {
          const migrationResult = await this.migrateFile(
            file,
            migrationPlan,
            { createBackups, validateAfterMigration }
          );

          if (migrationResult.success) {
            result.successfulFiles++;
            result.processedFiles.push(file.path);
          } else {
            result.failedFiles++;
            result.failedFileErrors.push({
              filePath: file.path,
              error: migrationResult.errors?.join(", ") || "Unknown error",
            });
            
            if (onError) {
              onError(file, migrationResult.errors?.join(", ") || "Unknown error");
            }
          }

          processedCount++;
          if (onProgress) {
            onProgress(processedCount, files.length, file.path);
          }

          return migrationResult;
        } catch (error) {
          result.failedFiles++;
          const errorMessage = error instanceof Error ? error.message : String(error);
          result.failedFileErrors.push({
            filePath: file.path,
            error: errorMessage,
          });
          
          if (onError) {
            onError(file, errorMessage);
          }

          processedCount++;
          if (onProgress) {
            onProgress(processedCount, files.length, file.path);
          }

          if (!continueOnErrors) {
            throw error;
          }

          return null;
        }
      });

      await Promise.all(batchPromises);
    }

    result.success = result.failedFiles === 0;
    return result;
  }

  /**
   * Migrate a single file
   */
  async migrateFile(
    file: TFile,
    migrationPlan: MigrationPlan,
    options: { createBackups?: boolean; validateAfterMigration?: boolean } = {}
  ): Promise<FileMigrationResult> {
    const { createBackups = true, validateAfterMigration = true } = options;

    try {
      // Create backup if requested
      if (createBackups) {
        await this.frontMatterProcessor.createBackup(file, migrationPlan.sourceNoteTypeId);
      }

      // Read current content
      const content = await this.vault.read(file);
      const noteResult = this.noteProcessor.processNote(content, file.path);

      if (!noteResult.valid || !noteResult.noteType) {
        return {
          success: false,
          filePath: file.path,
          operationsPerformed: [],
          errors: [`Could not process note: ${noteResult.errors.map(e => e.message).join(", ")}`],
        };
      }

      // Apply migration operations
      const operationsPerformed: MigrationOperation[] = [];
      const propertiesToUpdate: Record<string, any> = {};

      for (const operation of migrationPlan.operations) {
        switch (operation.type) {
          case "add-property":
            if (operation.targetProperty && operation.defaultValue !== undefined) {
              propertiesToUpdate[operation.targetProperty] = operation.defaultValue;
              operationsPerformed.push(operation);
            }
            break;

          case "remove-property":
            // Properties will be removed by not including them in the update
            operationsPerformed.push(operation);
            break;

          case "rename-property":
            if (operation.sourceProperty && operation.targetProperty) {
              const currentValue = noteResult.properties[operation.sourceProperty];
              if (currentValue !== undefined) {
                propertiesToUpdate[operation.targetProperty] = currentValue;
                operationsPerformed.push(operation);
              }
            }
            break;

          case "transform-property":
            if (operation.sourceProperty && operation.transform) {
              const currentValue = noteResult.properties[operation.sourceProperty];
              if (currentValue !== undefined) {
                const transformedValue = operation.transform(currentValue);
                const targetProp = operation.targetProperty || operation.sourceProperty;
                propertiesToUpdate[targetProp] = transformedValue;
                operationsPerformed.push(operation);
              }
            }
            break;

          case "update-version":
            // Version will be updated implicitly by changing note type
            operationsPerformed.push(operation);
            break;
        }
      }

      // Update front-matter if there are changes
      if (Object.keys(propertiesToUpdate).length > 0) {
        const updateResult = await this.frontMatterProcessor.modifyFrontMatter(
          file,
          migrationPlan.targetNoteTypeId,
          propertiesToUpdate,
          {
            validateProperties: true,
            preserveUnknownProperties: true,
            updateModTime: true,
          }
        );

        if (!updateResult.success) {
          return {
            success: false,
            filePath: file.path,
            operationsPerformed,
            errors: updateResult.errors,
            warnings: updateResult.warnings,
          };
        }
      }

      // Validate after migration if requested
      let validationResult: ValidationResult | undefined;
      if (validateAfterMigration) {
        validationResult = await this.frontMatterProcessor.validateFrontMatter(
          file,
          migrationPlan.targetNoteTypeId
        );
      }

      return {
        success: true,
        filePath: file.path,
        operationsPerformed,
        validationResult,
      };

    } catch (error) {
      return {
        success: false,
        filePath: file.path,
        operationsPerformed: [],
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  /**
   * Find files that need migration
   */
  async findFilesForMigration(
    sourceNoteTypeId: string,
    sourceVersion?: SemanticVersion
  ): Promise<TFile[]> {
    const allFiles = this.vault.getMarkdownFiles();
    const candidateFiles: TFile[] = [];

    for (const file of allFiles) {
      try {
        const content = await this.vault.read(file);
        const result = this.noteProcessor.processNote(content, file.path);

        if (result.valid && result.noteType?.id === sourceNoteTypeId) {
          // If specific version is requested, check version match
          if (!sourceVersion || result.noteType.version === sourceVersion) {
            candidateFiles.push(file);
          }
        }
      } catch (error) {
        // Skip files that can't be read
        continue;
      }
    }

    return candidateFiles;
  }

  /**
   * Create batches for concurrent processing
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Get migration statistics
   */
  async getMigrationStatistics(migrationPlan: MigrationPlan): Promise<{
    totalCandidateFiles: number;
    estimatedChanges: number;
    riskLevel: "low" | "medium" | "high";
  }> {
    const candidateFiles = await this.findFilesForMigration(
      migrationPlan.sourceNoteTypeId,
      migrationPlan.sourceVersion
    );

    const estimatedChanges = candidateFiles.length * migrationPlan.operations.length;
    
    let riskLevel: "low" | "medium" | "high" = "low";
    if (!migrationPlan.isBackwardsCompatible) {
      riskLevel = "high";
    } else if (migrationPlan.operations.some(op => op.type === "remove-property")) {
      riskLevel = "medium";
    }

    return {
      totalCandidateFiles: candidateFiles.length,
      estimatedChanges,
      riskLevel,
    };
  }
}
