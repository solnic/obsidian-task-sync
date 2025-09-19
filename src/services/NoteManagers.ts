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

export interface NoteTypeConfig<T = any> {
  manager: FileManager;
  propertyHandler?: EventHandler;
}

export interface NoteManagersConfig {
  [noteType: string]: NoteTypeConfig;
}

export class NoteManagers {
  private app: App;
  private vault: Vault;
  private settings: TaskSyncSettings;
  private noteTypes: Map<string, NoteTypeConfig> = new Map();

  constructor(app: App, vault: Vault, settings: TaskSyncSettings) {
    this.app = app;
    this.vault = vault;
    this.settings = settings;
  }

  /**
   * Register a note type with its corresponding file manager
   */
  public registerNoteType<T>(
    noteType: string,
    config: NoteTypeConfig<T>
  ): void {
    this.noteTypes.set(noteType, config);
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
   * Get the property handler for a specific note type
   */
  public getPropertyHandler(noteType: string): EventHandler | null {
    const config = this.noteTypes.get(noteType);
    return config?.propertyHandler || null;
  }

  /**
   * Register a property handler for an existing note type
   */
  public registerPropertyHandler(
    noteType: string,
    propertyHandler: EventHandler
  ): void {
    const config = this.noteTypes.get(noteType);
    if (!config) {
      throw new Error(`Note type '${noteType}' is not registered`);
    }

    config.propertyHandler = propertyHandler;
    console.log(
      `🔧 NoteManagers: Registered property handler for note type: ${noteType}`
    );
  }

  /**
   * Get all property handlers
   */
  public getAllPropertyHandlers(): EventHandler[] {
    const handlers: EventHandler[] = [];
    for (const config of this.noteTypes.values()) {
      if (config.propertyHandler) {
        handlers.push(config.propertyHandler);
      }
    }
    return handlers;
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
   * Initialize all registered file managers
   */
  public async initialize(): Promise<void> {
    console.log("🔧 NoteManagers: Initializing all registered managers");

    for (const [noteType, config] of this.noteTypes) {
      try {
        // File managers don't have an explicit initialize method currently
        // but this provides a hook for future initialization needs
        console.log(`✅ NoteManagers: Initialized ${noteType} manager`);
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
   * Cleanup all registered managers
   */
  public cleanup(): void {
    console.log("🔧 NoteManagers: Cleaning up all registered managers");

    for (const [noteType, config] of this.noteTypes) {
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
 * Factory function to create a NoteManagers instance with default note types
 */
export function createNoteManagers(
  app: App,
  vault: Vault,
  settings: TaskSyncSettings,
  managers: {
    taskFileManager: TaskFileManager;
    areaFileManager: AreaFileManager;
    projectFileManager: ProjectFileManager;
  },
  propertyHandlers?: {
    taskPropertyHandler?: EventHandler;
    areaPropertyHandler?: EventHandler;
    projectPropertyHandler?: EventHandler;
  }
): NoteManagers {
  const noteManagers = new NoteManagers(app, vault, settings);

  // Register default note types with optional property handlers
  noteManagers.registerNoteType("Task", {
    manager: managers.taskFileManager,
    propertyHandler: propertyHandlers?.taskPropertyHandler,
  });

  noteManagers.registerNoteType("Area", {
    manager: managers.areaFileManager,
    propertyHandler: propertyHandlers?.areaPropertyHandler,
  });

  noteManagers.registerNoteType("Project", {
    manager: managers.projectFileManager,
    propertyHandler: propertyHandlers?.projectPropertyHandler,
  });

  return noteManagers;
}

/**
 * Plugin interface for registering note types
 * This will be exposed on the main plugin class
 */
export interface NoteTypeRegistration {
  registerNoteType<T>(noteType: string, config: NoteTypeConfig<T>): void;

  registerPropertyHandler(
    noteType: string,
    propertyHandler: EventHandler
  ): void;
}
