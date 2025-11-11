/**
 * FileWatcher - File Watching System for Typed Notes
 * Detects external changes to typed notes and triggers re-validation
 */

import type { App, Vault, MetadataCache, TAbstractFile } from "obsidian";
import { Component, TFile } from "obsidian";
import type { NoteType, ValidationResult } from "./types";
import type { TypeRegistry } from "./registry";
import { NoteProcessor } from "./note-processor";
import { PropertyProcessor } from "./property-processor";
import { TemplateEngine } from "./template-engine";

/**
 * File change event types
 */
export type FileChangeType = "created" | "modified" | "deleted" | "renamed";

/**
 * File change event
 */
export interface FileChangeEvent {
  /** Type of change */
  type: FileChangeType;

  /** File that changed */
  file: TFile;

  /** Old path (for rename events) */
  oldPath?: string;

  /** Timestamp of change */
  timestamp: Date;

  /** Whether this is a typed note */
  isTypedNote: boolean;

  /** Note type if this is a typed note */
  noteType?: NoteType;

  /** Validation result if this is a typed note */
  validationResult?: ValidationResult;
}

/**
 * File watcher options
 */
export interface FileWatcherOptions {
  /** Whether to watch all files or only typed notes */
  watchTypedNotesOnly?: boolean;

  /** Whether to auto-validate on changes */
  autoValidate?: boolean;

  /** Debounce delay in milliseconds */
  debounceDelay?: number;

  /** File patterns to ignore */
  ignorePatterns?: RegExp[];

  /** Whether to watch metadata changes */
  watchMetadata?: boolean;
}

/**
 * File watcher event handler
 */
export type FileWatcherEventHandler = (
  event: FileChangeEvent
) => void | Promise<void>;

/**
 * FileWatcher monitors file system changes and validates typed notes
 */
