import { z } from "zod";
import { TaskSyncSettings } from "../main";
import { CacheManager } from "../cache/CacheManager";
import { SchemaCache } from "../cache/SchemaCache";
import { TaskImportManager } from "./TaskImportManager";
import { DailyNoteService } from "./DailyNoteService";
import {
  ExternalTaskData,
  TaskImportConfig,
  ImportResult,
} from "../types/integrations";
import { taskStore } from "../stores/taskStore";

export interface ServiceFilter {
  field: string;
  operator: "equals" | "contains" | "in" | "not_equals";
  value: any;
}

export abstract class AbstractService {
  protected settings: TaskSyncSettings;
  protected cacheManager: CacheManager;
  protected taskImportManager?: TaskImportManager;
  protected dailyNoteService?: DailyNoteService;

  constructor(settings: TaskSyncSettings) {
    this.settings = settings;
  }

  /**
   * Initialize the service with cache manager
   */
  async initialize(cacheManager: CacheManager): Promise<void> {
    this.cacheManager = cacheManager;
    await this.setupCaches();
    await this.preloadCaches();
  }

  /**
   * Preload all service caches from persistent storage
   * This restores cache state after plugin reload
   */
  protected async preloadCaches(): Promise<void> {
    // Default implementation - services can override if they have specific caches to preload
  }

  /**
   * Set import dependencies (for dependency injection)
   */
  setImportDependencies(taskImportManager: TaskImportManager): void {
    this.taskImportManager = taskImportManager;
  }

  /**
   * Set daily note service (for dependency injection)
   */
  setDailyNoteService(dailyNoteService: DailyNoteService): void {
    this.dailyNoteService = dailyNoteService;
  }

  /**
   * Abstract method to setup service-specific caches
   */
  protected abstract setupCaches(): Promise<void>;

  /**
   * Abstract method to check if service is enabled
   */
  abstract isEnabled(): boolean;

  /**
   * Abstract method to clear service-specific caches
   */
  abstract clearCache(): Promise<void>;

  /**
   * Helper method to create cache with schema validation
   */
  protected createCache<T>(
    cacheKey: string,
    schema: z.ZodType<T>
  ): SchemaCache<T> {
    return this.cacheManager.createCache(cacheKey, schema, {
      version: "1.0.0",
    });
  }

  /**
   * Helper method to build cache keys from filters
   */
  protected buildCacheKey(baseKey: string, filters?: ServiceFilter[]): string {
    if (!filters || filters.length === 0) return baseKey;

    const filterString = filters
      .map((f) => `${f.field}:${f.operator}:${f.value}`)
      .sort()
      .join("|");

    return `${baseKey}:${filterString}`;
  }

  /**
   * Helper method to validate repository format
   */
  protected validateRepository(repository: string): boolean {
    return /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(repository);
  }

  /**
   * Update settings reference (for when settings are changed)
   */
  updateSettings(newSettings: TaskSyncSettings): void {
    this.settings = newSettings;
  }

  /**
   * Protected fetch method that guarantees cache persistence
   * Services should implement fetchItems instead of handling caching manually
   */
  protected async fetch<T>(
    cache: SchemaCache<T[]> | undefined,
    cacheKey: string,
    fetchItemsFunction: () => Promise<T[]>
  ): Promise<T[]> {
    // Check cache first
    if (cache) {
      const cachedItems = await cache.get(cacheKey);
      if (cachedItems) {
        return cachedItems;
      }
    }

    // Fetch fresh data
    const items = await fetchItemsFunction();

    // Cache the result - this guarantees persistence
    if (cache) {
      await cache.set(cacheKey, items);
    }

    return items;
  }

  /**
   * Common import functionality for all services
   * Handles the standard import flow: check dependencies, transform data, check duplicates, create task
   */
  protected async importExternalItem<T>(
    externalItem: T,
    config: TaskImportConfig,
    transformFunction: (item: T) => ExternalTaskData,
    enhanceConfigFunction?: (
      item: T,
      config: TaskImportConfig
    ) => TaskImportConfig
  ): Promise<ImportResult> {
    if (!this.taskImportManager) {
      const error =
        "Import dependencies not initialized. Call setImportDependencies() first.";
      throw new Error(error);
    }

    const taskData = transformFunction(externalItem);

    // Check if task is already imported using task store
    if (taskStore.isTaskImported(taskData.sourceType, taskData.id)) {
      // If task already exists and addToToday is requested, still add to today
      if (config.addToToday && this.dailyNoteService) {
        const existingTask = taskStore.findTaskBySource(
          taskData.sourceType,
          taskData.id
        );
        if (existingTask?.filePath) {
          await this.dailyNoteService.addTaskToToday(existingTask.filePath);
        }
      }
      return {
        success: true,
        skipped: true,
        reason: "Task already imported",
        taskPath: taskStore.findTaskBySource(taskData.sourceType, taskData.id)
          ?.filePath,
      };
    }

    // Enhance config with service-specific data if function provided
    const enhancedConfig = enhanceConfigFunction
      ? enhanceConfigFunction(externalItem, config)
      : config;

    // Create the task
    const taskPath = await this.taskImportManager.createTaskFromData(
      taskData,
      enhancedConfig
    );

    // Manually refresh the task store to ensure the new task is immediately available
    // This prevents race conditions with duplicate detection
    await taskStore.refreshTasks();

    // If addToToday is requested, add the task to today's daily note
    if (config.addToToday && this.dailyNoteService) {
      await this.dailyNoteService.addTaskToToday(taskPath);
    }

    return {
      success: true,
      taskPath,
    };
  }
}
