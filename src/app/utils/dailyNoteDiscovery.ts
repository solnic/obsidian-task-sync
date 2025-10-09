/**
 * Daily Note Discovery Utility
 * Discovers daily note settings from Obsidian's Daily Notes plugin or Periodic Notes plugin
 */

import { App } from "obsidian";

export interface DailyNoteSettings {
  folder: string;
  format: string;
  template?: string;
  source: "daily-notes" | "periodic-notes" | "fallback";
}

// Extended App interface to include plugin properties
interface ExtendedApp extends App {
  internalPlugins?: {
    plugins?: Record<string, any>;
    getEnabledPluginById?: (id: string) => any;
  };
  plugins?: {
    plugins?: Record<string, any>;
  };
}

/**
 * Discover daily note settings from Obsidian plugins
 * Priority: Daily Notes plugin > Periodic Notes plugin > fallback
 */
export function discoverDailyNoteSettings(
  app: App,
  fallbackFolder = "Daily Notes"
): DailyNoteSettings {
  const extendedApp = app as ExtendedApp;
  // First, try to get settings from Daily Notes core plugin
  const dailyNotesPlugin =
    extendedApp.internalPlugins?.plugins?.["daily-notes"];
  if (dailyNotesPlugin?.enabled) {
    try {
      // Access the plugin's settings/options
      const instance =
        dailyNotesPlugin.instance ||
        extendedApp.internalPlugins?.getEnabledPluginById?.("daily-notes");
      if (instance?.options) {
        return {
          folder: instance.options.folder || "",
          format: instance.options.format || "YYYY-MM-DD",
          template: instance.options.template || "",
          source: "daily-notes",
        };
      }
    } catch (error) {
      console.warn("Failed to read Daily Notes plugin settings:", error);
    }
  }

  // Second, try to get settings from Periodic Notes community plugin
  const periodicNotesPlugin = extendedApp.plugins?.plugins?.["periodic-notes"];
  // For community plugins, if they exist in app.plugins.plugins, they are enabled
  if (periodicNotesPlugin) {
    try {
      // Access Periodic Notes settings for daily notes
      // The settings might be in different locations depending on the plugin version
      let settings = periodicNotesPlugin.settings?.daily;

      // Try alternative access patterns
      if (!settings && periodicNotesPlugin.instance?.settings) {
        settings = periodicNotesPlugin.instance.settings.daily;
      }

      // Try accessing through the plugin's data
      if (!settings && periodicNotesPlugin.data) {
        settings = periodicNotesPlugin.data.daily;
      }

      if (settings && settings.enabled !== false) {
        return {
          folder: settings.folder || "",
          format: settings.format || "YYYY-MM-DD",
          template: settings.template || "",
          source: "periodic-notes",
        };
      }
    } catch (error) {
      console.warn("Failed to read Periodic Notes plugin settings:", error);
    }
  }

  // Fallback to default settings
  return {
    folder: fallbackFolder,
    format: "YYYY-MM-DD",
    template: "",
    source: "fallback",
  };
}

/**
 * Get the path for a daily note based on discovered settings
 */
export function getDailyNotePath(
  app: App,
  date: Date,
  fallbackFolder = "Daily Notes"
): string {
  const settings = discoverDailyNoteSettings(app, fallbackFolder);
  const dateString = formatDate(date, settings.format);

  // If no folder is specified, use root
  const folder = settings.folder || "";

  if (folder) {
    return `${folder}/${dateString}.md`;
  } else {
    return `${dateString}.md`;
  }
}

/**
 * Format a date according to the specified format
 * Supports basic format tokens: YYYY, MM, DD
 */
function formatDate(date: Date, format: string): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return format
    .replace(/YYYY/g, String(year))
    .replace(/MM/g, month)
    .replace(/DD/g, day);
}
