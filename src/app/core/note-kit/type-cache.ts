/**
 * TypeCache - Efficient Note Type Storage and Caching
 * Provides caching for note types with invalidation, persistence, and monitoring
 */

import type { NoteType } from "./types";

/**
 * Cache entry with metadata
 */
export interface TypeCacheEntry {
  /** Cached note type data */
  data: NoteType;

  /** Timestamp when entry was cached */
  timestamp: string;

  /** Cache version for invalidation */
  version: string;
}

/**
 * Cache persistence adapter interface
 */
export interface CachePersistenceAdapter {
  /** Load cache data from persistent storage */
  load(): Promise<Record<string, TypeCacheEntry>>;

  /** Save cache data to persistent storage */
  save(data: Record<string, TypeCacheEntry>): Promise<void>;

  /** Clear all cache data from persistent storage */
  clear(): Promise<void>;
}

/**
 * Type cache options
 */
export interface TypeCacheOptions {
  /** Cache version for invalidation */
  version?: string;

  /** Maximum number of entries to keep in memory */
  maxEntries?: number;

  /** TTL for cache entries in milliseconds */
  ttl?: number;
}

/**
 * Cache statistics
 */
export interface TypeCacheStatistics {
  /** Total number of cached entries */
  totalEntries: number;

  /** Number of cache hits */
  hitCount: number;

  /** Number of cache misses */
  missCount: number;

  /** Cache hit rate (0-1) */
  hitRate: number;

  /** Memory usage in bytes (approximate) */
  memoryUsage: number;

  /** Last cache operation timestamp */
  lastAccess: Date;
}

/**
 * TypeCache provides efficient storage and retrieval of note types
 */
export class TypeCache {
  private memoryCache: Map<string, TypeCacheEntry> = new Map();
  private persistenceAdapter: CachePersistenceAdapter;
  private options: Required<TypeCacheOptions>;
  private statistics: {
    hitCount: number;
    missCount: number;
    lastAccess: Date;
  };

  constructor(
    persistenceAdapter: CachePersistenceAdapter,
    options: TypeCacheOptions = {}
  ) {
    this.persistenceAdapter = persistenceAdapter;
    this.options = {
      version: "1.0.0",
      maxEntries: 1000,
      ttl: 24 * 60 * 60 * 1000, // 24 hours
      ...options,
    };
    this.statistics = {
      hitCount: 0,
      missCount: 0,
      lastAccess: new Date(),
    };
  }

  /**
   * Get a note type from cache
   */
  async get(id: string): Promise<NoteType | null> {
    this.statistics.lastAccess = new Date();

    // Check memory cache first
    const memoryEntry = this.memoryCache.get(id);
    if (memoryEntry && this.isValidEntry(memoryEntry)) {
      this.statistics.hitCount++;
      return memoryEntry.data;
    }

    // Check persistent storage
    try {
      const persistentData = await this.persistenceAdapter.load();
      const persistentEntry = persistentData[id];

      if (persistentEntry && this.isValidEntry(persistentEntry)) {
        // Update memory cache
        this.memoryCache.set(id, persistentEntry);
        this.enforceMaxEntries();
        this.statistics.hitCount++;
        return persistentEntry.data;
      }
    } catch (error) {
      console.warn(`TypeCache: Failed to load from persistence for key ${id}:`, error);
    }

    this.statistics.missCount++;
    return null;
  }

  /**
   * Set a note type in cache
   */
  async set(id: string, noteType: NoteType): Promise<void> {
    this.statistics.lastAccess = new Date();

    const entry: TypeCacheEntry = {
      data: noteType,
      timestamp: new Date().toISOString(),
      version: this.options.version,
    };

    // Store in memory cache
    this.memoryCache.set(id, entry);
    this.enforceMaxEntries();

    // Store in persistent storage
    try {
      const persistentData = await this.persistenceAdapter.load();
      persistentData[id] = entry;
      await this.persistenceAdapter.save(persistentData);
    } catch (error) {
      console.warn(`TypeCache: Failed to save to persistence for key ${id}:`, error);
    }
  }

  /**
   * Delete a note type from cache
   */
  async delete(id: string): Promise<void> {
    this.statistics.lastAccess = new Date();

    // Remove from memory cache
    this.memoryCache.delete(id);

    // Remove from persistent storage
    try {
      const persistentData = await this.persistenceAdapter.load();
      delete persistentData[id];
      await this.persistenceAdapter.save(persistentData);
    } catch (error) {
      console.warn(`TypeCache: Failed to delete from persistence for key ${id}:`, error);
    }
  }

  /**
   * Check if a note type exists in cache
   */
  async has(id: string): Promise<boolean> {
    const noteType = await this.get(id);
    return noteType !== null;
  }

