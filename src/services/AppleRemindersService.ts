/**
 * Apple Reminders Service
 * Handles integration with Apple Reminders on macOS using node-osascript
 */

import {
  ExternalTaskData,
  TaskImportConfig,
  ImportResult,
} from "../types/integrations";
import {
  AppleRemindersIntegrationSettings,
  TaskSyncSettings,
} from "../components/ui/settings/types";
import {
  AppleReminder,
  AppleRemindersList,
  AppleRemindersResult,
  AppleRemindersError,
  AppleRemindersPermission,
  AppleRemindersFilter,
} from "../types/apple-reminders";
import { TaskImportManager } from "./TaskImportManager";
import { taskStore } from "../stores/taskStore";
import * as osascript from "node-osascript";

export class AppleRemindersService {
  private settings: TaskSyncSettings;
  private taskImportManager?: TaskImportManager;

  constructor(settings: TaskSyncSettings) {
    this.settings = settings;
  }

  /**
   * Set import dependencies (called from main plugin)
   */
  setImportDependencies(taskImportManager: TaskImportManager): void {
    this.taskImportManager = taskImportManager;
  }

  /**
   * Update settings reference (for when settings are changed)
   */
  updateSettings(newSettings: TaskSyncSettings): void {
    this.settings = newSettings;
  }

  /**
   * Check if Apple Reminders integration is enabled and available
   */
  isEnabled(): boolean {
    return (
      this.settings.appleRemindersIntegration.enabled &&
      this.isPlatformSupported()
    );
  }

  /**
   * Check if the current platform supports Apple Reminders
   */
  isPlatformSupported(): boolean {
    return process.platform === "darwin";
  }

