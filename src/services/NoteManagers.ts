/**
 * NoteManagers - Abstract note management system
 * Provides a unified interface for registering and managing different note types
 * with their corresponding file managers and property handlers
 */

import { App, Vault } from "obsidian";
import type { TaskSyncSettings } from "../components/ui/settings/types";
import type { FileManager } from "./FileManager";
import type { TaskFileManager } from "./TaskFileManager";
import type { AreaFileManager } from "./AreaFileManager";
import type { ProjectFileManager } from "./ProjectFileManager";
import type { EventHandler } from "../events/EventTypes";
import type { BaseEntity } from "../types/entities";
import { PROPERTY_REGISTRY } from "../types/properties";
import type { VaultScannerService } from "../types/services";

// Constructor type for file managers
export type FileManagerConstructor<T extends FileManager = FileManager> = new (
  app: App,
  vault: Vault,
  settings: TaskSyncSettings
) => T;

export interface NoteTypeConfig<T extends FileManager = FileManager> {
  managerClass: FileManagerConstructor<T>;
  manager?: T; // Instance will be created during initialization
}

export interface NoteManagersConfig {
  [noteType: string]: NoteTypeConfig;
}

export class NoteManagers {
  private app: App;
  private vault: Vault;
  private settings: TaskSyncSettings;
  private noteTypes: Map<string, NoteTypeConfig> = new Map();
  private vaultScanner: VaultScannerService;

  constructor(
    app: App,
    vault: Vault,
    settings: TaskSyncSettings,
    vaultScanner: VaultScannerService
  ) {
    this.app = app;
    this.vault = vault;
    this.settings = settings;
    this.vaultScanner = vaultScanner;
  }

  /**
   * Register a note type with its corresponding file manager class
   */
  public registerNoteType<T extends FileManager>(
    noteType: string,
    config: NoteTypeConfig<T>
  ): void {
    this.noteTypes.set(noteType, config as NoteTypeConfig);
    console.log(`🔧 NoteManagers: Registered note type: ${noteType}`);
  }

  /**
   * Get the file manager for a specific note type
   */
  public getManager<T extends FileManager>(noteType: string): T | null {
    const config = this.noteTypes.get(noteType);
    return (config?.manager as T) || null;
  }

  /**
   * Get all registered note types
   */
  public getRegisteredNoteTypes(): string[] {
    return Array.from(this.noteTypes.keys());
  }

  /**
   * Check if a note type is registered
   */
  public isNoteTypeRegistered(noteType: string): boolean {
    return this.noteTypes.has(noteType);
  }

  /**
   * Get the task file manager (convenience method)
   */
  public getTaskManager(): TaskFileManager | null {
    return this.getManager<TaskFileManager>("Task");
  }

  /**
   * Get the area file manager (convenience method)
   */
  public getAreaManager(): AreaFileManager | null {
    return this.getManager<AreaFileManager>("Area");
  }

  /**
   * Get the project file manager (convenience method)
   */
  public getProjectManager(): ProjectFileManager | null {
    return this.getManager<ProjectFileManager>("Project");
  }

  /**
   * Update entity properties using the appropriate file manager
   * @param entity - Entity object with type property
   * @param properties - Object with property keys mapped to values (e.g., { doDate: "2024-01-15", priority: "High" })
   */
  public async update(
    entity: BaseEntity & { type?: string },
    properties: Record<string, any>
  ): Promise<void> {
    if (!entity.type) {
      throw new Error(
        "Entity must have a type property to determine file manager"
      );
    }

    if (!entity.filePath) {
      throw new Error("Entity must have a filePath property");
    }

    // Get the appropriate file manager for this entity type
    const manager = this.getManager(entity.type);
    if (!manager) {
      throw new Error(
        `No file manager registered for entity type: ${entity.type}`
      );
    }

    // Update each property by finding the matching property definition by key
    for (const [propertyKey, value] of Object.entries(properties)) {
      // Find the property definition that matches this key
      const propertyDef = Object.values(PROPERTY_REGISTRY).find(
        (prop) => prop.key === propertyKey
      );

      if (!propertyDef) {
        throw new Error(`Unknown property key: ${propertyKey}`);
      }

      // Use the frontmatter name from the property registry
      const frontmatterKey = propertyDef.name;
      await manager.updateProperty(entity.filePath, frontmatterKey, value);
    }
  }

  /**
   * Load front-matter from a file using the appropriate file manager
   * @param filePath - Path to the file
   * @returns Front-matter object
   */
  public async loadFrontMatter(filePath: string): Promise<Record<string, any>> {
    // Try to determine the entity type from the file path
    let entityType: string | null = null;

    if (filePath.startsWith(this.settings.tasksFolder + "/")) {
      entityType = "Task";
    } else if (filePath.startsWith(this.settings.projectsFolder + "/")) {
      entityType = "Project";
    } else if (filePath.startsWith(this.settings.areasFolder + "/")) {
      entityType = "Area";
    }

    if (!entityType) {
      throw new Error(
        `Cannot determine entity type for file path: ${filePath}`
      );
    }

    const manager = this.getManager(entityType);
    if (!manager) {
      throw new Error(
        `No file manager registered for entity type: ${entityType}`
      );
    }

    return await manager.loadFrontMatter(filePath);
  }

