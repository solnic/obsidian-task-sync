/**
 * Daily Note Feature
 * Manages daily note operations including creation and task linking
 * Integrated as a feature of the ObsidianExtension
 */

import { App, TFile } from "obsidian";
import { eventBus, type DomainEvent } from "../../../core/events";
import type { Schedule, Task } from "../../../core/entities";
import { TaskSyncSettings } from "../../../types/settings";
import {
  discoverDailyNoteSettings,
  getDailyNotePath,
} from "../../../utils/dailyNoteDiscovery";
import { InlineTaskParser } from "../services/InlineTaskParser";
import { InlineTaskEditor } from "../services/InlineTaskEditor";

export interface DailyNoteFeatureSettings {
  dailyNotesFolder: string;
}

export interface DailyNoteResult {
  path: string;
  created: boolean;
  file?: TFile;
}

export interface AddTaskResult {
  success: boolean;
  dailyNotePath: string;
  error?: string;
}

export class DailyNoteFeature {
  private unsubscribeFunctions: (() => void)[] = [];
  private inlineTaskParser: InlineTaskParser;
  private inlineTaskEditor: InlineTaskEditor;

  constructor(
    private app: App,
    private pluginSettings: TaskSyncSettings,
    private settings: DailyNoteFeatureSettings
  ) {
    const tasksFolder = this.pluginSettings.tasksFolder;

    this.inlineTaskParser = new InlineTaskParser(app, tasksFolder);
    this.inlineTaskEditor = new InlineTaskEditor(tasksFolder);

    this.setupEventListeners();
  }

  /**
   * Set up event listeners for schedule events only
   */
  private setupEventListeners(): void {
    this.unsubscribeFunctions.push(
      eventBus.on("schedules.created", this.handleScheduleCreated.bind(this))
    );
    this.unsubscribeFunctions.push(
      eventBus.on("schedules.updated", this.handleScheduleUpdated.bind(this))
    );
  }

  /**
   * Handle schedule created event
   */
  private async handleScheduleCreated(event: DomainEvent): Promise<void> {
    if (event.type === "schedules.created") {
      // Only update Daily Note if the schedule is marked as planned
      // This prevents writing to Daily Note when schedule is just being initialized
      if (event.schedule.isPlanned) {
        console.log(
          "DailyNoteFeature: Handling schedule created event, updating daily note..."
        );
        await this.updateDailyNoteFromSchedule(event.schedule);
      }
    }
  }

  /**
   * Handle schedule updated event
   */
  private async handleScheduleUpdated(event: DomainEvent): Promise<void> {
    if (event.type === "schedules.updated") {
      // Only update Daily Note if the schedule is marked as planned
      // This prevents writing to Daily Note when we're just syncing FROM it
      if (event.schedule.isPlanned) {
        console.log(
          "DailyNoteFeature: Handling schedule updated event, updating daily note..."
        );
        await this.updateDailyNoteFromSchedule(event.schedule);
      }
    }
  }

  /**
   * Get date string in YYYY-MM-DD format
   */
  private getDateString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  /**
   * Get the path for today's daily note
   */
  async getTodayDailyNotePath(): Promise<string> {
    const today = new Date();

    // Use discovery utility to get the correct path based on Obsidian plugin settings
    const discoveredPath = getDailyNotePath(
      this.app,
      today,
      this.settings.dailyNotesFolder
    );

    // First, check if a daily note exists at the discovered path
    const expectedFile = this.app.vault.getAbstractFileByPath(discoveredPath);
    if (expectedFile instanceof TFile) {
      return discoveredPath;
    }

    // Second, try to find an existing daily note with today's date anywhere in the vault
    const dateString = this.getDateString(today);
    const allFiles = this.app.vault.getMarkdownFiles();
    const existingDailyNotes = allFiles.filter((file) => {
      const fileName = file.name.replace(/\.md$/, "");
      return fileName === dateString;
    });

    if (existingDailyNotes.length > 0) {
      // If multiple daily notes exist, prefer the one in the discovered folder
      const settings = discoverDailyNoteSettings(
        this.app,
        this.settings.dailyNotesFolder
      );
      const preferredFolder =
        settings.folder || this.settings.dailyNotesFolder || "Daily Notes";

      const preferredNote = existingDailyNotes.find((file) =>
        file.path.startsWith(preferredFolder + "/")
      );

      const selectedNote = preferredNote || existingDailyNotes[0];
      return selectedNote.path;
    }

    // If no existing daily note found, return the discovered path for creation
    return discoveredPath;
  }

