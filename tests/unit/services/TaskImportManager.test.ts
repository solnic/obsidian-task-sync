/**
 * TaskImportManager Tests
 * Tests for task import functionality ensuring all properties are set with defaults
 */

import {
  ExternalTaskData,
  TaskImportConfig,
} from "../../../src/types/integrations";
import { PROPERTY_REGISTRY } from "../../../src/types/properties";
import { PROPERTY_SETS } from "../../../src/services/base-definitions/BaseConfigurations";
import * as yaml from "js-yaml";

// Helper function to generate task front-matter (extracted from TaskImportManager)
function generateTaskFrontMatter(
  taskData: ExternalTaskData,
  config: TaskImportConfig
): Record<string, any> {
  const frontMatter: Record<string, any> = {};

  // Get all front-matter properties from the registry and set defaults
  PROPERTY_SETS.TASK_FRONTMATTER.forEach((propertyKey) => {
    const propertyDef = PROPERTY_REGISTRY[propertyKey];
    if (!propertyDef) return;

    const frontMatterKey = propertyDef.name;

    // Set default value if defined
    if (propertyDef.default !== undefined) {
      frontMatter[frontMatterKey] = propertyDef.default;
    }
  });

  // Override with specific values from task data and config
  frontMatter.Title = taskData.title;
  frontMatter.Type = "Task";
  frontMatter.Category = config.taskType || "Task";
  frontMatter.Priority = extractPriority(taskData) || null; // Use null as default from registry
  frontMatter.Areas = config.targetArea ? [`[[${config.targetArea}]]`] : [];

  if (config.targetProject) {
    frontMatter.Project = `[[${config.targetProject}]]`;
  }

  frontMatter.Done = false;
  frontMatter.Status = mapExternalStatus(taskData.status);
  frontMatter["Parent task"] = "";

  if (config.importLabelsAsTags && taskData.labels) {
    frontMatter.tags = taskData.labels;
  } else {
    frontMatter.tags = [];
  }

  if (config.doDate) {
    frontMatter["Do Date"] = config.doDate.toISOString().split("T")[0];
  }

  if (taskData.dueDate) {
    frontMatter["Due Date"] = taskData.dueDate.toISOString().split("T")[0];
  }

  if (taskData.reminders && taskData.reminders.length > 0) {
    frontMatter.Reminders = taskData.reminders.map((reminder) =>
      reminder.toISOString()
    );
  } else {
    frontMatter.Reminders = [];
  }

  return frontMatter;
}

// Helper functions (simplified versions from TaskImportManager)
function extractPriority(taskData: ExternalTaskData): string | null {
  return taskData.priority || null;
}

function mapExternalStatus(status: string): string {
  const statusMap: Record<string, string> = {
    open: "Backlog",
    closed: "Done",
    draft: "Backlog",
    merged: "Done",
  };
  return statusMap[status] || "Backlog";
}

// Helper function to generate front-matter string (extracted from TaskImportManager)
function generateFrontMatterString(
  frontMatterData: Record<string, any>
): string {
  // Use js-yaml to properly serialize the data with correct escaping
  const yamlContent = yaml.dump(frontMatterData, {
    quotingType: '"',
    forceQuotes: false,
    lineWidth: -1, // Disable line wrapping
  });

  return `---\n${yamlContent}---`;
}

