/**
 * Daily Note Extension
 * Manages daily note operations including creation and task linking
 * Listens to schedule events to automatically update daily notes
 */

import { App, Plugin, TFile } from "obsidian";
import { Extension, extensionRegistry, EntityType } from "../core/extension";
import { eventBus, type DomainEvent } from "../core/events";
import type { Schedule, Task } from "../core/entities";
import { readable, type Readable } from "svelte/store";

export interface DailyNoteExtensionSettings {
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

export class DailyNoteExtension implements Extension {
  readonly id = "daily-note";
  readonly name = "Daily Note Manager";
  readonly version = "1.0.0";
  readonly supportedEntities: readonly EntityType[] = [];

  private initialized = false;

  constructor(
    private app: App,
    private plugin: Plugin,
    private settings: DailyNoteExtensionSettings
  ) {}

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Register with the core app
      extensionRegistry.register(this);

      // Set up event listeners for schedule events
      this.setupEventListeners();

      // Trigger extension registered event
      eventBus.trigger({
        type: "extension.registered",
        extension: this.id,
        supportedEntities: [...this.supportedEntities],
      });

      this.initialized = true;
      console.log("DailyNoteExtension initialized successfully");
    } catch (error) {
      console.error("Failed to initialize DailyNoteExtension:", error);
      throw error;
    }
  }

  async load(): Promise<void> {
    if (!this.initialized) {
      throw new Error("DailyNoteExtension must be initialized before loading");
    }

    try {
      console.log("Loading DailyNoteExtension...");

      // Trigger extension loaded event
      eventBus.trigger({
        type: "extension.loaded",
        extension: this.id,
        supportedEntities: [...this.supportedEntities],
      });

      console.log("DailyNoteExtension loaded successfully");
    } catch (error) {
      console.error("Failed to load DailyNoteExtension:", error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    if (!this.initialized) return;

    eventBus.trigger({
      type: "extension.unregistered",
      extension: this.id,
    });

    this.initialized = false;
  }

  // Extension interface methods
  async onEntityCreated(event: DomainEvent): Promise<void> {
    if (event.type === "schedules.created") {
      await this.handleScheduleCreated(event.schedule);
    }
  }

  async onEntityUpdated(event: DomainEvent): Promise<void> {
    if (event.type === "schedules.updated") {
      await this.handleScheduleUpdated(event.schedule);
    }
  }

  async onEntityDeleted(event: DomainEvent): Promise<void> {
    // No action needed for schedule deletion
  }

  // ExtensionDataAccess interface methods
  // DailyNoteExtension doesn't manage tasks directly, so these return empty/default values

  getTasks(): Readable<readonly Task[]> {
    return readable<readonly Task[]>([], () => {});
  }

  async refresh(): Promise<void> {
    // No-op: DailyNoteExtension doesn't maintain its own task cache
  }

  searchTasks(query: string, tasks: readonly Task[]): readonly Task[] {
    // No-op: DailyNoteExtension doesn't provide task search
    return [];
  }

  sortTasks(
    tasks: readonly Task[],
    sortFields: Array<{ key: string; direction: "asc" | "desc" }>
  ): readonly Task[] {
    // No-op: DailyNoteExtension doesn't provide task sorting
    return tasks;
  }

  filterTasks(
    tasks: readonly Task[],
    criteria: {
      project?: string | null;
      area?: string | null;
      source?: string | null;
      showCompleted?: boolean;
    }
  ): readonly Task[] {
    // No-op: DailyNoteExtension doesn't provide task filtering
    return tasks;
  }

  async isHealthy(): Promise<boolean> {
    // Check if daily notes folder is accessible
    try {
      const dailyNotesFolder = this.settings.dailyNotesFolder || "Daily Notes";
      const folder = this.app.vault.getAbstractFileByPath(dailyNotesFolder);
      return folder !== null;
    } catch {
      return false;
    }
  }

  // Daily Note Operations

  /**
   * Get the path for today's daily note
   * First tries to use the currently active file if it matches today's date,
   * then searches for existing daily notes, then falls back to configured folder
   */
  async getTodayDailyNotePath(): Promise<string> {
    const today = new Date();
    const dateString = this.getDateString(today); // YYYY-MM-DD format

    // First, check if the currently active file is today's daily note
    const activeFile = this.app.workspace.getActiveFile();
    if (activeFile) {
      const activeFileName = activeFile.name.replace(/\.md$/, "");
      if (activeFileName === dateString) {
        return activeFile.path;
      }
    }

    // Second, try to find an existing daily note with today's date anywhere in the vault
    const allFiles = this.app.vault.getMarkdownFiles();
    const existingDailyNotes = allFiles.filter((file) => {
      const fileName = file.name.replace(/\.md$/, "");
      return fileName === dateString;
    });

    if (existingDailyNotes.length > 0) {
      // If multiple daily notes exist, prefer the one in the configured folder
      const dailyNotesFolder = this.settings.dailyNotesFolder || "Daily Notes";
      const preferredNote = existingDailyNotes.find((file) =>
        file.path.startsWith(dailyNotesFolder + "/")
      );

      const selectedNote = preferredNote || existingDailyNotes[0];
      return selectedNote.path;
    }

    // Fall back to configured folder
    const dailyNotesFolder = this.settings.dailyNotesFolder || "Daily Notes";
    return `${dailyNotesFolder}/${dateString}.md`;
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

    // Ensure the daily notes folder exists
    const dailyNotesFolder = this.settings.dailyNotesFolder || "Daily Notes";
    const folderExists = this.app.vault.getAbstractFileByPath(dailyNotesFolder);

    if (!folderExists) {
      await this.app.vault.createFolder(dailyNotesFolder);
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

      // Read current daily note content
      const currentContent = await this.app.vault.read(dailyNoteResult.file!);

      // Create task link using the file basename (without .md extension)
      const taskTitle = taskFile.basename;
      const taskLink = `- [ ] [[${taskTitle}]]`;

      // Check if task already exists in the daily note
      const taskAlreadyExists = currentContent.includes(taskLink);

      if (!taskAlreadyExists) {
        // Find or create a "Tasks" section
        let updatedContent: string;
        if (currentContent.includes("## Tasks")) {
          // Add to existing Tasks section - find the line and add after it
          const lines = currentContent.split("\n");
          const tasksIndex = lines.findIndex(
            (line) => line.trim() === "## Tasks"
          );
          if (tasksIndex !== -1) {
            lines.splice(tasksIndex + 1, 0, taskLink);
            updatedContent = lines.join("\n");
          } else {
            // Fallback if we can't find the exact line
            updatedContent = currentContent.replace(
              "## Tasks",
              `## Tasks\n${taskLink}`
            );
          }
        } else {
          // Add Tasks section at the end
          updatedContent = currentContent.trim() + `\n\n## Tasks\n${taskLink}`;
        }

        // Write back to the daily note
        await this.app.vault.modify(dailyNoteResult.file!, updatedContent);
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
   * Generate default content for a new daily note
   */
  private generateDailyNoteContent(): string {
    const today = new Date();
    const dateString = today.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    return [
      `# ${dateString}`,
      "",
      "## Tasks",
      "<!-- Tasks scheduled for today will appear here -->",
      "",
      "## Notes",
      "<!-- Daily notes and reflections -->",
      "",
    ].join("\n");
  }

  /**
   * Get date string in YYYY-MM-DD format
   */
  private getDateString(date: Date): string {
    return date.toISOString().split("T")[0];
  }

  // Event Handlers

  private setupEventListeners(): void {
    // Listen for schedule events to update daily notes
    eventBus.on("schedules.created", (event) => this.onEntityCreated(event));
    eventBus.on("schedules.updated", (event) => this.onEntityUpdated(event));
  }

  private async handleScheduleCreated(schedule: Schedule): Promise<void> {
    await this.updateDailyNoteFromSchedule(schedule);
  }

  private async handleScheduleUpdated(schedule: Schedule): Promise<void> {
    await this.updateDailyNoteFromSchedule(schedule);
  }

  private async updateDailyNoteFromSchedule(schedule: Schedule): Promise<void> {
    try {
      // Only update daily note if schedule is planned
      if (!schedule.isPlanned) {
        return;
      }

      // Add all tasks from the schedule to today's daily note
      for (const task of schedule.tasks) {
        if (task.source?.filePath) {
          await this.addTaskToToday(task.source.filePath);
        }
      }

      console.log(
        `Updated daily note with ${schedule.tasks.length} tasks from schedule`
      );
    } catch (error) {
      console.error("Failed to update daily note from schedule:", error);
    }
  }
}