  /**
   * Ensure today's daily note exists, creating it if necessary
   */
  async ensureTodayDailyNote(): Promise<DailyNoteResult> {
    const dailyNotePath = await this.getTodayDailyNotePath();

    // Check if the daily note already exists
    const existingFile = this.app.vault.getAbstractFileByPath(dailyNotePath);

    if (existingFile instanceof TFile) {
      return {
        path: dailyNotePath,
        created: false,
        file: existingFile,
      };
    }

    // Ensure the daily notes folder exists (use discovered settings)
    const settings = discoverDailyNoteSettings(
      this.app,
      this.settings.dailyNotesFolder
    );
    const dailyNotesFolder = settings.folder || this.settings.dailyNotesFolder;

    if (dailyNotesFolder) {
      const folderExists = await this.app.vault.adapter.exists(
        dailyNotesFolder
      );
      if (!folderExists) {
        await this.app.vault.createFolder(dailyNotesFolder);
      }
    }

    // Create the daily note as an empty file
    // Obsidian's template system will handle content when the user opens the note
    const file = await this.app.vault.create(dailyNotePath, "");

    return {
      path: dailyNotePath,
      created: true,
      file: file,
    };
  }

  /**
   * Update daily note from schedule (idempotent - adds missing tasks and removes unscheduled ones)
   */
  private async updateDailyNoteFromSchedule(schedule: Schedule): Promise<void> {
    // Only update daily note if schedule is planned
    if (!schedule.isPlanned) {
      throw "Schedule is not planned";
    }

    // Check if this is today's schedule
    const today = new Date();
    const scheduleDate = new Date(schedule.date);
    const isToday =
      this.getDateString(today) === this.getDateString(scheduleDate);

    if (!isToday) {
      throw "Schedule is not for today";
    }

    // Ensure today's daily note exists
    const dailyNoteResult = await this.ensureTodayDailyNote();

    // Extract existing task paths from the Daily Note using InlineTaskParser
    const existingTaskPathsArray = await this.inlineTaskParser.getTaskFilePaths(
      dailyNoteResult.file!
    );
    const existingTaskPaths = new Set(existingTaskPathsArray);

    // Read current daily note content for modification
    let currentContent = await this.app.vault.read(dailyNoteResult.file!);

    // Build set of scheduled task paths for quick lookup
    const scheduledTaskPaths = new Set(
      schedule.tasks.map((task) => task.source.keys.obsidian!)
    );

    // Find tasks to remove (in daily note but not in schedule)
    const tasksToRemove: string[] = [];
    for (const existingPath of existingTaskPaths) {
      if (!scheduledTaskPaths.has(existingPath)) {
        tasksToRemove.push(existingPath);
      }
    }

    // Remove unscheduled tasks from daily note using InlineTaskEditor
    if (tasksToRemove.length > 0) {
      currentContent = this.inlineTaskEditor.removeTasks(
        currentContent,
        tasksToRemove
      );
    }

    // Find tasks to add (in schedule but not in daily note)
    let tasksToAdd: Task[] = [];
    for (const task of schedule.tasks) {
      if (!existingTaskPaths.has(task.source.keys.obsidian!)) {
        tasksToAdd.push(task);
      }
    }

    // Add new tasks to daily note using InlineTaskEditor
    if (tasksToAdd.length > 0) {
      currentContent = this.inlineTaskEditor.addTasks(
        currentContent,
        tasksToAdd,
        { section: "Tasks" }
      );
    }

    // Only update if content actually changed
    const originalContent = await this.app.vault.read(dailyNoteResult.file!);
    if (currentContent !== originalContent) {
      await this.app.vault.modify(dailyNoteResult.file!, currentContent);
      console.log(
        `Updated daily note: removed ${tasksToRemove.length} tasks, added ${tasksToAdd.length} tasks`
      );
    }
  }

  /**
   * Cleanup method to remove event listeners
   */
  cleanup(): void {
    this.unsubscribeFunctions.forEach((unsubscribe) => unsubscribe());
    this.unsubscribeFunctions = [];
  }
}
