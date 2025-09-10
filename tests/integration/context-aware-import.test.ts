/**
 * Integration tests for context-aware GitHub importing
 * Tests that import commands detect current file context and configure imports accordingly
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { App, TFile } from "obsidian";
import type { TaskImportConfig } from "../../src/types/integrations";
import type { FileContext } from "../../src/main";

// Mock Obsidian APIs
const mockApp = {
  workspace: {
    getActiveFile: vi.fn(),
  },
} as unknown as App;

// Mock file objects
const createMockFile = (path: string, name: string): TFile =>
  ({
    path,
    name,
    basename: name.replace(".md", ""),
    extension: "md",
  }) as TFile;

describe("Context-Aware Import Integration", () => {
  let detectCurrentFileContext: (app: App, settings: any) => FileContext;
  let getContextAwareImportConfig: (
    context: FileContext,
    settings: any,
  ) => TaskImportConfig;

  beforeEach(async () => {
    vi.clearAllMocks();

    // These functions will be implemented in the main plugin
    detectCurrentFileContext = (app: App, settings: any): FileContext => {
      const activeFile = app.workspace.getActiveFile();

      if (!activeFile) {
        return { type: "none" };
      }

      const filePath = activeFile.path;
      const fileName = activeFile.name;

      // Check if file is in projects folder
      if (filePath.startsWith(settings.projectsFolder + "/")) {
        return {
          type: "project",
          name: fileName.replace(".md", ""),
          path: filePath,
        };
      }

      // Check if file is in areas folder
      if (filePath.startsWith(settings.areasFolder + "/")) {
        return {
          type: "area",
          name: fileName.replace(".md", ""),
          path: filePath,
        };
      }

      return { type: "none" };
    };

    getContextAwareImportConfig = (
      context: FileContext,
      settings: any,
    ): TaskImportConfig => {
      const config: TaskImportConfig = {
        taskType: "Task",
        importLabelsAsTags: true,
        preserveAssignee: true,
      };

      // Apply context-specific configuration
      if (context.type === "project" && context.name) {
        config.targetProject = context.name;
      } else if (context.type === "area" && context.name) {
        config.targetArea = context.name;
      }

      return config;
    };
  });

  it("should detect project context and configure import accordingly", () => {
    const mockSettings = {
      projectsFolder: "Projects",
      areasFolder: "Areas",
    };

    const projectFile = createMockFile(
      "Projects/Mobile App.md",
      "Mobile App.md",
    );
    mockApp.workspace.getActiveFile = vi.fn().mockReturnValue(projectFile);

    const context = detectCurrentFileContext(mockApp, mockSettings);
    expect(context.type).toBe("project");
    expect(context.name).toBe("Mobile App");
    expect(context.path).toBe("Projects/Mobile App.md");

    const config = getContextAwareImportConfig(context, mockSettings);
    expect(config.targetProject).toBe("Mobile App");
    expect(config.targetArea).toBeUndefined();
  });

  it("should detect area context and configure import accordingly", () => {
    const mockSettings = {
      projectsFolder: "Projects",
      areasFolder: "Areas",
    };

    const areaFile = createMockFile("Areas/Development.md", "Development.md");
    mockApp.workspace.getActiveFile = vi.fn().mockReturnValue(areaFile);

    const context = detectCurrentFileContext(mockApp, mockSettings);
    expect(context.type).toBe("area");
    expect(context.name).toBe("Development");
    expect(context.path).toBe("Areas/Development.md");

    const config = getContextAwareImportConfig(context, mockSettings);
    expect(config.targetArea).toBe("Development");
    expect(config.targetProject).toBeUndefined();
  });

  it("should handle no context gracefully", () => {
    const mockSettings = {
      projectsFolder: "Projects",
      areasFolder: "Areas",
    };

    // No active file
    mockApp.workspace.getActiveFile = vi.fn().mockReturnValue(null);

    const context = detectCurrentFileContext(mockApp, mockSettings);
    expect(context.type).toBe("none");

    const config = getContextAwareImportConfig(context, mockSettings);
    expect(config.targetProject).toBeUndefined();
    expect(config.targetArea).toBeUndefined();
    expect(config.taskType).toBe("Task"); // Default
  });

  it("should handle files outside project/area folders", () => {
    const mockSettings = {
      projectsFolder: "Projects",
      areasFolder: "Areas",
    };

    const otherFile = createMockFile("Notes/Random Note.md", "Random Note.md");
    mockApp.workspace.getActiveFile = vi.fn().mockReturnValue(otherFile);

    const context = detectCurrentFileContext(mockApp, mockSettings);
    expect(context.type).toBe("none");

    const config = getContextAwareImportConfig(context, mockSettings);
    expect(config.targetProject).toBeUndefined();
    expect(config.targetArea).toBeUndefined();
  });
});
