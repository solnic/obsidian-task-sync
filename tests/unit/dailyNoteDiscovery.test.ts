/**
 * Unit tests for Daily Note Discovery utility
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { discoverDailyNoteSettings, getDailyNotePath } from "../../src/app/utils/dailyNoteDiscovery";

// Mock Obsidian App
const createMockApp = (plugins: any = {}) => ({
  internalPlugins: {
    plugins: plugins.internal || {},
    getEnabledPluginById: vi.fn((id: string) => plugins.internal?.[id]?.enabled ? plugins.internal[id] : null),
  },
  plugins: {
    plugins: plugins.community || {},
  },
});

describe("Daily Note Discovery", () => {
  describe("discoverDailyNoteSettings", () => {
    it("should use Daily Notes plugin settings when available", () => {
      const mockApp = createMockApp({
        internal: {
          "daily-notes": {
            enabled: true,
            instance: {
              options: {
                folder: "My Daily Notes",
                format: "YYYY-MM-DD",
                template: "daily-template",
              },
            },
          },
        },
      });

      const settings = discoverDailyNoteSettings(mockApp as any);

      expect(settings).toEqual({
        folder: "My Daily Notes",
        format: "YYYY-MM-DD",
        template: "daily-template",
        source: "daily-notes",
      });
    });

    it("should use Periodic Notes plugin settings when Daily Notes is not available", () => {
      const mockApp = createMockApp({
        community: {
          "periodic-notes": {
            enabled: true,
            settings: {
              daily: {
                folder: "Periodic/Daily",
                format: "YYYY-MM-DD",
                template: "periodic-template",
              },
            },
          },
        },
      });

      const settings = discoverDailyNoteSettings(mockApp as any);

      expect(settings).toEqual({
        folder: "Periodic/Daily",
        format: "YYYY-MM-DD",
        template: "periodic-template",
        source: "periodic-notes",
      });
    });

    it("should fall back to default settings when no plugins are available", () => {
      const mockApp = createMockApp();

      const settings = discoverDailyNoteSettings(mockApp as any, "Custom Fallback");

      expect(settings).toEqual({
        folder: "Custom Fallback",
        format: "YYYY-MM-DD",
        template: "",
        source: "fallback",
      });
    });

    it("should prioritize Daily Notes over Periodic Notes when both are available", () => {
      const mockApp = createMockApp({
        internal: {
          "daily-notes": {
            enabled: true,
            instance: {
              options: {
                folder: "Daily Notes Folder",
                format: "YYYY-MM-DD",
                template: "",
              },
            },
          },
        },
        community: {
          "periodic-notes": {
            enabled: true,
            settings: {
              daily: {
                folder: "Periodic Notes Folder",
                format: "YYYY-MM-DD",
                template: "",
              },
            },
          },
        },
      });

      const settings = discoverDailyNoteSettings(mockApp as any);

      expect(settings.folder).toBe("Daily Notes Folder");
      expect(settings.source).toBe("daily-notes");
    });

    it("should handle disabled Daily Notes plugin gracefully", () => {
      const mockApp = createMockApp({
        internal: {
          "daily-notes": {
            enabled: false,
            instance: {
              options: {
                folder: "Should Not Use",
                format: "YYYY-MM-DD",
                template: "",
              },
            },
          },
        },
      });

      const settings = discoverDailyNoteSettings(mockApp as any, "Fallback");

      expect(settings.folder).toBe("Fallback");
      expect(settings.source).toBe("fallback");
    });
  });

  describe("getDailyNotePath", () => {
    it("should generate correct path with folder", () => {
      const mockApp = createMockApp({
        internal: {
          "daily-notes": {
            enabled: true,
            instance: {
              options: {
                folder: "My Daily Notes",
                format: "YYYY-MM-DD",
                template: "",
              },
            },
          },
        },
      });

      const date = new Date("2024-03-15");
      const path = getDailyNotePath(mockApp as any, date);

      expect(path).toBe("My Daily Notes/2024-03-15.md");
    });

    it("should generate correct path without folder", () => {
      const mockApp = createMockApp({
        internal: {
          "daily-notes": {
            enabled: true,
            instance: {
              options: {
                folder: "",
                format: "YYYY-MM-DD",
                template: "",
              },
            },
          },
        },
      });

      const date = new Date("2024-03-15");
      const path = getDailyNotePath(mockApp as any, date);

      expect(path).toBe("2024-03-15.md");
    });

    it("should use fallback folder when no plugins are available", () => {
      const mockApp = createMockApp();

      const date = new Date("2024-03-15");
      const path = getDailyNotePath(mockApp as any, date, "Custom Fallback");

      expect(path).toBe("Custom Fallback/2024-03-15.md");
    });
  });
});
