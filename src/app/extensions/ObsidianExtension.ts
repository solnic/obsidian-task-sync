/**
 * Obsidian Extension
 * Main extension implementation for Obsidian vault integration
 * Provides area operations and coordinates with the event bus
 */

import { App, Plugin } from "obsidian";
import { Extension, extensionRegistry, EntityType } from "../core/extension";
import { eventBus } from "../core/events";
import { ObsidianAreaOperations } from "./ObsidianAreaOperations";
import { ObsidianProjectOperations } from "./ObsidianProjectOperations";
import { ObsidianTaskOperations } from "./ObsidianTaskOperations";
import { taskStore } from "../stores/taskStore";
import { derived, type Readable } from "svelte/store";
import type { Task } from "../core/entities";

export interface ObsidianExtensionSettings {
  areasFolder: string;
  projectsFolder: string;
  tasksFolder: string;
}

export class ObsidianExtension implements Extension {
  readonly id = "obsidian";
  readonly name = "Obsidian Vault";
  readonly version = "1.0.0";
  readonly supportedEntities: readonly EntityType[] = [
    "area",
    "project",
    "task",
  ];

  private initialized = false;
  private areaOperations: ObsidianAreaOperations;
  private projectOperations: ObsidianProjectOperations;
  readonly taskOperations: ObsidianTaskOperations;

