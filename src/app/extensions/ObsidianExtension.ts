/**
 * Obsidian Extension
 * Main extension implementation for Obsidian vault integration
 * Provides area operations and coordinates with the event bus
 */

import {
  App,
  Plugin,
  MarkdownPostProcessor,
  TFile,
  EventRef,
  parseLinktext,
  getLinkpath,
} from "obsidian";
import { Extension, extensionRegistry, EntityType } from "../core/extension";
import { eventBus } from "../core/events";
import { ObsidianAreaOperations } from "./ObsidianAreaOperations";
import { ObsidianProjectOperations } from "./ObsidianProjectOperations";
import { ObsidianTaskOperations } from "./ObsidianTaskOperations";
import { TaskTodoMarkdownProcessor } from "../processors/TaskTodoMarkdownProcessor";
import { taskStore } from "../stores/taskStore";
import { projectStore } from "../stores/projectStore";
import { areaStore } from "../stores/areaStore";
import { Obsidian } from "../entities/Obsidian";
import { ContextService } from "../services/ContextService";
import { Tasks } from "../entities/Tasks";
import { Projects } from "../entities/Projects";
import { Areas } from "../entities/Areas";
import type { Task, Project } from "../core/entities";
import type { TaskSyncSettings } from "../types/settings";
import { ObsidianBaseManager } from "./obsidian/BaseManager";
import { DailyNoteFeature } from "../features/DailyNoteFeature";
import { derived, get, type Readable } from "svelte/store";
import { TypeNote } from "../core/type-note/TypeNote";
import { buildTaskNoteType } from "./obsidian/TaskNoteType";

/**
 * Obsidian Extension Settings
 * Contains Obsidian-specific settings that are not part of the general TaskSyncSettings
 *
 * Note: Base-related settings are Obsidian-specific because they use Obsidian's database feature.
 * These settings control how Obsidian Bases are generated and managed for areas, projects, and tasks.
 */
export interface ObsidianExtensionSettings extends TaskSyncSettings {
  // All Obsidian-specific settings are currently in TaskSyncSettings for convenience
  // In the future, Obsidian-only settings (like Base configuration) should be moved here
  // to better separate concerns between general task sync and Obsidian-specific features
}

export class ObsidianExtension implements Extension {
  readonly id = "obsidian";
  readonly name = "Obsidian Vault";
  readonly version = "1.0.0";
  readonly supportedEntities: readonly EntityType[] = [
    "area",
    "project",
    "task",
  ];

  private initialized = false;
  private vaultEventRefs: EventRef[] = [];
  private baseManager: ObsidianBaseManager;
  private dailyNoteFeature: DailyNoteFeature;

  private taskTodoMarkdownProcessor?: TaskTodoMarkdownProcessor;
  private markdownProcessor?: MarkdownPostProcessor;

  readonly areaOperations: ObsidianAreaOperations;
  readonly projectOperations: ObsidianProjectOperations;
  readonly taskOperations: ObsidianTaskOperations;
  readonly todoPromotionOperations: Obsidian.TodoPromotionOperations;
  readonly typeNote: TypeNote;

