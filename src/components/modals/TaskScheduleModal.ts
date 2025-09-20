/**
 * TaskScheduleModal - Modal for scheduling a task as a calendar event
 */

import {
  App,
  Modal,
  TextAreaComponent,
  TextComponent,
  Setting,
  DropdownComponent,
  ToggleComponent,
  Notice,
} from "obsidian";
import { Task } from "../../types/entities";
import { TaskSchedulingConfig } from "../../types/scheduling";
import { Calendar } from "../../types/calendar";
import { getDateString } from "../../utils/dateFiltering";
import TaskSyncPlugin from "../../main";

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

export class TaskScheduleModal extends Modal {
  private plugin: TaskSyncPlugin;
  private task: Task;
  private onSubmitCallback?: (scheduleData: TaskScheduleData) => Promise<void>;
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

  constructor(app: App, plugin: TaskSyncPlugin, task: Task) {
    super(app);
    this.plugin = plugin;
    this.task = task;
    this.modalEl.addClass("task-sync-schedule-task");
    this.modalEl.addClass("task-sync-modal");
  }

  onOpen(): void {
    this.titleEl.setText(`Schedule Task: ${this.task.title}`);
    this.initializeFormData();
    this.loadAvailableCalendars();
    this.createContent();
  }

  private initializeFormData(): void {
    const settings = this.plugin.settings.appleCalendarIntegration;
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
      if (this.plugin.taskSchedulingService) {
        this.availableCalendars =
          await this.plugin.taskSchedulingService.getAvailableCalendars();
      }
    } catch (error) {
      console.error("Failed to load available calendars:", error);
      new Notice("Failed to load available calendars");
    }
  }

  private createContent(): void {
    const { contentEl } = this;
    contentEl.empty();

    // Calendar selection
    new Setting(contentEl)
      .setName("Calendar")
      .setDesc("Select the calendar to create the event in")
      .addDropdown((dropdown) => {
        this.calendarDropdown = dropdown;

        // Add available calendars
        for (const calendar of this.availableCalendars) {
          dropdown.addOption(calendar.name, calendar.name);
        }

        dropdown
          .setValue(this.formData.targetCalendar || "")
          .onChange((value) => {
            this.formData.targetCalendar = value;
          });
      });

    // All-day toggle
    new Setting(contentEl)
      .setName("All Day")
      .setDesc("Create an all-day event")
      .addToggle((toggle) => {
        this.allDayToggle = toggle;
        toggle.setValue(this.formData.allDay || false).onChange((value) => {
          this.formData.allDay = value;
          this.updateTimeInputsVisibility();
        });
      });

    // Start date
    new Setting(contentEl)
      .setName("Start Date")
      .setDesc("Event start date")
      .addText((text) => {
        this.startDateInput = text;
        text
          .setPlaceholder("YYYY-MM-DD")
          .setValue(this.formatDate(this.formData.startDate!))
          .onChange((value) => {
            const date = this.parseDate(value);
            if (date) {
              this.formData.startDate = date;
              this.updateEndDate();
            }
          });
      });

    // Start time (hidden for all-day events)
    new Setting(contentEl)
      .setName("Start Time")
      .setDesc("Event start time")
      .addText((text) => {
        this.startTimeInput = text;
        text
          .setPlaceholder("HH:MM")
          .setValue(this.formatTime(this.formData.startDate!))
          .onChange((value) => {
            this.updateStartDateTime(value);
          });
      });

    // End date
    new Setting(contentEl)
      .setName("End Date")
      .setDesc("Event end date")
      .addText((text) => {
        this.endDateInput = text;
        text
          .setPlaceholder("YYYY-MM-DD")
          .setValue(this.formatDate(this.formData.endDate!))
          .onChange((value) => {
            const date = this.parseDate(value);
            if (date) {
              this.formData.endDate = date;
            }
          });
      });

    // End time (hidden for all-day events)
    new Setting(contentEl)
      .setName("End Time")
      .setDesc("Event end time")
      .addText((text) => {
        this.endTimeInput = text;
        text
          .setPlaceholder("HH:MM")
          .setValue(this.formatTime(this.formData.endDate!))
          .onChange((value) => {
            this.updateEndDateTime(value);
          });
      });

    // Location
    new Setting(contentEl)
      .setName("Location")
      .setDesc("Event location (optional)")
      .addText((text) => {
        this.locationInput = text;
        text
          .setPlaceholder("Meeting room, address, etc.")
          .setValue(this.formData.location || "")
          .onChange((value) => {
            this.formData.location = value;
          });
      });

    // Notes
    new Setting(contentEl)
      .setName("Notes")
      .setDesc("Additional notes for the event")
      .addTextArea((textarea) => {
        this.notesEditor = textarea;
        textarea
          .setPlaceholder("Event description...")
          .setValue(this.formData.notes || "")
          .onChange((value) => {
            this.formData.notes = value;
          });
        textarea.inputEl.rows = 3;
      });

    // Include task details
    new Setting(contentEl)
      .setName("Include Task Details")
      .setDesc("Include task information in the event description")
      .addToggle((toggle) => {
        this.includeTaskDetailsToggle = toggle;
        toggle
          .setValue(this.formData.includeTaskDetails || false)
          .onChange((value) => {
            this.formData.includeTaskDetails = value;
          });
      });

    // Reminders
    new Setting(contentEl)
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
    const buttonContainer = contentEl.createDiv("task-sync-modal-buttons");

    const cancelButton = buttonContainer.createEl("button", {
      text: "Cancel",
      cls: "task-sync-button-secondary",
    });
    cancelButton.onclick = () => this.close();

    const scheduleButton = buttonContainer.createEl("button", {
      text: "Schedule Task",
      cls: "task-sync-button-primary",
    });
    scheduleButton.onclick = () => this.handleSubmit();

    this.updateTimeInputsVisibility();
  }

  private updateTimeInputsVisibility(): void {
    const isAllDay = this.formData.allDay;

    if (this.startTimeInput) {
      const settingItem = this.startTimeInput.inputEl.closest(
        ".setting-item"
      ) as HTMLElement;
      if (settingItem) {
        settingItem.style.display = isAllDay ? "none" : "flex";
      }
    }

    if (this.endTimeInput) {
      const settingItem = this.endTimeInput.inputEl.closest(
        ".setting-item"
      ) as HTMLElement;
      if (settingItem) {
        settingItem.style.display = isAllDay ? "none" : "flex";
      }
    }
  }

  private formatDate(date: Date): string {
    return getDateString(date);
  }

  private formatTime(date: Date): string {
    return date.toTimeString().slice(0, 5);
  }

  private parseDate(dateStr: string): Date | null {
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
  }

  private updateStartDateTime(timeStr: string): void {
    if (!this.formData.startDate) return;

    const [hours, minutes] = timeStr.split(":").map((n) => parseInt(n));
    if (isNaN(hours) || isNaN(minutes)) return;

    const newDate = new Date(this.formData.startDate);
    newDate.setHours(hours, minutes, 0, 0);
    this.formData.startDate = newDate;

    this.updateEndDate();
  }

  private updateEndDateTime(timeStr: string): void {
    if (!this.formData.endDate) return;

    const [hours, minutes] = timeStr.split(":").map((n) => parseInt(n));
    if (isNaN(hours) || isNaN(minutes)) return;

    const newDate = new Date(this.formData.endDate);
    newDate.setHours(hours, minutes, 0, 0);
    this.formData.endDate = newDate;
  }

  private updateEndDate(): void {
    if (!this.formData.startDate) return;

    const duration =
      this.plugin.settings.appleCalendarIntegration?.defaultEventDuration || 60;
    this.formData.endDate = new Date(
      this.formData.startDate.getTime() + duration * 60 * 1000
    );

    if (this.endDateInput) {
      this.endDateInput.setValue(this.formatDate(this.formData.endDate));
    }

    if (this.endTimeInput && !this.formData.allDay) {
      this.endTimeInput.setValue(this.formatTime(this.formData.endDate));
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
      if (this.onSubmitCallback) {
        await this.onSubmitCallback(this.formData as TaskScheduleData);
      }
      this.close();
    } catch (error) {
      console.error("Failed to schedule task:", error);
      new Notice("Failed to schedule task");
    }
  }

  onSubmit(callback: (scheduleData: TaskScheduleData) => Promise<void>): void {
    this.onSubmitCallback = callback;
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