  /**
   * Get all cached note type IDs
   */
  async keys(): Promise<string[]> {
    this.statistics.lastAccess = new Date();

    const memoryKeys = Array.from(this.memoryCache.keys());
    
    try {
      const persistentData = await this.persistenceAdapter.load();
      const persistentKeys = Object.keys(persistentData).filter(key => 
        this.isValidEntry(persistentData[key])
      );

      // Combine and deduplicate
      const allKeys = new Set([...memoryKeys, ...persistentKeys]);
      return Array.from(allKeys);
    } catch (error) {
      console.warn("TypeCache: Failed to load keys from persistence:", error);
      return memoryKeys;
    }
  }

  /**
   * Get all cached note types
   */
  async values(): Promise<NoteType[]> {
    const keys = await this.keys();
    const values: NoteType[] = [];

    for (const key of keys) {
      const noteType = await this.get(key);
      if (noteType) {
        values.push(noteType);
      }
    }

    return values;
  }

  /**
   * Clear all cached note types
   */
  async clear(): Promise<void> {
    this.statistics.lastAccess = new Date();

    // Clear memory cache
    this.memoryCache.clear();

    // Clear persistent storage
    try {
      await this.persistenceAdapter.clear();
    } catch (error) {
      console.warn("TypeCache: Failed to clear persistence:", error);
    }
  }

  /**
   * Invalidate a specific cache entry
   */
  async invalidate(id: string): Promise<void> {
    await this.delete(id);
  }

  /**
   * Invalidate cache entries matching a pattern
   */
  async invalidatePattern(pattern: RegExp): Promise<void> {
    const keys = await this.keys();
    const matchingKeys = keys.filter(key => pattern.test(key));

    for (const key of matchingKeys) {
      await this.delete(key);
    }
  }

  /**
   * Preload note types into cache
   */
  async preload(noteTypes: NoteType[]): Promise<void> {
    for (const noteType of noteTypes) {
      await this.set(noteType.id, noteType);
    }
  }

  /**
   * Warm up cache from persistent storage
   */
  async warmUp(): Promise<void> {
    try {
      const persistentData = await this.persistenceAdapter.load();

      for (const [id, entry] of Object.entries(persistentData)) {
        if (this.isValidEntry(entry)) {
          this.memoryCache.set(id, entry);
        }
      }

      this.enforceMaxEntries();
      console.log(`TypeCache: Warmed up with ${this.memoryCache.size} entries`);
    } catch (error) {
      console.warn("TypeCache: Failed to warm up from persistence:", error);
    }
  }

  /**
   * Get cache statistics
   */
  async getStatistics(): Promise<TypeCacheStatistics> {
    const totalRequests = this.statistics.hitCount + this.statistics.missCount;
    const hitRate = totalRequests > 0 ? this.statistics.hitCount / totalRequests : 0;

    // Approximate memory usage calculation
    let memoryUsage = 0;
    for (const entry of this.memoryCache.values()) {
      memoryUsage += JSON.stringify(entry).length * 2; // Rough estimate
    }

    return {
      totalEntries: this.memoryCache.size,
      hitCount: this.statistics.hitCount,
      missCount: this.statistics.missCount,
      hitRate,
      memoryUsage,
      lastAccess: this.statistics.lastAccess,
    };
  }

  /**
   * Reset cache statistics
   */
  async resetStatistics(): Promise<void> {
    this.statistics.hitCount = 0;
    this.statistics.missCount = 0;
    this.statistics.lastAccess = new Date();
  }

  /**
   * Check if a cache entry is valid
   */
  private isValidEntry(entry: TypeCacheEntry): boolean {
    // Check version compatibility
    if (entry.version !== this.options.version) {
      return false;
    }

    // Check TTL
    const entryTime = new Date(entry.timestamp).getTime();
    const now = Date.now();
    if (now - entryTime > this.options.ttl) {
      return false;
    }

    return true;
  }

  /**
   * Enforce maximum number of entries in memory cache
   */
  private enforceMaxEntries(): void {
    if (this.memoryCache.size <= this.options.maxEntries) {
      return;
    }

    // Remove oldest entries (simple LRU approximation)
    const entries = Array.from(this.memoryCache.entries());
    entries.sort((a, b) => {
      const timeA = new Date(a[1].timestamp).getTime();
      const timeB = new Date(b[1].timestamp).getTime();
      return timeA - timeB;
    });

    const entriesToRemove = entries.slice(0, this.memoryCache.size - this.options.maxEntries);
    for (const [key] of entriesToRemove) {
      this.memoryCache.delete(key);
    }
  }
}
