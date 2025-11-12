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
import { getTaskStatusesFromTypeNote, getTaskPrioritiesFromTypeNote, getTaskCategoriesFromTypeNote } from "../../../utils/typeNoteHelpers";

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
      // Get the plugin's typeNote instance to access task note type configuration
      const plugin = (this.extension as any).plugin;
      const typeNote = plugin?.typeNote;

      // Get configured task statuses, priorities, and categories from note type
      const taskStatuses = typeNote ? getTaskStatusesFromTypeNote(typeNote) : [];
      const taskPriorities = typeNote ? getTaskPrioritiesFromTypeNote(typeNote) : [];
      const taskCategories = typeNote ? getTaskCategoriesFromTypeNote(typeNote) : [];

      // Find the "done" status from configured statuses
      const doneStatus = taskStatuses.find(s => s.isDone);
      const defaultStatus = taskStatuses[0];

      // Get default category (first one in the list)
      const defaultCategory = taskCategories.length > 0 ? taskCategories[0].name : "Task";

      // Map Apple Reminders priority (0-9) to configured task priority names
      // Priority mapping: 0=none, 1-3=low, 4-6=medium, 7-9=high
      let priorityName = "";
      if (reminder.priority > 0 && taskPriorities.length > 0) {
        if (reminder.priority >= 7) {
          // High priority (7-9)
          const highPriority = taskPriorities.find(p => p.name.toLowerCase() === "high" || p.name.toLowerCase() === "urgent");
          priorityName = highPriority?.name || "";
        } else if (reminder.priority >= 4) {
          // Medium priority (4-6)
          const mediumPriority = taskPriorities.find(p => p.name.toLowerCase() === "medium");
          priorityName = mediumPriority?.name || "";
        } else {
          // Low priority (1-3)
          const lowPriority = taskPriorities.find(p => p.name.toLowerCase() === "low");
          priorityName = lowPriority?.name || "";
        }
      }

      // Create task data
      const taskData = {
        title: reminder.title,
        description: reminder.notes,
        status: reminder.completed ? doneStatus.name : defaultStatus.name,
        done: reminder.completed,
        category: defaultCategory, // Use default category from note type configuration
        priority: priorityName,
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
