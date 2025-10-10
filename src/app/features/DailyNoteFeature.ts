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

  constructor(
    private app: App,
    private plugin: Plugin,
    private settings: DailyNoteFeatureSettings
  ) {
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
      await this.updateDailyNoteFromSchedule(event.schedule);
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
   * Add a task link to today's daily note and set the Do Date property
   */
  async addTaskToToday(taskPath: string): Promise<AddTaskResult> {
    try {
      // Ensure today's daily note exists
      const dailyNoteResult = await this.ensureTodayDailyNote();

      // Get the task file to extract the title
      const taskFile = this.app.vault.getAbstractFileByPath(taskPath);
      if (!taskFile || !(taskFile instanceof TFile)) {
        return {
          success: false,
          dailyNotePath: dailyNoteResult.path,
          error: "Task file not found",
        };
      }

      // Read the task file to get the title from front-matter
      const taskContent = await this.app.vault.read(taskFile);
      const frontMatterMatch = taskContent.match(/^---\n([\s\S]*?)\n---/);
      let taskTitle = taskFile.basename; // fallback to filename

      if (frontMatterMatch) {
        const frontMatter = frontMatterMatch[1];
        const titleMatch = frontMatter.match(/^Title:\s*(.+)$/m);
        if (titleMatch) {
          taskTitle = titleMatch[1].trim();
        }
      }

      // Read the daily note content
      const dailyNoteContent = await this.app.vault.read(dailyNoteResult.file!);

      // Check if the task is already linked in the daily note
      const taskLink = `[[${taskFile.path}|${taskTitle}]]`;
      if (!dailyNoteContent.includes(taskLink)) {
        // Add the task link under "Today's Tasks" section
        const todaysTasksRegex = /## Today's Tasks\n/;
        if (todaysTasksRegex.test(dailyNoteContent)) {
          const updatedContent = dailyNoteContent.replace(
            todaysTasksRegex,
            `## Today's Tasks\n- ${taskLink}\n`
          );
          await this.app.vault.modify(dailyNoteResult.file!, updatedContent);
        } else {
          // If no "Today's Tasks" section, append at the end
          const updatedContent = dailyNoteContent + `\n- ${taskLink}\n`;
          await this.app.vault.modify(dailyNoteResult.file!, updatedContent);
        }
      }

      // Set the Do Date property in the task's front-matter to today's date
      const today = this.getDateString(new Date()); // YYYY-MM-DD format

      await this.app.fileManager.processFrontMatter(taskFile, (frontmatter) => {
        // Only set Do Date if it's not already set or if it's different from today
        if (!frontmatter["Do Date"] || frontmatter["Do Date"] !== today) {
          frontmatter["Do Date"] = today;
        }
      });

      return {
        success: true,
        dailyNotePath: dailyNoteResult.path,
      };
    } catch (error: any) {
      return {
        success: false,
        dailyNotePath: "",
        error: error.message,
      };
    }
  }

  /**
   * Update daily note from schedule (merges with existing tasks, doesn't replace)
   */
  private async updateDailyNoteFromSchedule(schedule: Schedule): Promise<void> {
    try {
      // Only update daily note if schedule is planned
      if (!schedule.isPlanned) {
        return;
      }

      // Check if this is today's schedule
      const today = new Date();
      const scheduleDate = new Date(schedule.date);
      const isToday =
        this.getDateString(today) === this.getDateString(scheduleDate);

      if (!isToday) {
        return; // Only update today's daily note
      }

      // Ensure today's daily note exists
      const dailyNoteResult = await this.ensureTodayDailyNote();

      // Read current daily note content
      const currentContent = await this.app.vault.read(dailyNoteResult.file!);

      // Extract existing task links from the Daily Note
      const existingTaskPaths = new Set<string>();
      const tasksSection = currentContent.match(
        /## Today's Tasks\n([\s\S]*?)(?=\n## |$)/
      );
      if (tasksSection) {
        const taskLinkRegex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
        let match;
        while ((match = taskLinkRegex.exec(tasksSection[1])) !== null) {
          existingTaskPaths.add(match[1]);
        }
      }

      // Generate task links for all tasks in the schedule
      const taskLinks: string[] = [];
      const scheduledTaskPaths = new Set<string>();

      for (const task of schedule.tasks) {
        if (task.source?.filePath) {
          scheduledTaskPaths.add(task.source.filePath);

          // Skip if task is already in the Daily Note
          if (existingTaskPaths.has(task.source.filePath)) {
            continue;
          }

          // Get the task file to extract the title
          const taskFile = this.app.vault.getAbstractFileByPath(
            task.source.filePath
          );
          if (taskFile instanceof TFile) {
            // Read the task file to get the title from front-matter
            const taskContent = await this.app.vault.read(taskFile);
            const frontMatterMatch = taskContent.match(/^---\n([\s\S]*?)\n---/);
            let taskTitle = taskFile.basename; // fallback to filename

            if (frontMatterMatch) {
              const frontMatter = frontMatterMatch[1];
              const titleMatch = frontMatter.match(/^Title:\s*(.+)$/m);
              if (titleMatch) {
                taskTitle = titleMatch[1].trim();
              }
            }

            const taskLink = `- [ ] [[${taskFile.path}|${taskTitle}]]`;
            taskLinks.push(taskLink);
          }
        }
      }

      // Only update if we have new tasks to add
      if (taskLinks.length === 0) {
        return;
      }

      // Merge new tasks with existing Daily Note content
      let updatedContent = currentContent;

      if (currentContent.includes("## Today's Tasks")) {
        // Add new tasks to existing Tasks section
        const tasksRegex = /(## Today's Tasks\n)/;
        const newTasksToAdd = taskLinks.join("\n") + "\n";
        updatedContent = currentContent.replace(
          tasksRegex,
          `$1${newTasksToAdd}`
        );
      } else {
        // Add Tasks section if it doesn't exist
        const newTasksSection = `\n## Today's Tasks\n${taskLinks.join("\n")}\n`;
        updatedContent = currentContent + newTasksSection;
      }

      // Only update if content changed
      if (updatedContent !== currentContent) {
        await this.app.vault.modify(dailyNoteResult.file!, updatedContent);
        console.log(
          `Added ${taskLinks.length} new tasks to daily note (${existingTaskPaths.size} tasks already present)`
        );
      }
    } catch (error) {
      console.error("Failed to update daily note from schedule:", error);
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
