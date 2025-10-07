/**
 * Tests for NoteProcessor
 */

import { describe, test, expect, beforeEach } from "vitest";
import {
  NoteProcessor,
  type NoteProcessingOptions,
  type NoteProcessingResult,
  type FrontMatterExtractionResult,
  type NoteTypeDetectionResult,
} from "../../../src/app/core/type-note/note-processor";
import type { NoteType } from "../../../src/app/core/type-note/types";
import {
  stringSchema,
  numberSchema,
  optionalStringSchema,
} from "../../../src/app/core/type-note/schemas";
import { PropertyProcessor } from "../../../src/app/core/type-note/property-processor";
import { TemplateEngine } from "../../../src/app/core/type-note/template-engine";
import { TypeRegistry } from "../../../src/app/core/type-note/registry";

describe("NoteProcessor", () => {
  let processor: NoteProcessor;
  let propertyProcessor: PropertyProcessor;
  let templateEngine: TemplateEngine;
  let registry: TypeRegistry;

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
    propertyProcessor = new PropertyProcessor();
    templateEngine = new TemplateEngine();
    registry = new TypeRegistry();
    processor = new NoteProcessor(propertyProcessor, templateEngine, registry);
  });

  describe("extractFrontMatter", () => {
    test("extracts front-matter from valid note content", () => {
      const content = `---
title: Test Task
description: A test task
priority: 5
---

# Test Task

This is the content of the note.`;

      const result = processor.extractFrontMatter(content);

      expect(result.valid).toBe(true);
      expect(result.frontMatter).toEqual({
        title: "Test Task",
        description: "A test task",
        priority: 5,
      });
      expect(result.content).toBe("# Test Task\n\nThis is the content of the note.");
      expect(result.rawFrontMatter).toBe("title: Test Task\ndescription: A test task\npriority: 5");
    });

    test("handles note without front-matter", () => {
      const content = "# Test Note\n\nThis is just content.";

      const result = processor.extractFrontMatter(content);

      expect(result.valid).toBe(true);
      expect(result.frontMatter).toEqual({});
      expect(result.content).toBe(content);
      expect(result.rawFrontMatter).toBe("");
    });

    test("handles invalid YAML in front-matter", () => {
      const content = `---
title: Test Task
invalid: [unclosed array
priority: 5
---

# Test Task`;

      const result = processor.extractFrontMatter(content);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe("YAML_PARSE_ERROR");
    });
  });

  describe("detectNoteType", () => {
    test("detects note type from front-matter type field", () => {
      const noteType = createSampleNoteType();
      registry.register(noteType);

      const frontMatter = {
        type: "task",
        title: "Test Task",
      };

      const result = processor.detectNoteType(frontMatter, "test.md");

      expect(result.valid).toBe(true);
      expect(result.noteType?.id).toBe("task");
      expect(result.confidence).toBe("high");
      expect(result.detectionMethod).toBe("frontmatter-type");
    });

    test("detects note type from file path patterns", () => {
      const noteType = createSampleNoteType();
      registry.register(noteType);

      const frontMatter = {
        title: "Test Task",
      };

      const result = processor.detectNoteType(frontMatter, "tasks/test-task.md");

      expect(result.valid).toBe(true);
      expect(result.noteType?.id).toBe("task");
      expect(result.confidence).toBe("medium");
      expect(result.detectionMethod).toBe("file-path");
    });

    test("returns no match when note type cannot be detected", () => {
      const frontMatter = {
        title: "Unknown Note",
      };

      const result = processor.detectNoteType(frontMatter, "unknown.md");

      expect(result.valid).toBe(true);
      expect(result.noteType).toBeNull();
      expect(result.confidence).toBe("none");
      expect(result.detectionMethod).toBe("none");
    });
  });

  describe("processNote", () => {
    test("processes a complete note successfully", () => {
      const noteType = createSampleNoteType();
      registry.register(noteType);

      const content = `---
type: task
title: Test Task
description: A test task
priority: 5
---

# Test Task

This is the content of the note.`;

      const result = processor.processNote(content, "test-task.md");

      expect(result.valid).toBe(true);
      expect(result.noteType?.id).toBe("task");
      expect(result.properties).toEqual({
        title: "Test Task",
        description: "A test task",
        priority: 5,
      });
      expect(result.content).toBe("# Test Task\n\nThis is the content of the note.");
    });

    test("fails when note type cannot be detected", () => {
      const content = `---
title: Unknown Note
---

# Unknown Note`;

      const result = processor.processNote(content, "unknown.md");

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe("NOTE_TYPE_NOT_DETECTED");
    });

    test("fails when property validation fails", () => {
      const noteType = createSampleNoteType();
      registry.register(noteType);

      const content = `---
type: task
description: A test task without title
priority: 5
---

# Test Task`;

      const result = processor.processNote(content, "test-task.md");

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.propertyKey === "title")).toBe(true);
    });
  });

  describe("processTemplate", () => {
    test("processes template content with note properties", () => {
      const noteType = createSampleNoteType();
      const properties = {
        title: "Test Task",
        description: "A test task",
        priority: 5,
      };

      const result = processor.processTemplate(noteType, properties);

      expect(result.valid).toBe(true);
      expect(result.content).toBe("# Test Task\n\nA test task\n\nPriority: 5");
    });

    test("fails when template processing fails", () => {
      const noteType = createSampleNoteType();
      const properties = {
        // Missing required title
        description: "A test task",
        priority: 5,
      };

      const result = processor.processTemplate(noteType, properties);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
