/**
 * Test for the event-based settings change system
 * Verifies that settings changes emit proper events
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventManager } from "../src/events/EventManager";
import { EventType, SettingsChangedEventData } from "../src/events/EventTypes";
import {
  GitHubSettingsHandler,
  AppleRemindersSettingsHandler,
} from "../src/events/handlers/SettingsChangeHandler";

// Mock console.log to capture log messages
const mockConsoleLog = vi.fn();
vi.stubGlobal("console", { ...console, log: mockConsoleLog });

describe("Settings Event System", () => {
  let eventManager: EventManager;
  let mockGitHubService: any;
  let mockAppleRemindersService: any;
  let githubHandler: GitHubSettingsHandler;
  let appleHandler: AppleRemindersSettingsHandler;

  beforeEach(() => {
    mockConsoleLog.mockClear();

    eventManager = new EventManager();

    // Mock services with fresh mocks
    mockGitHubService = {
      updateSettingsInternal: vi.fn(),
      clearCache: vi.fn(),
    };

    mockAppleRemindersService = {
      updateSettingsInternal: vi.fn(),
      clearCache: vi.fn(),
    };

    // Create fresh handlers
    githubHandler = new GitHubSettingsHandler(mockGitHubService);
    appleHandler = new AppleRemindersSettingsHandler(mockAppleRemindersService);

    // Register handlers
    eventManager.registerHandler(githubHandler);
    eventManager.registerHandler(appleHandler);
  });

  it("should handle GitHub settings changes", async () => {
    const eventData: SettingsChangedEventData = {
      section: "githubIntegration",
      oldSettings: { enabled: false, personalAccessToken: "" },
      newSettings: { enabled: true, personalAccessToken: "new-token" },
      hasChanges: true,
    };

    await eventManager.emit(EventType.SETTINGS_CHANGED, eventData);

    expect(mockConsoleLog).toHaveBeenCalledWith(
      "🐙 GitHub settings changed via event system, clearing cache"
    );
    expect(mockGitHubService.updateSettingsInternal).toHaveBeenCalledWith(
      eventData.newSettings
    );
    expect(mockGitHubService.clearCache).toHaveBeenCalled();
  });

  it("should handle Apple Reminders settings changes", async () => {
    const eventData: SettingsChangedEventData = {
      section: "appleRemindersIntegration",
      oldSettings: { enabled: false, reminderLists: [] },
      newSettings: { enabled: true, reminderLists: ["Work"] },
      hasChanges: true,
    };

    await eventManager.emit(EventType.SETTINGS_CHANGED, eventData);

    expect(mockConsoleLog).toHaveBeenCalledWith(
      "🍎 Apple Reminders settings changed via event system, clearing cache"
    );
    expect(
      mockAppleRemindersService.updateSettingsInternal
    ).toHaveBeenCalledWith(eventData.newSettings);
    expect(mockAppleRemindersService.clearCache).toHaveBeenCalled();
  });

  it("should ignore settings changes when hasChanges is false", async () => {
    const eventData: SettingsChangedEventData = {
      section: "githubIntegration",
      oldSettings: { enabled: true, personalAccessToken: "token" },
      newSettings: { enabled: true, personalAccessToken: "token" },
      hasChanges: false,
    };

    await eventManager.emit(EventType.SETTINGS_CHANGED, eventData);

    expect(mockGitHubService.updateSettingsInternal).not.toHaveBeenCalled();
    expect(mockGitHubService.clearCache).not.toHaveBeenCalled();
  });

  it("should ignore settings changes for unrelated sections", async () => {
    const eventData: SettingsChangedEventData = {
      section: "taskTypes",
      oldSettings: [],
      newSettings: [{ name: "Bug", color: "red" }],
      hasChanges: true,
    };

    await eventManager.emit(EventType.SETTINGS_CHANGED, eventData);

    expect(mockGitHubService.updateSettingsInternal).not.toHaveBeenCalled();
    expect(mockGitHubService.clearCache).not.toHaveBeenCalled();
    expect(
      mockAppleRemindersService.updateSettingsInternal
    ).not.toHaveBeenCalled();
    expect(mockAppleRemindersService.clearCache).not.toHaveBeenCalled();
  });

  it("should handle multiple settings changes independently", async () => {
    // Apple Reminders settings change
    const appleEventData: SettingsChangedEventData = {
      section: "appleRemindersIntegration",
      oldSettings: { enabled: false },
      newSettings: { enabled: true },
      hasChanges: true,
    };

    await eventManager.emit(EventType.SETTINGS_CHANGED, appleEventData);

    expect(
      mockAppleRemindersService.updateSettingsInternal
    ).toHaveBeenCalledWith(appleEventData.newSettings);
    expect(mockAppleRemindersService.clearCache).toHaveBeenCalled();
  });
});
