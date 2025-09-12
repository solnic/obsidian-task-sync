import { describe, it, expect, beforeEach, vi } from "vitest";
import { ExternalDataCache } from "../src/services/ExternalDataCache";

// Mock Plugin class
class MockPlugin {
  private data: any = {};

  async loadData(): Promise<any> {
    return this.data;
  }

  async saveData(data: any): Promise<void> {
    this.data = data;
  }
}

describe("ExternalDataCache", () => {
  let cache: ExternalDataCache;
  let mockPlugin: MockPlugin;

  beforeEach(() => {
    mockPlugin = new MockPlugin();
    cache = new ExternalDataCache(mockPlugin as any);
  });

  it("should initialize without errors", async () => {
    await expect(cache.initialize()).resolves.not.toThrow();
  });

  it("should store and retrieve data", async () => {
    await cache.initialize();
    
    const testData = { id: 1, name: "Test Item" };
    await cache.set("test-key", testData);
    
    const retrieved = await cache.get("test-key");
    expect(retrieved).toEqual(testData);
  });

  it("should return null for non-existent keys", async () => {
    await cache.initialize();
    
    const result = await cache.get("non-existent");
    expect(result).toBeNull();
  });

  it("should respect cache expiration", async () => {
    await cache.initialize();
    
    const testData = { id: 1, name: "Test Item" };
    // Set with very short duration (1ms)
    await cache.set("test-key", testData, { duration: 1 });
    
    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Should return stale data by default
    const staleResult = await cache.get("test-key");
    expect(staleResult).toEqual(testData);
    
    // Should return null when stale data is not allowed
    const freshResult = await cache.get("test-key", { returnStaleOnExpired: false });
    expect(freshResult).toBeNull();
  });

  it("should check validity correctly", async () => {
    await cache.initialize();
    
    const testData = { id: 1, name: "Test Item" };
    await cache.set("test-key", testData, { duration: 1000 }); // 1 second
    
    expect(cache.hasValid("test-key")).toBe(true);
    expect(cache.has("test-key")).toBe(true);
    expect(cache.has("non-existent")).toBe(false);
  });

  it("should delete entries", async () => {
    await cache.initialize();
    
    const testData = { id: 1, name: "Test Item" };
    await cache.set("test-key", testData);
    
    expect(cache.has("test-key")).toBe(true);
    
    await cache.delete("test-key");
    
    expect(cache.has("test-key")).toBe(false);
  });

  it("should clear all entries", async () => {
    await cache.initialize();
    
    await cache.set("key1", { data: "test1" });
    await cache.set("key2", { data: "test2" });
    
    expect(cache.has("key1")).toBe(true);
    expect(cache.has("key2")).toBe(true);
    
    await cache.clear();
    
    expect(cache.has("key1")).toBe(false);
    expect(cache.has("key2")).toBe(false);
  });

  it("should provide cache statistics", async () => {
    await cache.initialize();
    
    await cache.set("key1", { data: "test1" }, { duration: 1000 });
    await cache.set("key2", { data: "test2" }, { duration: 1 }); // Will expire quickly
    
    // Wait for one to expire
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const stats = cache.getStats();
    expect(stats.totalEntries).toBe(2);
    expect(stats.validEntries).toBe(1);
    expect(stats.expiredEntries).toBe(1);
    expect(stats.oldestEntry).toBeInstanceOf(Date);
    expect(stats.newestEntry).toBeInstanceOf(Date);
  });

  it("should clean up expired entries", async () => {
    await cache.initialize();
    
    await cache.set("valid", { data: "valid" }, { duration: 1000 });
    await cache.set("expired", { data: "expired" }, { duration: 1 });
    
    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const removedCount = await cache.cleanup();
    expect(removedCount).toBe(1);
    expect(cache.has("valid")).toBe(true);
    expect(cache.has("expired")).toBe(false);
  });

  it("should persist data across initialization", async () => {
    await cache.initialize();
    
    const testData = { id: 1, name: "Persistent Test" };
    await cache.set("persistent-key", testData);
    
    // Create new cache instance with same plugin
    const newCache = new ExternalDataCache(mockPlugin as any);
    await newCache.initialize();
    
    const retrieved = await newCache.get("persistent-key");
    expect(retrieved).toEqual(testData);
  });

  it("should handle plugin data persistence", async () => {
    await cache.initialize();
    
    const testData = { id: 1, name: "Test Item" };
    await cache.set("test-key", testData);
    
    // Verify data was saved to plugin
    const pluginData = await mockPlugin.loadData();
    expect(pluginData.externalDataCache).toBeDefined();
    expect(pluginData.externalDataCache["test-key"]).toBeDefined();
    expect(pluginData.externalDataCache["test-key"].data).toEqual(testData);
  });
});
