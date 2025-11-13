import { z } from "zod";
// @ts-ignore - superjson types not resolving with current moduleResolution setting
import superjson from "superjson";
import { Plugin } from "obsidian";

export interface CacheEntry<T> {
  data: T;
  timestamp: Date;
  version: string;
}

export interface CacheOptions {
  version?: string; // Schema version for cache invalidation
  skipChangeDetection?: boolean; // Skip deep comparison for performance (default: false)
}

export class SchemaCache<T> {
  private plugin: Plugin;
  private schema: z.ZodType<T>;
  private cacheKey: string;
  private options: CacheOptions;
  private memoryCache: Map<string, CacheEntry<T>> = new Map();

  constructor(
    plugin: Plugin,
    cacheKey: string,
    schema: z.ZodType<T>,
    options: CacheOptions = {}
  ) {
    this.plugin = plugin;
    this.cacheKey = cacheKey;
    this.schema = schema;
    this.options = {
      version: "1.0.0",
      ...options,
    };
  }

  async get(key: string): Promise<T | null> {
    // Check memory cache first
    const memoryEntry = this.memoryCache.get(key);
    if (memoryEntry && this.isValidEntry(memoryEntry)) {
      return memoryEntry.data;
    }

    // Check persistent storage
    const persistentEntry = await this.getFromStorage(key);
    if (persistentEntry && this.isValidEntry(persistentEntry)) {
      // Update memory cache
      this.memoryCache.set(key, persistentEntry);
      return persistentEntry.data;
    }

    return null;
  }

  async set(key: string, data: T): Promise<void> {
    // Validate data against schema
    const validatedData = this.schema.parse(data);

    const now = new Date();
    const entry: CacheEntry<T> = {
      data: validatedData,
      timestamp: now,
      version: this.options.version || "1.0.0",
    };

    // Only log if data actually changed or this is a new entry (unless skipChangeDetection is enabled)
    const existingEntry = this.memoryCache.get(key);
    const isNewOrChanged = this.options.skipChangeDetection || 
      !existingEntry ||
      JSON.stringify(existingEntry.data) !== JSON.stringify(validatedData);

    if (isNewOrChanged) {
      console.log(`🔧 Cache updated: ${this.cacheKey}/${key}`);
    }

    // Store in memory cache
    this.memoryCache.set(key, entry);

    // Store in persistent storage
    await this.saveToStorage(key, entry);
  }

  async delete(key: string): Promise<void> {
    this.memoryCache.delete(key);
    await this.deleteFromStorage(key);
  }

  async clear(): Promise<void> {
    this.memoryCache.clear();
    await this.clearStorage();
  }

  /**
   * Preload all cached data from persistent storage into memory cache
   * This should be called during service initialization to restore cache state
   */
  async preloadFromStorage(): Promise<void> {
    try {
      const cacheData = await this.loadCacheData();
      console.log(
        `🔍 Preloading cache ${this.cacheKey}, found keys:`,
        Object.keys(cacheData)
      );

      for (const [key, serializedEntry] of Object.entries(cacheData)) {
        try {
          // Deserialize using SuperJSON to restore Date objects
          const entry = superjson.deserialize<CacheEntry<T>>(serializedEntry);

          // Validate entry structure and data
          if (entry && typeof entry === "object" && "data" in entry) {
            this.schema.parse(entry.data);

            // Only load valid entries
            if (this.isValidEntry(entry)) {
              this.memoryCache.set(key, entry);
              console.log(`✅ Preloaded cache entry: ${key}`);
            } else {
              console.log(`❌ Skipped invalid cache entry: ${key}`);
            }
          }
        } catch (error) {
          console.warn(`Failed to preload cache entry ${key}:`, error);
          // Continue with other entries
        }
      }

      console.log(
        `Preloaded ${this.memoryCache.size} entries for cache ${this.cacheKey}`
      );
    } catch (error) {
      console.warn(`Failed to preload cache ${this.cacheKey}:`, error);
    }
  }

  async keys(): Promise<string[]> {
    const storageData = await this.loadCacheData();
    const validKeys: string[] = [];

    for (const [key, serializedEntry] of Object.entries(storageData)) {
      try {
        // Deserialize using SuperJSON to restore Date objects
        const entry = superjson.deserialize<CacheEntry<T>>(serializedEntry);

        // Check if entry is valid before accessing properties
        if (entry && typeof entry === "object" && "data" in entry) {
          // Validate the deserialized data against schema
          this.schema.parse(entry.data);

          // Only include valid, non-expired entries
          if (this.isValidEntry(entry)) {
            validKeys.push(key);
          }
        }
      } catch (error) {
        // Skip invalid entries
        console.warn(`Skipping invalid cache entry ${key}:`, error);
      }
    }

    return validKeys;
  }

  private isValidEntry(entry: CacheEntry<T>): boolean {
    // Check version compatibility
    if (entry.version !== this.options.version) {
      console.log(
        `❌ Cache entry invalid: version mismatch. Entry: ${entry.version}, Expected: ${this.options.version}`
      );
      return false;
    }

    return true;
  }

  private async getFromStorage(key: string): Promise<CacheEntry<T> | null> {
    try {
      const cacheData = await this.loadCacheData();
      const serializedEntry = cacheData[key];

      if (!serializedEntry) return null;

      // Deserialize using SuperJSON to restore Date objects
      const entry = superjson.deserialize<CacheEntry<T>>(serializedEntry);

      // Check if entry is valid before accessing properties
      if (!entry || typeof entry !== "object" || !("data" in entry)) {
        console.warn(`Invalid cache entry structure for key ${key}:`, entry);
        return null;
      }

      // Validate the deserialized data against schema
      this.schema.parse(entry.data);

      return entry;
    } catch (error) {
      console.warn(`Failed to load cache entry ${key}:`, error);
      return null;
    }
  }

  private async saveToStorage(
    key: string,
    entry: CacheEntry<T>
  ): Promise<void> {
    try {
      const cacheData = await this.loadCacheData();

      // Serialize using SuperJSON to preserve Date objects
      cacheData[key] = superjson.serialize(entry);

      await this.saveCacheData(cacheData);
    } catch (error) {
      console.error(`Failed to save cache entry ${key}:`, error);
    }
  }

  private async deleteFromStorage(key: string): Promise<void> {
    try {
      const cacheData = await this.loadCacheData();
      delete cacheData[key];
      await this.saveCacheData(cacheData);
    } catch (error) {
      console.error(`Failed to delete cache entry ${key}:`, error);
    }
  }

  private async clearStorage(): Promise<void> {
    await this.saveCacheData({});
  }

  private async loadCacheData(): Promise<Record<string, any>> {
    const data = await this.plugin.loadData();
    return data?.cache?.[this.cacheKey] || {};
  }

  private async saveCacheData(cacheData: Record<string, any>): Promise<void> {
    const pluginData = (await this.plugin.loadData()) || {};
    if (!pluginData.cache) pluginData.cache = {};
    pluginData.cache[this.cacheKey] = cacheData;
    await this.plugin.saveData(pluginData);
  }
}
