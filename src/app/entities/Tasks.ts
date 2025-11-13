/**
 * Tasks entity with Queries and Operations
 * Implements the abstract base pattern for task management
 */

import { get } from "svelte/store";
import { Task } from "../core/entities";
import {
  Entities,
  EntitiesQueries,
  EntitiesOperations,
} from "../core/entities-base";
import { taskStore as store } from "../stores/taskStore";
import { eventBus } from "../core/events";

export class Tasks extends Entities {
  protected entityType = "task" as const;

  static Queries = class TaskQueries extends EntitiesQueries {
    public entityType = "task" as const;

    async getAll(): Promise<readonly Task[]> {
      return get(store).tasks;
    }

    async getById(id: string): Promise<Task | null> {
      const task = get(store).tasks.find((t) => t.id === id);
      return task || null;
    }

    async getByExtension(extensionId: string): Promise<readonly Task[]> {
      return get(store).tasks.filter((t) => t.source.extension === extensionId);
    }

    // Task-specific query methods
    async search(query: string): Promise<readonly Task[]> {
      const searchTerm = query.toLowerCase();
      return get(store).tasks.filter(
        (t) =>
          t.title.toLowerCase().includes(searchTerm) ||
          t.description?.toLowerCase().includes(searchTerm) ||
          t.tags.some((tag) => tag.toLowerCase().includes(searchTerm))
      );
    }

    async getByStatus(status: string): Promise<readonly Task[]> {
      return get(store).tasks.filter((t) => t.status === status);
    }

    async getByProject(project: string): Promise<readonly Task[]> {
      return get(store).tasks.filter((t) => t.project === project);
    }

    async getByArea(area: string): Promise<readonly Task[]> {
      return get(store).tasks.filter((t) => t.areas.includes(area));
    }

    async getByTag(tag: string): Promise<readonly Task[]> {
      return get(store).tasks.filter((t) => t.tags.includes(tag));
    }

    async getAllTags(): Promise<readonly string[]> {
      const allTags = new Set<string>();
      get(store).tasks.forEach((task) => {
        task.tags.forEach((tag) => allTags.add(tag));
      });
      return Array.from(allTags).sort();
    }

    async getDone(): Promise<readonly Task[]> {
      return get(store).tasks.filter((t) => t.done);
    }

    async getPending(): Promise<readonly Task[]> {
      return get(store).tasks.filter((t) => !t.done);
    }
  };

  static Operations = class TaskOperations extends EntitiesOperations {
    public entityType = "task" as const;

    async create(
      taskData: Omit<Task, "id" | "createdAt" | "updatedAt">
    ): Promise<Task> {
      // buildEntity handles schema validation and date coercion
      const task = this.buildEntity(taskData) as Task;

      // Dispatch action instead of calling store.addTask()
      store.dispatch({ type: "ADD_TASK", task });

      // Still trigger domain event for cross-cutting concerns
      eventBus.trigger({ type: "tasks.created", task });

      return task;
    }

    async update(task: Task): Promise<Task> {
      const updatedTask: Task = { ...task, updatedAt: this.timestamp() };

      // Dispatch action instead of calling store.updateTask()
      store.dispatch({ type: "UPDATE_TASK", task: updatedTask });

      // Still trigger domain event for cross-cutting concerns
      eventBus.trigger({ type: "tasks.updated", task: updatedTask });

      return updatedTask;
    }

    async delete(id: string): Promise<void> {
      // Get the task before removing it so we can include it in the event
      const task = get(store).tasks.find((t) => t.id === id);

      // Dispatch action instead of calling store.removeTask()
      store.dispatch({ type: "REMOVE_TASK", taskId: id });

      // Include the task in the event so listeners can access its properties
      eventBus.trigger({ type: "tasks.deleted", taskId: id, task });
    }

    async markDone(taskId: string): Promise<void> {
      const task = await new Tasks.Queries().getById(taskId);
      if (task) {
        await this.update({
          ...task,
          done: true,
          status: "Done",
        });
      }
    }

    async markPending(taskId: string): Promise<void> {
      const task = await new Tasks.Queries().getById(taskId);
      if (task) {
        await this.update({
          ...task,
          done: false,
        });
      }
    }

    async changeStatus(taskId: string, newStatus: string): Promise<void> {
      const task = await new Tasks.Queries().getById(taskId);
      if (task) {
        await this.update({
          ...task,
          status: newStatus,
          done: newStatus === "Done",
        });
      }
    }
  };
}