  constructor(
    private app: App,
    private plugin: Plugin,
    private settings: ObsidianExtensionSettings,
    typeNote: TypeNote
  ) {
    // Initialize base manager first so it can be passed to operations
    this.baseManager = new ObsidianBaseManager(app, app.vault, settings);

    this.typeNote = typeNote;

    this.areaOperations = new ObsidianAreaOperations(app, settings);

    // Pass base manager and settings to project operations for inline base generation
    this.projectOperations = new ObsidianProjectOperations(
      app,
      settings,
      this.baseManager
    );

    this.taskOperations = new ObsidianTaskOperations(
      app,
      settings,
      this.wikiLinkOperations
    );

    // Initialize context service for todo promotion
    const contextService = new ContextService(app, settings);

    // Initialize todo promotion operations
    this.todoPromotionOperations = new Obsidian.TodoPromotionOperations(
      app,
      settings,
      contextService,
      new Obsidian.TaskOperations(settings)
    );

    // Note: TaskTodoMarkdownProcessor will be initialized in the initialize() method
    // after wikiLinkOperations is available

    // Initialize daily note feature
    this.dailyNoteFeature = new DailyNoteFeature(app, plugin, {
      dailyNotesFolder: settings.dailyNotesFolder || "Daily Notes",
    });
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Register with the core app
      extensionRegistry.register(this);

      // Trigger extension registered event
      eventBus.trigger({
        type: "extension.registered",
        extension: this.id,
        supportedEntities: [...this.supportedEntities],
      });

      // Set up event listeners for domain events
      this.setupEventListeners();

      // Note: TypeNote initialization is handled by the plugin
      // We're using a shared TypeNote instance passed from the plugin

      // Register Task note type with TypeNote
      await this.registerTaskNoteType();

      // Pass TypeNote instance to task operations
      this.taskOperations.setTypeNote(this.typeNote);

      // Initialize markdown processor now that wikiLinkOperations is available
      this.taskTodoMarkdownProcessor = new TaskTodoMarkdownProcessor(
        this.app,
        this.settings,
        this.wikiLinkOperations
      );

      this.initialized = true;
      console.log("ObsidianExtension initialized successfully");
    } catch (error) {
      console.error("Failed to initialize ObsidianExtension:", error);
      throw error;
    }
  }

  async load(): Promise<void> {
    if (!this.initialized) {
      throw new Error("ObsidianExtension must be initialized before loading");
    }

    try {
      console.log("Loading ObsidianExtension - scanning existing tasks...");

      // Scan existing tasks and populate the store
      // This runs after Obsidian's layout is ready and vault is fully loaded
      await this.scanAndPopulateExistingTasks();

      // Set up vault event listeners for file deletions
      this.setupVaultEventListeners();

      // Register markdown processor after layout is ready
      this.registerTaskTodoMarkdownProcessor();

      // Trigger extension loaded event
      eventBus.trigger({
        type: "extension.loaded",
        extension: this.id,
        supportedEntities: [...this.supportedEntities],
      });

      console.log("ObsidianExtension loaded successfully");
    } catch (error) {
      console.error("Failed to load ObsidianExtension:", error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    if (!this.initialized) return;

    // Clean up vault event listeners
    this.vaultEventRefs.forEach((ref) => this.app.vault.offref(ref));
    this.vaultEventRefs = [];

    // Unregister markdown processor
    this.unregisterTaskTodoMarkdownProcessor();

    // Cleanup daily note feature
    this.dailyNoteFeature.cleanup();

    // Cleanup TypeNote system
    await this.typeNote.cleanup();

    eventBus.trigger({
      type: "extension.unregistered",
      extension: this.id,
    });

    this.initialized = false;
  }

  async isHealthy(): Promise<boolean> {
    return this.app.vault !== null && this.initialized;
  }

  /**
   * Add a task to today's daily note
   * Exposed method for other parts of the application to use
   */
  async addTaskToTodayDailyNote(taskPath: string) {
    return await this.dailyNoteFeature.addTaskToToday(taskPath);
  }

  /**
   * Ensure today's daily note exists
   * Exposed method for other parts of the application to use
   */
  async ensureTodayDailyNote() {
    return await this.dailyNoteFeature.ensureTodayDailyNote();
  }

  /**
   * Wiki Link Operations
   * Provides abstraction over Obsidian's first-class wiki link APIs
   */
  readonly wikiLinkOperations = {
    /**
     * Parse a wiki link text into its components
     * @param linktext - Wiki link content without [[ ]] brackets
     * @returns Object with path and subpath components
     */
    parseLinktext: (linktext: string) => {
      return parseLinktext(linktext);
    },

    /**
     * Convert linktext to a linkpath (file path)
     * @param linktext - Wiki link content without [[ ]] brackets
     * @returns The file path that the link points to
     */
    getLinkpath: (linktext: string) => {
      return getLinkpath(linktext);
    },

    /**
     * Resolve a link path to an actual file in the vault
     * @param linkpath - The path part of a wiki link
     * @param sourcePath - The path of the file containing the link (for relative resolution)
     * @returns The resolved TFile or null if not found
     */
    resolveFile: (linkpath: string, sourcePath: string): TFile | null => {
      return this.app.metadataCache.getFirstLinkpathDest(linkpath, sourcePath);
    },

    /**
     * Generate a markdown link using Obsidian's preferences
     * @param file - The file to link to
     * @param sourcePath - The path of the file containing the link
     * @param subpath - Optional subpath (heading/block)
     * @param alias - Optional display text
     * @returns Generated markdown link
     */
    generateMarkdownLink: (
      file: TFile,
      sourcePath: string,
      subpath?: string,
      alias?: string
    ): string => {
      return this.app.fileManager.generateMarkdownLink(
        file,
        sourcePath,
        subpath,
        alias
      );
    },

    /**
     * Generate linktext for a file using Obsidian's preferences
     * @param file - The file to generate linktext for
     * @param sourcePath - The source file path for relative links
     * @param omitMdExtension - Whether to omit .md extension
     * @returns Generated linktext
     */
    fileToLinktext: (
      file: TFile,
      sourcePath: string,
      omitMdExtension?: boolean
    ): string => {
      return this.app.metadataCache.fileToLinktext(
        file,
        sourcePath,
        omitMdExtension
      );
    },

    /**
     * Extract file path from an Obsidian internal link href
     * @param href - The href attribute from a rendered wiki link
     * @returns The file path or null if not an internal link
     */
    extractFilePathFromHref: (href: string): string | null => {
      // Handle internal links (wiki links)
      if (href.startsWith("app://obsidian.md/")) {
        // Extract the file path from the URL
        const url = new URL(href);
        return decodeURIComponent(url.pathname.substring(1));
      }

      // Handle relative paths
      if (!href.startsWith("http")) {
        return href;
      }

      return null;
    },

    /**
     * Parse a full wiki link (with brackets) into its components
     * @param wikiLink - Full wiki link like [[path|display]] or [[path]]
     * @returns Object with path, subpath, and display text
     */
    parseWikiLink: (wikiLink: string) => {
      // Remove the [[ ]] brackets
      const match = wikiLink.match(/^\[\[([^\]]+)\]\]$/);
      if (!match) {
        return null;
      }

      const linkContent = match[1];

      // Check for display text after |
      const pipeIndex = linkContent.indexOf("|");
      if (pipeIndex !== -1) {
        const path = linkContent.substring(0, pipeIndex).trim();
        const displayText = linkContent.substring(pipeIndex + 1).trim();
        const parsed = parseLinktext(path);
        return {
          path: parsed.path,
          subpath: parsed.subpath,
          displayText,
          fullPath: path,
        };
      }

      // No display text
      const parsed = parseLinktext(linkContent);
      return {
        path: parsed.path,
        subpath: parsed.subpath,
        displayText: null,
        fullPath: linkContent,
      };
    },

    /**
     * Create a wiki link with proper formatting
     * @param path - File path
     * @param displayText - Optional display text
     * @param subpath - Optional subpath (heading/block)
     * @returns Formatted wiki link
     */
    createWikiLink: (
      path: string,
      displayText?: string,
      subpath?: string
    ): string => {
      let linkContent = path;
      if (subpath) {
        linkContent += subpath;
      }
      if (displayText) {
        linkContent += `|${displayText}`;
      }
      return `[[${linkContent}]]`;
    },
  };

  /**
   * Get observable tasks for this extension
   * Returns the full task store - LocalTasksService will handle filtering/display
   * The extension provides all tasks, and the UI component decides what to show
   */
  getTasks(): Readable<readonly Task[]> {
    return derived(taskStore, ($store) => $store.tasks);
  }

  /**
   * Refresh tasks by re-scanning the vault
   * Public method that can be called by UI components
   * Handles both upserting existing tasks and removing deleted ones
   */
  async refresh(): Promise<void> {
    try {
      taskStore.setLoading(true);
      taskStore.setError(null);

      console.log("Refreshing Obsidian tasks...");

      // Get current tasks to identify which ones to remove (no longer exist in files)
      const currentState = get(taskStore);
      const currentTasks = currentState.tasks;

      // Scan existing task files
      const freshTasksData = await this.taskOperations.scanExistingTasks();
      console.log(`Refresh found ${freshTasksData.length} tasks`);

      // Create a set of natural keys from fresh data to identify removed tasks
      const freshNaturalKeys = new Set(
        freshTasksData.map((taskData) => taskData.naturalKey)
      );

      // Remove tasks that no longer exist in the file system
      for (const task of currentTasks) {
        if (
          task.source?.extension === "obsidian" &&
          task.source?.filePath &&
          !freshNaturalKeys.has(task.source.filePath)
        ) {
          console.log(
            `Removing deleted task: ${task.title} (${task.source.filePath})`
          );
          taskStore.removeTask(task.id);
        }
      }

      // Upsert fresh tasks - store will handle ID generation/preservation
      for (const taskData of freshTasksData) {
        try {
          taskStore.upsertTask(taskData);
        } catch (error) {
          console.error(`Failed to upsert task ${taskData.title}:`, error);
          // Continue with other tasks instead of crashing
        }
      }

      taskStore.setLoading(false);
      console.log("Refresh completed successfully");
    } catch (err: any) {
      console.error("Failed to refresh tasks:", err);
      taskStore.setError(err.message);
      taskStore.setLoading(false);
      throw err;
    }
  }

  /**
   * Search tasks by query string
   * Searches in title, category, status, project, and areas
   */
  searchTasks(query: string, tasks: readonly Task[]): readonly Task[] {
    const lowerQuery = query.toLowerCase();

    return tasks.filter((task) => {
      return (
        task.title.toLowerCase().includes(lowerQuery) ||
        (task.category && task.category.toLowerCase().includes(lowerQuery)) ||
        (task.status && task.status.toLowerCase().includes(lowerQuery)) ||
        (task.project &&
          typeof task.project === "string" &&
          task.project.toLowerCase().includes(lowerQuery)) ||
        (task.areas &&
          Array.isArray(task.areas) &&
          task.areas.some(
            (area: string) =>
              typeof area === "string" &&
              area.toLowerCase().includes(lowerQuery)
          ))
      );
    });
  }

  /**
   * Sort tasks by multiple fields
   * Supports sorting by title, createdAt, updatedAt, priority, status, category, project, areas
   */
  sortTasks(
    tasks: readonly Task[],
    sortFields: Array<{ key: string; direction: "asc" | "desc" }>
  ): readonly Task[] {
    return [...tasks].sort((a, b) => {
      for (const field of sortFields) {
        let aValue: any;
        let bValue: any;

        // Get values based on field key
        switch (field.key) {
          case "title":
            aValue = a.title;
            bValue = b.title;
            break;
          case "createdAt":
            aValue = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            bValue = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            break;
          case "updatedAt":
            aValue = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
            bValue = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
            break;
          case "priority":
            // Use priority order from constants if available
            // For now, just use string comparison
            aValue = a.priority || "";
            bValue = b.priority || "";
            break;
          case "status":
            aValue = a.status || "";
            bValue = b.status || "";
            break;
          case "category":
            aValue = a.category || "";
            bValue = b.category || "";
            break;
          case "project":
            aValue = a.project || "";
            bValue = b.project || "";
            break;
          case "areas":
            aValue = Array.isArray(a.areas) ? a.areas.join(", ") : "";
            bValue = Array.isArray(b.areas) ? b.areas.join(", ") : "";
            break;
          default:
            aValue = "";
            bValue = "";
        }

        // Compare values
        let comparison = 0;
        if (typeof aValue === "string" && typeof bValue === "string") {
          comparison = aValue.localeCompare(bValue);
        } else if (typeof aValue === "number" && typeof bValue === "number") {
          comparison = aValue - bValue;
        } else {
          // Handle mixed types by converting to strings
          comparison = String(aValue).localeCompare(String(bValue));
        }

        // Apply direction
        if (field.direction === "desc") {
          comparison = -comparison;
        }

        // If not equal, return the comparison result
        if (comparison !== 0) {
          return comparison;
        }
      }

      // If all fields are equal, maintain original order
      return 0;
    });
  }

  /**
   * Filter tasks by criteria
   * Filters by project, area, source, and completed status
   */
  filterTasks(
    tasks: readonly Task[],
    criteria: {
      project?: string | null;
      area?: string | null;
      source?: string | null;
      showCompleted?: boolean;
    }
  ): readonly Task[] {
    return tasks.filter((task) => {
      // Project filter
      if (criteria.project) {
        if (task.project !== criteria.project) {
          return false;
        }
      }

      // Area filter
      if (criteria.area) {
        if (!task.areas || !Array.isArray(task.areas)) {
          return false;
        }
        if (!task.areas.includes(criteria.area)) {
          return false;
        }
      }

      // Source filter
      if (criteria.source) {
        const taskSource = task.source?.filePath;
        if (taskSource !== criteria.source) {
          return false;
        }
      }

      // Completed filter - exclude completed tasks unless showCompleted is true
      if (!criteria.showCompleted && task.done === true) {
        return false;
      }

      return true;
    });
  }

  /**
   * Scan existing task files and populate the canonical task store
   * This follows the new architecture where extensions scan their representations
   * during initialization and populate the canonical store using upsert logic
   */
  private async scanAndPopulateExistingTasks(): Promise<void> {
    const existingTasksData = await this.taskOperations.scanExistingTasks();

    for (const taskData of existingTasksData) {
      try {
        taskStore.upsertTask(taskData);
      } catch (error) {
        console.error(`Failed to upsert task ${taskData.title}:`, error);
      }
    }
  }

  // Event handler methods required by Extension interface
  async onEntityCreated(event: any): Promise<void> {
    if (event.type === "areas.created") {
      await this.areaOperations.createNote(event.area);
    } else if (event.type === "projects.created") {
      await this.projectOperations.createNote(event.project);
    } else if (event.type === "tasks.created") {
      const task = event.task;

      // Create the note file and get the file path
      const filePath = await this.taskOperations.createNote(task);

      // Update the task's source to include the file path
      // This prevents duplicate tasks when the file change event fires
      const updatedTask: Task = {
        ...task,
        source: {
          extension: "obsidian",
          ...task.source,
          filePath: filePath,
        },
      };

      // Update the task in the store without triggering another event
      taskStore.updateTask(updatedTask);
    }
  }

  async onEntityUpdated(event: any): Promise<void> {
    if (event.type === "areas.updated") {
      // React to area update by updating the corresponding Obsidian note
      await this.areaOperations.updateNote(event.area);
    } else if (event.type === "projects.updated") {
      // React to project update by updating the corresponding Obsidian note
      await this.projectOperations.updateNote(event.project);
    } else if (event.type === "tasks.updated") {
      // React to task update by updating the corresponding Obsidian note
      await this.taskOperations.updateNote(event.task);
    }
  }

  async onEntityDeleted(event: any): Promise<void> {
    if (event.type === "areas.deleted") {
      // React to area deletion by deleting the corresponding Obsidian note
      await this.areaOperations.deleteNote(event.areaId);
    } else if (event.type === "projects.deleted") {
      // React to project deletion by deleting the corresponding Obsidian note
      await this.projectOperations.deleteNote(event.projectId);
    } else if (event.type === "tasks.deleted") {
      // React to task deletion by deleting the corresponding Obsidian note
      await this.taskOperations.deleteNote(event.taskId);
    }
  }

  /**
   * Sync project bases - create individual bases for projects
   * Public method that can be called when settings change or manually triggered
   */
  async syncProjectBases(): Promise<void> {
    await this.baseManager.syncProjectBases();
  }

  /**
   * Update base manager settings
   * Should be called when settings change
   */
  updateBaseManagerSettings(newSettings: TaskSyncSettings): void {
    this.baseManager.updateSettings(newSettings);
  }

  /**
   * Get base manager instance for direct access if needed
   */
  getBaseManager(): ObsidianBaseManager {
    return this.baseManager;
  }

  /**
   * Set up vault event listeners to handle file deletions
   * When a note is deleted in Obsidian, we need to delete the corresponding entity
   * Set up vault event listeners to handle file changes and deletions
   * When a note is modified or deleted in Obsidian, we need to update or delete the corresponding entity
   */
  private setupVaultEventListeners(): void {
    // Listen for metadata changes (front-matter updates)
    const metadataChangeRef = this.app.metadataCache.on(
      "changed",
      (file, _data, cache) => {
        if (!(file instanceof TFile)) return;

        const filePath = file.path;

        if (filePath.startsWith(this.settings.tasksFolder + "/")) {
          this.handleTaskFileChange(file, cache);
        } else if (filePath.startsWith(this.settings.projectsFolder + "/")) {
          this.handleProjectFileChange(file, cache);
        } else if (filePath.startsWith(this.settings.areasFolder + "/")) {
          this.handleAreaFileChange(file, cache);
        }

        this.handlePotentialTodoCheckboxChange(file);
      }
    );

    // Listen for file deletions in the vault
    const deleteRef = this.app.vault.on("delete", (file) => {
      if (!(file instanceof TFile)) return;

      const filePath = file.path;

      // Check if the deleted file is in one of our entity folders
      if (filePath.startsWith(this.settings.tasksFolder + "/")) {
        this.handleTaskFileDeletion(filePath);
      } else if (filePath.startsWith(this.settings.projectsFolder + "/")) {
        this.handleProjectFileDeletion(filePath);
      } else if (filePath.startsWith(this.settings.areasFolder + "/")) {
        this.handleAreaFileDeletion(filePath);
      }
    });

    this.vaultEventRefs.push(metadataChangeRef);
    this.vaultEventRefs.push(deleteRef);
  }

  /**
   * Handle task file deletion by finding and deleting the corresponding entity
   */
  private handleTaskFileDeletion(filePath: string): void {
    const task = taskStore.findByFilePath(filePath);
    if (task) {
      console.log(
        `Task file deleted: ${filePath}, deleting entity: ${task.id}`
      );
      // Use Tasks.Operations directly since we need to trigger domain events
      const taskOps = new Tasks.Operations(this.settings);
      taskOps.delete(task.id);
    }
  }

  /**
   * Handle project file deletion by finding and deleting the corresponding entity
   */
  private handleProjectFileDeletion(filePath: string): void {
    const project = projectStore.findByFilePath(filePath);
    if (project) {
      console.log(
        `Project file deleted: ${filePath}, deleting entity: ${project.id}`
      );
      const projectOps = new Projects.Operations(this.settings);
      projectOps.delete(project.id);
    }
  }

  /**
   * Handle area file deletion by finding and deleting the corresponding entity
   */
  private handleAreaFileDeletion(filePath: string): void {
    const area = areaStore.findByFilePath(filePath);
    if (area) {
      console.log(
        `Area file deleted: ${filePath}, deleting entity: ${area.id}`
      );
      const areaOps = new Areas.Operations(this.settings);
      areaOps.delete(area.id);
    }
  }

  /*
   * Handle task file change by reloading the task from the file
   */
  private async handleTaskFileChange(file: TFile, cache: any): Promise<void> {
    await this.taskOperations.rescanFile(file, cache);
  }

  /**
   * Handle potential todo checkbox changes in non-entity files
   * This detects when a promoted todo checkbox is clicked and syncs with the task file
   */
  private async handlePotentialTodoCheckboxChange(file: TFile): Promise<void> {
    try {
      // Read the file content to check for promoted todos (wiki links with checkboxes)
      const content = await this.app.vault.read(file);
      const lines = content.split("\n");

      // Look for lines that match the pattern: - [x] [[Task Name]] or - [ ] [[Task Name]]
      const promotedTodoRegex = /^(\s*)([-*])\s*\[([xX\s])\]\s*\[\[(.+)\]\]$/;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const match = line.match(promotedTodoRegex);

        if (match) {
          const [, , , checkboxState, taskTitle] = match;
          const isCompleted = checkboxState.toLowerCase() === "x";

          // Find the corresponding task file
          const taskFilePath = `${this.settings.tasksFolder}/${taskTitle}.md`;
          const taskFile = this.app.vault.getAbstractFileByPath(taskFilePath);

          if (taskFile instanceof TFile) {
            await this.syncTaskCompletionFromTodo(taskFile, isCompleted);
          }
        }
      }
    } catch (error) {
      // Silently fail - this is a background sync operation
    }
  }

  /**
   * Sync task completion status based on promoted todo checkbox state
   * Uses entity operations to update the task, which triggers the tasks.updated
   * handler to update front-matter using Obsidian's processFrontMatter API
   */
  private async syncTaskCompletionFromTodo(
    taskFile: TFile,
    isCompleted: boolean
  ): Promise<void> {
    try {
      // Find the task by file path
      const task = taskStore.findByFilePath(taskFile.path);

      if (!task) {
        return;
      }

      // Only update if the status has changed
      if (task.done !== isCompleted) {
        // Update the task using entity operations
        // This will trigger tasks.updated event which will update the file
        const taskOps = new Tasks.Operations(this.settings);
        await taskOps.update({
          ...task,
          done: isCompleted,
        });
      }
    } catch (error) {
      // Silently fail - this is a background sync operation
    }
  }

  /**
   * Handle project file change by reloading the project from the file
   * TODO: Implement project rescanning once project scanning is implemented
   */
  private async handleProjectFileChange(
    file: TFile,
    cache: any
  ): Promise<void> {
    console.log(
      `Project file changed: ${file.path} (rescanning not yet implemented)`
    );
  }

  /**
   * Handle area file change by reloading the area from the file
   * TODO: Implement area rescanning once area scanning is implemented
   */
  private async handleAreaFileChange(file: TFile, cache: any): Promise<void> {
    console.log(
      `Area file changed: ${file.path} (rescanning not yet implemented)`
    );
  }

  private setupEventListeners(): void {
    // Subscribe to domain events to reactively manage Obsidian notes
    eventBus.on("areas.created", this.onEntityCreated.bind(this));
    eventBus.on("areas.updated", this.onEntityUpdated.bind(this));
    eventBus.on("areas.deleted", this.onEntityDeleted.bind(this));

    eventBus.on("projects.created", this.onEntityCreated.bind(this));
    eventBus.on("projects.updated", this.onEntityUpdated.bind(this));
    eventBus.on("projects.deleted", this.onEntityDeleted.bind(this));

    // Note: Base generation for projects is now handled directly in ObsidianProjectOperations.createNote()
    // instead of as a side-effect of domain events, making it faster and more synchronous

    eventBus.on("tasks.created", this.onEntityCreated.bind(this));
    eventBus.on("tasks.updated", this.onEntityUpdated.bind(this));
    eventBus.on("tasks.deleted", this.onEntityDeleted.bind(this));
  }

  /**
   * Register the task todo markdown processor
   */
  private registerTaskTodoMarkdownProcessor(): void {
    if (this.taskTodoMarkdownProcessor) {
      this.markdownProcessor = this.plugin.registerMarkdownPostProcessor(
        this.taskTodoMarkdownProcessor.getProcessor(),
        100 // Sort order - run after other processors
      );
      console.log("Task todo markdown processor registered");
    }
  }

  /**
   * Cleanup the task todo markdown processor reference
   */
  private unregisterTaskTodoMarkdownProcessor(): void {
    if (this.markdownProcessor) {
      // Note: Obsidian doesn't provide a direct unregister method for post processors.
      // The processor will remain registered until the plugin is unloaded by Obsidian,
      // at which point Obsidian will automatically clean up all registered processors.
      // We only clear our reference here to avoid memory leaks.
      this.markdownProcessor = undefined;
      console.log(
        "Task todo markdown processor reference cleared (actual cleanup occurs on plugin unload)"
      );
    }
  }

  /**
   * Register Task note type with TypeNote
   * This creates and registers the Task note type based on current settings
   */
  private async registerTaskNoteType(): Promise<void> {
    try {
      // Build Task note type from current settings
      const taskNoteType = buildTaskNoteType(this.settings);

      // Register with TypeNote registry
      const result = this.typeNote.registry.register(taskNoteType, {
        allowOverwrite: true, // Allow re-registration when settings change
        validate: true,
        checkCompatibility: false, // Don't check compatibility on initial registration
      });

      if (!result.valid) {
        console.error("Failed to register Task note type:", result.errors);
        throw new Error(
          `Task note type registration failed: ${
            result.errors?.[0]?.message || "Unknown error"
          }`
        );
      }

      console.log("Task note type registered successfully with TypeNote");
    } catch (error) {
      console.error("Error registering Task note type:", error);
      throw error;
    }
  }

  /**
   * Update Task note type when settings change
   * This should be called when task categories, priorities, or statuses are modified
   */
  async updateTaskNoteType(): Promise<void> {
    await this.registerTaskNoteType();
  }
}
