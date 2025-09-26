/**
 * Main settings tab component for the Task Sync plugin
 * Adapted for the new architecture
 */

import { App, PluginSettingTab, Plugin } from "obsidian";
import { TaskSyncSettings } from "../../types/settings";
import SettingsViewSvelte from "./svelte/SettingsView.svelte";
import { mount, unmount } from "svelte";

// Interface for the plugin that provides settings functionality
interface TaskSyncPlugin extends Plugin {
  settings: TaskSyncSettings;
  saveSettings(): Promise<void>;
}

export class TaskSyncSettingTab extends PluginSettingTab {
  plugin: TaskSyncPlugin;
  view: any;

  constructor(app: App, plugin: TaskSyncPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    this.view = mount(SettingsViewSvelte, {
      target: this.containerEl,
      props: {
        settings: this.plugin.settings,
        saveSettings: async (newSettings: TaskSyncSettings) => {
          this.plugin.settings = newSettings;
          await this.plugin.saveSettings();
        },
        app: this.app,
        plugin: this.plugin,
      },
    });
  }

  hide(): void {
    if (this.view) {
      unmount(this.view);
    }
  }
}