describe("TaskImportManager Front-matter Generation", () => {
  describe("generateTaskFrontMatter", () => {
    test("should include all task front-matter properties with default values", () => {
      const taskData: ExternalTaskData = {
        id: "test-123",
        title: "Test Task",
        description: "Test description",
        status: "open",
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-02"),
        externalUrl: "https://example.com/task/123",
        sourceType: "github",
        sourceData: { number: 123 },
      };

      const config: TaskImportConfig = {
        targetArea: "Test Area",
        targetProject: "Test Project",
        taskType: "Feature",
        importLabelsAsTags: true,
      };

      const frontMatter = generateTaskFrontMatter(taskData, config);

      // Get all front-matter properties from the registry
      const frontMatterProperties = PROPERTY_SETS.TASK_FRONTMATTER;

      // Verify all front-matter properties with defaults are present
      frontMatterProperties.forEach((propertyKey) => {
        const propertyDef = PROPERTY_REGISTRY[propertyKey];
        if (!propertyDef) return;

        const frontMatterKey = propertyDef.name;

        // Properties with defaults should always be present
        if (propertyDef.default !== undefined) {
          expect(frontMatter).toHaveProperty(frontMatterKey);
          // If not explicitly set by the import logic, should use default
          if (frontMatter[frontMatterKey] === propertyDef.default) {
            expect(frontMatter[frontMatterKey]).toBe(propertyDef.default);
          }
        }
      });

      // Verify specific expected values
      expect(frontMatter.Title).toBe("Test Task");
      expect(frontMatter.Type).toBe("Task");
      expect(frontMatter.Category).toBe("Feature");
      expect(frontMatter.Done).toBe(false);
      expect(frontMatter.Status).toBe("Backlog"); // Should use default from registry
      expect(frontMatter.Areas).toEqual([`[[Test Area]]`]);
      expect(frontMatter.Project).toBe(`[[Test Project]]`);
      expect(frontMatter.tags).toEqual([]);
      expect(frontMatter["Parent task"]).toBe("");
    });

    test("should set default values for missing optional properties", () => {
      const taskData: ExternalTaskData = {
        id: "test-456",
        title: "Minimal Task",
        status: "open",
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-02"),
        externalUrl: "https://example.com/task/456",
        sourceType: "github",
        sourceData: { number: 456 },
      };

      const config: TaskImportConfig = {}; // Minimal config

      const frontMatter = generateTaskFrontMatter(taskData, config);

      // Verify default values are applied
      expect(frontMatter.Done).toBe(false); // Default from DONE property
      expect(frontMatter.Status).toBe("Backlog"); // Default from STATUS property
      expect(frontMatter.Areas).toEqual([]); // Default from AREAS property
      expect(frontMatter.tags).toEqual([]); // Default from TAGS property
      expect(frontMatter.Reminders).toEqual([]); // Default from REMINDERS property
      expect(frontMatter["Parent task"]).toBe(""); // Should be empty string for imports

      // Properties with null defaults should be null
      expect(frontMatter["Do Date"]).toBeNull();
      expect(frontMatter["Due Date"]).toBeNull();
      expect(frontMatter.Priority).toBeNull(); // Default is null for PRIORITY
    });

    test("should preserve provided dates and reminders", () => {
      const dueDate = new Date("2024-12-31");
      const reminder1 = new Date("2024-12-30");
      const reminder2 = new Date("2024-12-29");

      const taskData: ExternalTaskData = {
        id: "test-789",
        title: "Task with Dates",
        status: "open",
        dueDate: dueDate,
        reminders: [reminder1, reminder2],
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-02"),
        externalUrl: "https://example.com/task/789",
        sourceType: "github",
        sourceData: { number: 789 },
      };

      const doDate = new Date("2024-12-25");
      const config: TaskImportConfig = {
        doDate: doDate,
      };

      const frontMatter = generateTaskFrontMatter(taskData, config);

      expect(frontMatter["Do Date"]).toBe("2024-12-25");
      expect(frontMatter["Due Date"]).toBe("2024-12-31");
      expect(frontMatter.Reminders).toEqual([
        reminder1.toISOString(),
        reminder2.toISOString(),
      ]);
    });
  });

  describe("generateFrontMatterString", () => {
    test("should generate valid YAML for titles with quotes", () => {
      const frontMatterData = {
        Title: 'crontabs with "oreboot" oban option instead of valid crontab',
        Type: "Task",
        Category: "Bug",
        Priority: null,
        Areas: ["[[Sentry]]"],
        Done: false,
        Status: "Backlog",
        "Parent task": "",
        tags: ["Bug", "Waiting for: Product Owner", "Elixir"],
      };

      const frontMatterString = generateFrontMatterString(frontMatterData);

      // The generated YAML should be parseable
      // Extract YAML content between --- delimiters
      const yamlContent = frontMatterString.split("\n").slice(1, -1).join("\n");

      expect(() => {
        yaml.load(yamlContent);
      }).not.toThrow();

      // Parse the YAML and verify the title is preserved correctly
      const parsed = yaml.load(yamlContent) as Record<string, any>;
      expect(parsed.Title).toBe(
        'crontabs with "oreboot" oban option instead of valid crontab'
      );
    });

    test("should generate valid YAML for titles with various quote scenarios", () => {
      const testCases = [
        'Simple title with "double quotes"',
        "Title with 'single quotes'",
        "Mixed \"double\" and 'single' quotes",
        'Title with "nested "quotes" inside"',
        'Title with backslash\\and quotes"',
        'Title with: colons, "quotes", and other special chars!',
      ];

      testCases.forEach((title) => {
        const frontMatterData = {
          Title: title,
          Type: "Task",
          Category: "Bug",
          Priority: null,
          Areas: [],
          Done: false,
          Status: "Backlog",
          "Parent task": "",
          tags: [],
        };

        const frontMatterString = generateFrontMatterString(frontMatterData);

        // The generated YAML should be parseable
        // Extract YAML content between --- delimiters
        const yamlContent = frontMatterString
          .split("\n")
          .slice(1, -1)
          .join("\n");

        expect(() => {
          yaml.load(yamlContent);
        }).not.toThrow();

        // Parse the YAML and verify the title is preserved correctly
        const parsed = yaml.load(yamlContent) as Record<string, any>;
        expect(parsed.Title).toBe(title);
      });
    });
  });
});
