/**
 * Test for the reactive settings store integration
 * Verifies that services react to settings changes via the settings store
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GitHubService } from "../src/services/GitHubService";
import { AppleRemindersService } from "../src/services/AppleRemindersService";
import { CacheManager } from "../src/cache/CacheManager";
import { settingsStore } from "../src/stores/settingsStore";
import { TaskSyncSettings } from "../src/main";

// Mock console.log to capture log messages
const mockConsoleLog = vi.fn();
vi.stubGlobal("console", { ...console, log: mockConsoleLog });

describe("Settings Store Integration", () => {
  let mockCacheManager: CacheManager;
  let githubService: GitHubService;
  let appleRemindersService: AppleRemindersService;
  let mockSettings: TaskSyncSettings;

  beforeEach(async () => {
    mockConsoleLog.mockClear();

    // Create mock cache manager
    mockCacheManager = {
      createCache: vi.fn().mockReturnValue({
        get: vi.fn(),
        set: vi.fn(),
        clear: vi.fn(),
        preloadFromStorage: vi.fn(),
      }),
    } as any;

    // Create mock settings
    mockSettings = {
      githubIntegration: {
        enabled: true,
        personalAccessToken: "test-token",
        labelTypeMapping: {},
        orgRepoMappings: [],
      },
      appleRemindersIntegration: {
        enabled: true,
        reminderLists: [],
        includeCompletedReminders: false,
        excludeAllDayReminders: false,
      },
    } as any;

    // Initialize settings store
    settingsStore.initialize(mockSettings);

    // Create real services
    githubService = new GitHubService(mockSettings);
    await githubService.initialize(mockCacheManager);
    githubService.setupSettingsSubscription();

    appleRemindersService = new AppleRemindersService(mockSettings);
    await appleRemindersService.initialize(mockCacheManager);
    appleRemindersService.setupSettingsSubscription();

    // Spy on service methods
    vi.spyOn(githubService, "updateSettingsInternal");
    vi.spyOn(githubService, "clearCache");
    vi.spyOn(appleRemindersService, "updateSettingsInternal");
    vi.spyOn(appleRemindersService, "clearCache");
  });

  afterEach(() => {
    // Dispose services to clean up subscriptions and prevent cross-test interference
    githubService.dispose();
    appleRemindersService.dispose();
  });

  it("should handle GitHub settings changes via store", async () => {
    const newGitHubSettings = {
      enabled: true,
      personalAccessToken: "new-token",
      repositories: [],
      defaultRepository: "test/repo",
      issueFilters: {
        state: "open" as const,
        assignee: "",
        labels: [],
      },
      labelTypeMapping: {},
      orgRepoMappings: [],
    };

    // Update GitHub settings in the store
    settingsStore.updateGitHubIntegration(newGitHubSettings);

    // Wait for reactive update
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockConsoleLog).toHaveBeenCalledWith(
      "🐙 GitHub settings changed via store, updating service"
    );
    expect(githubService.updateSettingsInternal).toHaveBeenCalledWith(
      newGitHubSettings
    );
    expect(githubService.clearCache).toHaveBeenCalled();
  });

  it("should handle Apple Reminders settings changes via store", async () => {
    const newAppleSettings = {
      enabled: true,
      reminderLists: ["Work"],
      includeCompletedReminders: false,
      excludeAllDayReminders: false,
      syncInterval: 300,
      defaultTaskType: "Task",
      importNotesAsDescription: true,
      preservePriority: true,
    };

    // Update Apple Reminders settings in the store
    settingsStore.updateAppleRemindersIntegration(newAppleSettings);

    // Wait for reactive update
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockConsoleLog).toHaveBeenCalledWith(
      "🍎 Apple Reminders settings changed via store, updating service"
    );
    expect(appleRemindersService.updateSettingsInternal).toHaveBeenCalledWith(
      newAppleSettings
    );
    expect(appleRemindersService.clearCache).toHaveBeenCalled();
  });
});
