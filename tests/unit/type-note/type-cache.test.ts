/**
 * Tests for TypeCache
 */

import { describe, test, expect, beforeEach, vi } from "vitest";
import {
  TypeCache,
  type TypeCacheOptions,
  type TypeCacheStatistics,
  type CachePersistenceAdapter,
} from "../../../src/app/core/note-kit/type-cache";
import type { NoteType } from "../../../src/app/core/note-kit/types";
import {
  stringSchema,
  numberSchema,
  optionalStringSchema,
} from "../../../src/app/core/note-kit/schemas";

describe("TypeCache", () => {
  let cache: TypeCache;
  let mockAdapter: CachePersistenceAdapter;

  // Sample note type for testing
  const createSampleNoteType = (): NoteType => ({
    id: "task",
    name: "Task",
    version: "1.0.0",
    properties: {
      title: {
        key: "title",
        name: "Title",
        schema: stringSchema,
        frontMatterKey: "title",
        required: true,
      },
      description: {
        key: "description",
        name: "Description",
        schema: optionalStringSchema,
        frontMatterKey: "description",
        required: false,
        defaultValue: "No description",
      },
      priority: {
        key: "priority",
        name: "Priority",
        schema: numberSchema,
        frontMatterKey: "priority",
        required: false,
        defaultValue: 3,
      },
    },
    template: {
      version: "1.0.0",
      content: "# {{title}}\n\n{{description}}\n\nPriority: {{priority}}",
      variables: {
        title: { type: "string", required: true },
        description: { type: "string", required: false },
        priority: { type: "number", required: false },
      },
    },
  });

  beforeEach(() => {
    // Create mock persistence adapter with state
    let persistentData: Record<string, any> = {};

    mockAdapter = {
      load: vi
        .fn()
        .mockImplementation(() => Promise.resolve({ ...persistentData })),
      save: vi.fn().mockImplementation((data) => {
        persistentData = { ...data };
        return Promise.resolve();
      }),
      clear: vi.fn().mockImplementation(() => {
        persistentData = {};
        return Promise.resolve();
      }),
    };

    cache = new TypeCache(mockAdapter);
  });

  describe("basic operations", () => {
    test("stores and retrieves note types", async () => {
      const noteType = createSampleNoteType();

      await cache.set(noteType.id, noteType);
      const retrieved = await cache.get(noteType.id);

      expect(retrieved).toEqual(noteType);
    });

    test("returns null for non-existent note types", async () => {
      const result = await cache.get("non-existent");
      expect(result).toBeNull();
    });

    test("deletes note types", async () => {
      const noteType = createSampleNoteType();

      await cache.set(noteType.id, noteType);
      await cache.delete(noteType.id);
      const retrieved = await cache.get(noteType.id);

      expect(retrieved).toBeNull();
    });

    test("checks if note types exist", async () => {
      const noteType = createSampleNoteType();

      expect(await cache.has(noteType.id)).toBe(false);
      await cache.set(noteType.id, noteType);
      expect(await cache.has(noteType.id)).toBe(true);
    });

    test("gets all note type IDs", async () => {
      const noteType1 = createSampleNoteType();
      const noteType2 = {
        ...createSampleNoteType(),
        id: "project",
        name: "Project",
      };

      await cache.set(noteType1.id, noteType1);
      await cache.set(noteType2.id, noteType2);

      const keys = await cache.keys();
      expect(keys).toContain(noteType1.id);
      expect(keys).toContain(noteType2.id);
      expect(keys).toHaveLength(2);
    });

    test("gets all note types", async () => {
      const noteType1 = createSampleNoteType();
      const noteType2 = {
        ...createSampleNoteType(),
        id: "project",
        name: "Project",
      };

      await cache.set(noteType1.id, noteType1);
      await cache.set(noteType2.id, noteType2);

      const values = await cache.values();
      expect(values).toHaveLength(2);
      expect(values.find((nt: NoteType) => nt.id === noteType1.id)).toEqual(
        noteType1
      );
      expect(values.find((nt: NoteType) => nt.id === noteType2.id)).toEqual(
        noteType2
      );
    });

    test("clears all note types", async () => {
      const noteType = createSampleNoteType();

      await cache.set(noteType.id, noteType);
      await cache.clear();
      const retrieved = await cache.get(noteType.id);

      expect(retrieved).toBeNull();
      expect(await cache.keys()).toHaveLength(0);
    });
  });

  describe("cache invalidation", () => {
    test("invalidates cache when version changes", async () => {
      const options: TypeCacheOptions = { version: "1.0.0" };
      cache = new TypeCache(mockAdapter, options);

      const noteType = createSampleNoteType();
      await cache.set(noteType.id, noteType);

      // Simulate version change
      const newCache = new TypeCache(mockAdapter, { version: "2.0.0" });
      const retrieved = await newCache.get(noteType.id);

      expect(retrieved).toBeNull();
    });

    test("invalidates individual entries by key", async () => {
      const noteType = createSampleNoteType();

      await cache.set(noteType.id, noteType);
      await cache.invalidate(noteType.id);
      const retrieved = await cache.get(noteType.id);

      expect(retrieved).toBeNull();
    });

    test("invalidates entries by pattern", async () => {
      const noteType1 = createSampleNoteType();
      const noteType2 = {
        ...createSampleNoteType(),
        id: "task-v2",
        name: "Task V2",
      };
      const noteType3 = {
        ...createSampleNoteType(),
        id: "project",
        name: "Project",
      };

      await cache.set(noteType1.id, noteType1);
      await cache.set(noteType2.id, noteType2);
      await cache.set(noteType3.id, noteType3);

      await cache.invalidatePattern(/^task/);

      expect(await cache.get(noteType1.id)).toBeNull();
      expect(await cache.get(noteType2.id)).toBeNull();
      expect(await cache.get(noteType3.id)).toEqual(noteType3);
    });
  });

  describe("persistence", () => {
    test("loads data from persistence adapter on initialization", async () => {
      const noteType = createSampleNoteType();
      const persistedData = {
        [noteType.id]: {
          data: noteType,
          timestamp: new Date().toISOString(),
          version: "1.0.0",
        },
      };

      mockAdapter.load = vi.fn().mockResolvedValue(persistedData);
      cache = new TypeCache(mockAdapter);

      await cache.warmUp();
      const retrieved = await cache.get(noteType.id);

      expect(retrieved).toEqual(noteType);
      expect(mockAdapter.load).toHaveBeenCalled();
    });

    test("saves data to persistence adapter when setting", async () => {
      const noteType = createSampleNoteType();

      await cache.set(noteType.id, noteType);

      expect(mockAdapter.save).toHaveBeenCalled();
    });

    test("handles persistence adapter errors gracefully", async () => {
      mockAdapter.save = vi.fn().mockRejectedValue(new Error("Save failed"));

      const noteType = createSampleNoteType();

      // Should not throw
      await expect(cache.set(noteType.id, noteType)).resolves.not.toThrow();
    });
  });

  describe("preloading and warming", () => {
    test("preloads note types from array", async () => {
      const noteType1 = createSampleNoteType();
      const noteType2 = {
        ...createSampleNoteType(),
        id: "project",
        name: "Project",
      };

      await cache.preload([noteType1, noteType2]);

      expect(await cache.get(noteType1.id)).toEqual(noteType1);
      expect(await cache.get(noteType2.id)).toEqual(noteType2);
    });

    test("warms up cache from persistence", async () => {
      const noteType = createSampleNoteType();
      const persistedData = {
        [noteType.id]: {
          data: noteType,
          timestamp: new Date().toISOString(),
          version: "1.0.0",
        },
      };

      mockAdapter.load = vi.fn().mockResolvedValue(persistedData);

      await cache.warmUp();

      expect(await cache.get(noteType.id)).toEqual(noteType);
      expect(mockAdapter.load).toHaveBeenCalled();
    });
  });

  describe("statistics and monitoring", () => {
    test("provides cache statistics", async () => {
      const noteType1 = createSampleNoteType();
      const noteType2 = {
        ...createSampleNoteType(),
        id: "project",
        name: "Project",
      };

      await cache.set(noteType1.id, noteType1);
      await cache.set(noteType2.id, noteType2);

      // Simulate some cache hits and misses
      await cache.get(noteType1.id); // hit
      await cache.get(noteType1.id); // hit
      await cache.get("non-existent"); // miss

      const stats = await cache.getStatistics();

      expect(stats.totalEntries).toBe(2);
      expect(stats.hitCount).toBe(2);
      expect(stats.missCount).toBe(1);
      expect(stats.hitRate).toBeCloseTo(0.67, 2);
    });

    test("resets statistics", async () => {
      const noteType = createSampleNoteType();

      await cache.set(noteType.id, noteType);
      await cache.get(noteType.id); // hit
      await cache.get("non-existent"); // miss

      await cache.resetStatistics();
      const stats = await cache.getStatistics();

      expect(stats.hitCount).toBe(0);
      expect(stats.missCount).toBe(0);
      expect(stats.hitRate).toBe(0);
    });
  });
});
