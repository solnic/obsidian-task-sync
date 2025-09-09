/**
 * Plugin Storage Service
 * Manages plugin data storage including promoted todos, cached entities, and plugin state
 */

import { App, TFile, Plugin } from 'obsidian';
import { Task, Project, Area } from '../types/entities';

// Promoted todo tracking interface
export interface PromotedTodo {
  id: string;
  originalText: string;
  originalLine: string;
  filePath: string;
  lineNumber: number;
  taskName: string;
  taskPath: string;
  promotedAt: Date;
  parentTodo?: {
    text: string;
    lineNumber: number;
    taskName: string;
  };
}

// Plugin storage data structure
export interface PluginStorageData {
  version: string;
  promotedTodos: PromotedTodo[];
  cachedTasks: Task[];
  cachedProjects: Project[];
  cachedAreas: Area[];
  lastSync: Date;
}

export class PluginStorageService {
  private data: PluginStorageData;
  private readonly STORAGE_VERSION = '1.0.0';

  constructor(private app: App, private plugin: Plugin) {
    this.data = this.getDefaultData();
  }

  /**
   * Initialize storage service and load existing data
   */
  async initialize(): Promise<void> {
    await this.loadData();
  }

  /**
   * Get default storage data structure
   */
  private getDefaultData(): PluginStorageData {
    return {
      version: this.STORAGE_VERSION,
      promotedTodos: [],
      cachedTasks: [],
      cachedProjects: [],
      cachedAreas: [],
      lastSync: new Date()
    };
  }

  /**
   * Load data from Obsidian's data storage
   */
  private async loadData(): Promise<void> {
    try {
      const loadedData = await this.plugin.loadData();
      if (loadedData && loadedData.pluginStorage) {
        this.data = {
          ...this.getDefaultData(),
          ...loadedData.pluginStorage,
          // Convert date strings back to Date objects
          lastSync: new Date(loadedData.pluginStorage.lastSync || new Date()),
          promotedTodos: (loadedData.pluginStorage.promotedTodos || []).map((todo: any) => ({
            ...todo,
            promotedAt: new Date(todo.promotedAt)
          }))
        };
      }
    } catch (error) {
      console.error('Failed to load plugin storage data:', error);
      this.data = this.getDefaultData();
    }
  }

  /**
   * Save data to Obsidian's data storage
   */
  private async saveData(): Promise<void> {
    try {
      // Load existing plugin data to preserve settings
      const existingData = await this.plugin.loadData() || {};

      // Save our storage data under a specific key
      const updatedData = {
        ...existingData,
        pluginStorage: this.data
      };

      await this.plugin.saveData(updatedData);
    } catch (error) {
      console.error('Failed to save plugin storage data:', error);
    }
  }

  /**
   * Save storage data on plugin unload (public method for main.ts)
   */
  async onUnload(): Promise<void> {
    await this.saveData();
  }

  // ============================================================================
  // PROMOTED TODO TRACKING
  // ============================================================================

  /**
   * Track a promoted todo item
   */
  async trackPromotedTodo(
    originalText: string,
    originalLine: string,
    filePath: string,
    lineNumber: number,
    taskName: string,
    taskPath: string,
    parentTodo?: { text: string; lineNumber: number; taskName: string }
  ): Promise<string> {
    const id = this.generateId();
    const promotedTodo: PromotedTodo = {
      id,
      originalText,
      originalLine,
      filePath,
      lineNumber,
      taskName,
      taskPath,
      promotedAt: new Date(),
      parentTodo
    };

    this.data.promotedTodos.push(promotedTodo);
    await this.saveData();

    return id;
  }

  /**
   * Get all promoted todos
   */
  getPromotedTodos(): PromotedTodo[] {
    return [...this.data.promotedTodos];
  }

  /**
   * Get promoted todos for a specific file
   */
  getPromotedTodosForFile(filePath: string): PromotedTodo[] {
    return this.data.promotedTodos.filter(todo => todo.filePath === filePath);
  }

