/**
 * Main settings tab component for the Task Sync plugin
 */

import { App, PluginSettingTab } from "obsidian";
import TaskSyncPlugin from "../../../main-old";
import { TaskSyncSettings } from "./types";
import SettingsViewSvelte from "./svelte/SettingsView.svelte";
import { mount, unmount } from "svelte";

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
    unmount(this.view);
  }
}
