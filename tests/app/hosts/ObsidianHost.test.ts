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

describe("ObsidianHost Implementation", () => {
  let obsidianHost: ObsidianHost;

  beforeEach(() => {
    vi.clearAllMocks();
    obsidianHost = new ObsidianHost(mockPlugin);
  });

  describe("Settings persistence", () => {
    test("should load settings from Obsidian plugin data", async () => {
      const mockSettings: TaskSyncSettings = {
        areasFolder: "TestAreas",
        projectsFolder: "TestProjects",
        tasksFolder: "TestTasks",
        enableGitHubIntegration: true,
        enableAppleRemindersIntegration: false,
        enableAppleCalendarIntegration: false,
        defaultView: "areas",
        showCompletedTasks: false,
        autoCreateFolders: true,
        useTemplates: true,
      };

      mockPlugin.loadData.mockResolvedValue(mockSettings);

      const loadedSettings = await obsidianHost.loadSettings();

      expect(mockPlugin.loadData).toHaveBeenCalledTimes(1);
      expect(loadedSettings).toEqual(mockSettings);
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
        enableGitHubIntegration: true,
      };

      mockPlugin.loadData.mockResolvedValue(partialSettings);

      const loadedSettings = await obsidianHost.loadSettings();

      expect(loadedSettings.areasFolder).toBe("CustomAreas");
      expect(loadedSettings.enableGitHubIntegration).toBe(true);
      expect(loadedSettings.projectsFolder).toBe(
        DEFAULT_SETTINGS.projectsFolder
      );
      expect(loadedSettings.tasksFolder).toBe(DEFAULT_SETTINGS.tasksFolder);
    });

    test("should save settings to Obsidian plugin data", async () => {
      const testSettings: TaskSyncSettings = {
        areasFolder: "SavedAreas",
        projectsFolder: "SavedProjects",
        tasksFolder: "SavedTasks",
        enableGitHubIntegration: false,
        enableAppleRemindersIntegration: true,
        enableAppleCalendarIntegration: false,
        defaultView: "projects",
        showCompletedTasks: true,
        autoCreateFolders: false,
        useTemplates: false,
      };

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

      await obsidianHost.saveData(testData);

      expect(mockPlugin.saveData).toHaveBeenCalledTimes(1);
      expect(mockPlugin.saveData).toHaveBeenCalledWith(testData);
    });

    test("should load application data from Obsidian plugin storage", async () => {
      const mockData = {
        tasks: [{ id: "task-1", title: "Loaded Task" }],
        projects: [{ id: "project-1", name: "Loaded Project" }],
        areas: [{ id: "area-1", name: "Loaded Area" }],
        lastSync: "2024-01-01T00:00:00.000Z",
      };

      mockPlugin.loadData.mockResolvedValue(mockData);

      const loadedData = await obsidianHost.loadData();

      expect(mockPlugin.loadData).toHaveBeenCalledTimes(1);
      expect(loadedData).toEqual(mockData);
    });

    test("should return null when no application data exists", async () => {
      mockPlugin.loadData.mockResolvedValue(null);

      const loadedData = await obsidianHost.loadData();

      expect(mockPlugin.loadData).toHaveBeenCalledTimes(1);
      expect(loadedData).toBe(null);
    });
  });

  describe("Lifecycle callbacks", () => {
    test("should call plugin onload during host onload", async () => {
      await obsidianHost.onload();

      expect(mockPlugin.onload).toHaveBeenCalledTimes(1);
    });

    test("should call plugin onunload during host onunload", async () => {
      await obsidianHost.onunload();

      expect(mockPlugin.onunload).toHaveBeenCalledTimes(1);
    });

    test("should handle plugin lifecycle errors gracefully", async () => {
      const error = new Error("Plugin lifecycle error");
      mockPlugin.onload.mockRejectedValue(error);

      await expect(obsidianHost.onload()).rejects.toThrow(
        "Plugin lifecycle error"
      );
      expect(mockPlugin.onload).toHaveBeenCalledTimes(1);
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

      expect(mockPlugin.saveData).toHaveBeenCalledWith(settings);

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

      expect(mockPlugin.saveData).toHaveBeenCalledWith(initialData);

      // Load and modify data
      mockPlugin.loadData.mockResolvedValue(initialData);
      data = await obsidianHost.loadData();

      expect(data.tasks).toHaveLength(1);
      expect(data.tasks[0].title).toBe("Initial Task");
    });
  });
});
