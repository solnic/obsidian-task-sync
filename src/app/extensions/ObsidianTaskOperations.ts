/**
 * Obsidian Task Operations
 * Reactive note manager that responds to task domain events by managing corresponding Obsidian notes
 */

import { App, stringifyYaml } from "obsidian";
import { Task } from "../core/entities";
import { ObsidianEntityOperations } from "./ObsidianEntityOperations";

export class ObsidianTaskOperations extends ObsidianEntityOperations<Task> {
  constructor(app: App, folder: string) {
    super(app, folder);
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
}