  constructor(
    private app: App,
    private plugin: Plugin,
    private settings: ObsidianExtensionSettings
  ) {
    this.areaOperations = new ObsidianAreaOperations(app, settings.areasFolder);
    this.projectOperations = new ObsidianProjectOperations(
      app,
      settings.projectsFolder
    );
    this.taskOperations = new ObsidianTaskOperations(app, settings.tasksFolder);
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Register with the core app
      extensionRegistry.register(this);

      // Trigger extension registered event
      eventBus.trigger({
        type: "extension.registered",
        extension: this.id,
        supportedEntities: [...this.supportedEntities],
      });

      // Set up event listeners for domain events
      this.setupEventListeners();

      this.initialized = true;
      console.log("ObsidianExtension initialized successfully");
    } catch (error) {
      console.error("Failed to initialize ObsidianExtension:", error);
      throw error;
    }
  }

  async load(): Promise<void> {
    if (!this.initialized) {
      throw new Error("ObsidianExtension must be initialized before loading");
    }

    try {
      console.log("Loading ObsidianExtension - scanning existing tasks...");

      // Scan existing tasks and populate the store
      // This runs after Obsidian's layout is ready and vault is fully loaded
      await this.scanAndPopulateExistingTasks();

      console.log("ObsidianExtension loaded successfully");
    } catch (error) {
      console.error("Failed to load ObsidianExtension:", error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    if (!this.initialized) return;

    eventBus.trigger({
      type: "extension.unregistered",
      extension: this.id,
    });

    this.initialized = false;
  }

  async isHealthy(): Promise<boolean> {
    return this.app.vault !== null && this.initialized;
  }

  /**
   * Get observable tasks for this extension
   * Returns the full task store - LocalTasksService will handle filtering/display
   * The extension provides all tasks, and the UI component decides what to show
   */
  getTasks(): Readable<readonly Task[]> {
    return derived(taskStore, ($store) => $store.tasks);
  }

  /**
   * Refresh tasks by re-scanning the vault
   * Public method that can be called by UI components
   * Handles both upserting existing tasks and removing deleted ones
   */
  async refresh(): Promise<void> {
    try {
      taskStore.setLoading(true);
      taskStore.setError(null);

      console.log("Refreshing Obsidian tasks...");

      // Get current tasks to identify which ones to remove (no longer exist in files)
      const currentState = await new Promise((resolve) => {
        let unsubscribe: (() => void) | undefined;
        unsubscribe = taskStore.subscribe((state) => {
          resolve(state);
          if (unsubscribe) unsubscribe();
        });
      });

      const currentTasks = (currentState as any).tasks;

      // Scan existing task files
      const freshTasksData = await this.taskOperations.scanExistingTasks();
      console.log(`Refresh found ${freshTasksData.length} tasks`);

      // Create a set of natural keys from fresh data to identify removed tasks
      const freshNaturalKeys = new Set(
        freshTasksData.map((taskData) => taskData.naturalKey)
      );

      // Remove tasks that no longer exist in the file system
      for (const task of currentTasks) {
        if (
          task.source?.extension === "obsidian" &&
          task.source?.filePath &&
          !freshNaturalKeys.has(task.source.filePath)
        ) {
          console.log(
            `Removing deleted task: ${task.title} (${task.source.filePath})`
          );
          taskStore.removeTask(task.id);
        }
      }

      // Upsert fresh tasks - store will handle ID generation/preservation
      for (const taskData of freshTasksData) {
        taskStore.upsertTask(taskData);
      }

      taskStore.setLoading(false);
      console.log("Refresh completed successfully");
    } catch (err: any) {
      console.error("Failed to refresh tasks:", err);
      taskStore.setError(err.message);
      taskStore.setLoading(false);
      throw err;
    }
  }

  /**
   * Search tasks by query string
   * Searches in title, category, status, project, and areas
   */
  searchTasks(query: string, tasks: readonly Task[]): readonly Task[] {
    const lowerQuery = query.toLowerCase();

    return tasks.filter((task) => {
      return (
        task.title.toLowerCase().includes(lowerQuery) ||
        (task.category && task.category.toLowerCase().includes(lowerQuery)) ||
        (task.status && task.status.toLowerCase().includes(lowerQuery)) ||
        (task.project &&
          typeof task.project === "string" &&
          task.project.toLowerCase().includes(lowerQuery)) ||
        (task.areas &&
          Array.isArray(task.areas) &&
          task.areas.some(
            (area: string) =>
              typeof area === "string" &&
              area.toLowerCase().includes(lowerQuery)
          ))
      );
    });
  }

  /**
   * Sort tasks by multiple fields
   * Supports sorting by title, createdAt, updatedAt, priority, status, category, project, areas
   */
  sortTasks(
    tasks: readonly Task[],
    sortFields: Array<{ key: string; direction: "asc" | "desc" }>
  ): readonly Task[] {
    return [...tasks].sort((a, b) => {
      for (const field of sortFields) {
        let aValue: any;
        let bValue: any;

        // Get values based on field key
        switch (field.key) {
          case "title":
            aValue = a.title;
            bValue = b.title;
            break;
          case "createdAt":
            aValue = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            bValue = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            break;
          case "updatedAt":
            aValue = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
            bValue = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
            break;
          case "priority":
            // Use priority order from constants if available
            // For now, just use string comparison
            aValue = a.priority || "";
            bValue = b.priority || "";
            break;
          case "status":
            aValue = a.status || "";
            bValue = b.status || "";
            break;
          case "category":
            aValue = a.category || "";
            bValue = b.category || "";
            break;
          case "project":
            aValue = a.project || "";
            bValue = b.project || "";
            break;
          case "areas":
            aValue = Array.isArray(a.areas) ? a.areas.join(", ") : "";
            bValue = Array.isArray(b.areas) ? b.areas.join(", ") : "";
            break;
          default:
            aValue = "";
            bValue = "";
        }

        // Compare values
        let comparison = 0;
        if (typeof aValue === "string" && typeof bValue === "string") {
          comparison = aValue.localeCompare(bValue);
        } else if (typeof aValue === "number" && typeof bValue === "number") {
          comparison = aValue - bValue;
        } else {
          // Handle mixed types by converting to strings
          comparison = String(aValue).localeCompare(String(bValue));
        }

        // Apply direction
        if (field.direction === "desc") {
          comparison = -comparison;
        }

        // If not equal, return the comparison result
        if (comparison !== 0) {
          return comparison;
        }
      }

      // If all fields are equal, maintain original order
      return 0;
    });
  }

  /**
   * Filter tasks by criteria
   * Filters by project, area, source, and completed status
   */
  filterTasks(
    tasks: readonly Task[],
    criteria: {
      project?: string | null;
      area?: string | null;
      source?: string | null;
      showCompleted?: boolean;
    }
  ): readonly Task[] {
    return tasks.filter((task) => {
      // Project filter
      if (criteria.project) {
        if (task.project !== criteria.project) {
          return false;
        }
      }

      // Area filter
      if (criteria.area) {
        if (!task.areas || !Array.isArray(task.areas)) {
          return false;
        }
        if (!task.areas.includes(criteria.area)) {
          return false;
        }
      }

      // Source filter
      if (criteria.source) {
        const taskSource = task.source?.filePath;
        if (taskSource !== criteria.source) {
          return false;
        }
      }

      // Completed filter - exclude completed tasks unless showCompleted is true
      if (!criteria.showCompleted && task.done === true) {
        return false;
      }

      return true;
    });
  }

  /**
   * Scan existing task files and populate the canonical task store
   * This follows the new architecture where extensions scan their representations
   * during initialization and populate the canonical store using upsert logic
   */
  private async scanAndPopulateExistingTasks(): Promise<void> {
    try {
      console.log("Scanning existing tasks from Obsidian vault...");

      // Scan existing task files using the task operations (returns data without IDs)
      const existingTasksData = await this.taskOperations.scanExistingTasks();

      console.log(`Found ${existingTasksData.length} existing tasks`);

      // Populate the canonical task store using upsert logic
      // Store will handle ID generation for new tasks
      for (const taskData of existingTasksData) {
        taskStore.upsertTask(taskData);
      }

      console.log("Successfully populated task store with existing tasks");
    } catch (error) {
      console.error("Failed to scan and populate existing tasks:", error);
      // Don't throw - this shouldn't prevent extension initialization
    }
  }

  // Event handler methods required by Extension interface
  async onEntityCreated(event: any): Promise<void> {
    if (event.type === "areas.created") {
      // React to area creation by creating the corresponding Obsidian note
      await this.areaOperations.createNote(event.area);
    } else if (event.type === "projects.created") {
      // React to project creation by creating the corresponding Obsidian note
      await this.projectOperations.createNote(event.project);
    } else if (event.type === "tasks.created") {
      // React to task creation by creating the corresponding Obsidian note
      await this.taskOperations.createNote(event.task);
    }
  }

  async onEntityUpdated(event: any): Promise<void> {
    if (event.type === "areas.updated") {
      // React to area update by updating the corresponding Obsidian note
      await this.areaOperations.updateNote(event.area);
    } else if (event.type === "projects.updated") {
      // React to project update by updating the corresponding Obsidian note
      await this.projectOperations.updateNote(event.project);
    } else if (event.type === "tasks.updated") {
      // React to task update by updating the corresponding Obsidian note
      await this.taskOperations.updateNote(event.task);
    }
  }

  async onEntityDeleted(event: any): Promise<void> {
    if (event.type === "areas.deleted") {
      // React to area deletion by deleting the corresponding Obsidian note
      await this.areaOperations.deleteNote(event.areaId);
    } else if (event.type === "projects.deleted") {
      // React to project deletion by deleting the corresponding Obsidian note
      await this.projectOperations.deleteNote(event.projectId);
    } else if (event.type === "tasks.deleted") {
      // React to task deletion by deleting the corresponding Obsidian note
      await this.taskOperations.deleteNote(event.taskId);
    }
  }

  private setupEventListeners(): void {
    // Subscribe to domain events to reactively manage Obsidian notes
    eventBus.on("areas.created", this.onEntityCreated.bind(this));
    eventBus.on("areas.updated", this.onEntityUpdated.bind(this));
    eventBus.on("areas.deleted", this.onEntityDeleted.bind(this));

    eventBus.on("projects.created", this.onEntityCreated.bind(this));
    eventBus.on("projects.updated", this.onEntityUpdated.bind(this));
    eventBus.on("projects.deleted", this.onEntityDeleted.bind(this));

    eventBus.on("tasks.created", this.onEntityCreated.bind(this));
    eventBus.on("tasks.updated", this.onEntityUpdated.bind(this));
    eventBus.on("tasks.deleted", this.onEntityDeleted.bind(this));
  }
}
