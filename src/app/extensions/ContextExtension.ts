/**
 * ContextExtension - Manages file context detection and tracking
 * Integrates ContextService with the Host and provides reactive context updates
 */

import { App } from "obsidian";
import type { Extension } from "../core/extension";
import type { Host } from "../core/host";
import type { TaskSyncSettings } from "../types/settings";
import { ContextService } from "../services/ContextService";
import {
  updateFileContext,
  setDailyPlanningMode,
} from "../stores/contextStore";
import type { FileContext } from "../types/context";
import { extensionRegistry } from "../core/extension";
import { eventBus } from "../core/events";
import { readable, type Readable } from "svelte/store";
import type { Task } from "../core/entities";

export class ContextExtension implements Extension {
  readonly id = "context";
  readonly name = "Context Extension";
  readonly version = "1.0.0";
  readonly supportedEntities = [] as const;

  private app: App;
  private host: Host;
  private contextService: ContextService;
  private isInitialized = false;

  constructor(app: App, host: Host, settings: TaskSyncSettings) {
    this.app = app;
    this.host = host;

    // Initialize with provided settings
    this.contextService = new ContextService(app, settings);
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      console.log("Initializing ContextExtension...");

      // Register extension
      extensionRegistry.register(this);

      // Set up context tracking
      this.setupContextTracking();

      // Set initial context
      this.updateCurrentContext();

      // Trigger extension registered event
      eventBus.trigger({
        type: "extension.registered",
        extension: this.id,
        supportedEntities: [...this.supportedEntities],
      });

      this.isInitialized = true;
      console.log("ContextExtension initialized successfully");
    } catch (error) {
      console.error("Failed to initialize ContextExtension:", error);
      throw error;
    }
  }

  async load(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error("ContextExtension must be initialized before loading");
    }
    // Context extension doesn't need additional loading steps
    console.log("ContextExtension loaded successfully");
  }

  async shutdown(): Promise<void> {
    // Context tracking cleanup is handled by Obsidian's event system
    this.isInitialized = false;
  }

  async isHealthy(): Promise<boolean> {
    return this.isInitialized;
  }

  isEnabled(): boolean {
    return this.isInitialized;
  }

  // Event handlers (not used for context)
  async onEntityCreated(): Promise<void> {
    // Context extension doesn't handle entity events
  }

  async onEntityUpdated(): Promise<void> {
    // Context extension doesn't handle entity events
  }

  async onEntityDeleted(): Promise<void> {
    // Context extension doesn't handle entity events
  }

  /**
   * Get the current file context
   */
  getCurrentContext(): FileContext {
    return this.contextService.detectCurrentFileContext();
  }

  /**
   * Detect context for a specific file path
   */
  getFileContext(filePath: string): FileContext {
    return this.contextService.detectFileContext(filePath);
  }

  /**
   * Update daily planning mode in context
   */
  setDailyPlanningMode(isActive: boolean): void {
    setDailyPlanningMode(isActive);
  }

  /**
   * Update settings when they change
   */
  updateSettings(settings: TaskSyncSettings): void {
    this.contextService.updateSettings(settings);
    // Re-detect context with new settings
    this.updateCurrentContext();
  }

  /**
   * Set up context tracking for workspace events
   */
  private setupContextTracking(): void {
    // Listen for active file changes
    this.app.workspace.on("active-leaf-change", () => {
      this.updateCurrentContext();
    });

    this.app.workspace.on("file-open", () => {
      this.updateCurrentContext();
    });

    // Listen for file renames/moves that might affect context
    this.app.vault.on("rename", (file, oldPath) => {
      this.updateCurrentContext();
    });
  }

  /**
   * Update the current context and notify store
   */
  private updateCurrentContext(): void {
    const newContext = this.contextService.detectCurrentFileContext();
    updateFileContext(newContext);
  }

  // ExtensionDataAccess interface methods
  // ContextExtension doesn't manage tasks directly, so these return empty/default values

  getTasks(): Readable<readonly Task[]> {
    return readable<readonly Task[]>([], () => {});
  }

  async refresh(): Promise<void> {
    // No-op: ContextExtension doesn't maintain its own task cache
  }

  searchTasks(query: string, tasks: readonly Task[]): readonly Task[] {
    // No-op: ContextExtension doesn't provide task search
    return [];
  }

  sortTasks(
    tasks: readonly Task[],
    sortFields: Array<{ key: string; direction: "asc" | "desc" }>
  ): readonly Task[] {
    // No-op: ContextExtension doesn't provide task sorting
    return tasks;
  }

  filterTasks(
    tasks: readonly Task[],
    criteria: {
      project?: string | null;
      area?: string | null;
      source?: string | null;
      showCompleted?: boolean;
    }
  ): readonly Task[] {
    // No-op: ContextExtension doesn't provide task filtering
    return tasks;
  }

  // Extension interface methods (not used for context)
  async getAll(): Promise<never[]> {
    return [];
  }

  async getById(): Promise<undefined> {
    return undefined;
  }

  async create(): Promise<never> {
    throw new Error("Context extension does not support entity creation");
  }

  async update(): Promise<never> {
    throw new Error("Context extension does not support entity updates");
  }

  async delete(): Promise<never> {
    throw new Error("Context extension does not support entity deletion");
  }

  async search(): Promise<never[]> {
    return [];
  }
}
