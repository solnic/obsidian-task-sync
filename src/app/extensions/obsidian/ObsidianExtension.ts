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
import { Extension, extensionRegistry, EntityType } from "../../core/extension";
import { eventBus } from "../../core/events";
import { ObsidianAreaOperations } from "./operations/AreaOperations";
import { ObsidianProjectOperations } from "./operations/ProjectOperations";
import { ObsidianTaskOperations } from "./operations/TaskOperations";
import { TaskTodoMarkdownProcessor } from "./processors/TaskTodoMarkdownProcessor";
import { taskStore } from "../../stores/taskStore";
import { TaskQueryService } from "../../services/TaskQueryService";
import { ProjectQueryService } from "../../services/ProjectQueryService";
import { AreaQueryService } from "../../services/AreaQueryService";
import { projectStore } from "../../stores/projectStore";
import { areaStore } from "../../stores/areaStore";
import { Obsidian } from "./entities/Obsidian";
import { ContextService } from "../../services/ContextService";
import { Tasks } from "../../entities/Tasks";
import { Projects } from "../../entities/Projects";
import { Areas } from "../../entities/Areas";
import type { Task, Project, Area } from "../../core/entities";
import type { TaskSyncSettings } from "../../types/settings";
import { ObsidianBaseManager } from "./utils/BaseManager";
import { DailyNoteFeature } from "./features/DailyNoteFeature";
import { derived, get, writable, type Readable } from "svelte/store";
import { syncManager, type EntityDataProvider } from "../../core/SyncManager";
import { NoteKit } from "../../core/note-kit/NoteKit";
import { buildTaskNoteType } from "./types/TaskNoteType";
import { createProjectNoteType } from "./types/ProjectNoteType";
import { createAreaNoteType } from "./types/AreaNoteType";
import { ObsidianTaskSource } from "./sources/TaskSource";
import { taskSourceManager } from "../../core/TaskSourceManager";

/**
 * EntityDataProvider for Obsidian extension
 * Handles reading/writing task data to/from Obsidian files
 */
class ObsidianEntityDataProvider implements EntityDataProvider {
  extensionId = "obsidian";

  constructor(private extension: ObsidianExtension) {}

  async readEntityData(entityId: string): Promise<Partial<Task> | null> {
    // For cross-source entities (like imported GitHub tasks), we need to find the task
    // by its Obsidian file path, not by ID, since the task may have different IDs
    // in different stores
    const mainStoreState = get(taskStore);
    const mainTask = mainStoreState.tasks.find((t) => t.id === entityId);

    if (mainTask && mainTask.source.keys.obsidian) {
      // Find the corresponding task in Obsidian entity store by file path
      const obsidianTasks = get(this.extension.getEntityStore()) as Task[];
      const obsidianTask = obsidianTasks.find(
        (t) => t.source.keys.obsidian === mainTask.source.keys.obsidian
      );

      if (obsidianTask) {
        return obsidianTask;
      }
    }

    // Fallback: try to find by ID in Obsidian entity store (for Obsidian-only tasks)
    const obsidianTasks = get(this.extension.getEntityStore()) as Task[];
    const task = obsidianTasks.find((t) => t.id === entityId);

    if (task && task.source.keys.obsidian) {
      return task;
    }

    return null;
  }

