/**
 * Schedule Task Command
 * Schedules the current task as a calendar event
 */

import { Command, type CommandContext } from "../Command";
import {
  Notice,
  Setting,
  DropdownComponent,
  ToggleComponent,
  TextComponent,
  TextAreaComponent,
} from "obsidian";
import { taskStore } from "../../stores/taskStore";
import { CommandModal } from "../CommandModal";
import type { Task } from "../../types/entities";
import { Calendar } from "../../types/calendar";

export interface TaskScheduleData {
  targetCalendar: string;
  startDate: Date;
  endDate?: Date;
  allDay: boolean;
  location?: string;
  notes?: string;
  includeTaskDetails: boolean;
  reminders: number[];
}

class Modal extends CommandModal {
  private task: Task;
  private formData: Partial<TaskScheduleData> = {};
  private availableCalendars: Calendar[] = [];

  // UI Components
  private calendarDropdown: DropdownComponent;
  private startDateInput: TextComponent;
  private startTimeInput: TextComponent;
  private endDateInput: TextComponent;
  private endTimeInput: TextComponent;
  private allDayToggle: ToggleComponent;
  private locationInput: TextComponent;
  private notesEditor: TextAreaComponent;
  private includeTaskDetailsToggle: ToggleComponent;
  private remindersInput: TextComponent;

  constructor(command: ScheduleTaskCommand, task: Task) {
    super(command);
    this.task = task;
  }

  onOpen(): void {
    this.titleEl.setText(`Schedule Task: ${this.task.title}`);
    this.modalEl.addClass("task-sync-schedule-task");
    this.modalEl.addClass("task-sync-modal");
    this.initializeFormData();
    this.loadAvailableCalendars();
    this.createContent();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  protected createComponent(_container: HTMLElement): any {
    // This modal uses traditional Obsidian UI, not Svelte
    return null;
  }

  private initializeFormData(): void {
    const settings = this.getSettings().appleCalendarIntegration;
    const now = new Date();
    const defaultStart = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now

    // Defensive checks for settings
    const defaultEventDuration = settings?.defaultEventDuration || 60;
    const defaultEnd = new Date(
      defaultStart.getTime() + defaultEventDuration * 60 * 1000
    );

    // Ensure defaultReminders is an array
    const defaultReminders = Array.isArray(settings?.defaultReminders)
      ? settings.defaultReminders
      : [15];

    this.formData = {
      targetCalendar: settings?.defaultSchedulingCalendar || "",
      startDate: defaultStart,
      endDate: defaultEnd,
      allDay: false,
      location: "",
      notes: "",
      includeTaskDetails: settings?.includeTaskDetailsInEvent || true,
      reminders: [...defaultReminders],
    };
  }

  private async loadAvailableCalendars(): Promise<void> {
    try {
      const taskSchedulingService = (this.getTaskSyncPlugin() as any)
        .taskSchedulingService;
      if (taskSchedulingService) {
        this.availableCalendars =
          await taskSchedulingService.getAvailableCalendars();
      }
    } catch (error) {
      console.error("Failed to load calendars:", error);
      this.availableCalendars = [];
    }
  }

  private createContent(): void {
    const container = this.contentEl.createDiv("task-sync-modal-content");

    // Calendar selection
    new Setting(container)
      .setName("Calendar")
      .setDesc("Select the calendar to schedule this task in")
      .addDropdown((dropdown) => {
        this.calendarDropdown = dropdown;

        // Add calendars to dropdown
        this.availableCalendars.forEach((calendar) => {
          dropdown.addOption(calendar.id, calendar.name);
        });

        dropdown
          .setValue(this.formData.targetCalendar || "")
          .onChange((value) => {
            this.formData.targetCalendar = value;
          });
      });

    // All day toggle
    new Setting(container)
      .setName("All Day")
      .setDesc("Schedule as an all-day event")
      .addToggle((toggle) => {
        this.allDayToggle = toggle;
        toggle.setValue(this.formData.allDay || false).onChange((value) => {
          this.formData.allDay = value;
          this.updateTimeInputsVisibility();
        });
      });

    // Start date and time
    this.createDateTimeInputs(container);

    // Location
    new Setting(container)
      .setName("Location")
      .setDesc("Optional location for the event")
      .addText((text) => {
        this.locationInput = text;
        text
          .setPlaceholder("Enter location...")
          .setValue(this.formData.location || "")
          .onChange((value) => {
            this.formData.location = value;
          });
      });

    // Notes
    new Setting(container)
      .setName("Notes")
      .setDesc("Additional notes for the event")
      .addTextArea((text) => {
        this.notesEditor = text;
        text
          .setPlaceholder("Enter notes...")
          .setValue(this.formData.notes || "")
          .onChange((value) => {
            this.formData.notes = value;
          });
        text.inputEl.rows = 3;
      });

    // Include task details
    new Setting(container)
      .setName("Include Task Details")
      .setDesc("Include task description and metadata in the event")
      .addToggle((toggle) => {
        this.includeTaskDetailsToggle = toggle;
        toggle
          .setValue(this.formData.includeTaskDetails || true)
          .onChange((value) => {
            this.formData.includeTaskDetails = value;
          });
      });

    // Reminders
    new Setting(container)
      .setName("Reminders")
      .setDesc("Reminder times in minutes before event (comma-separated)")
      .addText((text) => {
        this.remindersInput = text;
        text
          .setPlaceholder("15, 60")
          .setValue((this.formData.reminders || []).join(", "))
          .onChange((value) => {
            try {
              const reminders = value
                .split(",")
                .map((s) => parseInt(s.trim()))
                .filter((n) => !isNaN(n) && n > 0);
              this.formData.reminders = reminders;
            } catch (error) {
              // Invalid input, ignore
            }
          });
      });

    // Action buttons
    this.createActionButtons(container);
  }

  private createDateTimeInputs(container: HTMLElement): void {
    // Start date
    new Setting(container)
      .setName("Start Date")
      .setDesc("Date when the event starts")
      .addText((text) => {
        this.startDateInput = text;
        text
          .setPlaceholder("YYYY-MM-DD")
          .setValue(this.formatDate(this.formData.startDate))
          .onChange((value) => {
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
              this.formData.startDate = date;
            }
          });
      });

    // Start time (hidden if all day)
    const startTimeSetting = new Setting(container)
      .setName("Start Time")
      .setDesc("Time when the event starts")
      .addText((text) => {
        this.startTimeInput = text;
        text
          .setPlaceholder("HH:MM")
          .setValue(this.formatTime(this.formData.startDate))
          .onChange((value) => {
            this.updateDateTime("start", value);
          });
      });

    // End date
    new Setting(container)
      .setName("End Date")
      .setDesc("Date when the event ends")
      .addText((text) => {
        this.endDateInput = text;
        text
          .setPlaceholder("YYYY-MM-DD")
          .setValue(this.formatDate(this.formData.endDate))
          .onChange((value) => {
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
              this.formData.endDate = date;
            }
          });
      });

