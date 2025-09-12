/**
 * External Data Cache Service
 * Provides persistent caching for external service data (GitHub issues, Apple reminders, etc.)
 * Data is stored in the plugin's data.json file and survives plugin reloads
 */

import { Plugin } from "obsidian";

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

export interface CacheOptions {
  /** Cache duration in milliseconds (default: 5 minutes) */
  duration?: number;
  /** Whether to return stale data if available when cache is expired (default: true) */
  returnStaleOnExpired?: boolean;
}

export class ExternalDataCache {
  private plugin: Plugin;
  private cache: Map<string, CacheEntry<any>> = new Map();
  private readonly DEFAULT_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private readonly STORAGE_KEY = "externalDataCache";

  constructor(plugin: Plugin) {
    this.plugin = plugin;
  }

  /**
   * Initialize the cache by loading persisted data
   */
  async initialize(): Promise<void> {
    await this.loadPersistedCache();
  }

  /**
   * Get data from cache
   */
  async get<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    const entry = this.cache.get(key);
    if (!entry) {
      console.log(`📦 Cache miss: no entry found for key ${key}`);
      return null;
    }

    const now = Date.now();
    const isExpired = now > entry.expiresAt;

    if (!isExpired) {
      // Cache hit - return fresh data
      console.log(`📦 Cache hit: returning fresh data for key ${key}`);
      return entry.data as T;
    }

    // Cache expired
    if (options.returnStaleOnExpired !== false) {
      // Return stale data if allowed
      console.log(`📦 Cache expired but returning stale data for key ${key}`);
      return entry.data as T;
    }

    // Don't return stale data
    console.log(`📦 Cache expired and stale data not allowed for key ${key}`);
    return null;
  }

  /**
   * Check if cache has valid (non-expired) data for key
   */
  hasValid(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    const now = Date.now();
    return now <= entry.expiresAt;
  }

  /**
   * Check if cache has any data for key (including expired)
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Set data in cache
   */
  async set<T>(
    key: string,
    data: T,
    options: CacheOptions = {}
  ): Promise<void> {
    const duration = options.duration ?? this.DEFAULT_CACHE_DURATION;
    const now = Date.now();

    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      expiresAt: now + duration,
    };

    this.cache.set(key, entry);
    await this.persistCache();
  }

  /**
   * Remove data from cache
   */
  async delete(key: string): Promise<void> {
    this.cache.delete(key);
    await this.persistCache();
  }

  /**
   * Clear all cache data
   */
  async clear(): Promise<void> {
    this.cache.clear();
    await this.persistCache();
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    totalEntries: number;
    validEntries: number;
    expiredEntries: number;
    oldestEntry: Date | null;
    newestEntry: Date | null;
  } {
    const now = Date.now();
    let validCount = 0;
    let expiredCount = 0;
    let oldestTimestamp = Infinity;
    let newestTimestamp = 0;

    for (const entry of this.cache.values()) {
      if (now <= entry.expiresAt) {
        validCount++;
      } else {
        expiredCount++;
      }

      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
      }
      if (entry.timestamp > newestTimestamp) {
        newestTimestamp = entry.timestamp;
      }
    }

    return {
      totalEntries: this.cache.size,
      validEntries: validCount,
      expiredEntries: expiredCount,
      oldestEntry:
        oldestTimestamp === Infinity ? null : new Date(oldestTimestamp),
      newestEntry: newestTimestamp === 0 ? null : new Date(newestTimestamp),
    };
  }

  /**
   * Clean up expired entries
   */
  async cleanup(): Promise<number> {
    const now = Date.now();
    let removedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      await this.persistCache();
    }

    return removedCount;
  }

  /**
   * Load cache data from plugin storage
   */
  private async loadPersistedCache(): Promise<void> {
    try {
      const data = await this.plugin.loadData();
      if (data && data[this.STORAGE_KEY]) {
        const cacheData = data[this.STORAGE_KEY];

        console.log(
          `📦 Loading ${
            Object.keys(cacheData).length
          } cache entries from storage`
        );

        // Restore cache entries
        for (const [key, entry] of Object.entries(cacheData)) {
          const cacheEntry = entry as CacheEntry<any>;
          this.cache.set(key, cacheEntry);
          console.log(
            `📦 Loaded cache entry: ${key}, expires: ${new Date(
              cacheEntry.expiresAt
            )}`
          );
        }

        // Clean up expired entries on load
        const removedCount = await this.cleanup();
        console.log(`📦 Cleaned up ${removedCount} expired cache entries`);
      } else {
        console.log("📦 No cache data found in storage");
      }
    } catch (error) {
      console.error("Failed to load external data cache:", error);
    }
  }

  /**
   * Persist cache data to plugin storage
   */
  private async persistCache(): Promise<void> {
    try {
      const existingData = (await this.plugin.loadData()) || {};

      // Convert Map to plain object for serialization
      const cacheData: Record<string, CacheEntry<any>> = {};
      for (const [key, entry] of this.cache.entries()) {
        cacheData[key] = entry;
      }

      const updatedData = {
        ...existingData,
        [this.STORAGE_KEY]: cacheData,
      };

      await this.plugin.saveData(updatedData);
    } catch (error) {
      console.error("Failed to persist external data cache:", error);
    }
  }

  /**
   * Save cache data on plugin unload
   */
  async onUnload(): Promise<void> {
    await this.persistCache();
  }
}
