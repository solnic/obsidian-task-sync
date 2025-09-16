/**
 * Task Store - Reactive Svelte store for task management
 * Provides a centralized, reactive API for task operations and queries
 */

import { derived } from "svelte/store";
import { EntityStore } from "./EntityStore";
import { Task } from "../types/entities";
import { PROPERTY_SETS } from "../services/base-definitions/BaseConfigurations";

class TaskStore extends EntityStore<Task> {
  constructor() {
    super("taskStore");
  }

  protected getPropertySet(): readonly string[] {
    return PROPERTY_SETS.TASK_FRONTMATTER;
  }

  // Derived stores for common queries
  public importedTasks = derived(this._store, ($store) =>
    $store.entities.filter((task) => task.source)
  );

  public githubTasks = derived(this._store, ($store) =>
    $store.entities.filter((task) => task.source?.name === "github")
  );

  public linearTasks = derived(this._store, ($store) =>
    $store.entities.filter((task) => task.source?.name === "linear")
  );

  /**
   * Refresh all tasks from the file system (alias for base class method)
   */
  async refreshTasks() {
    await this.refreshEntities();
  }

  /**
   * Find a task by its external source
   */
  findTaskBySource(sourceName: string, sourceKey: string): Task | null {
    const entities = this.getEntities();
    return (
      entities.find(
        (task) =>
          task.source?.name === sourceName && task.source?.key === sourceKey
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
  getTasksBySource(sourceName: string): Task[] {
    const entities = this.getEntities();
    return entities.filter((task) => task.source?.name === sourceName);
  }

  /**
   * Get tasks by project
   */
  getTasksByProject(projectName: string): Task[] {
    const entities = this.getEntities();
    return entities.filter(
      (task) =>
        task.project === projectName || task.project === `[[${projectName}]]`
    );
  }

  /**
   * Get tasks by area
   */
  getTasksByArea(areaName: string): Task[] {
    const entities = this.getEntities();
    return entities.filter(
      (task) =>
        task.areas?.includes(areaName) ||
        task.areas?.includes(`[[${areaName}]]`)
    );
  }
}

// Export singleton instance
export const taskStore = new TaskStore();
