/**
 * EntityCacheHandler - Automatically caches entities when they are created
 * Handles TASK_CREATED, PROJECT_CREATED, AREA_CREATED events to cache entities in storage
 */

import { App, TFile } from "obsidian";
import {
  EventHandler,
  EventType,
  PluginEvent,
  TaskEventData,
  StatusChangedEventData,
  DoneChangedEventData,
} from "../EventTypes";
import { TaskSyncSettings } from "../../main";
import { PluginStorageService } from "../../services/PluginStorageService";

/**
 * Handler that automatically caches entities when they are created
 */
export class EntityCacheHandler implements EventHandler {
  constructor(
    private app: App,
    private settings: TaskSyncSettings,
    private storageService: PluginStorageService
  ) {}

  /**
   * Update the settings reference for this handler
   */
  updateSettings(newSettings: TaskSyncSettings): void {
    this.settings = newSettings;
  }

  /**
   * Get the event types this handler supports
   */
  getSupportedEventTypes(): EventType[] {
    return [
      EventType.TASK_CREATED,
      EventType.PROJECT_CREATED,
      EventType.AREA_CREATED,
      EventType.STATUS_CHANGED,
      EventType.DONE_CHANGED,
    ];
  }

  /**
   * Handle entity creation and update events and cache them
   */
  async handle(event: PluginEvent): Promise<void> {
    try {
      switch (event.type) {
        case EventType.TASK_CREATED:
          await this.cacheTask(event.data as TaskEventData);
          break;
        case EventType.PROJECT_CREATED:
          await this.cacheProject(event.data as TaskEventData);
          break;
        case EventType.AREA_CREATED:
          await this.cacheArea(event.data as TaskEventData);
          break;
        case EventType.STATUS_CHANGED:
        case EventType.DONE_CHANGED:
          await this.updateCachedEntity(
            event.data as StatusChangedEventData | DoneChangedEventData
          );
          break;
      }
    } catch (error) {
      const filePath = (event.data as any).filePath || "unknown";
      console.error(
        `EntityCacheHandler: Error caching entity for ${filePath}:`,
        error
      );
    }
  }

  /**
   * Cache a task entity
   */
  private async cacheTask(data: TaskEventData): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(data.filePath);
    if (!(file instanceof TFile)) {
      console.warn(`EntityCacheHandler: Task file not found: ${data.filePath}`);
      return;
    }

    // Use Obsidian's metadata cache to get front-matter
    const cache = this.app.metadataCache.getFileCache(file);
    const frontmatter = cache?.frontmatter || {};

    // Create a simple task object for caching
    const task = {
      id: this.generateId(),
      name: frontmatter.Title || frontmatter.Name || file.basename,
      filePath: data.filePath,
      type: frontmatter.Type || "Task",
      priority: frontmatter.Priority,
      areas: this.normalizeArrayProperty(frontmatter.Areas),
      project: frontmatter.Project,
      done: frontmatter.Done || false,
      status: frontmatter.Status,
      parentTask: frontmatter["Parent task"],
      subTasks: this.normalizeArrayProperty(frontmatter["Sub-tasks"]),
      tags: this.normalizeArrayProperty(frontmatter.tags),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.storageService.cacheTask(task as any);
  }

  /**
   * Cache a project entity
   */
  private async cacheProject(data: TaskEventData): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(data.filePath);
    if (!(file instanceof TFile)) {
      console.warn(
        `EntityCacheHandler: Project file not found: ${data.filePath}`
      );
      return;
    }

    // Use Obsidian's metadata cache to get front-matter
    const cache = this.app.metadataCache.getFileCache(file);
    const frontmatter = cache?.frontmatter || {};

    // Create a simple project object for caching
    const project = {
      id: this.generateId(),
      name: frontmatter.Name || file.basename,
      filePath: data.filePath,
      type: frontmatter.Type || "Project",
      areas: this.normalizeArrayProperty(frontmatter.Areas),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.storageService.cacheProject(project as any);
  }

  /**
   * Cache an area entity
   */
  private async cacheArea(data: TaskEventData): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(data.filePath);
    if (!(file instanceof TFile)) {
      console.warn(`EntityCacheHandler: Area file not found: ${data.filePath}`);
      return;
    }

    // Use Obsidian's metadata cache to get front-matter
    const cache = this.app.metadataCache.getFileCache(file);
    const frontmatter = cache?.frontmatter || {};

