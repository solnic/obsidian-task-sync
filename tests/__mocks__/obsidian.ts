/**
 * Mock implementation of Obsidian API for testing
 */

export class TFile {
  path: string;
  name: string;
  basename: string;
  extension: string;

  constructor(path: string) {
    this.path = path;
    this.name = path.split('/').pop() || '';
    this.basename = this.name.replace(/\.[^/.]+$/, '');
    this.extension = this.name.split('.').pop() || '';
  }
}

export class TFolder {
  path: string;
  name: string;
  children: (TFile | TFolder)[];

  constructor(path: string) {
    this.path = path;
    this.name = path.split('/').pop() || '';
    this.children = [];
  }
}

export class Vault {
  adapter: {
    exists: (path: string) => Promise<boolean>;
    read: (path: string) => Promise<string>;
    write: (path: string, content: string) => Promise<void>;
    mkdir: (path: string) => Promise<void>;
    list: (path: string) => Promise<{ files: string[]; folders: string[] }>;
  };

  constructor() {
    this.adapter = {
      exists: async (path: string) => true,
      read: async (path: string) => '',
      write: async (path: string, content: string) => {},
      mkdir: async (path: string) => {},
      list: async (path: string) => ({ files: [], folders: [] })
    };
  }

  getAbstractFileByPath(path: string): TFile | TFolder | null {
    if (path.endsWith('.md')) {
      return new TFile(path);
    }
    return new TFolder(path);
  }

  async create(path: string, content: string): Promise<TFile> {
    return new TFile(path);
  }

  async createFolder(path: string): Promise<TFolder> {
    return new TFolder(path);
  }

  async read(file: TFile): Promise<string> {
    return '';
  }

  async modify(file: TFile, content: string): Promise<void> {}

  async delete(file: TFile): Promise<void> {}
}

export class Component {
  load(): void {}
  unload(): void {}
}

export class Plugin extends Component {
  app: any;
  manifest: any;

  constructor(app: any, manifest: any) {
    super();
    this.app = app;
    this.manifest = manifest;
  }

  onload(): void {}
  onunload(): void {}
}

export class Setting {
  constructor(containerEl: HTMLElement) {}
  setName(name: string): this { return this; }
  setDesc(desc: string): this { return this; }
  addText(cb: (text: any) => void): this { return this; }
  addToggle(cb: (toggle: any) => void): this { return this; }
  addDropdown(cb: (dropdown: any) => void): this { return this; }
  addButton(cb: (button: any) => void): this { return this; }
}

export class PluginSettingTab {
  constructor(app: any, plugin: any) {}
  display(): void {}
}

export class Modal {
  constructor(app: any) {}
  open(): void {}
  close(): void {}
  onOpen(): void {}
  onClose(): void {}
}

export class Notice {
  constructor(message: string, timeout?: number) {}
}

export const normalizePath = (path: string): string => {
  return path.replace(/\\/g, '/');
};

export const moment = {
  format: (format: string) => '2023-01-01'
};
