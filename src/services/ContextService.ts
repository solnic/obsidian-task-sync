/**
 * ContextService - Centralized context detection and management
 * Provides consistent context detection logic across the plugin
 */

import { App } from "obsidian";
import type { FileContext } from "../main";
import type { TaskSyncSettings } from "../components/ui/settings/types";

export class ContextService {
  private app: App;
  private settings: TaskSyncSettings;

  constructor(app: App, settings: TaskSyncSettings) {
    this.app = app;
    this.settings = settings;
  }

  /**
   * Update settings reference
   */
  updateSettings(settings: TaskSyncSettings): void {
    this.settings = settings;
  }

  /**
   * Detect the context of the currently active file
   */
  detectCurrentFileContext(): FileContext {
    const activeFile = this.app.workspace.getActiveFile();

    if (!activeFile) {
      return { type: "none" };
    }

    const filePath = activeFile.path;
    const fileName = activeFile.name;

    // Check if file is a daily note (format: YYYY-MM-DD anywhere in path or name)
    const dailyNotePattern = /\b\d{4}-\d{2}-\d{2}\b/;
    if (dailyNotePattern.test(filePath) || dailyNotePattern.test(fileName)) {
      return {
        type: "daily",
        name: fileName.replace(".md", ""),
        path: filePath,
      };
    }

    // Check if file is in projects folder
    if (filePath.startsWith(this.settings.projectsFolder + "/")) {
      return {
        type: "project",
        name: fileName.replace(".md", ""),
        path: filePath,
      };
    }

    // Check if file is in areas folder
    if (filePath.startsWith(this.settings.areasFolder + "/")) {
      return {
        type: "area",
        name: fileName.replace(".md", ""),
        path: filePath,
      };
    }

    // Check if file is in tasks folder
    if (filePath.startsWith(this.settings.tasksFolder + "/")) {
      return {
        type: "task",
        name: fileName.replace(".md", ""),
        path: filePath,
      };
    }

    return { type: "none" };
  }

  /**
   * Detect context for a specific file path
   */
  detectFileContext(filePath: string): FileContext {
    const fileName = filePath.split("/").pop() || "";

    // Check if file is a daily note (format: YYYY-MM-DD anywhere in path or name)
    const dailyNotePattern = /\b\d{4}-\d{2}-\d{2}\b/;
    if (dailyNotePattern.test(filePath) || dailyNotePattern.test(fileName)) {
      return {
        type: "daily",
        name: fileName.replace(".md", ""),
        path: filePath,
      };
    }

    // Check if file is in projects folder
    if (filePath.startsWith(this.settings.projectsFolder + "/")) {
      return {
        type: "project",
        name: fileName.replace(".md", ""),
        path: filePath,
      };
    }

    // Check if file is in areas folder
    if (filePath.startsWith(this.settings.areasFolder + "/")) {
      return {
        type: "area",
        name: fileName.replace(".md", ""),
        path: filePath,
      };
    }

    // Check if file is in tasks folder
    if (filePath.startsWith(this.settings.tasksFolder + "/")) {
      return {
        type: "task",
        name: fileName.replace(".md", ""),
        path: filePath,
      };
    }

    return { type: "none" };
  }
}