  /**
   * Initialize all registered file managers by instantiating them
   */
  public async initialize(): Promise<void> {
    console.log("🔧 NoteManagers: Initializing all registered managers");

    for (const [noteType, config] of this.noteTypes) {
      try {
        // Instantiate the file manager if not already done
        if (!config.manager && config.managerClass) {
          config.manager = new config.managerClass(
            this.app,
            this.vault,
            this.settings
          );
          console.log(`✅ NoteManagers: Instantiated ${noteType} manager`);
        } else if (config.manager) {
          console.log(
            `✅ NoteManagers: ${noteType} manager already instantiated`
          );
        } else {
          console.warn(
            `⚠️ NoteManagers: No manager class provided for ${noteType}`
          );
        }
      } catch (error) {
        console.error(
          `❌ NoteManagers: Failed to initialize ${noteType} manager:`,
          error
        );
      }
    }
  }

  /**
   * Update settings for all registered managers
   */
  public updateSettings(newSettings: TaskSyncSettings): void {
    this.settings = newSettings;

    for (const [noteType, config] of this.noteTypes) {
      try {
        if (
          config.manager &&
          typeof config.manager.updateSettings === "function"
        ) {
          config.manager.updateSettings(newSettings);
          console.log(
            `✅ NoteManagers: Updated settings for ${noteType} manager`
          );
        }
      } catch (error) {
        console.error(
          `❌ NoteManagers: Failed to update settings for ${noteType} manager:`,
          error
        );
      }
    }
  }

  /**
   * Update files of a specific type to match current schema
   * Unified method that replaces separate updateTaskFiles, updateProjectFiles, updateAreaFiles
   * @param noteType - The type of note to update (e.g., "Task", "Project", "Area")
   * @param results - Results object to track changes and errors
   */
  public async updateFiles(noteType: string, results: any): Promise<void> {
    try {
      // Get the file manager for this note type
      const manager = this.getManager(noteType);
      if (!manager) {
        throw new Error(
          `No file manager registered for note type: ${noteType}`
        );
      }

      // Get the appropriate scanner method based on note type
      let files: string[] = [];
      switch (noteType) {
        case "Task":
          files = await this.vaultScanner.scanTasksFolder();
          break;
        case "Project":
          files = await this.vaultScanner.scanProjectsFolder();
          break;
        case "Area":
          files = await this.vaultScanner.scanAreasFolder();
          break;
        default:
          throw new Error(
            `Unsupported note type for file updates: ${noteType}`
          );
      }

      // Update each file
      for (const filePath of files) {
        try {
          const updateResult = await manager.updateFileProperties(filePath);

          if (updateResult.hasChanges) {
            results.filesUpdated++;
            results.propertiesUpdated += updateResult.propertiesChanged;

            // Log for non-task types (tasks don't log individual updates)
            if (noteType !== "Task") {
              console.log(
                `Task Sync: Updated ${updateResult.propertiesChanged} properties in ${filePath}`
              );
            }
          } else if (noteType !== "Task") {
            // Log for non-task types
            console.log(`Task Sync: No changes needed for ${filePath}`);
          }
        } catch (error) {
          console.error(
            `Task Sync: Failed to update ${noteType.toLowerCase()} file ${filePath}:`,
            error
          );
          results.errors.push(`Failed to update ${filePath}: ${error.message}`);
        }
      }
    } catch (error) {
      console.error(
        `Task Sync: Failed to update ${noteType.toLowerCase()} files:`,
        error
      );
      results.errors.push(
        `Failed to update ${noteType.toLowerCase()} files: ${error.message}`
      );
    }
  }

  /**
   * Cleanup all registered managers
   */
  public cleanup(): void {
    console.log("🔧 NoteManagers: Cleaning up all registered managers");

    for (const [noteType] of this.noteTypes) {
      try {
        // File managers don't have explicit cleanup methods currently
        // but this provides a hook for future cleanup needs
        console.log(`✅ NoteManagers: Cleaned up ${noteType} manager`);
      } catch (error) {
        console.error(
          `❌ NoteManagers: Failed to cleanup ${noteType} manager:`,
          error
        );
      }
    }

    this.noteTypes.clear();
  }
}

/**
 * Plugin interface for registering note types
 * This will be exposed on the main plugin class
 */
export interface NoteTypeRegistration {
  registerNoteType<T extends FileManager>(
    noteType: string,
    config: NoteTypeConfig<T>
  ): void;
}