  /**
   * Execute AppleScript with timeout and error handling
   */
  private async executeAppleScript(
    script: string,
    variables: Record<string, any> = {}
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const childProcess = osascript.execute(
        script,
        variables,
        (err: any, res: any) => {
          if (err) {
            reject(err);
          } else {
            resolve(res);
          }
        }
      );

      // Add timeout to prevent hanging
      setTimeout(() => {
        childProcess.stdin?.pause();
        childProcess.kill();
        reject(new Error("AppleScript execution timed out"));
      }, 30000);
    });
  }

  /**
   * Check and request permissions for accessing Apple Reminders
   */
  async checkPermissions(): Promise<
    AppleRemindersResult<AppleRemindersPermission>
  > {
    if (!this.isPlatformSupported()) {
      throw new Error("Apple Reminders is only available on macOS");
    }

    try {
      // Try to access reminders to test permissions
      await this.executeAppleScript(
        'tell application "Reminders" to return name of lists'
      );

      return {
        success: true,
        data: AppleRemindersPermission.AUTHORIZED,
      };
    } catch (error: any) {
      throw new Error(`Permission denied: ${error.message || "Unknown error"}`);
    }
  }

  /**
   * Fetch all available reminder lists
   */
  async fetchReminderLists(): Promise<
    AppleRemindersResult<AppleRemindersList[]>
  > {
    const permissionCheck = await this.checkPermissions();
    if (!permissionCheck.success) {
      return {
        success: false,
        error: permissionCheck.error,
      };
    }

    try {
      const lists = await this.executeAppleScript(
        'tell application "Reminders" to return properties of lists'
      );

      const reminderLists: AppleRemindersList[] = (
        Array.isArray(lists) ? lists : []
      ).map((list: any) => ({
        id: list.id || list.name, // Use name as fallback ID
        name: list.name,
        color: list.color || "#007AFF", // Default blue color
        reminderCount: 0, // We'll get this separately if needed
      }));

      return {
        success: true,
        data: reminderLists,
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          type: AppleRemindersError.UNKNOWN,
          message: `Failed to fetch reminder lists: ${error.message}`,
          originalError: error,
        },
      };
    }
  }

  /**
   * Fetch reminders from specified lists or all lists
   */
  async fetchReminders(
    filter?: AppleRemindersFilter
  ): Promise<AppleRemindersResult<AppleReminder[]>> {
    const permissionCheck = await this.checkPermissions();
    if (!permissionCheck.success) {
      return {
        success: false,
        error: permissionCheck.error,
      };
    }

    try {
      const lists = await this.executeAppleScript(
        'tell application "Reminders" to return properties of lists'
      );
      const allReminders: AppleReminder[] = [];

      for (const list of Array.isArray(lists) ? lists : []) {
        // Skip lists not in filter if specified
        if (filter?.listNames && !filter.listNames.includes(list.name)) {
          continue;
        }

        // Skip lists not in settings if configured
        const configuredLists =
          this.settings.appleRemindersIntegration.reminderLists;
        if (
          configuredLists.length > 0 &&
          !configuredLists.includes(list.name)
        ) {
          continue;
        }

        // Get reminders from this list
        const reminders = await this.executeAppleScript(
          `tell list list_name in application "Reminders"
            set buffer to ((current date) - hours * 1)
            return properties of reminders whose completion date comes after buffer or completed is false
          end tell`,
          { list_name: list.name }
        );

        for (const reminder of Array.isArray(reminders) ? reminders : []) {
          // Apply filters
          if (!this.shouldIncludeReminder(reminder, filter)) {
            continue;
          }

          const appleReminder: AppleReminder =
            this.transformAppleScriptReminderToAppleReminder(reminder, list);
          allReminders.push(appleReminder);
        }
      }

      return {
        success: true,
        data: allReminders,
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          type: AppleRemindersError.UNKNOWN,
          message: `Failed to fetch reminders: ${error.message}`,
          originalError: error,
        },
      };
    }
  }

  /**
   * Import Apple Reminder as Obsidian task
   */
  async importReminderAsTask(
    reminder: AppleReminder,
    config: TaskImportConfig
  ): Promise<ImportResult> {
    if (!this.taskImportManager) {
      const error =
        "Import dependencies not initialized. Call setImportDependencies() first.";
      throw new Error(error);
    }

    try {
      const taskData = this.transformReminderToTaskData(reminder);

      // Check if task is already imported using task store
      if (taskStore.isTaskImported(taskData.sourceType, taskData.id)) {
        return {
          success: true,
          skipped: true,
          reason: "Task already imported",
        };
      }

      // Enhance config with reminder-specific settings
      const enhancedConfig = this.enhanceConfigWithReminderData(
        reminder,
        config
      );

      // Create the task
      const taskPath = await this.taskImportManager.createTaskFromData(
        taskData,
        enhancedConfig
      );

      // Task store will automatically pick up the new task via file watchers
      return {
        success: true,
        taskPath,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Transform Apple Reminder to ExternalTaskData format
   */
  private transformReminderToTaskData(
    reminder: AppleReminder
  ): ExternalTaskData {
    return {
      id: reminder.id,
      title: reminder.title,
      description: reminder.notes || undefined,
      status: reminder.completed ? "completed" : "open",
      priority: this.mapReminderPriorityToTaskPriority(reminder.priority),
      assignee: undefined, // Apple Reminders doesn't have assignees
      labels: [reminder.list.name], // Use list name as a label
      createdAt: reminder.creationDate,
      updatedAt: reminder.modificationDate,
      externalUrl: reminder.url || `reminder://${reminder.id}`,
      sourceType: "apple-reminders",
      sourceData: reminder,
    };
  }

  /**
   * Transform AppleScript reminder data to AppleReminder format
   */
  private transformAppleScriptReminderToAppleReminder(
    scriptReminder: any,
    list: any
  ): AppleReminder {
    return {
      id: scriptReminder.id || scriptReminder.name,
      title: scriptReminder.name,
      notes: scriptReminder.body || "",
      completed: scriptReminder.completed || false,
      completionDate: scriptReminder.completionDate
        ? new Date(scriptReminder.completionDate)
        : undefined,
      creationDate: scriptReminder.creationDate
        ? new Date(scriptReminder.creationDate)
        : new Date(),
      modificationDate: scriptReminder.modificationDate
        ? new Date(scriptReminder.modificationDate)
        : new Date(),
      dueDate: scriptReminder.dueDate
        ? new Date(scriptReminder.dueDate)
        : undefined,
      priority: scriptReminder.priority || 0,
      list: {
        id: list.id || list.name,
        name: list.name,
        color: list.color || "#007AFF",
      },
      allDay: scriptReminder.allDay || false,
      url: `reminder://${scriptReminder.id || scriptReminder.name}`,
    };
  }

  /**
   * Check if a reminder should be included based on filters
   */
  private shouldIncludeReminder(
    reminder: any,
    filter?: AppleRemindersFilter
  ): boolean {
    // Check completion status
    if (filter?.includeCompleted === false && reminder.completed) {
      return false;
    }

    if (
      !filter?.includeCompleted &&
      !this.settings.appleRemindersIntegration.includeCompletedReminders &&
      reminder.completed
    ) {
      return false;
    }

    // Check all-day reminders
    if (filter?.excludeAllDay && reminder.allDay) {
      return false;
    }

    if (
      this.settings.appleRemindersIntegration.excludeAllDayReminders &&
      reminder.allDay
    ) {
      return false;
    }

    // Check priority range
    if (filter?.priorityRange) {
      const priority = reminder.priority || 0;
      if (
        filter.priorityRange.min !== undefined &&
        priority < filter.priorityRange.min
      ) {
        return false;
      }
      if (
        filter.priorityRange.max !== undefined &&
        priority > filter.priorityRange.max
      ) {
        return false;
      }
    }

    // Check due date range
    if (filter?.dueDateRange && reminder.dueDate) {
      const dueDate = new Date(reminder.dueDate);
      if (filter.dueDateRange.start && dueDate < filter.dueDateRange.start) {
        return false;
      }
      if (filter.dueDateRange.end && dueDate > filter.dueDateRange.end) {
        return false;
      }
    }

    return true;
  }

  /**
   * Map Apple Reminders priority (0-9) to task priority string
   */
  private mapReminderPriorityToTaskPriority(priority: number): string {
    if (priority === 0) return "Low";
    if (priority <= 3) return "Low";
    if (priority <= 6) return "Medium";
    if (priority <= 8) return "High";
    return "Urgent";
  }

  /**
   * Enhance import config with reminder-specific data
   */
  private enhanceConfigWithReminderData(
    reminder: AppleReminder,
    config: TaskImportConfig
  ): TaskImportConfig {
    return {
      ...config,
      taskType:
        config.taskType ||
        this.settings.appleRemindersIntegration.defaultTaskType ||
        "Task",
    };
  }
}
