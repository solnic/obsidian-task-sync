/**
 * Tasks entity with Queries and Operations
 * Implements the abstract base pattern for task management
 */

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
      return new Promise((resolve) => {
        const unsubscribe = store.subscribe((state) => {
          resolve(state.tasks);
          unsubscribe();
        });
      });
    }

    async getById(id: string): Promise<Task | null> {
      return new Promise((resolve) => {
        const unsubscribe = store.subscribe((state) => {
          const task = state.tasks.find((t) => t.id === id);
          resolve(task || null);
          unsubscribe();
        });
      });
    }

    async getByExtension(extensionId: string): Promise<readonly Task[]> {
      return new Promise((resolve) => {
        const unsubscribe = store.subscribe((state) => {
          const tasks = state.tasks.filter(
            (t) => t.source?.extension === extensionId
          );
          resolve(tasks);
          unsubscribe();
        });
      });
    }

    // Task-specific query methods
    async search(query: string): Promise<readonly Task[]> {
      const searchTerm = query.toLowerCase();
      return new Promise((resolve) => {
        const unsubscribe = store.subscribe((state) => {
          const tasks = state.tasks.filter(
            (t) =>
              t.title.toLowerCase().includes(searchTerm) ||
              t.description?.toLowerCase().includes(searchTerm) ||
              t.tags.some((tag) => tag.toLowerCase().includes(searchTerm))
          );
          resolve(tasks);
          unsubscribe();
        });
      });
    }

    async getByStatus(status: string): Promise<readonly Task[]> {
      return new Promise((resolve) => {
        const unsubscribe = store.subscribe((state) => {
          const tasks = state.tasks.filter((t) => t.status === status);
          resolve(tasks);
          unsubscribe();
        });
      });
    }

    async getByProject(project: string): Promise<readonly Task[]> {
      return new Promise((resolve) => {
        const unsubscribe = store.subscribe((state) => {
          const tasks = state.tasks.filter((t) => t.project === project);
          resolve(tasks);
          unsubscribe();
        });
      });
    }

    async getByArea(area: string): Promise<readonly Task[]> {
      return new Promise((resolve) => {
        const unsubscribe = store.subscribe((state) => {
          const tasks = state.tasks.filter((t) => t.areas.includes(area));
          resolve(tasks);
          unsubscribe();
        });
      });
    }

    async getByTag(tag: string): Promise<readonly Task[]> {
      return new Promise((resolve) => {
        const unsubscribe = store.subscribe((state) => {
          const tasks = state.tasks.filter((t) => t.tags.includes(tag));
          resolve(tasks);
          unsubscribe();
        });
      });
    }

    async getAllTags(): Promise<readonly string[]> {
      return new Promise((resolve) => {
        const unsubscribe = store.subscribe((state) => {
          const allTags = new Set<string>();
          state.tasks.forEach((task) => {
            task.tags.forEach((tag) => allTags.add(tag));
          });
          resolve(Array.from(allTags).sort());
          unsubscribe();
        });
      });
    }

    async getDone(): Promise<readonly Task[]> {
      return new Promise((resolve) => {
        const unsubscribe = store.subscribe((state) => {
          const tasks = state.tasks.filter((t) => t.done);
          resolve(tasks);
          unsubscribe();
        });
      });
    }

    async getPending(): Promise<readonly Task[]> {
      return new Promise((resolve) => {
        const unsubscribe = store.subscribe((state) => {
          const tasks = state.tasks.filter((t) => !t.done);
          resolve(tasks);
          unsubscribe();
        });
      });
    }
  };

  static Operations = class TaskOperations extends EntitiesOperations {
    public entityType = "task" as const;

    async create(
      taskData: Omit<Task, "id" | "createdAt" | "updatedAt">
    ): Promise<Task> {
      const task = this.buildEntity(taskData) as Task;

      store.addTask(task);

      eventBus.trigger({ type: "tasks.created", task });

      return task;
    }

    async update(task: Task): Promise<Task> {
      const updatedTask: Task = { ...task, updatedAt: this.timestamp() };

      store.updateTask(updatedTask);

      eventBus.trigger({ type: "tasks.updated", task: updatedTask });

      return updatedTask;
    }

    async delete(id: string): Promise<void> {
      store.removeTask(id);
      eventBus.trigger({ type: "tasks.deleted", taskId: id });
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

export const taskQueries = new Tasks.Queries();
export const taskOperations = new Tasks.Operations();