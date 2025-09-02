import { vi } from 'vitest';

// Mock Obsidian API
const mockApp = {
  vault: {
    adapter: {
      exists: vi.fn(),
      read: vi.fn(),
      write: vi.fn(),
      mkdir: vi.fn(),
      list: vi.fn(),
    },
    getMarkdownFiles: vi.fn(() => []),
    getAbstractFileByPath: vi.fn(),
    create: vi.fn(),
    modify: vi.fn(),
    delete: vi.fn(),
  },
  workspace: {
    getActiveFile: vi.fn(),
    openLinkText: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  },
  metadataCache: {
    getFileCache: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  },
  fileManager: {
    generateMarkdownLink: vi.fn(),
  },
};

const mockPlugin = {
  app: mockApp,
  addCommand: vi.fn(),
  addSettingTab: vi.fn(),
  loadData: vi.fn(() => Promise.resolve({})),
  saveData: vi.fn(() => Promise.resolve()),
  addRibbonIcon: vi.fn(),
  addStatusBarItem: vi.fn(),
  registerEvent: vi.fn(),
  registerDomEvent: vi.fn(),
  registerInterval: vi.fn(),
};

// Global mocks
(global as any).app = mockApp;

// Mock Obsidian classes
vi.mock('obsidian', () => ({
  Plugin: class MockPlugin {
    app = mockApp;
    addCommand = vi.fn();
    addSettingTab = vi.fn();
    loadData = vi.fn(() => Promise.resolve({}));
    saveData = vi.fn(() => Promise.resolve());
    addRibbonIcon = vi.fn();
    addStatusBarItem = vi.fn();
    registerEvent = vi.fn();
    registerDomEvent = vi.fn();
    registerInterval = vi.fn();
  },
  PluginSettingTab: class MockPluginSettingTab {
    constructor(app: any, plugin: any) {
      this.app = app;
      this.plugin = plugin;
    }
    app: any;
    plugin: any;
    containerEl = {
      empty: vi.fn(),
      createEl: vi.fn(() => ({
        setText: vi.fn(),
        addClass: vi.fn(),
      })),
    };
  },
  Setting: class MockSetting {
    constructor(containerEl: any) {
      this.containerEl = containerEl;
    }
    containerEl: any;
    setName = vi.fn(() => this);
    setDesc = vi.fn(() => this);
    addText = vi.fn(() => this);
    addToggle = vi.fn(() => this);
    addDropdown = vi.fn(() => this);
    addButton = vi.fn(() => this);
  },
  Modal: class MockModal {
    constructor(app: any) {
      this.app = app;
    }
    app: any;
    contentEl = {
      empty: vi.fn(),
      createEl: vi.fn(() => ({
        setText: vi.fn(),
        addClass: vi.fn(),
      })),
    };
    open = vi.fn();
    close = vi.fn();
  },
  Notice: vi.fn(),
  TFile: class MockTFile {
    constructor(path: string) {
      this.path = path;
      this.name = path.split('/').pop() || '';
      this.basename = this.name.replace(/\.[^/.]+$/, '');
    }
    path: string;
    name: string;
    basename: string;
  },
  TFolder: class MockTFolder {
    constructor(path: string) {
      this.path = path;
      this.name = path.split('/').pop() || '';
    }
    path: string;
    name: string;
    children: any[] = [];
  },
}));

// Setup DOM environment
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock console methods for cleaner test output
global.console = {
  ...console,
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};
