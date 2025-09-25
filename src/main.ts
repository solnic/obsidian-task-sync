/**
 * Lightweight Obsidian Plugin Wrapper for Svelte App
 * Phase 8.1 - Minimal implementation to get the app rendering
 */

import { Plugin, ItemView, WorkspaceLeaf } from 'obsidian';
import { mount, unmount } from 'svelte';
import App from './app/App.svelte';
import { TaskSyncSettings } from './components/ui/settings/types';
import { DEFAULT_SETTINGS } from './components/ui/settings/defaults';

export default class TaskSyncPlugin extends Plugin {
  settings: TaskSyncSettings;

  async onload() {
    console.log('TaskSync plugin loading...');
    
    await this.loadSettings();

    // Register the main view
    this.registerView('task-sync-main', (leaf) => {
      return new TaskSyncView(leaf, this);
    });

    // Add ribbon icon
    this.addRibbonIcon('checkbox', 'Task Sync', () => {
      this.activateView();
    });

    // Add command to open main view
    this.addCommand({
      id: 'open-main-view',
      name: 'Open Main View',
      callback: () => {
        this.activateView();
      }
    });

    // Activate view when layout is ready
    this.app.workspace.onLayoutReady(() => {
      this.activateView();
    });

    console.log('TaskSync plugin loaded successfully');
  }

  async onunload() {
    console.log('TaskSync plugin unloading...');
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async activateView() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType('task-sync-main')[0];

    if (!leaf) {
      leaf = workspace.getRightLeaf(false);
      await leaf.setViewState({ type: 'task-sync-main', active: true });
    }

    workspace.revealLeaf(leaf);
  }
}

class TaskSyncView extends ItemView {
  private plugin: TaskSyncPlugin;
  private appComponent: any = null;

  constructor(leaf: WorkspaceLeaf, plugin: TaskSyncPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return 'task-sync-main';
  }

  getDisplayText(): string {
    return 'Task Sync';
  }

  getIcon(): string {
    return 'checkbox';
  }

  async onOpen() {
    console.log('TaskSync view opening...');
    const container = this.containerEl.children[1];
    container.empty();

    try {
      this.appComponent = mount(App, {
        target: container,
        props: {
          obsidianApp: this.app,
          plugin: this.plugin,
          settings: this.plugin.settings
        }
      });
      console.log('TaskSync Svelte app mounted successfully');
    } catch (error) {
      console.error('Failed to mount TaskSync Svelte app:', error);
      container.createEl('div', { text: 'Failed to load TaskSync app: ' + error.message });
    }
  }

  async onClose() {
    console.log('TaskSync view closing...');
    if (this.appComponent) {
      try {
        unmount(this.appComponent);
        this.appComponent = null;
        console.log('TaskSync Svelte app unmounted successfully');
      } catch (error) {
        console.error('Failed to unmount TaskSync Svelte app:', error);
      }
    }
  }
}
