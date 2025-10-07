/**
 * BackupManager - Backup and Rollback System for Template Updates
 * Implements backup and rollback system for template updates to prevent data loss
 */

import type { App, Vault, TFile } from "obsidian";
import { normalizePath } from "obsidian";
import type { NoteType, Template, SemanticVersion } from "./types";
import type { TypeRegistry } from "./registry";
import * as yaml from "js-yaml";

/**
 * Backup types
 */
export type BackupType = "note-type" | "template" | "file" | "registry";

/**
 * Backup entry
 */
export interface BackupEntry {
  /** Unique backup ID */
  id: string;

  /** Type of backup */
  type: BackupType;

  /** Backup timestamp */
  timestamp: Date;

  /** Description of what was backed up */
  description: string;

  /** Original data */
  originalData: any;

  /** File path (for file backups) */
  filePath?: string;

  /** Note type ID (for note type backups) */
  noteTypeId?: string;

  /** Version (for versioned backups) */
  version?: SemanticVersion;

  /** Tags for categorization */
  tags?: string[];

  /** Whether this backup can be automatically cleaned up */
  autoCleanup?: boolean;
}

/**
 * Backup options
 */
export interface BackupOptions {
  /** Description for the backup */
  description?: string;

  /** Tags to add to the backup */
  tags?: string[];

  /** Whether this backup can be automatically cleaned up */
  autoCleanup?: boolean;

  /** Maximum number of backups to keep for this item */
  maxBackups?: number;
}

/**
 * Restore options
 */
export interface RestoreOptions {
  /** Whether to create a backup before restoring */
  createBackupBeforeRestore?: boolean;

  /** Whether to validate after restore */
  validateAfterRestore?: boolean;

  /** Whether to force restore even if validation fails */
  forceRestore?: boolean;
}

/**
 * Backup result
 */
export interface BackupResult {
  /** Whether backup was successful */
  success: boolean;

  /** Backup ID if successful */
  backupId?: string;

  /** Backup entry if successful */
  backupEntry?: BackupEntry;

  /** Errors */
  errors?: string[];
}

/**
 * Restore result
 */
export interface RestoreResult {
  /** Whether restore was successful */
  success: boolean;

  /** Backup ID that was restored */
  backupId?: string;

  /** Pre-restore backup ID (if created) */
  preRestoreBackupId?: string;

  /** Validation result after restore */
  validationResult?: any;

  /** Errors */
  errors?: string[];

  /** Warnings */
  warnings?: string[];
}

/**
 * BackupManager handles backup and rollback operations
 */
export class BackupManager {
  private app: App;
  private vault: Vault;
  private registry: TypeRegistry;
  private backups: Map<string, BackupEntry> = new Map();
  private backupFolder: string;

  constructor(
    app: App,
    registry: TypeRegistry,
    backupFolder: string = ".obsidian/type-note-backups"
  ) {
    this.app = app;
    this.vault = app.vault;
    this.registry = registry;
    this.backupFolder = normalizePath(backupFolder);
  }

  /**
   * Initialize backup system
   */
  async initialize(): Promise<void> {
    // Ensure backup folder exists
    await this.ensureBackupFolder();

    // Load existing backups
    await this.loadBackups();
  }

