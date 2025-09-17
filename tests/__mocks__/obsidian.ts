// Mock implementation of Obsidian API for testing
import { vi } from 'vitest';

export class ItemView {
  contentEl = {
    empty: vi.fn(),
    addClass: vi.fn(),
    removeClass: vi.fn(),
    createEl: vi.fn(() => ({
      createEl: vi.fn(),
      setText: vi.fn(),
      createDiv: vi.fn(() => ({
        createDiv: vi.fn(),
        setText: vi.fn(),
        addClass: vi.fn(),
        removeClass: vi.fn()
      })),
      addClass: vi.fn(),
      removeClass: vi.fn(),
      remove: vi.fn()
    })),
    createDiv: vi.fn(() => ({
      createDiv: vi.fn(),
      setText: vi.fn(),
      addClass: vi.fn(),
      removeClass: vi.fn(),
      remove: vi.fn()
    })),
    remove: vi.fn()
  };
  leaf: any;
  app = {
    workspace: {
      on: vi.fn(),
      off: vi.fn(),
      getActiveFile: vi.fn(),
      getActiveViewOfType: vi.fn(),
      activeEditor: { file: null as any },
      getLeavesOfType: vi.fn(() => [])
    },
    vault: {
      on: vi.fn(),
      off: vi.fn(),
      read: vi.fn(),
      modify: vi.fn(),
      create: vi.fn(),
      getAbstractFileByPath: vi.fn()
    },
    metadataCache: {
      getFileCache: vi.fn(),
      on: vi.fn(),
      off: vi.fn()
    }
  };
  registerEvent = vi.fn();

  constructor(leaf: any) {
    this.leaf = leaf;
  }

  getViewType() { return 'mock-view'; }
  getDisplayText() { return 'Mock View'; }
  getIcon() { return 'mock'; }
}

export class WorkspaceLeaf {
  on = vi.fn();
  off = vi.fn();
}

export class MarkdownView { }

export class TFile {
  path: string = '';
  name: string = '';
  basename: string = '';
  extension: string = '';

  constructor(path?: string) {
    if (path) {
      this.path = path;
      this.name = path.split('/').pop() || '';
      this.basename = this.name.replace(/\.[^/.]+$/, '');
      this.extension = this.name.split('.').pop() || '';
    }
  }
}

export const Notice = vi.fn();

export const setIcon = vi.fn();

export class Plugin {
  app: any;
  settings: any = {};
  loadData = vi.fn().mockResolvedValue({});
  saveData = vi.fn().mockResolvedValue(undefined);

  constructor() {
    this.app = {
      workspace: {
        on: vi.fn(),
        off: vi.fn(),
        getActiveFile: vi.fn(),
        getActiveViewOfType: vi.fn(),
        getLeavesOfType: vi.fn(() => [])
      },
      vault: {
        on: vi.fn(),
        off: vi.fn(),
        read: vi.fn(),
        modify: vi.fn(),
        create: vi.fn(),
        getAbstractFileByPath: vi.fn()
      },
      metadataCache: {
        getFileCache: vi.fn(),
        on: vi.fn(),
        off: vi.fn()
      }
    };
  }
}

export class PluginSettingTab { }

export const Setting = vi.fn();

export class SuggestModal { }

export class Modal { }

export class App {
  workspace = {
    on: vi.fn(),
    off: vi.fn(),
    getActiveFile: vi.fn(),
    getActiveViewOfType: vi.fn(),
    getLeavesOfType: vi.fn(() => [])
  };
  vault = {
    on: vi.fn(),
    off: vi.fn(),
    read: vi.fn(),
    modify: vi.fn(),
    create: vi.fn(),
    getAbstractFileByPath: vi.fn()
  };
  metadataCache = {
    getFileCache: vi.fn(),
    on: vi.fn(),
    off: vi.fn()
  };
}

export const requestUrl = vi.fn();

// Mock getFrontMatterInfo function
export const getFrontMatterInfo = vi.fn((content: string) => {
  // Simple mock implementation that detects frontmatter
  if (content.startsWith('---\n')) {
    const frontmatterEnd = content.indexOf('\n---\n', 4);
    if (frontmatterEnd !== -1) {
      return {
        exists: true,
        from: 4, // After opening ---\n
        to: frontmatterEnd,
        contentStart: frontmatterEnd + 5, // After closing \n---\n
        frontmatter: content.slice(4, frontmatterEnd)
      };
    }
  }

  return {
    exists: false,
    from: 0,
    to: 0,
    contentStart: 0,
    frontmatter: ''
  };
});
