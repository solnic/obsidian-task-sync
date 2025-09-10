/**
 * Mock implementation of Obsidian API for testing
 */

export class Plugin {
  app: any;
  manifest: any;
  settings: any;

  constructor(app: any, manifest: any) {
    this.app = app;
    this.manifest = manifest;
  }

  async onload() {}
  onunload() {}
  async loadData() {
    return {};
  }
  async saveData(data: any) {}
  addCommand(command: any) {}
  addSettingTab(tab: any) {}
}

export class PluginSettingTab {
  app: any;
  plugin: any;

  constructor(app: any, plugin: any) {
    this.app = app;
    this.plugin = plugin;
  }

  display() {}
}

export class Setting {
  constructor(containerEl: any) {}
  setName(name: string) {
    return this;
  }
  setDesc(desc: string) {
    return this;
  }
  addText(cb: any) {
    return this;
  }
  addToggle(cb: any) {
    return this;
  }
  addDropdown(cb: any) {
    return this;
  }
  addButton(cb: any) {
    return this;
  }
}

export class TFile {
  path: string;
  name: string;
  extension: string;

  constructor(path: string) {
    this.path = path;
    this.name = path.split("/").pop() || "";
    this.extension = this.name.split(".").pop() || "";
  }
}

export class MarkdownView {
  editor: any;

  constructor() {
    this.editor = null;
  }

  getViewType() {
    return "markdown";
  }
}

export class Notice {
  constructor(message: string, timeout?: number) {
    console.log(`Notice: ${message}`);
  }
}

// Mock editor interface
export interface Editor {
  getCursor(): { line: number; ch: number };
  getLine(line: number): string;
  setLine(line: number, text: string): void;
}

// Export commonly used types
export interface App {
  workspace: Workspace;
  vault: Vault;
}

export interface Workspace {
  getActiveView(): any;
  getActiveFile(): TFile | null;
}

export interface Vault {
  create(path: string, content: string): Promise<TFile>;
  getAbstractFileByPath(path: string): TFile | null;
}
