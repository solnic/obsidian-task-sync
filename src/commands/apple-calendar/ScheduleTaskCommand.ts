/**
 * Schedule Task Command
 * Schedules the current task as a calendar event
 */

import { Command, type CommandContext } from "../Command";
import { Notice } from "obsidian";
import { TaskScheduleModal } from "../../components/modals/TaskScheduleModal";
import { taskStore } from "../../stores/taskStore";

export class ScheduleTaskCommand extends Command {
  constructor(context: CommandContext) {
    super(context);
  }

  getId(): string {
    return "schedule-task";
  }

  getName(): string {
    return "Schedule Task";
  }

  isAvailable(): boolean {
    return this.settings.appleCalendarIntegration.schedulingEnabled;
  }

  async execute(): Promise<void> {
    const taskSchedulingService = (this.plugin as any).taskSchedulingService;
    if (!taskSchedulingService.isEnabled()) {
      new Notice(
        "Task scheduling is not enabled. Please configure it in settings."
      );
      return;
    }

    // Get the current file and check if it's a task
    const activeFile = this.plugin.app.workspace.getActiveFile();
    if (!activeFile) {
      new Notice("No active file. Please open a task file to schedule.");
      return;
    }

    // Check if the current file is a task
    const task = taskStore.findEntityByPath(activeFile.path);
    if (!task) {
      new Notice(
        "Current file is not a task. Please open a task file to schedule."
      );
      return;
    }

    // Check if task is already scheduled
    const isScheduled = await taskSchedulingService.isTaskScheduled(
      task.filePath || ""
    );
    if (isScheduled) {
      new Notice("This task is already scheduled.");
      return;
    }

    // Open the scheduling modal
    const modal = new TaskScheduleModal(this.plugin.app, this.plugin as any, task);

    modal.onSubmit(async (scheduleData) => {
      await this.scheduleTask(task, scheduleData);
    });

    modal.open();
  }

  /**
   * Schedule a task with the given configuration
   */
  private async scheduleTask(task: any, scheduleData: any): Promise<void> {
    try {
      new Notice("Scheduling task...");

      const config = {
        targetCalendar: scheduleData.targetCalendar,
        startDate: scheduleData.startDate,
        endDate: scheduleData.endDate,
        allDay: scheduleData.allDay,
        location: scheduleData.location,
        notes: scheduleData.notes,
        includeTaskDetails: scheduleData.includeTaskDetails,
        reminders: scheduleData.reminders,
      };

      const taskSchedulingService = (this.plugin as any).taskSchedulingService;
      const result = await taskSchedulingService.scheduleTask(task, config);

      if (result.success) {
        new Notice(
          `✅ Task scheduled successfully in ${scheduleData.targetCalendar}`
        );

        // Optionally refresh any open calendar views
        // This could be extended to refresh calendar views if needed
      } else {
        new Notice(`❌ Failed to schedule task: ${result.error}`);
      }
    } catch (error: any) {
      console.error("Failed to schedule task:", error);
      new Notice(`❌ Failed to schedule task: ${error.message}`);
    }
  }
}
