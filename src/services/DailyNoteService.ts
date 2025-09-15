/**
 * DailyNoteService
 * Handles daily note operations including getting today's daily note,
 * creating it if it doesn't exist, and adding task links to it
 */

import { App, Vault, TFile } from "obsidian";
import { TaskSyncSettings } from "../main";

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

export class DailyNoteService {
  constructor(
    private app: App,
    private vault: Vault,
    private settings: TaskSyncSettings
  ) {}

  /**
   * Get the path for today's daily note
   * First tries to use the currently active file if it matches today's date,
   * then searches for existing daily notes, then falls back to configured folder
   * @returns Path to today's daily note
   */
  async getTodayDailyNotePath(): Promise<string> {
    const today = new Date();
    const dateString = today.toISOString().split("T")[0]; // YYYY-MM-DD format

    // First, check if the currently active file is today's daily note
    const activeFile = this.app.workspace.getActiveFile();
    if (activeFile) {
      const activeFileName = activeFile.name.replace(/\.md$/, "");
      if (activeFileName === dateString) {
        return activeFile.path;
      }
    }

    // Second, try to find an existing daily note with today's date anywhere in the vault
    const allFiles = this.vault.getMarkdownFiles();
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

    // Fall back to the configured daily notes folder
    const dailyNotesFolder = this.settings.dailyNotesFolder || "Daily Notes";
    const fallbackPath = `${dailyNotesFolder}/${dateString}.md`;
    return fallbackPath;
  }

  /**
   * Ensure today's daily note exists, creating it if necessary
   * @returns Result with path and whether it was created
   */
  async ensureTodayDailyNote(): Promise<DailyNoteResult> {
    const dailyNotePath = await this.getTodayDailyNotePath();

    // Check if the daily note already exists
    const existingFile = this.vault.getAbstractFileByPath(dailyNotePath);

    if (existingFile instanceof TFile) {
      return {
        path: dailyNotePath,
        created: false,
        file: existingFile,
      };
    }

    // Ensure the daily notes folder exists
    const dailyNotesFolder = this.settings.dailyNotesFolder || "Daily Notes";
    const folderExists = this.vault.getAbstractFileByPath(dailyNotesFolder);

    if (!folderExists) {
      await this.vault.createFolder(dailyNotesFolder);
    }

    // Create the daily note
    const content = this.generateDailyNoteContent();
    const file = await this.vault.create(dailyNotePath, content);

    return {
      path: dailyNotePath,
      created: true,
      file: file,
    };
  }

  /**
   * Add a task link to today's daily note and set the Do Date property
   * @param taskPath Path to the task file
   * @returns Result of the operation
   */
  async addTaskToToday(taskPath: string): Promise<AddTaskResult> {
    try {
      // Ensure today's daily note exists
      const dailyNoteResult = await this.ensureTodayDailyNote();

      // Get the task file to extract the title
      const taskFile = this.vault.getAbstractFileByPath(taskPath);
      if (!taskFile || !(taskFile instanceof TFile)) {
        return {
          success: false,
          dailyNotePath: dailyNoteResult.path,
          error: "Task file not found",
        };
      }

      // Extract task title from file name (remove .md extension)
      const taskTitle = taskFile.name.replace(/\.md$/, "");

      // Read current daily note content
      const currentContent = await this.vault.read(dailyNoteResult.file!);

      // Add task link to the daily note
      const taskLink = `- [ ] [[${taskTitle}]]`;

      // Check if task already exists to avoid duplicates
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
        await this.vault.modify(dailyNoteResult.file!, updatedContent);
      }

      // Set the Do Date property in the task's front-matter to today's date
      const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD format

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
   * Check if a task is already in today's daily note
   * @param taskPath Path to the task file
   * @returns True if the task is already in today's daily note
   */
  async isTaskInToday(taskPath: string): Promise<boolean> {
    try {
      // Get today's daily note path
      const dailyNotePath = await this.getTodayDailyNotePath();

      // Check if the daily note exists
      const dailyNoteFile = this.vault.getAbstractFileByPath(dailyNotePath);
      if (!dailyNoteFile || !(dailyNoteFile instanceof TFile)) {
        return false;
      }

      // Get the task file to extract the title
      const taskFile = this.vault.getAbstractFileByPath(taskPath);
      if (!taskFile || !(taskFile instanceof TFile)) {
        return false;
      }

      // Extract task title from file name (remove .md extension)
      const taskTitle = taskFile.name.replace(/\.md$/, "");

      // Read the daily note content
      const dailyNoteContent = await this.vault.read(dailyNoteFile);

      // Check if the task link exists in the daily note
      const taskLink = `- [ ] [[${taskTitle}]]`;
      const taskLinkCompleted = `- [x] [[${taskTitle}]]`;

      return (
        dailyNoteContent.includes(taskLink) ||
        dailyNoteContent.includes(taskLinkCompleted)
      );
    } catch (error: any) {
      console.error("Error checking if task is in today's daily note:", error);
      return false;
    }
  }

  /**
   * Generate default content for a new daily note
   * @returns Default daily note content
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
      "## Notes",
      "",
      "## Tasks",
      "",
      "## Reflections",
      "",
    ].join("\n");
  }
}
