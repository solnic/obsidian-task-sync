/**
 * ContextService - Centralized context detection and management
 * Provides consistent context detection logic across the plugin
 * Ported from old-stuff/services/ContextService.ts for new architecture
 */

import { App } from "obsidian";
import type { FileContext } from "../types/context";
import type { TaskSyncSettings } from "../types/settings";
import type { Task, Project, Area } from "../core/entities";
import { TaskQueryService } from "./TaskQueryService";
import { ProjectQueryService } from "./ProjectQueryService";
import { AreaQueryService } from "./AreaQueryService";
import { taskStore } from "../stores/taskStore";
import { projectStore } from "../stores/projectStore";
import { areaStore } from "../stores/areaStore";
import { get } from "svelte/store";

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
   * Get the current context with resolved entity
   */
  getCurrentContext(): FileContext {
    const baseContext = this.detectCurrentFileContext();

    // Resolve entity based on context type
    let entity: Task | Project | Area | undefined = undefined;

    if (
      baseContext.path &&
      baseContext.type !== "none" &&
      baseContext.type !== "daily"
    ) {
      switch (baseContext.type) {
        case "task": {
          const tasks = get(taskStore).tasks;
          entity =
            TaskQueryService.findByFilePath(tasks, baseContext.path) ||
            TaskQueryService.findByTitle(tasks, baseContext.name || "");
          break;
        }
        case "project": {
          const projects = get(projectStore).projects;
          entity =
            ProjectQueryService.findByFilePath(projects, baseContext.path) ||
            ProjectQueryService.findByName(projects, baseContext.name || "");
          break;
        }
        case "area": {
          const areas = get(areaStore).areas;
          entity =
            AreaQueryService.findByFilePath(areas, baseContext.path) ||
            AreaQueryService.findByName(areas, baseContext.name || "");
          break;
        }
      }
    }

    return {
      ...baseContext,
      entity,
    };
  }

  /**
   * Detect the context of the currently active file (without entity resolution)
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