  async writeEntityData(entityId: string, data: Partial<Task>): Promise<void> {
    console.log(
      `[ObsidianEntityDataProvider] writeEntityData called for entity ${entityId}`
    );
    console.log(`[ObsidianEntityDataProvider] Data to write:`, {
      title: data.title,
      source: data.source,
    });

    // For cross-source entities (like imported GitHub tasks), we need to find the task
    // by its Obsidian file path, not by ID, since the task may have different IDs
    // in different stores
    const mainStoreState = get(taskStore);
    const mainTask = mainStoreState.tasks.find((t) => t.id === entityId);

    let obsidianTask: Task | undefined;

    if (mainTask && mainTask.source.keys.obsidian) {
      // Find the corresponding task in Obsidian entity store by file path
      const obsidianTasks = get(this.extension.getEntityStore()) as Task[];
      obsidianTask = obsidianTasks.find(
        (t) => t.source.keys.obsidian === mainTask.source.keys.obsidian
      );
    }

    // Fallback: try to find by ID in Obsidian entity store (for Obsidian-only tasks)
    if (!obsidianTask) {
      const obsidianTasks = get(this.extension.getEntityStore()) as Task[];
      obsidianTask = obsidianTasks.find((t) => t.id === entityId);
    }

    if (obsidianTask && obsidianTask.source.keys.obsidian) {
      console.log(
        `[ObsidianEntityDataProvider] Found Obsidian task, updating file: ${obsidianTask.source.keys.obsidian}`
      );
      // Update the task file with the merged data
      const mergedTask = { ...obsidianTask, ...data };
      console.log(`[ObsidianEntityDataProvider] Merged task data:`, {
        title: mergedTask.title,
        source: mergedTask.source,
      });
      await this.extension.taskOperations.updateNote(mergedTask);
      console.log(`[ObsidianEntityDataProvider] File update completed`);
    } else {
      console.log(
        `[ObsidianEntityDataProvider] No Obsidian task found for entity ${entityId}`
      );
    }
  }

  canHandle(entity: Task): boolean {
    return !!entity.source.keys.obsidian;
  }

