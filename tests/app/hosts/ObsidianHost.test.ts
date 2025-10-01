/**
 * Tests for ObsidianHost implementation
 * Tests ObsidianHost class that provides Obsidian-specific Host implementation
 */

import { describe, test, expect, beforeEach, vi } from "vitest";
import { ObsidianHost } from "../../../src/app/hosts/ObsidianHost";
import {
  TaskSyncSettings,
  DEFAULT_SETTINGS,
} from "../../../src/app/types/settings";

// Mock Obsidian Plugin interface
const mockPlugin = {
  loadData: vi.fn(),
  saveData: vi.fn(),
  onload: vi.fn(),
  onunload: vi.fn(),
};

/**
 * Test fixture factory for creating complete TaskSyncSettings objects
 */
function createTestSettings(
  overrides: Partial<TaskSyncSettings> = {}
): TaskSyncSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...overrides,
  };
}

describe("ObsidianHost Implementation", () => {
  let obsidianHost: ObsidianHost;

  beforeEach(() => {
    vi.clearAllMocks();
    obsidianHost = new ObsidianHost(mockPlugin);
  });

  describe("Settings persistence", () => {
    test("should load complete settings from Obsidian plugin data", async () => {
      const mockSettings = createTestSettings({
        areasFolder: "TestAreas",
        projectsFolder: "TestProjects",
        tasksFolder: "TestTasks",
      });

      mockPlugin.loadData.mockResolvedValue(mockSettings);

      const loadedSettings = await obsidianHost.loadSettings();

      expect(mockPlugin.loadData).toHaveBeenCalledTimes(1);
      expect(loadedSettings).toEqual(mockSettings);
      expect(loadedSettings.areasFolder).toBe("TestAreas");
      expect(loadedSettings.projectsFolder).toBe("TestProjects");
      expect(loadedSettings.tasksFolder).toBe("TestTasks");
    });

    test("should return default settings when no data exists", async () => {
      mockPlugin.loadData.mockResolvedValue(null);

      const loadedSettings = await obsidianHost.loadSettings();

      expect(mockPlugin.loadData).toHaveBeenCalledTimes(1);
      expect(loadedSettings).toEqual(DEFAULT_SETTINGS);
    });

    test("should merge partial settings with defaults", async () => {
      const partialSettings = {
        areasFolder: "CustomAreas",
        basesFolder: "CustomBases",
        autoGenerateBases: false,
      };

      mockPlugin.loadData.mockResolvedValue(partialSettings);

      const loadedSettings = await obsidianHost.loadSettings();

      expect(loadedSettings.areasFolder).toBe("CustomAreas");
      expect(loadedSettings.basesFolder).toBe("CustomBases");
      expect(loadedSettings.autoGenerateBases).toBe(false);
      expect(loadedSettings.projectsFolder).toBe(
        DEFAULT_SETTINGS.projectsFolder
      );
      expect(loadedSettings.tasksFolder).toBe(DEFAULT_SETTINGS.tasksFolder);
      // Should have default values for other properties
      expect(loadedSettings.taskTypes).toEqual(DEFAULT_SETTINGS.taskTypes);
      expect(loadedSettings.integrations).toEqual(
        DEFAULT_SETTINGS.integrations
      );
    });

    test("should save settings to Obsidian plugin data", async () => {
      const testSettings = createTestSettings({
        areasFolder: "SavedAreas",
        projectsFolder: "SavedProjects",
        tasksFolder: "SavedTasks",
        integrations: {
          ...DEFAULT_SETTINGS.integrations,
          github: {
            ...DEFAULT_SETTINGS.integrations.github,
            enabled: false,
          },
          appleReminders: {
            ...DEFAULT_SETTINGS.integrations.appleReminders,
            enabled: true,
          },
        },
      });

      await obsidianHost.saveSettings(testSettings);

      expect(mockPlugin.saveData).toHaveBeenCalledTimes(1);
      expect(mockPlugin.saveData).toHaveBeenCalledWith(testSettings);
    });
  });

  describe("Data persistence", () => {
    test("should save application data to Obsidian plugin storage", async () => {
      const testData = {
        tasks: [{ id: "task-1", title: "Test Task" }],
        projects: [{ id: "project-1", name: "Test Project" }],
        areas: [{ id: "area-1", name: "Test Area" }],
        lastSync: new Date().toISOString(),
      };

      // Mock existing settings to ensure they're preserved
      mockPlugin.loadData.mockResolvedValue({
        areasFolder: "CustomAreas",
        projectsFolder: "CustomProjects",
        basesFolder: "CustomBases",
        autoGenerateBases: false,
      });

      await obsidianHost.saveData(testData);

      expect(mockPlugin.saveData).toHaveBeenCalledTimes(1);
      // Entity data should be stored under 'entities' key, preserving settings
      expect(mockPlugin.saveData).toHaveBeenCalledWith({
        areasFolder: "CustomAreas",
        projectsFolder: "CustomProjects",
        basesFolder: "CustomBases",
        autoGenerateBases: false,
        entities: testData,
      });
    });

    test("should load application data from Obsidian plugin storage", async () => {
      const mockEntityData = {
        tasks: [{ id: "task-1", title: "Loaded Task" }],
        projects: [{ id: "project-1", name: "Loaded Project" }],
        areas: [{ id: "area-1", name: "Loaded Area" }],
        lastSync: "2024-01-01T00:00:00.000Z",
      };

      // Entity data is stored under 'entities' key
      mockPlugin.loadData.mockResolvedValue({
        areasFolder: "CustomAreas",
        entities: mockEntityData,
      });

      const loadedData = await obsidianHost.loadData();

      expect(mockPlugin.loadData).toHaveBeenCalledTimes(1);
      expect(loadedData).toEqual(mockEntityData);
    });

    test("should return null when no application data exists", async () => {
      mockPlugin.loadData.mockResolvedValue(null);

      const loadedData = await obsidianHost.loadData();

      expect(mockPlugin.loadData).toHaveBeenCalledTimes(1);
      expect(loadedData).toBe(null);
    });
  });

  describe("Lifecycle callbacks", () => {
    test("should set up event handlers during host onload", async () => {
      await obsidianHost.onload();

      // Verify that event handlers are registered by checking handler count
      const { eventBus } = await import("../../../src/app/core/events");
      const handlerCount = eventBus.getHandlerCount("obsidian.notes.created");

      expect(handlerCount).toBeGreaterThan(0);
    });

    test("should clean up event handlers during host onunload", async () => {
      // First set up handlers
      await obsidianHost.onload();

      // Then clean them up
      await obsidianHost.onunload();

      // Verify that event handlers are cleared
      const { eventBus } = await import("../../../src/app/core/events");
      const handlerCount = eventBus.getHandlerCount("obsidian.notes.created");

      expect(handlerCount).toBe(0);
    });

    test("should successfully complete onload without errors", async () => {
      // onload should not throw errors
      await expect(obsidianHost.onload()).resolves.toBeUndefined();
    });
  });

  describe("Error handling", () => {
    test("should propagate settings load errors", async () => {
      const error = new Error("Failed to load settings");
      mockPlugin.loadData.mockRejectedValue(error);

      await expect(obsidianHost.loadSettings()).rejects.toThrow(
        "Failed to load settings"
      );
    });

    test("should propagate settings save errors", async () => {
      const error = new Error("Failed to save settings");
      mockPlugin.saveData.mockRejectedValue(error);

      const testSettings = { ...DEFAULT_SETTINGS };
      await expect(obsidianHost.saveSettings(testSettings)).rejects.toThrow(
        "Failed to save settings"
      );
    });

    test("should propagate data load errors", async () => {
      const error = new Error("Failed to load data");
      mockPlugin.loadData.mockRejectedValue(error);

      await expect(obsidianHost.loadData()).rejects.toThrow(
        "Failed to load data"
      );
    });

    test("should propagate data save errors", async () => {
      const error = new Error("Failed to save data");
      mockPlugin.saveData.mockRejectedValue(error);

      const testData = { tasks: [] };
      await expect(obsidianHost.saveData(testData)).rejects.toThrow(
        "Failed to save data"
      );
    });
  });

  describe("Integration scenarios", () => {
    test("should handle complete settings lifecycle", async () => {
      // Start with no settings
      mockPlugin.loadData.mockResolvedValue(null);
      mockPlugin.saveData.mockResolvedValue(undefined);

      let settings = await obsidianHost.loadSettings();
      expect(settings).toEqual(DEFAULT_SETTINGS);

      // Modify and save settings
      settings.areasFolder = "ModifiedAreas";
      settings.enableGitHubIntegration = true;
      await obsidianHost.saveSettings(settings);

      // Settings should be saved at root level, preserving entities
      expect(mockPlugin.saveData).toHaveBeenCalledWith({
        ...settings,
        entities: undefined, // No entities yet
      });

      // Load modified settings
      mockPlugin.loadData.mockResolvedValue(settings);
      const reloadedSettings = await obsidianHost.loadSettings();

      expect(reloadedSettings.areasFolder).toBe("ModifiedAreas");
      expect(reloadedSettings.enableGitHubIntegration).toBe(true);
    });

    test("should handle complete data lifecycle", async () => {
      // Start with no data
      mockPlugin.loadData.mockResolvedValue(null);
      mockPlugin.saveData.mockResolvedValue(undefined);

      let data = await obsidianHost.loadData();
      expect(data).toBe(null);

      // Save initial data
      const initialData = {
        tasks: [{ id: "task-1", title: "Initial Task" }],
        lastSync: new Date().toISOString(),
      };
      await obsidianHost.saveData(initialData);

      // Entity data should be stored under 'entities' key
      expect(mockPlugin.saveData).toHaveBeenCalledWith({
        entities: initialData,
      });

      // Load and modify data - mock the storage structure
      mockPlugin.loadData.mockResolvedValue({
        entities: initialData,
      });
      data = await obsidianHost.loadData();

      expect(data.tasks).toHaveLength(1);
      expect(data.tasks[0].title).toBe("Initial Task");
    });
  });
});