    // Create a simple area object for caching
    const area = {
      id: this.generateId(),
      name: frontmatter.Name || file.basename,
      filePath: data.filePath,
      type: frontmatter.Type || "Area",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.storageService.cacheArea(area as any);
  }

  /**
   * Update cached entity when file properties change
   */
  private async updateCachedEntity(
    data: StatusChangedEventData | DoneChangedEventData
  ): Promise<void> {
    const { filePath, frontmatter } = data;

    // Determine entity type from file path
    const entityType = this.getEntityType(filePath);

    if (entityType === "task") {
      await this.updateCachedTask(filePath, frontmatter);
    } else if (entityType === "project") {
      await this.updateCachedProject(filePath, frontmatter);
    } else if (entityType === "area") {
      await this.updateCachedArea(filePath, frontmatter);
    }
  }

  /**
   * Update a cached task with new front-matter data
   */
  private async updateCachedTask(
    filePath: string,
    frontmatter: Record<string, any>
  ): Promise<void> {
    const cachedTasks = this.storageService.getCachedTasks();
    const taskIndex = cachedTasks.findIndex(
      (t: any) => t.filePath === filePath
    );

    if (taskIndex !== -1) {
      // Update existing cached task
      const existingTask = cachedTasks[taskIndex] as any;
      const updatedTask = {
        ...existingTask,
        name: frontmatter.Title || frontmatter.Name || existingTask.name,
        type: frontmatter.Type || existingTask.type,
        priority: frontmatter.Priority,
        areas: this.normalizeArrayProperty(frontmatter.Areas),
        project: frontmatter.Project,
        done: frontmatter.Done,
        status: frontmatter.Status,
        parentTask: frontmatter["Parent task"],
        subTasks: this.normalizeArrayProperty(frontmatter["Sub-tasks"]),
        tags: this.normalizeArrayProperty(frontmatter.tags),
        updatedAt: new Date(),
      };

      await this.storageService.cacheTask(updatedTask as any);
      console.log(`EntityCacheHandler: Updated cached task for ${filePath}`);
    }
  }

  /**
   * Update a cached project with new front-matter data
   */
  private async updateCachedProject(
    filePath: string,
    frontmatter: Record<string, any>
  ): Promise<void> {
    const cachedProjects = this.storageService.getCachedProjects();
    const projectIndex = cachedProjects.findIndex(
      (p: any) => p.filePath === filePath
    );

    if (projectIndex !== -1) {
      // Update existing cached project
      const existingProject = cachedProjects[projectIndex] as any;
      const updatedProject = {
        ...existingProject,
        name: frontmatter.Name || existingProject.name,
        type: frontmatter.Type || existingProject.type,
        areas: this.normalizeArrayProperty(frontmatter.Areas),
        updatedAt: new Date(),
      };

      await this.storageService.cacheProject(updatedProject as any);
      console.log(`EntityCacheHandler: Updated cached project for ${filePath}`);
    }
  }

  /**
   * Update a cached area with new front-matter data
   */
  private async updateCachedArea(
    filePath: string,
    frontmatter: Record<string, any>
  ): Promise<void> {
    const cachedAreas = this.storageService.getCachedAreas();
    const areaIndex = cachedAreas.findIndex(
      (a: any) => a.filePath === filePath
    );

    if (areaIndex !== -1) {
      // Update existing cached area
      const existingArea = cachedAreas[areaIndex] as any;
      const updatedArea = {
        ...existingArea,
        name: frontmatter.Name || existingArea.name,
        type: frontmatter.Type || existingArea.type,
        updatedAt: new Date(),
      };

      await this.storageService.cacheArea(updatedArea as any);
      console.log(`EntityCacheHandler: Updated cached area for ${filePath}`);
    }
  }

  /**
   * Determine entity type from file path
   */
  private getEntityType(filePath: string): "task" | "project" | "area" {
    if (filePath.startsWith(this.settings.tasksFolder + "/")) {
      return "task";
    } else if (filePath.startsWith(this.settings.projectsFolder + "/")) {
      return "project";
    } else if (filePath.startsWith(this.settings.areasFolder + "/")) {
      return "area";
    }
    return "task"; // Default fallback
  }

  /**
   * Normalize array properties from front-matter
   */
  private normalizeArrayProperty(value: any): string[] {
    if (!value) return [];
    if (Array.isArray(value)) return value.map(String);
    if (typeof value === "string")
      return value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    return [String(value)];
  }

  /**
   * Generate a unique ID for entities
   */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }
}
