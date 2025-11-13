/**
 * Schema Migration System
 * Manages automatic schema migrations including property type conversions
 */

import type { App, TFile, Notice as ObsidianNotice } from "obsidian";
import { Notice } from "obsidian";
import type { NoteType, PropertyDefinition } from "./types";
import type { TypeRegistry } from "./registry";
import { BulkOperations, type MigrationPlan, type MigrationOperation } from "./bulk-operations";
import { BackupManager } from "./backup-manager";

/**
 * Migration record to track executed migrations
 */
export interface MigrationRecord {
  /** Unique migration ID */
  id: string;

  /** Migration description */
  description: string;

  /** Timestamp when migration was executed */
  executedAt: Date;

  /** Number of files affected */
  filesAffected: number;

  /** Whether migration was successful */
  success: boolean;

  /** Migration version (for ordering) */
  version: string;
}

/**
 * Schema migration definition
 */
export interface SchemaMigration {
  /** Unique migration ID */
  id: string;

  /** Migration version (for ordering, e.g., "1.0.0") */
  version: string;

  /** Migration description */
  description: string;

  /** Whether this migration should run automatically */
  autoRun: boolean;

  /**
   * Check if this migration needs to run
   * @returns true if migration is needed
   */
  needsMigration: (registry: TypeRegistry) => Promise<boolean>;

  /**
   * Execute the migration
   * @returns Migration result
   */
  execute: (
    app: App,
    registry: TypeRegistry,
    backupManager: BackupManager,
    onProgress?: (processed: number, total: number, currentFile: string) => void
  ) => Promise<{
    success: boolean;
    filesAffected: number;
    errors?: string[];
  }>;
}

/**
 * Association migration - converts link properties to association properties
 */
export class AssociationMigration implements SchemaMigration {
  id = "association-property-type";
  version = "1.0.0";
  description = "Convert link properties to association property type";
  autoRun = true;

  async needsMigration(registry: TypeRegistry): Promise<boolean> {
    const allNoteTypes = registry.getAll();

    // Check if any note type has properties with link: true but type !== "association"
    for (const noteType of allNoteTypes) {
      for (const [key, prop] of Object.entries(noteType.properties)) {
        if (prop.link && prop.type !== "association") {
          return true;
        }
      }
    }

    return false;
  }

