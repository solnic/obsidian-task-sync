/**
 * Test for base generation functionality
 * Verifies that project base generation works correctly
 */

import { describe, it, expect } from "vitest";
import {
  generateProjectBase,
  ProjectAreaInfo,
} from "../../src/app/extensions/obsidian/BaseConfigurations";
import { DEFAULT_SETTINGS } from "../../src/app/types/settings";

describe("Base Generation", () => {
  it("should generate a valid project base configuration", () => {
    const project: ProjectAreaInfo = {
      name: "Test Project",
      path: "Projects/Test Project.md",
      type: "project",
    };

    const baseConfig = generateProjectBase(DEFAULT_SETTINGS, project);

    // Verify the base config is a valid YAML string
    expect(baseConfig).toBeTruthy();
    expect(typeof baseConfig).toBe("string");

    // Verify it contains expected sections
    expect(baseConfig).toContain("formulas:");
    expect(baseConfig).toContain("properties:");
    expect(baseConfig).toContain("views:");

    // Verify it contains the project-specific filter
    expect(baseConfig).toContain("Test Project");

    // Verify it contains expected view types
    expect(baseConfig).toContain("type: table");
    expect(baseConfig).toContain("name: Tasks");

    console.log("Generated base config:");
    console.log(baseConfig);
  });

  it("should generate different configurations for different projects", () => {
    const project1: ProjectAreaInfo = {
      name: "Project Alpha",
      path: "Projects/Project Alpha.md",
      type: "project",
    };

    const project2: ProjectAreaInfo = {
      name: "Project Beta",
      path: "Projects/Project Beta.md",
      type: "project",
    };

    const baseConfig1 = generateProjectBase(DEFAULT_SETTINGS, project1);
    const baseConfig2 = generateProjectBase(DEFAULT_SETTINGS, project2);

    // Verify they are different
    expect(baseConfig1).not.toBe(baseConfig2);

    // Verify each contains its respective project name
    expect(baseConfig1).toContain("Project Alpha");
    expect(baseConfig2).toContain("Project Beta");

    // Verify they don't contain each other's names
    expect(baseConfig1).not.toContain("Project Beta");
    expect(baseConfig2).not.toContain("Project Alpha");
  });

  it("should handle projects with special characters in names", () => {
    const project: ProjectAreaInfo = {
      name: "Project: Special & Characters!",
      path: "Projects/Project- Special & Characters!.md",
      type: "project",
    };

    const baseConfig = generateProjectBase(DEFAULT_SETTINGS, project);

    // Should not throw and should generate valid config
    expect(baseConfig).toBeTruthy();
    expect(typeof baseConfig).toBe("string");
    expect(baseConfig).toContain("formulas:");
    expect(baseConfig).toContain("properties:");
    expect(baseConfig).toContain("views:");
  });

  it("should include all expected task types in views", () => {
    const project: ProjectAreaInfo = {
      name: "Test Project",
      path: "Projects/Test Project.md",
      type: "project",
    };

    const baseConfig = generateProjectBase(DEFAULT_SETTINGS, project);

    // Verify it includes views for each task type from default settings
    DEFAULT_SETTINGS.taskTypes.forEach((taskType) => {
      expect(baseConfig).toContain(taskType.name);
    });

    // Verify it includes priority-based views
    DEFAULT_SETTINGS.taskPriorities.forEach((priority) => {
      expect(baseConfig).toContain(priority.name);
    });
  });
});
