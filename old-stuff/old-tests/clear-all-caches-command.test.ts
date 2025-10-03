/**
 * Unit tests for Clear All Caches Command
 * Tests the command logic without requiring full e2e environment
 */

import { describe, test, expect, vi, beforeEach } from "vitest";
import { ClearAllCachesCommand } from "../src/commands/cache/ClearAllCachesCommand";

describe("Clear All Caches Command", () => {
  let mockPlugin: any;
  let mockTaskSyncPlugin: any;
  let mockIntegrationManager: any;
  let mockSettings: any;
  let mockCacheManager: any;
  let command: ClearAllCachesCommand;

  beforeEach(() => {
    // Mock CacheManager
    mockCacheManager = {
      clearAllCaches: vi.fn().mockResolvedValue(undefined),
      getStats: vi.fn().mockResolvedValue([
        { cacheKey: "test-cache", keyCount: 5 }
      ])
    };

    // Mock stores
    const mockStores = {
      taskStore: {
        saveData: vi.fn().mockResolvedValue(undefined),
        refreshEntities: vi.fn().mockResolvedValue(undefined),
        getEntities: vi.fn().mockReturnValue([])
      },
      projectStore: {
        saveData: vi.fn().mockResolvedValue(undefined),
        refreshEntities: vi.fn().mockResolvedValue(undefined),
        getEntities: vi.fn().mockReturnValue([])
      },
      areaStore: {
        saveData: vi.fn().mockResolvedValue(undefined),
        refreshEntities: vi.fn().mockResolvedValue(undefined),
        getEntities: vi.fn().mockReturnValue([])
      },
      taskMentionStore: {
        saveData: vi.fn().mockResolvedValue(undefined),
        refreshEntities: vi.fn().mockResolvedValue(undefined),
        getEntities: vi.fn().mockReturnValue([])
      },
      scheduleStore: {
        saveData: vi.fn().mockResolvedValue(undefined),
        refreshEntities: vi.fn().mockResolvedValue(undefined),
        getEntities: vi.fn().mockReturnValue([])
      }
    };

    // Mock integration services
    const mockGitHubService = {
      clearCache: vi.fn().mockResolvedValue(undefined),
      isEnabled: vi.fn().mockReturnValue(true)
    };

    const mockAppleRemindersService = {
      clearCache: vi.fn().mockResolvedValue(undefined),
      isEnabled: vi.fn().mockReturnValue(true)
    };

    const mockAppleCalendarService = {
      clearCache: vi.fn().mockResolvedValue(undefined),
      isEnabled: vi.fn().mockReturnValue(true)
    };

    // Mock IntegrationManager
    mockIntegrationManager = {
      getGitHubService: vi.fn().mockReturnValue(mockGitHubService),
      getAppleRemindersService: vi.fn().mockReturnValue(mockAppleRemindersService),
      getAppleCalendarService: vi.fn().mockReturnValue(mockAppleCalendarService),
      getAvailableServices: vi.fn().mockReturnValue([
        { id: "github", service: mockGitHubService },
        { id: "apple-reminders", service: mockAppleRemindersService },
        { id: "apple-calendar", service: mockAppleCalendarService }
      ])
    };

    // Mock TaskSyncPlugin interface
    mockTaskSyncPlugin = {
      stores: mockStores,
      cacheManager: mockCacheManager,
      integrationManager: mockIntegrationManager
    };

    // Mock Obsidian Plugin
    mockPlugin = {
      cacheManager: mockCacheManager,
      stores: mockStores,
      integrationManager: mockIntegrationManager,
      appleCalendarService: mockAppleCalendarService
    };

    mockSettings = {};

    // Create command instance
    const context = {
      plugin: mockPlugin,
      taskSyncPlugin: mockTaskSyncPlugin,
      integrationManager: mockIntegrationManager,
      settings: mockSettings
    };

    command = new ClearAllCachesCommand(context);
  });

  test("should have correct ID and name", () => {
    expect(command.getId()).toBe("clear-all-caches");
    expect(command.getName()).toBe("Clear all caches");
  });

  test("should be available by default", () => {
    expect(command.isAvailable()).toBe(true);
  });

  test("should call cacheManager.clearAllCaches when executed", async () => {
    await command.execute();

    expect(mockCacheManager.clearAllCaches).toHaveBeenCalledTimes(1);
  });

  test("should handle missing cacheManager gracefully", async () => {
    // Test with undefined cacheManager
    mockPlugin.cacheManager = undefined;

    // Should not throw an error
    await expect(command.execute()).resolves.not.toThrow();
  });

  test("should call all store save and refresh methods", async () => {
    await command.execute();

    // Verify all store save methods were called
    expect(mockTaskSyncPlugin.stores.taskStore.saveData).toHaveBeenCalledTimes(1);
    expect(mockTaskSyncPlugin.stores.projectStore.saveData).toHaveBeenCalledTimes(1);
    expect(mockTaskSyncPlugin.stores.areaStore.saveData).toHaveBeenCalledTimes(1);
    expect(mockTaskSyncPlugin.stores.taskMentionStore.saveData).toHaveBeenCalledTimes(1);
    expect(mockTaskSyncPlugin.stores.scheduleStore.saveData).toHaveBeenCalledTimes(1);

    // Verify all store refresh methods were called
    expect(mockTaskSyncPlugin.stores.taskStore.refreshEntities).toHaveBeenCalledTimes(1);
    expect(mockTaskSyncPlugin.stores.projectStore.refreshEntities).toHaveBeenCalledTimes(1);
    expect(mockTaskSyncPlugin.stores.areaStore.refreshEntities).toHaveBeenCalledTimes(1);
    expect(mockTaskSyncPlugin.stores.taskMentionStore.refreshEntities).toHaveBeenCalledTimes(1);
    expect(mockTaskSyncPlugin.stores.scheduleStore.refreshEntities).toHaveBeenCalledTimes(1);
  });

  test("should call all integration service clearCache methods", async () => {
    await command.execute();

    // Verify integration service clearCache methods were called
    const githubService = mockIntegrationManager.getGitHubService();
    const appleRemindersService = mockIntegrationManager.getAppleRemindersService();
    const appleCalendarService = mockPlugin.appleCalendarService;

    expect(githubService.clearCache).toHaveBeenCalledTimes(1);
    expect(appleRemindersService.clearCache).toHaveBeenCalledTimes(1);
    expect(appleCalendarService.clearCache).toHaveBeenCalledTimes(1);
  });
});
