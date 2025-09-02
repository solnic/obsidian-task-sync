// Import vi from vitest for mocking
import { vi } from 'vitest';

// Mock Obsidian API for testing

export class Plugin {
  app: any;
  manifest: any;

  constructor(app: any, manifest: any) {
    this.app = app;
    this.manifest = manifest;
  }

  addCommand = vi.fn();
  addSettingTab = vi.fn();
  loadData = vi.fn(() => Promise.resolve({}));
  saveData = vi.fn(() => Promise.resolve());
  addRibbonIcon = vi.fn();
  addStatusBarItem = vi.fn();
  registerEvent = vi.fn();
  registerDomEvent = vi.fn();
  registerInterval = vi.fn();

  onload() { }
  onunload() { }
}

export class PluginSettingTab {
  app: any;
  plugin: any;
  containerEl = {
    empty: vi.fn(),
    createEl: vi.fn(() => ({
      setText: vi.fn(),
      addClass: vi.fn(),
    })),
  };

  constructor(app: any, plugin: any) {
    this.app = app;
    this.plugin = plugin;
  }

  display() { }
}

export class Setting {
  containerEl: any;

  constructor(containerEl: any) {
    this.containerEl = containerEl;
  }

  setName = vi.fn(() => this);
  setDesc = vi.fn(() => this);
  addText = vi.fn(() => this);
  addToggle = vi.fn(() => this);
  addDropdown = vi.fn(() => this);
  addButton = vi.fn(() => this);
}

export class Modal {
  app: any;
  contentEl = {
    empty: vi.fn(),
    createEl: vi.fn(() => ({
      setText: vi.fn(),
      addClass: vi.fn(),
    })),
  };

  constructor(app: any) {
    this.app = app;
  }

  open = vi.fn();
  close = vi.fn();
}

export const Notice = vi.fn();

export class TFile {
  path: string;
  name: string;
  basename: string;

  constructor(path: string) {
    this.path = path;
    this.name = path.split('/').pop() || '';
    this.basename = this.name.replace(/\.[^/.]+$/, '');
  }
}

export class TFolder {
  path: string;
  name: string;
  children: any[] = [];

  constructor(path: string) {
    this.path = path;
    this.name = path.split('/').pop() || '';
  }
}
