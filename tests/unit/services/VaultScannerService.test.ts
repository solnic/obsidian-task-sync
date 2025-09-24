/**
 * VaultScannerService Tests
 * Tests for YAML frontmatter parsing functionality
 */

import { VaultScanner } from "../../../src/services/VaultScannerService";
import { TaskSyncSettings } from "../../../src/types";

// Mock Obsidian vault
const mockVault = {
  getAbstractFileByPath: vi.fn(),
  getMarkdownFiles: vi.fn(),
  read: vi.fn(),
};

// Mock settings
const mockSettings: TaskSyncSettings = {
  tasksFolder: "Tasks",
  projectsFolder: "Projects",
  areasFolder: "Areas",
  templateFolder: "Templates",
} as TaskSyncSettings;

describe("VaultScannerService", () => {
  let vaultScanner: VaultScanner;

  beforeEach(() => {
    vaultScanner = new VaultScanner(mockVault as any, mockSettings);
    vi.clearAllMocks();
  });

  describe("extractFrontmatter", () => {
    test("should parse simple YAML frontmatter", () => {
      const content = `---
Title: Test Task
Type: Task
Done: false
Priority: High
---

This is the content.`;

      // Access the private method for testing
      const result = (vaultScanner as any).extractFrontmatter(content);

      expect(result).toEqual({
        Title: "Test Task",
        Type: "Task",
        Done: false,
        Priority: "High",
      });
    });

    test("should handle frontmatter with arrays", () => {
      const content = `---
Title: Test Task
Areas: ["Area 1", "Area 2"]
tags: [bug, feature]
---

Content here.`;

      const result = (vaultScanner as any).extractFrontmatter(content);

      expect(result).toEqual({
        Title: "Test Task",
        Areas: ["Area 1", "Area 2"],
        tags: ["bug", "feature"],
      });
    });

    test("should handle frontmatter with quotes in values", () => {
      const content = `---
Title: Task with "quotes" in title
Description: This has 'single' and "double" quotes
---

Content.`;

      const result = (vaultScanner as any).extractFrontmatter(content);

      expect(result).toEqual({
        Title: 'Task with "quotes" in title',
        Description: "This has 'single' and \"double\" quotes",
      });
    });

    test("should handle multiline values properly with js-yaml", () => {
      const content = `---
Title: Test Task
Description: |
  This is a multiline
  description that spans
  multiple lines
---

Content.`;

      const result = (vaultScanner as any).extractFrontmatter(content);

      // js-yaml properly handles multiline values
      expect(result).toEqual({
        Title: "Test Task",
        Description:
          "This is a multiline\ndescription that spans\nmultiple lines\n",
      });
    });

    test("should handle nested objects properly with js-yaml", () => {
      const content = `---
Title: Test Task
metadata:
  created: 2024-01-01
  author: John Doe
---

Content.`;

      const result = (vaultScanner as any).extractFrontmatter(content);

      // js-yaml properly handles nested objects
      expect(result).toEqual({
        Title: "Test Task",
        metadata: {
          created: new Date("2024-01-01"),
          author: "John Doe",
        },
      });
    });

    test("should return empty object when no frontmatter", () => {
      const content = `This is just content without frontmatter.`;

      const result = (vaultScanner as any).extractFrontmatter(content);

      expect(result).toEqual({});
    });

    test("should handle empty frontmatter", () => {
      const content = `---
---

Content here.`;

      const result = (vaultScanner as any).extractFrontmatter(content);

      expect(result).toEqual({});
    });
  });
});