    // End time (hidden if all day)
    const endTimeSetting = new Setting(container)
      .setName("End Time")
      .setDesc("Time when the event ends")
      .addText((text) => {
        this.endTimeInput = text;
        text
          .setPlaceholder("HH:MM")
          .setValue(this.formatTime(this.formData.endDate))
          .onChange((value) => {
            this.updateDateTime("end", value);
          });
      });

    // Store references for visibility toggling
    (startTimeSetting as any).timeInputSetting = true;
    (endTimeSetting as any).timeInputSetting = true;
  }

  private updateTimeInputsVisibility(): void {
    const timeSettings = this.contentEl.querySelectorAll(".setting-item");
    timeSettings.forEach((setting) => {
      if ((setting as any).timeInputSetting) {
        (setting as HTMLElement).style.display = this.formData.allDay
          ? "none"
          : "flex";
      }
    });
  }

  private createActionButtons(container: HTMLElement): void {
    const buttonContainer = container.createDiv("task-sync-modal-buttons");

    const cancelButton = buttonContainer.createEl("button", {
      text: "Cancel",
      cls: "task-sync-button-secondary",
    });

    const scheduleButton = buttonContainer.createEl("button", {
      text: "Schedule Task",
      cls: "task-sync-button-primary",
    });

    cancelButton.addEventListener("click", () => {
      this.close();
    });

    scheduleButton.addEventListener("click", () => {
      this.handleSubmit();
    });
  }

  private formatDate(date?: Date): string {
    if (!date) return "";
    return date.toISOString().split("T")[0];
  }

  private formatTime(date?: Date): string {
    if (!date) return "";
    return date.toTimeString().slice(0, 5);
  }

  private updateDateTime(type: "start" | "end", timeValue: string): void {
    const [hours, minutes] = timeValue.split(":").map(Number);
    if (isNaN(hours) || isNaN(minutes)) return;

    const targetDate =
      type === "start" ? this.formData.startDate : this.formData.endDate;
    if (!targetDate) return;

    const newDate = new Date(targetDate);
    newDate.setHours(hours, minutes);

    if (type === "start") {
      this.formData.startDate = newDate;
    } else {
      this.formData.endDate = newDate;
    }
  }

  private async handleSubmit(): Promise<void> {
    // Validate required fields
    if (!this.formData.targetCalendar) {
      new Notice("Please select a calendar");
      return;
    }

    if (!this.formData.startDate) {
      new Notice("Please specify a start date");
      return;
    }

    if (!this.formData.endDate) {
      new Notice("Please specify an end date");
      return;
    }

    if (this.formData.endDate <= this.formData.startDate) {
      new Notice("End date must be after start date");
      return;
    }

    try {
      await (this.command as ScheduleTaskCommand).handleSubmit(
        this.task,
        this.formData as TaskScheduleData
      );
      this.close();
    } catch (error) {
      console.error("Failed to schedule task:", error);
      new Notice("Failed to schedule task");
    }
  }
}

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
    const modal = new Modal(this, task);
    modal.open();
  }

  async handleSubmit(
    task: Task,
    scheduleData: TaskScheduleData
  ): Promise<void> {
    await this.scheduleTask(task, scheduleData);
  }

  /**
   * Schedule a task with the given configuration
   */
  private async scheduleTask(
    task: Task,
    scheduleData: TaskScheduleData
  ): Promise<void> {
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
