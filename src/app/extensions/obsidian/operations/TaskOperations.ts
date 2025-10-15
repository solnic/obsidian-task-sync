/**
 * Obsidian Task Operations
 * Reactive note manager that responds to task domain events by managing corresponding Obsidian notes
 */

import { App, TFile } from "obsidian";
import { Task } from "../../../core/entities";
import { ObsidianEntityOperations } from "./EntityOperations";
import { projectStore } from "../../../stores/projectStore";
import { taskStore } from "../../../stores/taskStore";
import { getDateString } from "../../../utils/dateFiltering";
import { PROPERTY_REGISTRY } from "../utils/PropertyRegistry";
import type { TaskSyncSettings } from "../../../types/settings";
import { ObsidianTaskReconciler } from "../../../core/TaskReconciler";

export class ObsidianTaskOperations extends ObsidianEntityOperations<Task> {
  private wikiLinkOperations: any;

  constructor(app: App, settings: TaskSyncSettings, wikiLinkOperations?: any) {
    super(app, settings.tasksFolder);
    this.wikiLinkOperations = wikiLinkOperations;
  }

  /**
   * Scan the tasks folder and return all existing task files as Task entities (without IDs)
   * This is used during extension initialization to populate the canonical store
   * The store will handle ID generation and upsert logic using natural keys
   */
  async scanExistingTasks(): Promise<
    Array<Omit<Task, "id"> & { naturalKey: string }>
  > {
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

    const tasks: Array<Omit<Task, "id"> & { naturalKey: string }> = [];

    for (const file of taskFiles) {
      try {
        console.log(`Parsing task file: ${file.path}`);
        const taskData = await this.parseFileToTaskData(file);
        if (taskData) {
          console.log(`Successfully parsed task: ${taskData.title}`);
          tasks.push(taskData);
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

  /**
   * Rescan a single task file and update it in the store
   * This is used when a file's front-matter changes
   * @param file - The file to rescan
   * @param cache - Optional metadata cache from the changed event
   */
  async rescanFile(file: TFile, cache?: any): Promise<void> {
    // Use the cache parameter directly from the 'changed' event
    // This contains the updated frontmatter data
    const taskData = await this.parseFileToTaskData(file, cache);
    if (taskData) {
      // Dispatch UPSERT_TASK action to taskStore with Obsidian reconciler
      taskStore.dispatch({
        type: "UPSERT_TASK",
        taskData,
        reconciler: new ObsidianTaskReconciler(),
      });
    }
  }

  /**
   * Override createNote to use parent implementation
   * TypeNote integration is disabled for entity notes because:
   * 1. Entity notes need description in content, not front-matter
   * 2. TypeNote validation expects front-matter keys but templates use property keys
   * 3. ObsidianEntityOperations already handles front-matter correctly
   */
  async createNote(task: Task): Promise<string> {
    // Always use the parent implementation which handles front-matter correctly
    return await super.createNote(task);
  }

  // Implement abstract method to get entity display name for file naming
  protected getEntityDisplayName(task: Task): string {
    return task.title;
  }

  // Implement abstract methods for task-specific behavior
  protected generateFrontMatter(task: Task): Record<string, any> {
    // Use the Obsidian property registry to ensure consistent front-matter structure
    // ALL frontmatter properties must be defined even if they have null/empty defaults
    // to prevent validation errors when creating LocalTask objects.

    // Convert project name to wiki link format
    let projectValue = task.project || "";
    if (projectValue && !projectValue.startsWith("[[")) {
      // Look up the project to get its file path
      const project = this.findProjectByName(projectValue);
      if (project && project.source?.filePath) {
        // Format as [[Projects/Foo Bar.md|Foo Bar]]
        projectValue = `[[${project.source.filePath}|${projectValue}]]`;
      }
    }

    return {
      [PROPERTY_REGISTRY.TITLE.name]: task.title, // Use property name from registry
      [PROPERTY_REGISTRY.TYPE.name]: "Task", // Always "Task" for task entities
      [PROPERTY_REGISTRY.CATEGORY.name]: task.category || "", // Task category
      [PROPERTY_REGISTRY.PRIORITY.name]: task.priority || "", // Priority
      [PROPERTY_REGISTRY.AREAS.name]: task.areas || [], // Areas array
      [PROPERTY_REGISTRY.PROJECT.name]: projectValue, // Project in wiki link format
      [PROPERTY_REGISTRY.DONE.name]: task.done, // Done boolean
      [PROPERTY_REGISTRY.STATUS.name]: task.status, // Status
      [PROPERTY_REGISTRY.PARENT_TASK.name]: task.parentTask || "", // Parent task
      [PROPERTY_REGISTRY.DO_DATE.name]: task.doDate
        ? getDateString(task.doDate)
        : null, // Do Date
      [PROPERTY_REGISTRY.DUE_DATE.name]: task.dueDate
        ? getDateString(task.dueDate)
        : null, // Due Date
      [PROPERTY_REGISTRY.TAGS.name]: task.tags || [], // Tags array
      [PROPERTY_REGISTRY.REMINDERS.name]: [], // Reminders (not yet implemented)
      // Note: createdAt and updatedAt are NOT frontmatter properties according to registry
      // They come from file.ctime and file.mtime (frontmatter: false)
    };
  }

  /**
   * Find a project by name from the project store
   */
  private findProjectByName(
    projectName: string
  ): import("../../../core/entities").Project | null {
    let foundProject = null;
    const unsubscribe = projectStore.subscribe((state) => {
      foundProject = state.projects.find((p) => p.name === projectName);
    });
    unsubscribe();
    return foundProject;
  }

  protected getEntityType(): string {
    return "Task";
  }

  /**
   * Parse a task file and convert it to task data (without ID)
   *
   * This method is public to allow external callers (like ObsidianTaskSource) to parse
   * individual task files when handling file system events. It extracts task data from
   * the file's front matter and returns it in a format suitable for store upsert operations.
   *
   * Based on the old TaskFileManager.loadEntity logic but simplified for new architecture.
   *
   * @param file - The Obsidian file to parse
   * @param cache - Optional metadata cache from the changed event. If provided, uses this
   *                directly instead of waiting for the metadata cache to be ready. This
   *                improves performance when handling file change events.
   * @returns Task data without ID, including naturalKey for store upsert, or null if the
   *          file is not a valid task file (missing Type: Task or Title in front matter)
   *
   * @example
   * ```typescript
   * // Parse a task file during file system event handling
   * const taskData = await taskOperations.parseFileToTaskData(file, cache);
   * if (taskData) {
   *   taskStore.dispatch({
   *     type: "UPSERT_TASK",
   *     taskData,
   *     reconciler: new ObsidianTaskReconciler()
   *   });
   * }
   * ```
   */
  async parseFileToTaskData(
    file: TFile,
    cache?: any
  ): Promise<(Omit<Task, "id"> & { naturalKey: string }) | null> {
    // If cache is provided (from changed event), use it directly
    // Otherwise wait for metadata cache to be ready
    const frontMatter =
      cache?.frontmatter || (await this.waitForMetadataCache(file));

    if (frontMatter?.Type !== "Task" || !frontMatter?.Title) {
      return null; // Not a task file
    }

    // Helper function to clean link formatting from strings using Obsidian's native APIs
    const cleanLinkFormat = (value: any): any => {
      if (typeof value === "string") {
        // Use wiki link operations if available, otherwise fallback to simple bracket removal
        if (this.wikiLinkOperations?.parseWikiLink) {
          try {
            const parsed = this.wikiLinkOperations.parseWikiLink(value);
            if (parsed) {
              // Return display text if available, otherwise extract filename from path
              return (
                parsed.displayText || parsed.path.split("/").pop() || value
              );
            }
          } catch (error) {
            console.warn(
              "Failed to parse wiki link with native API, falling back to simple removal:",
              error
            );
          }
        }
        // Fallback: simple bracket removal
        return value.replace(/^\[\[|\]\]$/g, "");
      }
      if (Array.isArray(value)) {
        return value.map((item) => cleanLinkFormat(item));
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
    // Uses the same logic as coerceToDate to ensure consistency
    const parseDate = (dateValue: any): Date | undefined => {
      if (!dateValue || dateValue === "") {
        return undefined;
      }
      if (dateValue instanceof Date) {
        return isNaN(dateValue.getTime()) ? undefined : dateValue;
      }
      if (typeof dateValue === "string" && dateValue.trim() !== "") {
        // Special handling for YYYY-MM-DD format to use local timezone
        // This prevents date shifting when the user's timezone is not UTC
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
          const [year, month, day] = dateValue.split("-").map(Number);
          const date = new Date(year, month - 1, day); // month is 0-indexed
          return isNaN(date.getTime()) ? undefined : date;
        }
        // For other formats, use standard Date parsing
        const date = new Date(dateValue);
        return isNaN(date.getTime()) ? undefined : date;
      }
      return undefined;
    };

    // Create Task data without ID - store will handle ID generation and upsert
    // Note: source.extension preservation is now handled in the reducer during LOAD_SOURCE_SUCCESS
    const taskData: Omit<Task, "id"> & { naturalKey: string } = {
      title: frontMatter.Title,
      description: frontMatter.Description || "",
      category: frontMatter.Category || "", // Use Category property, not Type
      status: frontMatter.Status || "Not Started",
      priority: frontMatter.Priority || "", // Ensure priority is always a string
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
        extension: "obsidian", // Default to obsidian, reducer will preserve non-obsidian extensions
        filePath: file.path, // Use file path as the source identifier
      },
      // Natural key for store upsert logic
      naturalKey: file.path,
    };

    return taskData;
  }

  /**
   * Wait for metadata cache to have front-matter for the given file
   * Uses event-driven approach with fallback polling for better performance
   * Based on the old FileManager.waitForMetadataCache implementation
   */
  private async waitForMetadataCache(file: TFile): Promise<any> {
    // Helper function to check if frontmatter is complete (has non-null values)
    const isCompleteFrontmatter = (frontmatter: any): boolean => {
      if (!frontmatter || Object.keys(frontmatter).length === 0) {
        return false;
      }
      // Check if essential properties have non-null values
      // For tasks, we expect at least Title and Type to have values
      if (frontmatter.Type === "Task") {
        return frontmatter.Title !== null && frontmatter.Title !== undefined;
      }
      // For other entity types, just check that we have some non-null values
      return Object.values(frontmatter).some(
        (value) => value !== null && value !== undefined
      );
    };

    // First check if metadata is already available and complete
    const existingCache = this.app.metadataCache.getFileCache(file);
    if (
      existingCache?.frontmatter &&
      isCompleteFrontmatter(existingCache.frontmatter)
    ) {
      return existingCache.frontmatter;
    }

    // Use event-driven approach with timeout
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.app.metadataCache.off("changed", onMetadataChanged);
        reject(new Error(`Metadata cache timeout for file: ${file.path}`));
      }, 5000); // 5 second timeout

      const onMetadataChanged = (
        changedFile: TFile,
        _data: string,
        cache: any
      ) => {
        if (
          changedFile.path === file.path &&
          cache?.frontmatter &&
          isCompleteFrontmatter(cache.frontmatter)
        ) {
          clearTimeout(timeout);
          this.app.metadataCache.off("changed", onMetadataChanged);
          resolve(cache.frontmatter);
        }
      };

      // Listen for metadata changes
      this.app.metadataCache.on("changed", onMetadataChanged);

      // Fallback: check again after a short delay in case the event was missed
      setTimeout(() => {
        const cache = this.app.metadataCache.getFileCache(file);
        if (cache?.frontmatter && isCompleteFrontmatter(cache.frontmatter)) {
          clearTimeout(timeout);
          this.app.metadataCache.off("changed", onMetadataChanged);
          resolve(cache.frontmatter);
        }
      }, 100);
    });
  }
}