export class FileWatcher extends Component {
  private app: App;
  private vault: Vault;
  private metadataCache: MetadataCache;
  private registry: TypeRegistry;
  private noteProcessor: NoteProcessor;
  private options: Required<FileWatcherOptions>;
  private eventHandlers: Set<FileWatcherEventHandler> = new Set();
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    app: App,
    registry: TypeRegistry,
    options: FileWatcherOptions = {}
  ) {
    super();

    this.app = app;
    this.vault = app.vault;
    this.metadataCache = app.metadataCache;
    this.registry = registry;

    // Initialize note processor
    const propertyProcessor = new PropertyProcessor();
    const templateEngine = new TemplateEngine();
    this.noteProcessor = new NoteProcessor(
      propertyProcessor,
      templateEngine,
      registry
    );

    // Set default options
    this.options = {
      watchTypedNotesOnly: false,
      autoValidate: true,
      debounceDelay: 500,
      ignorePatterns: [/\.tmp$/, /~\$/, /\.obsidian\//],
      watchMetadata: true,
      ...options,
    };
  }

  /**
   * Start watching files
   */
  onload(): void {
    // Register vault event handlers
    this.registerEvent(
      this.vault.on("create", (file) => {
        if (file instanceof TFile) {
          this.handleFileCreate(file);
        }
      })
    );

    this.registerEvent(
      this.vault.on("modify", (file) => {
        if (file instanceof TFile) {
          this.handleFileModify(file);
        }
      })
    );

    this.registerEvent(
      this.vault.on("delete", (file) => {
        if (file instanceof TFile) {
          this.handleFileDelete(file);
        }
      })
    );

    this.registerEvent(
      this.vault.on("rename", (file, oldPath) => {
        if (file instanceof TFile) {
          this.handleFileRename(file, oldPath);
        }
      })
    );

    // Register metadata cache events if watching metadata
    if (this.options.watchMetadata) {
      this.registerEvent(
        this.metadataCache.on("changed", (file) =>
          this.handleMetadataChange(file)
        )
      );
    }
  }

  /**
   * Stop watching files
   */
  onunload(): void {
    // Clear debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    // Event handlers are automatically unregistered by Component.onunload()
  }

  /**
   * Add event handler
   */
  addEventHandler(handler: FileWatcherEventHandler): void {
    this.eventHandlers.add(handler);
  }

  /**
   * Remove event handler
   */
  removeEventHandler(handler: FileWatcherEventHandler): void {
    this.eventHandlers.delete(handler);
  }

  /**
   * Handle file creation
   */
  private async handleFileCreate(file: TFile): Promise<void> {
    if (!this.shouldWatchFile(file)) {
      return;
    }

    this.debounceEvent(file.path, "created", async () => {
      const event = await this.createFileChangeEvent("created", file);
      await this.emitEvent(event);
    });
  }

  /**
   * Handle file modification
   */
  private async handleFileModify(file: TFile): Promise<void> {
    if (!this.shouldWatchFile(file)) {
      return;
    }

    this.debounceEvent(file.path, "modified", async () => {
      const event = await this.createFileChangeEvent("modified", file);
      await this.emitEvent(event);
    });
  }

  /**
   * Handle file deletion
   */
  private async handleFileDelete(file: TFile): Promise<void> {
    if (!this.shouldWatchFile(file)) {
      return;
    }

    const event = await this.createFileChangeEvent("deleted", file);
    await this.emitEvent(event);
  }

  /**
   * Handle file rename
   */
  private async handleFileRename(file: TFile, oldPath: string): Promise<void> {
    if (!this.shouldWatchFile(file)) {
      return;
    }

    const event = await this.createFileChangeEvent("renamed", file, oldPath);
    await this.emitEvent(event);
  }

  /**
   * Handle metadata changes
   */
  private async handleMetadataChange(file: TFile): Promise<void> {
    if (!this.shouldWatchFile(file)) {
      return;
    }

    this.debounceEvent(`${file.path}-metadata`, "modified", async () => {
      const event = await this.createFileChangeEvent("modified", file);
      await this.emitEvent(event);
    });
  }

  /**
   * Create file change event
   */
  private async createFileChangeEvent(
    type: FileChangeType,
    file: TFile,
    oldPath?: string
  ): Promise<FileChangeEvent> {
    const event: FileChangeEvent = {
      type,
      file,
      oldPath,
      timestamp: new Date(),
      isTypedNote: false,
    };

    // Check if this is a typed note and validate if auto-validation is enabled
    if (this.options.autoValidate) {
      try {
        const content = await this.vault.read(file);
        const result = this.noteProcessor.processNote(content, file.path);

        if (result.valid && result.noteType) {
          event.isTypedNote = true;
          event.noteType = result.noteType;
          event.validationResult = {
            valid: result.valid,
            errors: result.errors,
            warnings: result.warnings,
          };
        }
      } catch (error) {
        // File might be deleted or inaccessible, ignore validation errors
      }
    }

    return event;
  }

  /**
   * Emit event to all handlers
   */
  private async emitEvent(event: FileChangeEvent): Promise<void> {
    // Filter events if watching typed notes only
    if (this.options.watchTypedNotesOnly && !event.isTypedNote) {
      return;
    }

    // Emit to all handlers
    const promises = Array.from(this.eventHandlers).map(async (handler) => {
      try {
        await handler(event);
      } catch (error) {
        console.error("Error in file watcher event handler:", error);
      }
    });

    await Promise.all(promises);
  }

  /**
   * Debounce events to avoid excessive processing
   */
  private debounceEvent(
    key: string,
    type: FileChangeType,
    callback: () => Promise<void>
  ): void {
    // Clear existing timer
    const existingTimer = this.debounceTimers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(async () => {
      this.debounceTimers.delete(key);
      await callback();
    }, this.options.debounceDelay);

    this.debounceTimers.set(key, timer);
  }

  /**
   * Check if file should be watched
   */
  private shouldWatchFile(file: TFile): boolean {
    // Only watch markdown files
    if (file.extension !== "md") {
      return false;
    }

    // Check ignore patterns
    for (const pattern of this.options.ignorePatterns) {
      if (pattern.test(file.path)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Manually validate a file
   */
  async validateFile(file: TFile): Promise<ValidationResult | null> {
    try {
      const content = await this.vault.read(file);
      const result = this.noteProcessor.processNote(content, file.path);

      return {
        valid: result.valid,
        errors: result.errors,
        warnings: result.warnings,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Get current options
   */
  getOptions(): Required<FileWatcherOptions> {
    return { ...this.options };
  }

  /**
   * Update options
   */
  updateOptions(newOptions: Partial<FileWatcherOptions>): void {
    this.options = { ...this.options, ...newOptions };
  }

  /**
   * Check if a file is currently being watched
   */
  isWatching(file: TFile): boolean {
    return this.shouldWatchFile(file);
  }

  /**
   * Get statistics about watched files
   */
  async getWatchStatistics(): Promise<{
    totalFiles: number;
    watchedFiles: number;
    typedNotes: number;
    validTypedNotes: number;
    invalidTypedNotes: number;
  }> {
    const allFiles = this.vault.getMarkdownFiles();
    const watchedFiles = allFiles.filter((file) => this.shouldWatchFile(file));

    let typedNotes = 0;
    let validTypedNotes = 0;
    let invalidTypedNotes = 0;

    for (const file of watchedFiles) {
      const validation = await this.validateFile(file);
      if (validation) {
        typedNotes++;
        if (validation.valid) {
          validTypedNotes++;
        } else {
          invalidTypedNotes++;
        }
      }
    }

    return {
      totalFiles: allFiles.length,
      watchedFiles: watchedFiles.length,
      typedNotes,
      validTypedNotes,
      invalidTypedNotes,
    };
  }
}