  /**
   * Create backup of a note type
   */
  async backupNoteType(
    noteTypeId: string,
    options: BackupOptions = {}
  ): Promise<BackupResult> {
    try {
      const noteType = this.registry.get(noteTypeId);
      if (!noteType) {
        return {
          success: false,
          errors: [`Note type "${noteTypeId}" not found`],
        };
      }

      const backupEntry: BackupEntry = {
        id: this.generateBackupId(),
        type: "note-type",
        timestamp: new Date(),
        description:
          options.description || `Backup of note type "${noteType.name}"`,
        originalData: this.serializeNoteType(noteType),
        noteTypeId,
        version: noteType.version,
        tags: options.tags,
        autoCleanup: options.autoCleanup,
      };

      // Save backup
      await this.saveBackup(backupEntry);

      // Cleanup old backups if needed
      if (options.maxBackups) {
        await this.cleanupOldBackups(
          "note-type",
          noteTypeId,
          options.maxBackups
        );
      }

      return {
        success: true,
        backupId: backupEntry.id,
        backupEntry,
      };
    } catch (error) {
      return {
        success: false,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  /**
   * Create backup of a template
   */
  async backupTemplate(
    template: Template,
    options: BackupOptions = {}
  ): Promise<BackupResult> {
    try {
      const backupEntry: BackupEntry = {
        id: this.generateBackupId(),
        type: "template",
        timestamp: new Date(),
        description:
          options.description ||
          `Backup of template "${template.content.substring(0, 50)}..."`,
        originalData: { ...template },
        tags: options.tags,
        autoCleanup: options.autoCleanup,
      };

      // Save backup
      await this.saveBackup(backupEntry);

      // Cleanup old backups if needed
      if (options.maxBackups) {
        await this.cleanupOldBackups("template", undefined, options.maxBackups);
      }

      return {
        success: true,
        backupId: backupEntry.id,
        backupEntry,
      };
    } catch (error) {
      return {
        success: false,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  /**
   * Create backup of a file
   */
  async backupFile(
    file: TFile,
    options: BackupOptions = {}
  ): Promise<BackupResult> {
    try {
      const content = await this.vault.read(file);
      const metadata = this.app.metadataCache.getFileCache(file);

      const backupEntry: BackupEntry = {
        id: this.generateBackupId(),
        type: "file",
        timestamp: new Date(),
        description: options.description || `Backup of file "${file.path}"`,
        originalData: {
          content,
          metadata: metadata?.frontmatter,
          path: file.path,
        },
        filePath: file.path,
        tags: options.tags,
        autoCleanup: options.autoCleanup,
      };

      // Save backup
      await this.saveBackup(backupEntry);

      // Cleanup old backups if needed
      if (options.maxBackups) {
        await this.cleanupOldBackups("file", file.path, options.maxBackups);
      }

      return {
        success: true,
        backupId: backupEntry.id,
        backupEntry,
      };
    } catch (error) {
      return {
        success: false,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  /**
   * Create backup of entire registry
   */
  async backupRegistry(options: BackupOptions = {}): Promise<BackupResult> {
    try {
      const allNoteTypes = this.registry.getAll();
      const serializedRegistry = allNoteTypes.map((nt) =>
        this.serializeNoteType(nt)
      );

      const backupEntry: BackupEntry = {
        id: this.generateBackupId(),
        type: "registry",
        timestamp: new Date(),
        description:
          options.description ||
          `Full registry backup (${allNoteTypes.length} note types)`,
        originalData: serializedRegistry,
        tags: options.tags,
        autoCleanup: options.autoCleanup,
      };

      // Save backup
      await this.saveBackup(backupEntry);

      // Cleanup old backups if needed
      if (options.maxBackups) {
        await this.cleanupOldBackups("registry", undefined, options.maxBackups);
      }

      return {
        success: true,
        backupId: backupEntry.id,
        backupEntry,
      };
    } catch (error) {
      return {
        success: false,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  /**
   * Restore from backup
   */
  async restore(
    backupId: string,
    options: RestoreOptions = {}
  ): Promise<RestoreResult> {
    const {
      createBackupBeforeRestore = true,
      validateAfterRestore = true,
      forceRestore = false,
    } = options;

    try {
      const backup = this.backups.get(backupId);
      if (!backup) {
        return {
          success: false,
          errors: [`Backup "${backupId}" not found`],
        };
      }

      let preRestoreBackupId: string | undefined;

      // Create backup before restore if requested
      if (createBackupBeforeRestore) {
        const preRestoreResult = await this.createPreRestoreBackup(backup);
        if (preRestoreResult.success) {
          preRestoreBackupId = preRestoreResult.backupId;
        }
      }

      // Perform restore based on backup type
      switch (backup.type) {
        case "note-type":
          await this.restoreNoteType(backup);
          break;
        case "file":
          await this.restoreFile(backup);
          break;
        case "registry":
          await this.restoreRegistry(backup);
          break;
        default:
          return {
            success: false,
            errors: [`Unsupported backup type: ${backup.type}`],
          };
      }

      return {
        success: true,
        backupId,
        preRestoreBackupId,
      };
    } catch (error) {
      return {
        success: false,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  /**
   * List all backups
   */
  listBackups(filter?: {
    type?: BackupType;
    noteTypeId?: string;
    filePath?: string;
    tags?: string[];
    since?: Date;
    until?: Date;
  }): BackupEntry[] {
    let backups = Array.from(this.backups.values());

    if (filter) {
      if (filter.type) {
        backups = backups.filter((b) => b.type === filter.type);
      }
      if (filter.noteTypeId) {
        backups = backups.filter((b) => b.noteTypeId === filter.noteTypeId);
      }
      if (filter.filePath) {
        backups = backups.filter((b) => b.filePath === filter.filePath);
      }
      if (filter.tags) {
        backups = backups.filter(
          (b) => b.tags && filter.tags!.some((tag) => b.tags!.includes(tag))
        );
      }
      if (filter.since) {
        backups = backups.filter((b) => b.timestamp >= filter.since!);
      }
      if (filter.until) {
        backups = backups.filter((b) => b.timestamp <= filter.until!);
      }
    }

    return backups.sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
  }

  /**
   * Delete backup
   */
  async deleteBackup(backupId: string): Promise<boolean> {
    try {
      const backup = this.backups.get(backupId);
      if (!backup) {
        return false;
      }

      // Remove from memory
      this.backups.delete(backupId);

      // Remove backup file
      const backupFilePath = this.getBackupFilePath(backupId);
      const backupFile = this.vault.getAbstractFileByPath(backupFilePath);
      if (backupFile) {
        await this.vault.delete(backupFile);
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Cleanup old backups
   */
  async cleanupOldBackups(
    type: BackupType,
    identifier?: string,
    maxBackups: number = 10
  ): Promise<number> {
    const backups = this.listBackups({
      type,
      noteTypeId: identifier,
      filePath: identifier,
    }).filter((b) => b.autoCleanup !== false);

    if (backups.length <= maxBackups) {
      return 0;
    }

    const backupsToDelete = backups.slice(maxBackups);
    let deletedCount = 0;

    for (const backup of backupsToDelete) {
      const deleted = await this.deleteBackup(backup.id);
      if (deleted) {
        deletedCount++;
      }
    }

    return deletedCount;
  }

  // Private helper methods...
  private generateBackupId(): string {
    return `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async ensureBackupFolder(): Promise<void> {
    const exists = await this.vault.adapter.exists(this.backupFolder);
    if (!exists) {
      await this.vault.createFolder(this.backupFolder);
    }
  }

  private getBackupFilePath(backupId: string): string {
    return normalizePath(`${this.backupFolder}/${backupId}.json`);
  }

  private async saveBackup(backup: BackupEntry): Promise<void> {
    this.backups.set(backup.id, backup);

    const backupFilePath = this.getBackupFilePath(backup.id);
    const backupData = JSON.stringify(backup, null, 2);

    await this.vault.create(backupFilePath, backupData);
  }

  private async loadBackups(): Promise<void> {
    try {
      const backupFiles = this.vault
        .getFiles()
        .filter(
          (file) =>
            file.path.startsWith(this.backupFolder) && file.extension === "json"
        );

      for (const file of backupFiles) {
        try {
          const content = await this.vault.read(file);
          const backup: BackupEntry = JSON.parse(content);

          // Convert timestamp string back to Date
          backup.timestamp = new Date(backup.timestamp);

          this.backups.set(backup.id, backup);
        } catch (error) {
          console.warn(`Failed to load backup file ${file.path}:`, error);
        }
      }
    } catch (error) {
      console.warn("Failed to load backups:", error);
    }
  }

  private serializeNoteType(noteType: NoteType): any {
    return {
      ...noteType,
      // Convert any non-serializable properties if needed
    };
  }

  private async createPreRestoreBackup(
    originalBackup: BackupEntry
  ): Promise<BackupResult> {
    const description = `Pre-restore backup before restoring ${originalBackup.id}`;

    switch (originalBackup.type) {
      case "note-type":
        return this.backupNoteType(originalBackup.noteTypeId!, { description });
      case "registry":
        return this.backupRegistry({ description });
      default:
        return {
          success: false,
          errors: ["Cannot create pre-restore backup for this type"],
        };
    }
  }

  private async restoreNoteType(backup: BackupEntry): Promise<void> {
    if (backup.noteTypeId) {
      // This would restore the note type to the registry
      // Implementation depends on registry's restore capabilities
    }
  }

  private async restoreFile(backup: BackupEntry): Promise<void> {
    if (backup.filePath && backup.originalData) {
      const file = this.vault.getAbstractFileByPath(backup.filePath);
      if (file) {
        await this.vault.modify(file as TFile, backup.originalData.content);
      } else {
        await this.vault.create(backup.filePath, backup.originalData.content);
      }
    }
  }

  private async restoreRegistry(backup: BackupEntry): Promise<void> {
    // This would restore the entire registry
    // Implementation depends on registry's restore capabilities
  }
}