  async execute(
    app: App,
    registry: TypeRegistry,
    backupManager: BackupManager,
    onProgress?: (processed: number, total: number, currentFile: string) => void
  ): Promise<{
    success: boolean;
    filesAffected: number;
    errors?: string[];
  }> {
    const bulkOps = new BulkOperations(app, registry);
    const errors: string[] = [];
    let totalFilesAffected = 0;

    // Create backup of registry before migration
    const registryBackup = await backupManager.backupRegistry({
      description: "Pre-migration backup for association property type conversion",
      tags: ["schema-migration", "association-migration"],
      autoCleanup: false,
    });

    if (!registryBackup.success) {
      return {
        success: false,
        filesAffected: 0,
        errors: registryBackup.errors || ["Failed to create registry backup"],
      };
    }

    // Find all note types with link properties
    const allNoteTypes = registry.getAll();
    const noteTypesToMigrate: Array<{
      noteType: NoteType;
      propertiesToMigrate: Array<{ key: string; prop: PropertyDefinition }>;
    }> = [];

    for (const noteType of allNoteTypes) {
      const propertiesToMigrate: Array<{ key: string; prop: PropertyDefinition }> = [];

      for (const [key, prop] of Object.entries(noteType.properties)) {
        if (prop.link && prop.type !== "association") {
          propertiesToMigrate.push({ key, prop });
        }
      }

      if (propertiesToMigrate.length > 0) {
        noteTypesToMigrate.push({ noteType, propertiesToMigrate });
      }
    }

    if (noteTypesToMigrate.length === 0) {
      return {
        success: true,
        filesAffected: 0,
      };
    }

    // Process each note type
    for (const { noteType, propertiesToMigrate } of noteTypesToMigrate) {
      const migrationPlan = this.createMigrationPlan(noteType, propertiesToMigrate);

      if (!migrationPlan) {
        errors.push(`Failed to create migration plan for note type: ${noteType.id}`);
        continue;
      }

      // Find files to migrate
      const filesToMigrate = await bulkOps.findFilesForMigration(
        noteType.id,
        noteType.version
      );

      if (filesToMigrate.length === 0) {
        continue;
      }

      // Execute migration with backup and validation
      const result = await bulkOps.executeBulkMigration(
        filesToMigrate,
        migrationPlan,
        {
          createBackups: true,
          validateAfterMigration: true,
          continueOnErrors: true,
          maxConcurrency: 5,
          onProgress,
          onError: (file, error) => {
            errors.push(`File ${file.path}: ${error}`);
          },
        }
      );

      totalFilesAffected += result.successfulFiles;

      if (result.errors && result.errors.length > 0) {
        errors.push(...result.errors);
      }

      // Update the note type schema in registry
      this.updateNoteTypeSchema(registry, noteType, propertiesToMigrate);
    }

    return {
      success: errors.length === 0,
      filesAffected: totalFilesAffected,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Create migration plan for converting link properties to associations
   */
  private createMigrationPlan(
    noteType: NoteType,
    propertiesToMigrate: Array<{ key: string; prop: PropertyDefinition }>
  ): MigrationPlan | null {
    const operations: MigrationOperation[] = [];

    // For each property to migrate, create a transform operation
    for (const { key, prop } of propertiesToMigrate) {
      // Determine association configuration based on current property type
      const isMultiple = prop.type === "array";
      const noteTypeId = this.inferNoteTypeId(key, prop);

      if (!noteTypeId) {
        console.warn(
          `Cannot infer note type ID for property ${key}, skipping migration`
        );
        continue;
      }

      operations.push({
        type: "transform-property",
        sourceProperty: key,
        targetProperty: key,
        description: `Convert ${key} from ${prop.type} with link flag to association property`,
        transform: (value: any) => {
          // Value is already in the correct format (wiki link or array of wiki links)
          // No transformation needed, just validation
          return value;
        },
      });
    }

    if (operations.length === 0) {
      return null;
    }

    return {
      sourceNoteTypeId: noteType.id,
      sourceVersion: noteType.version,
      targetNoteTypeId: noteType.id,
      targetVersion: noteType.version,
      operations,
      isBackwardsCompatible: true,
      description: `Convert link properties to association type in ${noteType.name}`,
    };
  }

  /**
   * Infer the target note type ID from property key
   */
  private inferNoteTypeId(key: string, prop: PropertyDefinition): string | null {
    // Common mappings based on property key naming conventions
    const keyToTypeMap: Record<string, string> = {
      project: "project",
      projects: "project",
      area: "area",
      areas: "area",
      task: "task",
      tasks: "task",
      parentTask: "task",
      parent: "task",
      subtasks: "task",
      relatedTasks: "task",
      dependencies: "task",
      blockedBy: "task",
    };

    return keyToTypeMap[key] || null;
  }

  /**
   * Update note type schema in registry to use association type
   */
  private updateNoteTypeSchema(
    registry: TypeRegistry,
    noteType: NoteType,
    propertiesToMigrate: Array<{ key: string; prop: PropertyDefinition }>
  ): void {
    // Create updated note type with association properties
    const updatedProperties = { ...noteType.properties };

    for (const { key, prop } of propertiesToMigrate) {
      const noteTypeId = this.inferNoteTypeId(key, prop);
      if (!noteTypeId) continue;

      const isMultiple = prop.type === "array";

      // Update property definition to use association type
      updatedProperties[key] = {
        ...prop,
        type: "association",
        association: {
          noteTypeId,
          multiple: isMultiple,
          allowCreate: true,
        },
        // Remove link flag as it's now implicit in association type
        link: undefined,
      };
    }

    // Create updated note type
    const updatedNoteType: NoteType = {
      ...noteType,
      properties: updatedProperties,
    };

    // Re-register the updated note type
    registry.register(updatedNoteType, {
      allowOverwrite: true,
      validate: false,
    });
  }
}

/**
 * Schema Migration Manager
 * Manages and executes schema migrations
 */
export class SchemaMigrationManager {
  private app: App;
  private registry: TypeRegistry;
  private backupManager: BackupManager;
  private migrations: Map<string, SchemaMigration> = new Map();
  private executedMigrations: Map<string, MigrationRecord> = new Map();

  constructor(app: App, registry: TypeRegistry, backupManager: BackupManager) {
    this.app = app;
    this.registry = registry;
    this.backupManager = backupManager;

    // Register built-in migrations
    this.registerMigration(new AssociationMigration());
  }

  /**
   * Initialize migration manager and load executed migrations
   */
  async initialize(
    executedMigrations: MigrationRecord[] = []
  ): Promise<void> {
    // Load executed migrations into map
    for (const record of executedMigrations) {
      this.executedMigrations.set(record.id, record);
    }
  }

  /**
   * Register a migration
   */
  registerMigration(migration: SchemaMigration): void {
    this.migrations.set(migration.id, migration);
  }

  /**
   * Check if a migration has been executed
   */
  hasMigrationExecuted(migrationId: string): boolean {
    return this.executedMigrations.has(migrationId);
  }

  /**
   * Get all pending migrations
   */
  async getPendingMigrations(): Promise<SchemaMigration[]> {
    const pending: SchemaMigration[] = [];

    for (const migration of this.migrations.values()) {
      if (this.hasMigrationExecuted(migration.id)) {
        continue;
      }

      const needsMigration = await migration.needsMigration(this.registry);
      if (needsMigration) {
        pending.push(migration);
      }
    }

    // Sort by version
    return pending.sort((a, b) => a.version.localeCompare(b.version));
  }

  /**
   * Execute a specific migration
   */
  async executeMigration(
    migrationId: string,
    onProgress?: (processed: number, total: number, currentFile: string) => void
  ): Promise<MigrationRecord> {
    const migration = this.migrations.get(migrationId);
    if (!migration) {
      throw new Error(`Migration ${migrationId} not found`);
    }

    if (this.hasMigrationExecuted(migrationId)) {
      throw new Error(`Migration ${migrationId} has already been executed`);
    }

    const startTime = new Date();

    try {
      const result = await migration.execute(
        this.app,
        this.registry,
        this.backupManager,
        onProgress
      );

      const record: MigrationRecord = {
        id: migrationId,
        description: migration.description,
        executedAt: startTime,
        filesAffected: result.filesAffected,
        success: result.success,
        version: migration.version,
      };

      this.executedMigrations.set(migrationId, record);

      return record;
    } catch (error) {
      const record: MigrationRecord = {
        id: migrationId,
        description: migration.description,
        executedAt: startTime,
        filesAffected: 0,
        success: false,
        version: migration.version,
      };

      this.executedMigrations.set(migrationId, record);

      throw error;
    }
  }

  /**
   * Execute all pending migrations
   */
  async executeAllPendingMigrations(
    onProgress?: (
      migrationId: string,
      processed: number,
      total: number,
      currentFile: string
    ) => void
  ): Promise<MigrationRecord[]> {
    const pending = await this.getPendingMigrations();
    const records: MigrationRecord[] = [];

    for (const migration of pending) {
      const record = await this.executeMigration(
        migration.id,
        (processed, total, file) => {
          if (onProgress) {
            onProgress(migration.id, processed, total, file);
          }
        }
      );

      records.push(record);
    }

    return records;
  }

  /**
   * Get all executed migrations
   */
  getExecutedMigrations(): MigrationRecord[] {
    return Array.from(this.executedMigrations.values()).sort(
      (a, b) => b.executedAt.getTime() - a.executedAt.getTime()
    );
  }

  /**
   * Export migration records for persistence
   */
  exportMigrationRecords(): MigrationRecord[] {
    return this.getExecutedMigrations();
  }

  /**
   * Check and execute auto-run migrations on plugin load
   */
  async checkAndExecuteAutoMigrations(
    showNotice: boolean = true
  ): Promise<MigrationRecord[]> {
    const pending = await this.getPendingMigrations();
    const autoMigrations = pending.filter((m) => m.autoRun);

    if (autoMigrations.length === 0) {
      return [];
    }

    let notice: ObsidianNotice | null = null;
    if (showNotice) {
      notice = new Notice(
        `Running ${autoMigrations.length} schema migration(s)...`,
        0
      );
    }

    const records: MigrationRecord[] = [];

    try {
      for (const migration of autoMigrations) {
        if (showNotice && notice) {
          notice.setMessage(
            `Running migration: ${migration.description}...`
          );
        }

        const record = await this.executeMigration(migration.id, (processed, total) => {
          if (showNotice && notice) {
            notice.setMessage(
              `${migration.description}: ${processed}/${total} files`
            );
          }
        });

        records.push(record);
      }

      if (showNotice && notice) {
        notice.hide();
        new Notice(
          `✅ Successfully completed ${records.length} schema migration(s)`,
          5000
        );
      }

      return records;
    } catch (error) {
      if (notice) {
        notice.hide();
      }

      new Notice(
        `❌ Schema migration failed: ${error.message}`,
        10000
      );

      throw error;
    }
  }
}