  /**
   * Obsidian syncs all properties since it's the storage layer
   * However, properties from other sources (like GitHub) should be preserved
   * by the SyncManager's merge strategy, not overridden by Obsidian
   *
   * Returning undefined means all properties are syncable (backward compatibility)
   */
  getSyncableProperties(): Array<keyof Task> | undefined {
    // Obsidian stores all properties, so we don't filter
    // The SyncManager's "source-wins" strategy ensures that properties
    // from the authoritative source (e.g., GitHub) are preserved
    return undefined;
  }
}

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

  // Extension's own entity store - contains Obsidian tasks owned by this extension
  private entityStore = writable<Task[]>([]);

  /**
   * Get the extension's entity store (read-only)
   */
  getEntityStore(): Readable<Task[]> {
    return this.entityStore;
  }

  /**
   * Update the extension's entity store
   */
  updateEntityStore(tasks: Task[]): void {
    this.entityStore.set(tasks);
  }

  private taskTodoMarkdownProcessor?: TaskTodoMarkdownProcessor;
  private markdownProcessor?: MarkdownPostProcessor;

  readonly areaOperations: ObsidianAreaOperations;
  readonly projectOperations: ObsidianProjectOperations;
  readonly taskOperations: ObsidianTaskOperations;
  readonly todoPromotionOperations: Obsidian.TodoPromotionOperations;
  readonly typeNote: NoteKit;

  // SyncManager provider
  private entityDataProvider?: ObsidianEntityDataProvider;

  constructor(
    private app: App,
    private plugin: Plugin,
    private settings: ObsidianExtensionSettings,
    typeNote: NoteKit
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
    this.dailyNoteFeature = new DailyNoteFeature(app, settings, {
      dailyNotesFolder: settings.dailyNotesFolder,
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

      // Note: NoteKit initialization is handled by the plugin
      // We're using a shared NoteKit instance passed from the plugin

      // Register note types with NoteKit
      console.log("Registering note types with NoteKit...");
      await this.registerTaskNoteType();
      await this.registerProjectNoteType();
      await this.registerAreaNoteType();

      // Verify registration
      const registeredTypes = this.typeNote.registry.getAll();
      console.log(
        `Total note types registered: ${registeredTypes.length}`,
        registeredTypes.map((nt) => nt.id)
      );

      // Initialize markdown processor now that wikiLinkOperations is available
      this.taskTodoMarkdownProcessor = new TaskTodoMarkdownProcessor(
        this.app,
        this.settings,
        this.wikiLinkOperations
      );

      // Register ObsidianTaskSource with TaskSourceManager
      console.log("Registering ObsidianTaskSource with TaskSourceManager...");
      const taskSource = new ObsidianTaskSource(this.app, this.settings, this);
      taskSourceManager.registerSource(taskSource);
      console.log("ObsidianTaskSource registered successfully");

      // Register EntityDataProvider with SyncManager
      console.log("Registering ObsidianEntityDataProvider with SyncManager...");
      this.entityDataProvider = new ObsidianEntityDataProvider(this);
      syncManager.registerProvider(this.entityDataProvider);
      console.log("ObsidianEntityDataProvider registered successfully");

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
      console.log("Loading ObsidianExtension - scanning existing entities...");

      // Refresh tasks from ObsidianTaskSource via TaskSourceManager
      // This runs after Obsidian's layout is ready and vault is fully loaded
      // Use refreshSource instead of loadSource to trigger SyncManager for cross-source tasks
      await taskSourceManager.refreshSource("obsidian");
      console.log("Tasks refreshed from ObsidianTaskSource");

      // Scan and load existing projects
      console.log("Scanning existing projects...");
      const projects = await this.projectOperations.scanExistingProjects();
      console.log(`Found ${projects.length} projects in vault`);

      // Add each project to the store
      for (const project of projects) {
        projectStore.dispatch({
          type: "ADD_PROJECT",
          project,
        });
      }
      console.log(`Loaded ${projects.length} projects into store`);

      // Scan and load existing areas
      console.log("Scanning existing areas...");
      const areas = await this.areaOperations.scanExistingAreas();
      console.log(`Found ${areas.length} areas in vault`);

      // Add each area to the store
      for (const area of areas) {
        areaStore.dispatch({
          type: "ADD_AREA",
          area,
        });
      }
      console.log(`Loaded ${areas.length} areas into store`);

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

    // Cleanup NoteKit system
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
   *
   * Updated to use taskStore (action-based architecture)
   */
  getTasks(): Readable<readonly Task[]> {
    return derived(taskStore, ($store) => $store.tasks);
  }

  /**
   * Refresh tasks by re-scanning the vault
   * Public method that can be called by UI components
   *
   * Updated to use TaskSourceManager which handles:
   * - Scanning vault via ObsidianTaskSource
   * - Dispatching actions to taskStore
   * - Managing loading/error states
   */
  async refresh(): Promise<void> {
    try {
      console.log("Refreshing Obsidian tasks via TaskSourceManager...");

      // Use TaskSourceManager to refresh tasks from ObsidianTaskSource
      // This will:
      // 1. Call ObsidianTaskSource.refresh()
      // 2. Dispatch LOAD_SOURCE_START action
      // 3. Dispatch LOAD_SOURCE_SUCCESS with fresh tasks
      // 4. Store reducer handles replacing old tasks with fresh ones
      await taskSourceManager.refreshSource("obsidian");

      console.log("Refresh completed successfully via TaskSourceManager");
    } catch (err: any) {
      console.error("Failed to refresh tasks:", err);
      throw err;
    }
  }

  // Note: Search, filter, and sort operations removed
  // Components should use TaskQueryService for these operations

  // Event handler methods required by Extension interface
  async onEntityCreated(event: any): Promise<void> {
    try {
      if (event.type === "areas.created") {
        const area = event.area;

        // Create the note file and get the file path
        const filePath = await this.areaOperations.createNote(area);

        // Update the area's source to include the file path
        // This prevents issues when the file is deleted
        // IMPORTANT: Preserve the original extension if it exists
        const updatedArea: Area = {
          ...area,
          source: {
            ...area.source,
            extension: area.source.extension || "obsidian", // Preserve original extension
            filePath: filePath,
          },
        };

        // Update the area in the store without triggering another event
        areaStore.dispatch({ type: "UPDATE_AREA", area: updatedArea });
      } else if (event.type === "projects.created") {
        const project = event.project;

        // Create the note file and get the file path
        const filePath = await this.projectOperations.createNote(project);

        // Update the project's source to include the file path
        // This prevents issues when the file is deleted
        // IMPORTANT: Preserve the original extension if it exists
        const updatedProject: Project = {
          ...project,
          source: {
            ...project.source,
            extension: project.source.extension || "obsidian", // Preserve original extension
            filePath: filePath,
          },
        };

        // Update the project in the store without triggering another event
        projectStore.dispatch({
          type: "UPDATE_PROJECT",
          project: updatedProject,
        });
      } else if (event.type === "tasks.created") {
        const task = event.task;

        // Create the note file and get the file path
        const filePath = await this.taskOperations.createNote(task);

        // Update the task's source to include the file path
        // This prevents duplicate tasks when the file change event fires
        // IMPORTANT: Preserve the original extension (e.g., "github") if it exists
        const updatedTask: Task = {
          ...task,
          source: {
            ...task.source,
            extension: task.source.extension || "obsidian", // Preserve original extension
            keys: {
              ...task.source.keys,
              obsidian: filePath,
            },
          },
        };

        // Update the task in the store AND trigger persistence
        // We need to trigger tasks.updated event so the updated task (with filePath) gets persisted
        // This is critical for preserving source.extension after plugin reload
        taskStore.dispatch({ type: "UPDATE_TASK", task: updatedTask });
        eventBus.trigger({
          type: "tasks.updated",
          task: updatedTask,
        });
      }
    } catch (error) {
      console.error(`Failed to create entity file for ${event?.type}:`, error);
      // Re-throw to allow calling code to handle the error
      throw error;
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
      // The event includes the area entity so we can access its filePath
      await this.areaOperations.deleteNote(event.area);
    } else if (event.type === "projects.deleted") {
      // React to project deletion by deleting the corresponding Obsidian note
      // The event includes the project entity so we can access its filePath
      await this.projectOperations.deleteNote(event.project);
    } else if (event.type === "tasks.deleted") {
      // React to task deletion by deleting the corresponding Obsidian note
      // The event includes the task entity so we can access its filePath
      await this.taskOperations.deleteNote(event.task);
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
   * Update settings for all operations and components
   * Should be called when settings change
   */
  updateSettings(newSettings: TaskSyncSettings): void {
    this.settings = newSettings;

    // Update base manager
    this.baseManager.updateSettings(newSettings);

    // Update operations that have settings-dependent logic
    this.projectOperations.updateSettings(newSettings);
    this.taskOperations.updateSettings(newSettings);

    // Note: AreaOperations doesn't need settings update as it doesn't store settings
  }

  /**
   * Get base manager instance for direct access if needed
   */
  getBaseManager(): ObsidianBaseManager {
    return this.baseManager;
  }

  /**
   * Set up vault event listeners to handle file changes and deletions
   *
   * NOTE: Task file changes AND deletions are handled by ObsidianTaskSource.watch()
   * which is registered with TaskSourceManager. This method only handles:
   * - Project and Area file changes (no DataSources for these yet)
   * - Project and Area deletions (triggers Operations.delete())
   * - Todo checkbox changes (syncs checkbox state with task files)
   */
  private setupVaultEventListeners(): void {
    // Listen for metadata changes (front-matter updates)
    const metadataChangeRef = this.app.metadataCache.on(
      "changed",
      (file, _data, cache) => {
        if (!(file instanceof TFile)) return;

        const filePath = file.path;

        // Task file changes are handled by ObsidianTaskSource.watch()
        // Only handle Projects and Areas here
        if (filePath.startsWith(this.settings.projectsFolder + "/")) {
          void this.handleProjectFileChange(file, cache);
        } else if (filePath.startsWith(this.settings.areasFolder + "/")) {
          void this.handleAreaFileChange(file, cache);
        }

        // Handle todo checkbox changes in all files
        void this.handlePotentialTodoCheckboxChange(file);
      }
    );

    // Listen for file deletions in the vault
    // NOTE: Task deletions are handled by ObsidianTaskSource.watch()
    // Only handle Project and Area deletions here
    const deleteRef = this.app.vault.on("delete", (file) => {
      if (!(file instanceof TFile)) return;

      const filePath = file.path;

      // Check if the deleted file is a Project or Area
      // Task deletions are handled by ObsidianTaskSource
      if (filePath.startsWith(this.settings.projectsFolder + "/")) {
        void this.handleProjectFileDeletion(filePath);
      } else if (filePath.startsWith(this.settings.areasFolder + "/")) {
        void this.handleAreaFileDeletion(filePath);
      }
    });

    this.vaultEventRefs.push(metadataChangeRef);
    this.vaultEventRefs.push(deleteRef);
  }

  /**
   * Handle project file deletion by finding and deleting the corresponding entity
   */
  private async handleProjectFileDeletion(filePath: string): Promise<void> {
    const projectStoreState = get(projectStore);
    const project = ProjectQueryService.findByFilePath(
      projectStoreState.projects,
      filePath
    );
    if (!project) {
      console.warn(`Project file deleted but entity not found: ${filePath}`);
      return;
    }
    console.log(
      `Project file deleted: ${filePath}, deleting entity: ${project.id}`
    );
    const projectOps = new Projects.Operations(this.settings);
    await projectOps.delete(project.id);
  }

  /**
   * Handle area file deletion by finding and deleting the corresponding entity
   */
  private async handleAreaFileDeletion(filePath: string): Promise<void> {
    const areaStoreState = get(areaStore);
    const area = AreaQueryService.findByFilePath(
      areaStoreState.areas,
      filePath
    );
    if (!area) {
      console.warn(`Area file deleted but entity not found: ${filePath}`);
      return;
    }
    console.log(`Area file deleted: ${filePath}, deleting entity: ${area.id}`);
    const areaOps = new Areas.Operations(this.settings);
    await areaOps.delete(area.id);
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
      const storeState = get(taskStore);
      const task = TaskQueryService.findByFilePath(
        storeState.tasks,
        taskFile.path
      );

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
    _cache: any
  ): Promise<void> {
    console.log(
      `Project file changed: ${file.path} (rescanning not yet implemented)`
    );
  }

  /**
   * Handle area file change by reloading the area from the file
   * TODO: Implement area rescanning once area scanning is implemented
   */
  private async handleAreaFileChange(file: TFile, _cache: any): Promise<void> {
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
   * Register Task note type with NoteKit
   * This creates and registers the Task note type based on current settings
   */
  private async registerTaskNoteType(): Promise<void> {
    try {
      // Check if Task note type already exists (from persisted data)
      if (this.typeNote.registry.has("task")) {
        console.log(
          "Task note type already exists in registry (loaded from persistence), skipping default registration"
        );
        return;
      }

      // Build Task note type with default configuration
      const taskNoteType = buildTaskNoteType();

      // Register with NoteKit registry
      const result = this.typeNote.registry.register(taskNoteType, {
        allowOverwrite: false, // Don't overwrite persisted note types
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

      console.log("Task note type registered successfully with NoteKit");
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

  /**
   * Register Project note type with NoteKit
   * This creates and registers the Project note type
   */
  private async registerProjectNoteType(): Promise<void> {
    try {
      // Check if Project note type already exists (from persisted data)
      if (this.typeNote.registry.has("project")) {
        console.log(
          "Project note type already exists in registry (loaded from persistence), skipping default registration"
        );
        return;
      }

      // Create Project note type
      const projectNoteType = createProjectNoteType();

      // Register with NoteKit registry
      const result = this.typeNote.registry.register(projectNoteType, {
        allowOverwrite: false, // Don't overwrite persisted note types
        validate: true,
        checkCompatibility: false,
      });

      if (!result.valid) {
        console.error("Failed to register Project note type:", result.errors);
        throw new Error(
          `Project note type registration failed: ${
            result.errors?.[0]?.message || "Unknown error"
          }`
        );
      }

      console.log("Project note type registered successfully with NoteKit");
    } catch (error) {
      console.error("Error registering Project note type:", error);
      throw error;
    }
  }

  /**
   * Register Area note type with NoteKit
   * This creates and registers the Area note type
   */
  private async registerAreaNoteType(): Promise<void> {
    try {
      // Check if Area note type already exists (from persisted data)
      if (this.typeNote.registry.has("area")) {
        console.log(
          "Area note type already exists in registry (loaded from persistence), skipping default registration"
        );
        return;
      }

      // Create Area note type
      const areaNoteType = createAreaNoteType();

      // Register with NoteKit registry
      const result = this.typeNote.registry.register(areaNoteType, {
        allowOverwrite: false, // Don't overwrite persisted note types
        validate: true,
        checkCompatibility: false,
      });

      if (!result.valid) {
        console.error("Failed to register Area note type:", result.errors);
        throw new Error(
          `Area note type registration failed: ${
            result.errors?.[0]?.message || "Unknown error"
          }`
        );
      }

      console.log("Area note type registered successfully with NoteKit");
    } catch (error) {
      console.error("Error registering Area note type:", error);
      throw error;
    }
  }
}
