/**
 * ContextExtension - Manages file context detection and tracking
 * Integrates ContextService with the Host and provides reactive context updates
 */

import { App } from "obsidian";
import type { Extension } from "../../core/extension";
import type { Host } from "../../core/host";
import type { TaskSyncSettings } from "../../types/settings";
import { ContextService } from "../../services/ContextService";
import {
  updateFileContext,
  setDailyPlanningMode,
} from "../../stores/contextStore";
import type { FileContext } from "../../types/context";
import { extensionRegistry } from "../../core/extension";
import { eventBus } from "../../core/events";
import { readable, type Readable } from "svelte/store";
import type { Task, Project, Area } from "../../core/entities";
import { TaskQueryService } from "../../services/TaskQueryService";
import { ProjectQueryService } from "../../services/ProjectQueryService";
import { AreaQueryService } from "../../services/AreaQueryService";
import { taskStore } from "../../stores/taskStore";
import { projectStore } from "../../stores/projectStore";
import { areaStore } from "../../stores/areaStore";
import { get } from "svelte/store";

export class ContextExtension implements Extension {
  readonly id = "context";
  readonly name = "Context Extension";
  readonly version = "1.0.0";
  readonly supportedEntities = [] as const;

  private app: App;
  private host: Host;
  private contextService: ContextService;
  private isInitialized = false;
  private storeUnsubscribers: (() => void)[] = [];

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

      // Set up store subscriptions to react to entity changes
      this.setupStoreSubscriptions();

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
    // Cleanup store subscriptions
    this.storeUnsubscribers.forEach((unsubscribe) => unsubscribe());
    this.storeUnsubscribers = [];

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
   * Get the current file context with resolved entity
   */
  getCurrentContext(): FileContext {
    return this.contextService.getCurrentContext();
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

    // Listen for metadata cache changes - this fires AFTER file is fully indexed
    // This ensures context updates happen after Obsidian has processed the file
    this.app.metadataCache.on("changed", (file) => {
      // Only update context if this is the active file
      const activeFile = this.app.workspace.getActiveFile();
      if (activeFile && activeFile.path === file.path) {
        this.updateCurrentContext();
      }
    });

    // Listen for file renames/moves that might affect context
    this.app.vault.on("rename", (file, oldPath) => {
      this.updateCurrentContext();
    });
  }

  /**
   * Set up store subscriptions to react to entity changes
   *
   * DISABLED: These subscriptions were causing infinite loops because:
   * 1. Store emits → updateCurrentContext() called
   * 2. updateCurrentContext() fetches entity from store (new object reference)
   * 3. Context store updates → ContextWidget re-renders
   * 4. ContextWidget $effect re-subscribes to stores → stores emit again
   * 5. Back to step 1 → infinite loop
   *
   * Instead, we rely on:
   * - File change events (active-leaf-change, file-open, metadata changed)
   * - These are sufficient to keep context in sync
   * - Entity updates are reflected through the stores that ContextWidget subscribes to directly
   */
  private setupStoreSubscriptions(): void {
    // No store subscriptions - rely on file change events only
    // This prevents infinite loops while still keeping context up-to-date
  }

  /**
   * Update the current context and notify store
   */
  private updateCurrentContext(): void {
    const baseContext = this.contextService.detectCurrentFileContext();

    // Resolve entity based on context type
    let entity: Task | Project | Area | undefined = undefined;

    if (
      baseContext.path &&
      baseContext.type !== "none" &&
      baseContext.type !== "daily"
    ) {
      switch (baseContext.type) {
        case "task": {
          const tasks = get(taskStore).tasks;
          entity =
            TaskQueryService.findByFilePath(tasks, baseContext.path) ||
            TaskQueryService.findByTitle(tasks, baseContext.name || "");
          break;
        }
        case "project": {
          const projects = get(projectStore).projects;
          entity =
            ProjectQueryService.findByFilePath(projects, baseContext.path) ||
            ProjectQueryService.findByName(projects, baseContext.name || "");
          break;
        }
        case "area": {
          const areas = get(areaStore).areas;
          entity =
            AreaQueryService.findByFilePath(areas, baseContext.path) ||
            AreaQueryService.findByName(areas, baseContext.name || "");
          break;
        }
      }
    }

    // Create enriched context with resolved entity
    const enrichedContext: FileContext = {
      ...baseContext,
      entity,
    };

    console.log("ContextExtension - Updating context:", {
      type: enrichedContext.type,
      path: enrichedContext.path,
      name: enrichedContext.name,
      hasEntity: !!enrichedContext.entity,
      entityId: enrichedContext.entity?.id,
    });

    updateFileContext(enrichedContext);
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
