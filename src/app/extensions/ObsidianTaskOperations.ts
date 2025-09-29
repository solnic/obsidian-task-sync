/**
 * Obsidian Task Operations
 * Reactive note manager that responds to task domain events by managing corresponding Obsidian notes
 */

import { App, stringifyYaml, TFile, TFolder } from "obsidian";
import { Task } from "../core/entities";
import { ObsidianEntityOperations } from "./ObsidianEntityOperations";

export class ObsidianTaskOperations extends ObsidianEntityOperations<Task> {
  constructor(app: App, folder: string) {
    super(app, folder);
  }

  /**
   * Scan the tasks folder and return all existing task files as Task entities
   * This is used during extension initialization to populate the canonical store
   */
  async scanExistingTasks(): Promise<Task[]> {
    console.log(`Scanning tasks folder: ${this.folder}`);
    const folder = this.app.vault.getFolderByPath(this.folder);

    if (!folder) {
      console.warn(
        `Tasks folder '${this.folder}' does not exist, returning empty array`
      );
      return [];
    }

    const taskFiles = folder.children
      .filter((child) => child instanceof TFile && child.extension === "md")
      .map((child) => child as TFile);

    console.log(
      `Found ${taskFiles.length} .md files in tasks folder:`,
      taskFiles.map((f) => f.path)
    );

    const tasks: Task[] = [];

    for (const file of taskFiles) {
      try {
        console.log(`Parsing task file: ${file.path}`);
        const task = await this.parseFileToTask(file);
        if (task) {
          console.log(`Successfully parsed task: ${task.title}`);
          tasks.push(task);
        } else {
          console.log(`File ${file.path} was not a valid task`);
        }
      } catch (error) {
        console.error(`Failed to parse task file ${file.path}:`, error);
      }
    }

    console.log(`Scan complete. Found ${tasks.length} valid tasks`);
    return tasks;
  }

  // Implement abstract method to get entity display name for file naming
  protected getEntityDisplayName(task: Task): string {
    return task.title;
  }

  // Implement abstract methods for task-specific behavior
  protected generateFrontMatter(task: Task): Record<string, any> {
    // Based on properties.ts from old-stuff, only include frontmatter: true properties
    return {
      Title: task.title, // TITLE property
      Type: task.category || "Task", // TYPE/CATEGORY property
      Status: task.status, // STATUS property
      Priority: task.priority, // PRIORITY property (can be undefined)
      Done: task.done, // DONE property
      Project: task.project, // PROJECT property (can be undefined)
      Areas: task.areas && task.areas.length > 0 ? task.areas : undefined, // AREAS property
      "Parent task": task.parentTask, // PARENT_TASK property (note the space in name)
      "Do Date": task.doDate?.toISOString().split("T")[0], // DO_DATE property
      "Due Date": task.dueDate?.toISOString().split("T")[0], // DUE_DATE property
      tags: task.tags && task.tags.length > 0 ? task.tags : undefined, // TAGS property (lowercase)
      // Note: createdAt and updatedAt are NOT frontmatter properties according to properties.ts
      // They come from file.ctime and file.mtime (frontmatter: false)
    };
  }

  protected getEntityType(): string {
    return "Task";
  }

  /**
   * Parse a task file and convert it to a Task entity
   * Based on the old TaskFileManager.loadEntity logic but simplified for new architecture
   */
  private async parseFileToTask(file: TFile): Promise<Task | null> {
    try {
      // Get frontmatter from the file - wait for metadata cache if needed
      let fileCache = this.app.metadataCache.getFileCache(file);

      // If metadata cache is not ready, wait for it
      if (!fileCache) {
        await new Promise<void>((resolve) => {
          const checkCache = () => {
            fileCache = this.app.metadataCache.getFileCache(file);
            if (fileCache) {
              resolve();
            } else {
              setTimeout(checkCache, 100); // Check again in 100ms
            }
          };
          checkCache();
        });
      }

      const frontMatter = fileCache?.frontmatter;

      if (!frontMatter || frontMatter.Type !== "Task") {
        console.log(
          `Skipping file ${file.path}: not a task file (Type: ${frontMatter?.Type})`
        );
        return null; // Not a task file
      }

      // Skip if essential properties are missing
      if (!frontMatter.Title) {
        return null;
      }

      // Helper function to clean link formatting from strings
      const cleanLinkFormat = (value: any): any => {
        if (typeof value === "string") {
          return value.replace(/^\[\[|\]\]$/g, "");
        }
        if (Array.isArray(value)) {
          return value.map((item) =>
            typeof item === "string" ? item.replace(/^\[\[|\]\]$/g, "") : item
          );
        }
        return value;
      };

      // Ensure areas is always an array
      let areas = cleanLinkFormat(frontMatter.Areas);
      if (!Array.isArray(areas)) {
        if (areas === undefined || areas === null) {
          areas = [];
        } else if (typeof areas === "string") {
          areas = [areas];
        } else {
          areas = [];
        }
      }

      // Helper function to parse date strings
      const parseDate = (dateValue: any): Date | undefined => {
        if (!dateValue || dateValue === "") {
          return undefined;
        }
        if (dateValue instanceof Date) {
          return dateValue;
        }
        if (typeof dateValue === "string") {
          const date = new Date(dateValue);
          return isNaN(date.getTime()) ? undefined : date;
        }
        return undefined;
      };

      // Create Task entity following the new schema
      const task: Task = {
        id: crypto.randomUUID(), // Generate new ID for each scan
        title: frontMatter.Title,
        description: frontMatter.Description || "",
        category: frontMatter.Type || "Task",
        status: frontMatter.Status || "Not Started",
        priority: frontMatter.Priority,
        done: frontMatter.Done || false,
        project: cleanLinkFormat(frontMatter.Project),
        areas: areas,
        parentTask: cleanLinkFormat(frontMatter["Parent task"]),
        doDate: parseDate(frontMatter["Do Date"]),
        dueDate: parseDate(frontMatter["Due Date"]),
        tags: Array.isArray(frontMatter.tags) ? frontMatter.tags : [],
        createdAt: new Date(file.stat.ctime),
        updatedAt: new Date(file.stat.mtime),
        // Source information for tracking
        source: {
          extension: "obsidian",
          source: file.path, // Use file path as the source identifier
        },
      };

      return task;
    } catch (error) {
      console.error(`Failed to parse task file ${file.path}:`, error);
      return null;
    }
  }
}
