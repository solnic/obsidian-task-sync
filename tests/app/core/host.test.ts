/**
 * Tests for Host abstraction
 * Tests Host interface and MockHost implementation
 */

import { describe, test, expect, beforeEach } from "vitest";
import { Host } from "../../../src/app/core/host";
import { TaskSyncSettings } from "../../../src/app/types/settings";

// Mock host for testing
class MockHost extends Host {
  private mockSettings: TaskSyncSettings | null = null;
  private mockData: any = null;
  private loadCalled = false;
  private unloadCalled = false;

  async loadSettings(): Promise<TaskSyncSettings> {
    if (!this.mockSettings) {
      throw new Error("No settings available");
    }
    return this.mockSettings;
  }

  async saveSettings(settings: TaskSyncSettings): Promise<void> {
    this.mockSettings = settings;
  }

  async saveData(data: any): Promise<void> {
    this.mockData = data;
  }

  async loadData(): Promise<any> {
    return this.mockData;
  }

  async onload(): Promise<void> {
    this.loadCalled = true;
  }

  async onunload(): Promise<void> {
    this.unloadCalled = true;
  }

  // Test helpers
  setMockSettings(settings: TaskSyncSettings): void {
    this.mockSettings = settings;
  }

  setMockData(data: any): void {
    this.mockData = data;
  }

  wasLoadCalled(): boolean {
    return this.loadCalled;
  }

  wasUnloadCalled(): boolean {
    return this.unloadCalled;
  }
}

describe("Host Abstraction", () => {
  let mockHost: MockHost;

  beforeEach(() => {
    mockHost = new MockHost();
  });

  describe("Host interface", () => {
    test("should implement settings persistence", async () => {
      const testSettings: TaskSyncSettings = {
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

      await mockHost.saveSettings(testSettings);
      const loadedSettings = await mockHost.loadSettings();

      expect(loadedSettings).toEqual(testSettings);
      expect(loadedSettings.areasFolder).toBe("TestAreas");
      expect(loadedSettings.enableGitHubIntegration).toBe(true);
    });

    test("should implement data persistence", async () => {
      const testData = {
        tasks: [{ id: "task-1", title: "Test Task" }],
        projects: [{ id: "project-1", name: "Test Project" }],
        areas: [{ id: "area-1", name: "Test Area" }],
      };

      await mockHost.saveData(testData);
      const loadedData = await mockHost.loadData();

      expect(loadedData).toEqual(testData);
      expect(loadedData.tasks).toHaveLength(1);
      expect(loadedData.projects).toHaveLength(1);
      expect(loadedData.areas).toHaveLength(1);
    });

    test("should implement lifecycle callbacks", async () => {
      expect(mockHost.wasLoadCalled()).toBe(false);
      expect(mockHost.wasUnloadCalled()).toBe(false);

      await mockHost.onload();
      expect(mockHost.wasLoadCalled()).toBe(true);
      expect(mockHost.wasUnloadCalled()).toBe(false);

      await mockHost.onunload();
      expect(mockHost.wasLoadCalled()).toBe(true);
      expect(mockHost.wasUnloadCalled()).toBe(true);
    });

    test("should handle missing settings gracefully", async () => {
      // Don't set mock settings
      await expect(mockHost.loadSettings()).rejects.toThrow("No settings available");
    });

    test("should handle null data gracefully", async () => {
      // Don't set mock data
      const loadedData = await mockHost.loadData();
      expect(loadedData).toBe(null);
    });
  });

  describe("Host lifecycle", () => {
    test("should support multiple save/load cycles", async () => {
      const settings1: TaskSyncSettings = {
        areasFolder: "Areas1",
        projectsFolder: "Projects1",
        tasksFolder: "Tasks1",
        enableGitHubIntegration: false,
        enableAppleRemindersIntegration: false,
        enableAppleCalendarIntegration: false,
        defaultView: "tasks",
        showCompletedTasks: true,
        autoCreateFolders: false,
        useTemplates: false,
      };

      const settings2: TaskSyncSettings = {
        areasFolder: "Areas2",
        projectsFolder: "Projects2",
        tasksFolder: "Tasks2",
        enableGitHubIntegration: true,
        enableAppleRemindersIntegration: true,
        enableAppleCalendarIntegration: true,
        defaultView: "projects",
        showCompletedTasks: false,
        autoCreateFolders: true,
        useTemplates: true,
      };

      // First cycle
      await mockHost.saveSettings(settings1);
      let loaded = await mockHost.loadSettings();
      expect(loaded.areasFolder).toBe("Areas1");
      expect(loaded.enableGitHubIntegration).toBe(false);

      // Second cycle
      await mockHost.saveSettings(settings2);
      loaded = await mockHost.loadSettings();
      expect(loaded.areasFolder).toBe("Areas2");
      expect(loaded.enableGitHubIntegration).toBe(true);
    });

    test("should support multiple onload/onunload cycles", async () => {
      await mockHost.onload();
      expect(mockHost.wasLoadCalled()).toBe(true);

      await mockHost.onunload();
      expect(mockHost.wasUnloadCalled()).toBe(true);

      // Reset for second cycle
      const mockHost2 = new MockHost();
      expect(mockHost2.wasLoadCalled()).toBe(false);
      expect(mockHost2.wasUnloadCalled()).toBe(false);

      await mockHost2.onload();
      expect(mockHost2.wasLoadCalled()).toBe(true);
    });
  });
});
