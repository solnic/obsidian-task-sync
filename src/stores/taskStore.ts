/**
 * Task Store - Reactive Svelte store for task management
 * Provides a centralized, reactive API for task operations and queries
 */

import { writable, derived, get } from "svelte/store";
import { App, TFile } from "obsidian";
import matter from "gray-matter";
import { TaskSource } from "../types/entities";

export interface TaskData {
  file: TFile;
  title: string;
  type?: string;
  category?: string;
  priority?: string;
  areas?: string[];
  project?: string;
  done?: boolean;
  status?: string;
  source?: TaskSource;
  tags?: string[];
  [key: string]: any; // Allow additional front-matter properties
}

export interface TaskStoreState {
  tasks: TaskData[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

class TaskStore {
  private app: App | null = null;
  private tasksFolder = "Tasks";

  // Core store
  private _store = writable<TaskStoreState>({
    tasks: [],
    loading: false,
    error: null,
    lastUpdated: null,
  });

  // Public store interface
  public subscribe = this._store.subscribe;

  // Derived stores for common queries
  public importedTasks = derived(this._store, ($store) =>
    $store.tasks.filter((task) => task.source),
  );

  public githubTasks = derived(this._store, ($store) =>
    $store.tasks.filter((task) => task.source?.name === "github"),
  );

  public linearTasks = derived(this._store, ($store) =>
    $store.tasks.filter((task) => task.source?.name === "linear"),
  );

  /**
   * Initialize the store with Obsidian app instance
   */
  initialize(app: App, tasksFolder: string = "Tasks") {
    this.app = app;
    this.tasksFolder = tasksFolder;

    // Set up file system watchers for reactive updates
    this.setupFileWatchers();

    // Initial load
    this.refreshTasks();
  }

  /**
   * Refresh all tasks from the file system
   */
  async refreshTasks() {
    if (!this.app) return;

    this._store.update((state) => ({ ...state, loading: true, error: null }));

    try {
      const tasks = await this.loadAllTasks();
      this._store.update((state) => ({
        ...state,
        tasks,
        loading: false,
        lastUpdated: new Date(),
      }));
    } catch (error) {
      this._store.update((state) => ({
        ...state,
        loading: false,
        error: error instanceof Error ? error.message : "Failed to load tasks",
      }));
    }
  }

  /**
   * Find a task by its external source
   */
  findTaskBySource(sourceName: string, sourceKey: string): TaskData | null {
    const state = get(this._store);
    return (
      state.tasks.find(
        (task) =>
          task.source?.name === sourceName && task.source?.key === sourceKey,
      ) || null
    );
  }

  /**
   * Check if a task with the given source already exists
   */
  isTaskImported(sourceName: string, sourceKey: string): boolean {
    return this.findTaskBySource(sourceName, sourceKey) !== null;
  }

  /**
   * Get all tasks from a specific source
   */
  getTasksBySource(sourceName: string): TaskData[] {
    const state = get(this._store);
    return state.tasks.filter((task) => task.source?.name === sourceName);
  }

  /**
   * Get tasks by project
   */
  getTasksByProject(projectName: string): TaskData[] {
    const state = get(this._store);
    return state.tasks.filter(
      (task) =>
        task.project === projectName || task.project === `[[${projectName}]]`,
    );
  }

  /**
   * Get tasks by area
   */
  getTasksByArea(areaName: string): TaskData[] {
    const state = get(this._store);
    return state.tasks.filter((task) =>
      task.areas?.some(
        (area) => area === areaName || area === `[[${areaName}]]`,
      ),
    );
  }

  /**
   * Load all tasks from the file system
   */
  private async loadAllTasks(): Promise<TaskData[]> {
    if (!this.app) return [];

    const taskFiles = this.app.vault
      .getMarkdownFiles()
      .filter((file) => file.path.startsWith(this.tasksFolder + "/"));

    const tasks: TaskData[] = [];

    for (const file of taskFiles) {
      try {
        const taskData = await this.parseTaskFile(file);
        if (taskData) {
          tasks.push(taskData);
        }
      } catch (error) {
        console.warn(`Failed to parse task file ${file.path}:`, error);
      }
    }

    return tasks;
  }

  /**
   * Parse a task file and extract task data
   */
  private async parseTaskFile(file: TFile): Promise<TaskData | null> {
    if (!this.app) return null;

    try {
      const content = await this.app.vault.read(file);
      const parsed = matter(content);
      const frontMatter = parsed.data;

      // Only include files that are actually tasks (have Type: Task or similar)
      if (frontMatter.Type !== "Task" && frontMatter.type !== "Task") {
        return null;
      }

      return {
        file,
        title: frontMatter.Title || frontMatter.title || file.basename,
        type: frontMatter.Type || frontMatter.type,
        category: frontMatter.Category || frontMatter.category,
        priority: frontMatter.Priority || frontMatter.priority,
        areas: frontMatter.Areas || frontMatter.areas || [],
        project: frontMatter.Project || frontMatter.project,
        done: frontMatter.Done || frontMatter.done || false,
        status: frontMatter.Status || frontMatter.status,
        source: frontMatter.source,
        tags: frontMatter.tags || [],
        ...frontMatter, // Include all other front-matter properties
      };
    } catch (error) {
      console.warn(`Failed to read task file ${file.path}:`, error);
      return null;
    }
  }

  /**
   * Set up file system watchers for reactive updates
   */
  private setupFileWatchers() {
    if (!this.app) return;

    // Watch for file changes in the tasks folder
    this.app.vault.on("create", (file) => {
      if (
        file instanceof TFile &&
        file.path.startsWith(this.tasksFolder + "/")
      ) {
        this.refreshTasks();
      }
    });

    this.app.vault.on("delete", (file) => {
      if (
        file instanceof TFile &&
        file.path.startsWith(this.tasksFolder + "/")
      ) {
        this.refreshTasks();
      }
    });

    this.app.vault.on("modify", (file) => {
      if (
        file instanceof TFile &&
        file.path.startsWith(this.tasksFolder + "/")
      ) {
        this.refreshTasks();
      }
    });

    this.app.vault.on("rename", (file, oldPath) => {
      if (
        (file instanceof TFile &&
          file.path.startsWith(this.tasksFolder + "/")) ||
        oldPath.startsWith(this.tasksFolder + "/")
      ) {
        this.refreshTasks();
      }
    });
  }

  /**
   * Clear the store (for cleanup)
   */
  clear() {
    this._store.set({
      tasks: [],
      loading: false,
      error: null,
      lastUpdated: null,
    });
  }
}

// Export singleton instance
export const taskStore = new TaskStore();
