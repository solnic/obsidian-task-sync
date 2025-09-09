/**
 * EntityCacheHandler - Automatically caches entities when they are created
 * Handles TASK_CREATED, PROJECT_CREATED, AREA_CREATED events to cache entities in storage
 */

import { App, TFile } from 'obsidian';
import {
  EventHandler,
  EventType,
  PluginEvent,
  TaskEventData
} from '../EventTypes';
import { TaskSyncSettings } from '../../main';
import { PluginStorageService } from '../../services/PluginStorageService';

/**
 * Handler that automatically caches entities when they are created
 */
export class EntityCacheHandler implements EventHandler {
  constructor(
    private app: App,
    private settings: TaskSyncSettings,
    private storageService: PluginStorageService
  ) { }

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
      EventType.AREA_CREATED
    ];
  }

  /**
   * Handle entity creation events and cache them
   */
  async handle(event: PluginEvent): Promise<void> {
    const data = event.data as TaskEventData;

    try {
      switch (event.type) {
        case EventType.TASK_CREATED:
          await this.cacheTask(data);
          break;
        case EventType.PROJECT_CREATED:
          await this.cacheProject(data);
          break;
        case EventType.AREA_CREATED:
          await this.cacheArea(data);
          break;
      }
    } catch (error) {
      console.error(`EntityCacheHandler: Error caching entity for ${data.filePath}:`, error);
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
      type: frontmatter.Type || 'Task',
      priority: frontmatter.Priority,
      areas: this.normalizeArrayProperty(frontmatter.Areas),
      project: frontmatter.Project,
      done: frontmatter.Done || false,
      status: frontmatter.Status,
      parentTask: frontmatter['Parent task'],
      subTasks: this.normalizeArrayProperty(frontmatter['Sub-tasks']),
      tags: this.normalizeArrayProperty(frontmatter.tags),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.storageService.cacheTask(task as any);
    console.log(`EntityCacheHandler: Cached task: ${task.name} (${task.filePath})`);
  }

  /**
   * Cache a project entity
   */
  private async cacheProject(data: TaskEventData): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(data.filePath);
    if (!(file instanceof TFile)) {
      console.warn(`EntityCacheHandler: Project file not found: ${data.filePath}`);
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
      type: frontmatter.Type || 'Project',
      areas: this.normalizeArrayProperty(frontmatter.Areas),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.storageService.cacheProject(project as any);
    console.log(`EntityCacheHandler: Cached project: ${project.name} (${project.filePath})`);
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
      type: frontmatter.Type || 'Area',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.storageService.cacheArea(area as any);
    console.log(`EntityCacheHandler: Cached area: ${area.name} (${area.filePath})`);
  }

  /**
   * Normalize array properties from front-matter
   */
  private normalizeArrayProperty(value: any): string[] {
    if (!value) return [];
    if (Array.isArray(value)) return value.map(String);
    if (typeof value === 'string') return value.split(',').map(s => s.trim()).filter(Boolean);
    return [String(value)];
  }

  /**
   * Generate a unique ID for entities
   */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }
}
