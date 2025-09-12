import { z } from "zod";
import superjson from "superjson";
import { Plugin } from "obsidian";

export interface CacheEntry<T> {
  data: T;
  timestamp: Date;
  expiresAt?: Date;
  version: string;
}

export interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  version?: string; // Schema version for cache invalidation
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
      ttl: 60 * 60 * 1000, // 1 hour default
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

    const entry: CacheEntry<T> = {
      data: validatedData,
      timestamp: new Date(),
      expiresAt: this.options.ttl
        ? new Date(Date.now() + this.options.ttl)
        : undefined,
      version: this.options.version || "1.0.0",
    };

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

  async keys(): Promise<string[]> {
    const storageData = await this.loadCacheData();
    return Object.keys(storageData);
  }

  private isValidEntry(entry: CacheEntry<T>): boolean {
    // Check version compatibility
    if (entry.version !== this.options.version) {
      return false;
    }

    // Check expiration
    if (entry.expiresAt && entry.expiresAt < new Date()) {
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
