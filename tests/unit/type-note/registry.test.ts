/**
 * Tests for TypeRegistry
 */

import { describe, test, expect, beforeEach } from "vitest";
import { z } from "zod";
import {
  TypeRegistry,
  RegistryError,
} from "../../../src/app/core/note-kit/registry";
import type { NoteType } from "../../../src/app/core/note-kit/types";
import {
  stringSchema,
  dateSchema,
} from "../../../src/app/core/note-kit/schemas";

describe("TypeRegistry", () => {
  let registry: TypeRegistry;

  // Sample note type for testing
  const createSampleNoteType = (
    id: string = "task",
    version: string = "1.0.0"
  ): NoteType => ({
    id,
    name: "Task",
    version,
    properties: {
      title: {
        key: "title",
        name: "Title",
        type: "string",
        schema: stringSchema,
        frontMatterKey: "title",
        required: true,
      },
      dueDate: {
        key: "dueDate",
        name: "Due Date",
        type: "date",
        schema: dateSchema,
        frontMatterKey: "due_date",
        required: false,
      },
    },
    template: {
      version: "1.0.0",
      content: "# {{title}}\n\nDue: {{dueDate}}",
      variables: {},
    },
  });

  beforeEach(() => {
    registry = new TypeRegistry();
  });

  describe("register", () => {
    test("registers a new note type", () => {
      const noteType = createSampleNoteType();
      const result = registry.register(noteType);

      expect(result.valid).toBe(true);
      expect(registry.has("task")).toBe(true);
      expect(registry.get("task")).toEqual(noteType);
    });

    test("prevents duplicate registration without allowOverwrite", () => {
      const noteType = createSampleNoteType();
      registry.register(noteType);

      const result = registry.register(noteType);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe("DUPLICATE_NOTE_TYPE");
    });

    test("allows overwrite when allowOverwrite is true", () => {
      const noteType1 = createSampleNoteType();
      const noteType2 = { ...createSampleNoteType(), name: "Updated Task" };

      registry.register(noteType1);
      const result = registry.register(noteType2, { allowOverwrite: true });

      expect(result.valid).toBe(true);
      expect(registry.get("task")?.name).toBe("Updated Task");
    });

    test("validates note type when validate option is true", () => {
      const invalidNoteType = {
        id: "",
        name: "Invalid",
        version: "1.0.0",
      } as any;

      const result = registry.register(invalidNoteType, { validate: true });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test("skips validation when validate option is false", () => {
      const invalidNoteType = {
        id: "test",
        name: "Test",
        version: "1.0.0",
      } as any;

      const result = registry.register(invalidNoteType, { validate: false });

      expect(result.valid).toBe(true);
    });

    test("checks version compatibility when updating", () => {
      const noteType1 = createSampleNoteType("task", "1.0.0");
      const noteType2 = createSampleNoteType("task", "0.9.0"); // Lower version

      registry.register(noteType1);
      const result = registry.register(noteType2, {
        allowOverwrite: true,
        checkCompatibility: true,
      });

      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe("INVALID_VERSION_UPDATE");
    });

    test("allows version update when new version is greater", () => {
      const noteType1 = createSampleNoteType("task", "1.0.0");
      const noteType2 = createSampleNoteType("task", "1.1.0");

      registry.register(noteType1);
      const result = registry.register(noteType2, {
        allowOverwrite: true,
        checkCompatibility: true,
      });

      expect(result.valid).toBe(true);
      expect(registry.get("task")?.version).toBe("1.1.0");
    });

    test("tracks version history", () => {
      const noteType1 = createSampleNoteType("task", "1.0.0");
      const noteType2 = createSampleNoteType("task", "1.1.0");
      const noteType3 = createSampleNoteType("task", "2.0.0");

      registry.register(noteType1);
      registry.register(noteType2, { allowOverwrite: true });
      registry.register(noteType3, { allowOverwrite: true });

      const history = registry.getVersionHistory("task");
      expect(history).toEqual(["1.0.0", "1.1.0", "2.0.0"]);
    });
  });

  describe("unregister", () => {
    test("removes a note type", () => {
      const noteType = createSampleNoteType();
      registry.register(noteType);

      const result = registry.unregister("task");

      expect(result).toBe(true);
      expect(registry.has("task")).toBe(false);
    });

    test("returns false when note type does not exist", () => {
      const result = registry.unregister("nonexistent");
      expect(result).toBe(false);
    });

    test("removes version history when unregistering", () => {
      const noteType = createSampleNoteType();
      registry.register(noteType);
      registry.unregister("task");

      const history = registry.getVersionHistory("task");
      expect(history).toEqual([]);
    });
  });

  describe("get and has", () => {
    test("retrieves registered note type", () => {
      const noteType = createSampleNoteType();
      registry.register(noteType);

      const retrieved = registry.get("task");
      expect(retrieved).toEqual(noteType);
    });

    test("returns undefined for non-existent note type", () => {
      const retrieved = registry.get("nonexistent");
      expect(retrieved).toBeUndefined();
    });

    test("checks if note type exists", () => {
      const noteType = createSampleNoteType();
      registry.register(noteType);

      expect(registry.has("task")).toBe(true);
      expect(registry.has("nonexistent")).toBe(false);
    });
  });

  describe("getAll", () => {
    test("returns all registered note types", () => {
      const noteType1 = createSampleNoteType("task", "1.0.0");
      const noteType2 = createSampleNoteType("article", "1.0.0");

      registry.register(noteType1);
      registry.register(noteType2);

      const all = registry.getAll();
      expect(all).toHaveLength(2);
    });

    test("excludes deprecated note types by default", () => {
      const noteType1 = createSampleNoteType("task", "1.0.0");
      const noteType2 = {
        ...createSampleNoteType("article", "1.0.0"),
        metadata: { deprecated: true },
      };

      registry.register(noteType1);
      registry.register(noteType2);

      const all = registry.getAll();
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe("task");
    });

    test("includes deprecated note types when requested", () => {
      const noteType1 = createSampleNoteType("task", "1.0.0");
      const noteType2 = {
        ...createSampleNoteType("article", "1.0.0"),
        metadata: { deprecated: true },
      };

      registry.register(noteType1);
      registry.register(noteType2);

      const all = registry.getAll({ includeDeprecated: true });
      expect(all).toHaveLength(2);
    });

    test("filters by category", () => {
      const noteType1 = {
        ...createSampleNoteType("task", "1.0.0"),
        metadata: { category: "productivity" },
      };
      const noteType2 = {
        ...createSampleNoteType("article", "1.0.0"),
        metadata: { category: "writing" },
      };

      registry.register(noteType1);
      registry.register(noteType2);

      const filtered = registry.getAll({ category: "productivity" });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe("task");
    });

    test("filters by tags", () => {
      const noteType1 = {
        ...createSampleNoteType("task", "1.0.0"),
        metadata: { tags: ["work", "productivity"] },
      };
      const noteType2 = {
        ...createSampleNoteType("article", "1.0.0"),
        metadata: { tags: ["writing", "blog"] },
      };

      registry.register(noteType1);
      registry.register(noteType2);

      const filtered = registry.getAll({ tags: ["productivity"] });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe("task");
    });
  });

  describe("getAllMetadata", () => {
    test("returns metadata for all note types", () => {
      const noteType = createSampleNoteType();
      registry.register(noteType);

      const metadata = registry.getAllMetadata();
      expect(metadata).toHaveLength(1);
      expect(metadata[0]).toEqual({
        id: "task",
        name: "Task",
        version: "1.0.0",
        description: undefined,
        category: undefined,
        tags: undefined,
        deprecated: undefined,
        icon: undefined,
        color: undefined,
      });
    });
  });

  describe("clear", () => {
    test("removes all note types", () => {
      registry.register(createSampleNoteType("task", "1.0.0"));
      registry.register(createSampleNoteType("article", "1.0.0"));

      registry.clear();

      expect(registry.size).toBe(0);
      expect(registry.getAll()).toHaveLength(0);
    });
  });

  describe("validateNoteType", () => {
    test("validates a valid note type", () => {
      const noteType = createSampleNoteType();
      const result = registry.validateNoteType(noteType);

      expect(result.valid).toBe(true);
    });

    test("rejects note type without ID", () => {
      const noteType = { ...createSampleNoteType(), id: "" };
      const result = registry.validateNoteType(noteType);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === "INVALID_NOTE_TYPE_ID")).toBe(
        true
      );
    });

    test("rejects note type without name", () => {
      const noteType = { ...createSampleNoteType(), name: "" };
      const result = registry.validateNoteType(noteType);

      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e) => e.code === "INVALID_NOTE_TYPE_NAME")
      ).toBe(true);
    });
  });

  describe("serialize", () => {
    test("serializes a note type", () => {
      const noteType = createSampleNoteType();
      const serialized = registry.serialize(noteType);

      expect(serialized.id).toBe("task");
      expect(serialized.name).toBe("Task");
      expect(serialized.version).toBe("1.0.0");
      expect(serialized.properties).toBeDefined();
      expect(serialized.template).toBeDefined();
    });

    test("serializes all note types", () => {
      registry.register(createSampleNoteType("task", "1.0.0"));
      registry.register(createSampleNoteType("article", "1.0.0"));

      const serialized = registry.serializeAll();
      expect(serialized).toHaveLength(2);
    });
  });

  describe("getStats", () => {
    test("returns registry statistics", () => {
      const noteType1 = {
        ...createSampleNoteType("task", "1.0.0"),
        metadata: {
          category: "productivity",
          tags: ["work", "tasks"],
        },
      };
      const noteType2 = {
        ...createSampleNoteType("article", "1.0.0"),
        metadata: {
          category: "writing",
          tags: ["blog", "writing"],
          deprecated: true,
        },
      };

      registry.register(noteType1);
      registry.register(noteType2);

      const stats = registry.getStats();
      expect(stats.totalNoteTypes).toBe(2);
      expect(stats.deprecatedCount).toBe(1);
      expect(stats.categories).toContain("productivity");
      expect(stats.categories).toContain("writing");
      expect(stats.tags).toContain("work");
      expect(stats.tags).toContain("blog");
    });
  });
});
