/**
 * Apple Reminders Data Source
 * Implements DataSource interface for Apple Reminders integration
 */

import type { Task } from "../../../core/entities";
import { TaskSchema } from "../../../core/entities";
import { generateId } from "../../../utils/idGenerator";
import type { AppleReminder } from "../../../types/apple-reminders";
import type { AppleRemindersExtension } from "../AppleRemindersExtension";
import type { DataSource, DataSourceWatchCallbacks } from "../../../sources/DataSource";

/**
 * Data source for Apple Reminders
 * Fetches Apple Reminders data and transforms it into Task entities
 */
export class AppleRemindersDataSource implements DataSource<Task> {
  readonly id = "apple-reminders";
  readonly name = "Apple Reminders";

  constructor(private extension: AppleRemindersExtension) {}

  /**
   * Load initial data from Apple Reminders
   */
  async loadInitialData(): Promise<readonly Task[]> {
    if (!this.extension.isEnabled()) {
      return [];
    }

    try {
      const remindersResult = await this.extension.fetchReminders();
      if (remindersResult.success && remindersResult.data) {
        const tasks = await Promise.all(
          remindersResult.data.map((reminder) => this.transformToTask(reminder))
        );
        return tasks.filter((task): task is Task => task !== null);
      }
      return [];
    } catch (error) {
      console.error("Failed to load initial Apple Reminders data:", error);
      return [];
    }
  }

  /**
   * Refresh data from Apple Reminders
   */
  async refresh(): Promise<readonly Task[]> {
    return this.loadInitialData();
  }

  /**
   * Watch for changes (optional - Apple Reminders doesn't support real-time watching)
   */
  watch(callbacks: DataSourceWatchCallbacks<Task>): () => void {
    // Apple Reminders doesn't support real-time watching via AppleScript
    // Return a no-op cleanup function
    return () => {};
  }

  /**
   * Transform an Apple Reminder into a Task entity
   */
  private async transformToTask(reminder: AppleReminder): Promise<Task | null> {
    try {
      // Map Apple Reminders priority (0-9) to task priority strings
      const priorityMap: Record<number, string> = {
        0: "", // No priority
        1: "low",
        2: "low",
        3: "low",
        4: "medium",
        5: "medium",
        6: "medium",
        7: "high",
        8: "high",
        9: "high",
      };

      // Create task data
      const taskData = {
        title: reminder.title,
        description: reminder.notes || "",
        status: reminder.completed ? "done" : "todo",
        done: reminder.completed,
        category: "reminder", // Default category for Apple Reminders
        priority: priorityMap[reminder.priority] || "",
        parentTask: "",
        project: "",
        areas: [] as string[],
        tags: [`apple-reminders`, `list:${reminder.list.name.toLowerCase().replace(/\s+/g, "-")}`],
        doDate: null as Date | null,
        dueDate: reminder.dueDate || null,
        createdAt: reminder.creationDate || new Date(),
        updatedAt: reminder.modificationDate || new Date(),
        source: {
          extension: this.id,
          keys: {
            "apple-reminders": reminder.id,
          },
          data: reminder, // Store raw Apple Reminders data for reference
        },
      };

      // Validate and create Task entity
      const task = TaskSchema.parse({
        id: generateId(),
        ...taskData,
      });

      return task;
    } catch (error) {
      console.error("Failed to transform Apple Reminder to Task:", error, reminder);
      return null;
    }
  }

  /**
   * Check if this data source can handle a given task
   */
  canHandle(task: Task): boolean {
    return task.source.extension === this.id;
  }

  /**
   * Get the natural key for an Apple Reminders task
   */
  getNaturalKey(task: Task): string | null {
    return task.source.keys["apple-reminders"] || null;
  }
}
