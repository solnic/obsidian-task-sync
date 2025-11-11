/**
 * NoteKit - Main NoteKit API encapsulation
 * Provides a single entry point for all NoteKit functionality
 */

import type { App } from "obsidian";
import { TypeRegistry } from "./registry";
import { NoteProcessor } from "./note-processor";
import { ObsidianPropertyManager } from "./obsidian-property-manager";
import { PropertyProcessor } from "./property-processor";
import { TemplateEngine } from "./template-engine";
import { TemplateManager, type TemplatePreferences } from "./template-manager";
import { FileManager } from "./file-manager";
import { FrontMatterProcessor } from "./front-matter-processor";
import { FileWatcher, type FileWatcherOptions } from "./file-watcher";
import { BulkOperations } from "./bulk-operations";
import { BackupManager } from "./backup-manager";
import { BasesIntegration } from "./bases-integration";

/**
 * NoteKit main class that encapsulates all NoteKit functionality
 * Provides a clean API for integrating NoteKit with Obsidian plugins
 */
export class NoteKit {
  public readonly registry: TypeRegistry;
  public readonly propertyProcessor: PropertyProcessor;
  public readonly templateEngine: TemplateEngine;
  public readonly templateManager: TemplateManager;
  public readonly fileManager: FileManager;
  public readonly frontMatterProcessor: FrontMatterProcessor;
  public readonly fileWatcher: FileWatcher;
  public readonly bulkOperations: BulkOperations;
  public readonly backupManager: BackupManager;
  public readonly noteProcessor: NoteProcessor;
  public readonly obsidianPropertyManager: ObsidianPropertyManager;
  public readonly basesIntegration: BasesIntegration;

  constructor(
    app: App,
    templatePreferences?: TemplatePreferences,
    fileWatcherOptions?: FileWatcherOptions
  ) {
    // Initialize core components
    this.registry = new TypeRegistry();
    this.propertyProcessor = new PropertyProcessor();
    this.templateEngine = new TemplateEngine();

    // Default template preferences
    const defaultTemplatePreferences: TemplatePreferences = {
      preferredProvider: "core",
      useTemplaterWhenAvailable: true,
      templateFolder: "Templates",
      autoDetectTemplates: true,
      showUpdateNotifications: true,
    };

    const finalTemplatePreferences = {
      ...defaultTemplatePreferences,
      ...templatePreferences,
    };

    // Initialize template and file managers
    this.templateManager = new TemplateManager(
      app,
      this.registry,
      finalTemplatePreferences
    );
    this.fileManager = new FileManager(
      app,
      this.registry,
      finalTemplatePreferences
    );
    this.frontMatterProcessor = new FrontMatterProcessor(app, this.registry);
    this.fileWatcher = new FileWatcher(app, this.registry, fileWatcherOptions);
    this.bulkOperations = new BulkOperations(app, this.registry);
    this.backupManager = new BackupManager(app, this.registry);

    // Initialize composite components that depend on core components
    this.noteProcessor = new NoteProcessor(
      this.propertyProcessor,
      this.templateEngine,
      this.registry
    );

    // Initialize Obsidian-specific components
    this.obsidianPropertyManager = new ObsidianPropertyManager(app);
    this.basesIntegration = new BasesIntegration(app, this.registry);
  }

  /**
   * Initialize NoteKit system
   * Can be used for any async initialization if needed in the future
   */
  async initialize(): Promise<void> {
    // Initialize backup manager
    await this.backupManager.initialize();

    // Start file watcher
    this.fileWatcher.load();
  }

  /**
   * Cleanup NoteKit system
   * Can be used for cleanup when plugin is unloaded
   */
  async cleanup(): Promise<void> {
    // Unload file watcher
    this.fileWatcher.unload();
  }
}
