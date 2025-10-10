/**
 * Daily Note Feature
 * Manages daily note operations including creation and task linking
 * Integrated as a feature of the ObsidianExtension
 */

import { App, Plugin, TFile } from "obsidian";
import { eventBus, type DomainEvent } from "../core/events";
import type { Schedule, Task } from "../core/entities";
import {
  discoverDailyNoteSettings,
  getDailyNotePath,
} from "../utils/dailyNoteDiscovery";
import { DailyNoteParser } from "../services/DailyNoteParser";

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
  private dailyNoteParser: DailyNoteParser;

  constructor(
    private app: App,
    private plugin: Plugin,
    private settings: DailyNoteFeatureSettings
  ) {
    this.dailyNoteParser = new DailyNoteParser(app);
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
   * Generate content for a new daily note
   */
  private generateDailyNoteContent(): string {
    const today = new Date();
    const dateString = this.getDateString(today);

    return `# ${dateString}

## Today's Tasks

## Notes

## Reflections
`;
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
    const dailyNotesFolder =
      settings.folder || this.settings.dailyNotesFolder || "Daily Notes";

    if (dailyNotesFolder) {
      const folderExists = await this.app.vault.adapter.exists(
        dailyNotesFolder
      );
      if (!folderExists) {
        await this.app.vault.createFolder(dailyNotesFolder);
      }
    }

    // Create the daily note
    const content = this.generateDailyNoteContent();
    const file = await this.app.vault.create(dailyNotePath, content);

    return {
      path: dailyNotePath,
      created: true,
      file: file,
    };
  }

  /**
   * Update daily note from schedule (idempotent - only adds missing tasks)
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

    // Extract existing task links from the Daily Note using DailyNoteParser
    const existingTaskPaths = await this.extractTaskPathsFromDailyNote(
      dailyNoteResult.file!
    );

    // Read current daily note content for modification
    const currentContent = await this.app.vault.read(dailyNoteResult.file!);

    let tasksToAdd: Task[] = [];

    for (const task of schedule.tasks) {
      if (existingTaskPaths.has(task.source.filePath!)) {
        continue;
      }
      tasksToAdd.push(task);
    }

    // Early return if no new tasks to add (idempotent behavior)
    if (tasksToAdd.length === 0) {
      return;
    }

    // Generate task links for new tasks
    const taskLinks = tasksToAdd.map(
      (task) => `- [ ] [[${task.source.filePath}|${task.title}]]`
    );

    // Merge new tasks with existing Daily Note content
    const updatedContent = this.insertTasksIntoContent(
      currentContent,
      taskLinks
    );

    // Only update if content actually changed
    if (updatedContent !== currentContent) {
      await this.app.vault.modify(dailyNoteResult.file!, updatedContent);
      console.log(
        `Added ${taskLinks.length} new tasks to daily note (${existingTaskPaths.size} tasks already present)`
      );
    }
  }

  /**
   * Extract task file paths from daily note using DailyNoteParser
   */
  private async extractTaskPathsFromDailyNote(
    dailyNoteFile: TFile
  ): Promise<Set<string>> {
    const taskLinks = await this.dailyNoteParser.parseTaskLinks(
      dailyNoteFile,
      "Tasks"
    );
    return new Set(
      taskLinks
        .map((link) => link.filePath)
        .filter((path) => path !== undefined) as string[]
    );
  }

  /**
   * Insert task links into daily note content
   */
  private insertTasksIntoContent(content: string, taskLinks: string[]): string {
    if (content.includes("## Today's Tasks")) {
      // Add new tasks to existing Tasks section
      const tasksRegex = /(## Today's Tasks\n)/;
      const newTasksToAdd = taskLinks.join("\n") + "\n";
      return content.replace(tasksRegex, `$1${newTasksToAdd}`);
    } else {
      // Add Tasks section if it doesn't exist
      const newTasksSection = `\n## Today's Tasks\n${taskLinks.join("\n")}\n`;
      return content + newTasksSection;
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
