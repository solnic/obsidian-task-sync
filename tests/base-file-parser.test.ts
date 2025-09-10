import { describe, it, expect } from "vitest";
import { BaseFileParser } from "../src/services/BaseFileParser";

describe("BaseFileParser", () => {
  const parser = new BaseFileParser();

  describe("parseBaseFile", () => {
    it("should parse frontmatter correctly", () => {
      const content = `---
title: Test Base
view: kanban
type: task
auto-generate: true
auto-update: false
description: Test description
---

This is a test base file.

\`\`\`base
view: list
type: project
filters:
  - field: status
    operator: equals
    value: "active"
sort:
  field: name
  direction: asc
group:
  field: priority
  showEmpty: true
\`\`\`

## Items
- [[Task 1]]
- [[Task 2]]
`;

      const result = parser.parseBaseFile(content, "/path/to/test.base.md");

      expect(result.filePath).toBe("/path/to/test.base.md");
      expect(result.viewType).toBe("list"); // Should use code block value over frontmatter
      expect(result.entityType).toBe("project"); // Should use code block value over frontmatter
      expect(result.autoGenerate).toBe(true);
      expect(result.autoUpdate).toBe(false);
      expect(result.filters).toHaveLength(1);
      expect(result.filters[0]).toEqual({
        field: "status",
        operator: "equals",
        value: "active",
        enabled: true,
      });
      expect(result.sorting).toEqual({
        field: "name",
        direction: "asc",
      });
      expect(result.grouping).toEqual({
        field: "priority",
        showEmpty: true,
      });
    });

    it("should handle minimal frontmatter only", () => {
      const content = `---
title: Minimal Base
---

Just a description.
`;

      const result = parser.parseBaseFile(content, "/path/to/minimal.base.md");

      expect(result.filePath).toBe("/path/to/minimal.base.md");
      expect(result.viewType).toBe("kanban"); // default
      expect(result.entityType).toBe("task"); // default
      expect(result.autoGenerate).toBe(false);
      expect(result.autoUpdate).toBe(false);
      expect(result.filters).toEqual([]);
      expect(result.sorting).toEqual({ field: "name", direction: "asc" });
    });

    it("should handle complex sorting and grouping", () => {
      const content = `---
title: Complex Base
---

\`\`\`base
view: timeline
type: area
sort:
  field: priority
  direction: desc
  secondary:
    field: name
    direction: asc
group:
  field: status
  showEmpty: false
  customOrder:
    - "todo"
    - "in-progress"
    - "done"
\`\`\`
`;

      const result = parser.parseBaseFile(content, "/path/to/complex.base.md");

      expect(result.viewType).toBe("timeline");
      expect(result.entityType).toBe("area");
      expect(result.sorting).toEqual({
        field: "priority",
        direction: "desc",
        secondary: {
          field: "name",
          direction: "asc",
        },
      });
      expect(result.grouping).toEqual({
        field: "status",
        showEmpty: false,
        customOrder: ["todo", "in-progress", "done"],
      });
    });
  });

  describe("generateBaseFile", () => {
    it("should generate correct base file content", () => {
      const baseFile = {
        id: "test-id",
        name: "Generated Base",
        description: "A generated base file",
        filePath: "/path/to/generated.base.md",
        fileExists: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        viewType: "kanban" as const,
        entityType: "task" as const,
        entityIds: [] as string[],
        autoGenerate: true,
        autoUpdate: false,
        filters: [
          {
            field: "status",
            operator: "equals" as const,
            value: "todo",
            enabled: true,
          },
        ],
        sorting: {
          field: "priority",
          direction: "desc" as const,
        },
        grouping: {
          field: "status",
          showEmpty: true,
        },
      };

      const entities = [
        { name: "Task 1", filePath: "/tasks/task1.md" },
        { name: "Task 2", filePath: "/tasks/task2.md" },
      ];

      const result = parser.generateBaseFile(baseFile, entities);

      expect(result).toContain("view: kanban");
      expect(result).toContain("view: kanban");
      expect(result).toContain("type: task");
      expect(result).toContain("auto-generate: true");
      expect(result).toContain("## Items");
      expect(result).toContain("```base");
      expect(result).toContain("field: status");
      expect(result).toContain("operator: equals");
      expect(result).toContain("value: todo");
      expect(result).toContain("direction: desc");
      expect(result).toContain("showEmpty: true");
      expect(result).toContain("- [[Task 1]]");
      expect(result).toContain("- [[Task 2]]");
    });
  });

  describe("validateBaseFile", () => {
    it("should validate correct base file", () => {
      const content = `---
title: Valid Base
---

\`\`\`base
view: kanban
type: task
\`\`\`
`;

      const result = parser.validateBaseFile(content);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should detect missing base configuration block", () => {
      const content = `---
title: Invalid Base
---

Just some content without base block.
`;

      const result = parser.validateBaseFile(content);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Missing base configuration block");
    });

    it("should detect invalid view type", () => {
      const content = `---
title: Invalid Base
---

\`\`\`base
view: invalid-view
type: task
\`\`\`
`;

      const result = parser.validateBaseFile(content);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Invalid view type: invalid-view");
    });

    it("should detect invalid entity type", () => {
      const content = `---
title: Invalid Base
---

\`\`\`base
view: kanban
type: invalid-type
\`\`\`
`;

      const result = parser.validateBaseFile(content);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Invalid entity type: invalid-type");
    });
  });
});
