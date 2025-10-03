import { z } from 'zod';
import { Plugin } from 'obsidian';
import { SchemaCache, CacheOptions } from './SchemaCache';

export class CacheManager {
  private plugin: Plugin;
  private caches: Map<string, SchemaCache<any>> = new Map();

  constructor(plugin: Plugin) {
    this.plugin = plugin;
  }

  createCache<T>(
    cacheKey: string, 
    schema: z.ZodType<T>, 
    options?: CacheOptions
  ): SchemaCache<T> {
    if (this.caches.has(cacheKey)) {
      return this.caches.get(cacheKey) as SchemaCache<T>;
    }

    const cache = new SchemaCache(this.plugin, cacheKey, schema, options);
    this.caches.set(cacheKey, cache);
    return cache;
  }

  getCache<T>(cacheKey: string): SchemaCache<T> | null {
    return this.caches.get(cacheKey) as SchemaCache<T> || null;
  }

  async clearAllCaches(): Promise<void> {
    for (const cache of this.caches.values()) {
      await cache.clear();
    }
  }

  async getStats(): Promise<{ cacheKey: string; keyCount: number }[]> {
    const stats = [];
    for (const [cacheKey, cache] of this.caches.entries()) {
      const keys = await cache.keys();
      stats.push({ cacheKey, keyCount: keys.length });
    }
    return stats;
  }
}