  /**
   * Remove a promoted todo from tracking
   */
  async removePromotedTodo(id: string): Promise<boolean> {
    const index = this.data.promotedTodos.findIndex(todo => todo.id === id);
    if (index !== -1) {
      this.data.promotedTodos.splice(index, 1);
      await this.saveData();
      return true;
    }
    return false;
  }

  /**
   * Revert a promoted todo back to its original format and delete the task file
   */
  async revertPromotedTodo(id: string): Promise<boolean> {
    const promotedTodo = this.data.promotedTodos.find(todo => todo.id === id);
    if (!promotedTodo) {
      return false;
    }

    try {
      // Delete the associated task file
      const taskFile = this.app.vault.getAbstractFileByPath(promotedTodo.taskPath);
      if (taskFile instanceof TFile) {
        await this.app.vault.delete(taskFile);
        console.log(`Deleted task file: ${promotedTodo.taskPath}`);
      }

      // Get the original file and restore the original line
      const file = this.app.vault.getAbstractFileByPath(promotedTodo.filePath);
      if (file instanceof TFile) {
        const content = await this.app.vault.read(file);
        const lines = content.split('\n');

        // Restore the original line
        if (lines[promotedTodo.lineNumber]) {
          lines[promotedTodo.lineNumber] = promotedTodo.originalLine;

          const updatedContent = lines.join('\n');
          await this.app.vault.modify(file, updatedContent);

          // Remove from tracking
          await this.removePromotedTodo(id);

          return true;
        }
      }
    } catch (error) {
      console.error('Failed to revert promoted todo:', error);
    }

    return false;
  }

  // ============================================================================
  // ENTITY CACHING
  // ============================================================================

  /**
   * Cache a task entity
   */
  async cacheTask(task: Task): Promise<void> {
    const existingIndex = this.data.cachedTasks.findIndex(t => t.id === task.id);
    if (existingIndex !== -1) {
      this.data.cachedTasks[existingIndex] = task;
    } else {
      this.data.cachedTasks.push(task);
    }
    await this.saveData();
  }

  /**
   * Get cached tasks
   */
  getCachedTasks(): Task[] {
    return [...this.data.cachedTasks];
  }

  /**
   * Cache a project entity
   */
  async cacheProject(project: Project): Promise<void> {
    const existingIndex = this.data.cachedProjects.findIndex(p => p.id === project.id);
    if (existingIndex !== -1) {
      this.data.cachedProjects[existingIndex] = project;
    } else {
      this.data.cachedProjects.push(project);
    }
    await this.saveData();
  }

  /**
   * Get cached projects
   */
  getCachedProjects(): Project[] {
    return [...this.data.cachedProjects];
  }

  /**
   * Cache an area entity
   */
  async cacheArea(area: Area): Promise<void> {
    const existingIndex = this.data.cachedAreas.findIndex(a => a.id === area.id);
    if (existingIndex !== -1) {
      this.data.cachedAreas[existingIndex] = area;
    } else {
      this.data.cachedAreas.push(area);
    }
    await this.saveData();
  }

  /**
   * Get cached areas
   */
  getCachedAreas(): Area[] {
    return [...this.data.cachedAreas];
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * Clear all cached data
   */
  async clearCache(): Promise<void> {
    this.data.cachedTasks = [];
    this.data.cachedProjects = [];
    this.data.cachedAreas = [];
    await this.saveData();
  }

  /**
   * Get storage statistics
   */
  getStorageStats(): {
    promotedTodos: number;
    cachedTasks: number;
    cachedProjects: number;
    cachedAreas: number;
    lastSync: Date;
  } {
    return {
      promotedTodos: this.data.promotedTodos.length,
      cachedTasks: this.data.cachedTasks.length,
      cachedProjects: this.data.cachedProjects.length,
      cachedAreas: this.data.cachedAreas.length,
      lastSync: this.data.lastSync
    };
  }
}
