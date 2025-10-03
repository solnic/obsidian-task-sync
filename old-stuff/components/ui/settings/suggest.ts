/**
 * Autocomplete suggest components for settings
 */

import { App, TFolder, TFile, Setting } from "obsidian";
import {
  FolderSuggestOptions,
  FileSuggestOptions,
  ValidationResult,
} from "./types";

/**
 * Creates a folder suggestion input using Obsidian's vault API
 */
export class FolderSuggestComponent {
  private app: App;
  private inputEl: HTMLInputElement;
  private suggestEl: HTMLElement | null = null;
  private options: FolderSuggestOptions;
  private onChangeCallback?: (value: string) => void;
  private isOpen = false;

  constructor(
    app: App,
    inputEl: HTMLInputElement,
    options: FolderSuggestOptions = {},
  ) {
    this.app = app;
    this.inputEl = inputEl;
    this.options = options;
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.inputEl.addEventListener("input", this.handleInput.bind(this));
    this.inputEl.addEventListener("focus", this.handleFocus.bind(this));
    this.inputEl.addEventListener("blur", this.handleBlur.bind(this));
    this.inputEl.addEventListener("keydown", this.handleKeydown.bind(this));
  }

  private handleInput(): void {
    const value = this.inputEl.value;
    this.showSuggestions(value);

    if (this.onChangeCallback) {
      this.onChangeCallback(value);
    }
  }

  private handleFocus(): void {
    this.showSuggestions(this.inputEl.value);
  }

  private handleBlur(): void {
    // Delay hiding to allow for suggestion clicks
    setTimeout(() => this.hideSuggestions(), 150);
  }

  private handleKeydown(event: KeyboardEvent): void {
    if (!this.isOpen) return;

    switch (event.key) {
      case "Escape":
        this.hideSuggestions();
        break;
      case "ArrowDown":
        event.preventDefault();
        this.selectNextSuggestion();
        break;
      case "ArrowUp":
        event.preventDefault();
        this.selectPreviousSuggestion();
        break;
      case "Enter":
        event.preventDefault();
        this.acceptSelectedSuggestion();
        break;
    }
  }

  private showSuggestions(query: string): void {
    const folders = this.getFolderSuggestions(query);

    if (folders.length === 0) {
      this.hideSuggestions();
      return;
    }

    if (!this.suggestEl) {
      this.createSuggestElement();
    }

    this.renderSuggestions(folders);
    this.isOpen = true;
  }

  private getFolderSuggestions(query: string): string[] {
    const allFolders = this.app.vault
      .getAllLoadedFiles()
      .filter((file) => file instanceof TFolder)
      .map((folder) => folder.path)
      .sort();

    if (!query.trim()) {
      return allFolders.slice(0, 10); // Show first 10 folders
    }

    return allFolders
      .filter((path) => path.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 10);
  }

  private createSuggestElement(): void {
    this.suggestEl = document.createElement("div");
    this.suggestEl.className = "suggestion-container task-sync-folder-suggest";

    // Position relative to input
    const rect = this.inputEl.getBoundingClientRect();
    this.suggestEl.style.position = "absolute";
    this.suggestEl.style.top = `${rect.bottom + window.scrollY}px`;
    this.suggestEl.style.left = `${rect.left + window.scrollX}px`;
    this.suggestEl.style.width = `${rect.width}px`;
    this.suggestEl.style.zIndex = "1000";
    this.suggestEl.style.backgroundColor = "var(--background-primary)";
    this.suggestEl.style.border = "1px solid var(--background-modifier-border)";
    this.suggestEl.style.borderRadius = "4px";
    this.suggestEl.style.maxHeight = "200px";
    this.suggestEl.style.overflowY = "auto";

    document.body.appendChild(this.suggestEl);
  }

  private renderSuggestions(folders: string[]): void {
    if (!this.suggestEl) return;

    this.suggestEl.innerHTML = "";

    folders.forEach((folder, index) => {
      const item = document.createElement("div");
      item.className = "suggestion-item";
      item.textContent = folder || "(root)";
      item.style.padding = "8px 12px";
      item.style.cursor = "pointer";

      if (index === 0) {
        item.classList.add("is-selected");
        item.style.backgroundColor = "var(--background-modifier-hover)";
      }

      item.addEventListener("click", () => {
        this.inputEl.value = folder;
        this.hideSuggestions();
        if (this.onChangeCallback) {
          this.onChangeCallback(folder);
        }
      });

      item.addEventListener("mouseenter", () => {
        this.clearSelection();
        item.classList.add("is-selected");
        item.style.backgroundColor = "var(--background-modifier-hover)";
      });

      this.suggestEl.appendChild(item);
    });
  }

  private selectNextSuggestion(): void {
    if (!this.suggestEl) return;

    const items = this.suggestEl.querySelectorAll(".suggestion-item");
    const selected = this.suggestEl.querySelector(".is-selected");

    if (!selected) {
      if (items.length > 0) {
        this.selectItem(items[0] as HTMLElement);
      }
      return;
    }

    const currentIndex = Array.from(items).indexOf(selected);
    const nextIndex = (currentIndex + 1) % items.length;
    this.selectItem(items[nextIndex] as HTMLElement);
  }

  private selectPreviousSuggestion(): void {
    if (!this.suggestEl) return;

    const items = this.suggestEl.querySelectorAll(".suggestion-item");
    const selected = this.suggestEl.querySelector(".is-selected");

    if (!selected) {
      if (items.length > 0) {
        this.selectItem(items[items.length - 1] as HTMLElement);
      }
      return;
    }

    const currentIndex = Array.from(items).indexOf(selected);
    const prevIndex = currentIndex === 0 ? items.length - 1 : currentIndex - 1;
    this.selectItem(items[prevIndex] as HTMLElement);
  }

  private selectItem(item: HTMLElement): void {
    this.clearSelection();
    item.classList.add("is-selected");
    item.style.backgroundColor = "var(--background-modifier-hover)";
  }

  private clearSelection(): void {
    if (!this.suggestEl) return;

    this.suggestEl.querySelectorAll(".suggestion-item").forEach((item) => {
      item.classList.remove("is-selected");
      (item as HTMLElement).style.backgroundColor = "";
    });
  }

  private acceptSelectedSuggestion(): void {
    if (!this.suggestEl) return;

    const selected = this.suggestEl.querySelector(".is-selected");
    if (selected) {
      this.inputEl.value = selected.textContent || "";
      this.hideSuggestions();
      if (this.onChangeCallback) {
        this.onChangeCallback(this.inputEl.value);
      }
    }
  }

  private hideSuggestions(): void {
    if (this.suggestEl) {
      this.suggestEl.remove();
      this.suggestEl = null;
    }
    this.isOpen = false;
  }

  public onChange(callback: (value: string) => void): void {
    this.onChangeCallback = callback;
  }

  public destroy(): void {
    this.hideSuggestions();
  }
}

/**
 * Creates a file suggestion input using Obsidian's vault API
 */
export class FileSuggestComponent {
  private app: App;
  private inputEl: HTMLInputElement;
  private suggestEl: HTMLElement | null = null;
  private options: FileSuggestOptions;
  private onChangeCallback?: (value: string) => void;
  private isOpen = false;

  constructor(
    app: App,
    inputEl: HTMLInputElement,
    options: FileSuggestOptions = {},
  ) {
    this.app = app;
    this.inputEl = inputEl;
    this.options = options;
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.inputEl.addEventListener("input", this.handleInput.bind(this));
    this.inputEl.addEventListener("focus", this.handleFocus.bind(this));
    this.inputEl.addEventListener("blur", this.handleBlur.bind(this));
    this.inputEl.addEventListener("keydown", this.handleKeydown.bind(this));
  }

  private handleInput(): void {
    const value = this.inputEl.value;
    this.showSuggestions(value);

    if (this.onChangeCallback) {
      this.onChangeCallback(value);
    }
  }

  private handleFocus(): void {
    this.showSuggestions(this.inputEl.value);
  }

  private handleBlur(): void {
    // Delay hiding to allow for suggestion clicks
    setTimeout(() => this.hideSuggestions(), 150);
  }

  private handleKeydown(event: KeyboardEvent): void {
    if (!this.isOpen) return;

    switch (event.key) {
      case "Escape":
        this.hideSuggestions();
        break;
      case "ArrowDown":
        event.preventDefault();
        this.selectNextSuggestion();
        break;
      case "ArrowUp":
        event.preventDefault();
        this.selectPreviousSuggestion();
        break;
      case "Enter":
        event.preventDefault();
        this.acceptSelectedSuggestion();
        break;
    }
  }

  private showSuggestions(query: string): void {
    const files = this.getFileSuggestions(query);

    if (files.length === 0) {
      this.hideSuggestions();
      return;
    }

    if (!this.suggestEl) {
      this.createSuggestElement();
    }

    this.renderSuggestions(files);
    this.isOpen = true;
  }

  private getFileSuggestions(query: string): string[] {
    let allFiles = this.app.vault
      .getAllLoadedFiles()
      .filter((file) => file instanceof TFile);

    // Filter by folder path if specified
    if (this.options.folderPath !== undefined) {
      const folderPath = this.options.folderPath;
      allFiles = allFiles.filter((file) => {
        // Check if file is in the specified folder or its subfolders
        if (folderPath === "") {
          // Empty string means root folder only (no subfolders)
          return !file.path.includes("/");
        } else {
          // Non-empty folder path
          return file.path.startsWith(folderPath + "/");
        }
      });
    }

    let fileNames = allFiles.map((file) => file.name);

    // Filter by extensions if specified
    if (this.options.fileExtensions && this.options.fileExtensions.length > 0) {
      fileNames = fileNames.filter((fileName) =>
        this.options.fileExtensions!.some((ext) => fileName.endsWith(ext)),
      );
    }

    fileNames.sort();

    if (!query.trim()) {
      return fileNames.slice(0, 10); // Show first 10 files
    }

    return fileNames
      .filter((name) => name.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 10);
  }

  private createSuggestElement(): void {
    this.suggestEl = document.createElement("div");
    this.suggestEl.className = "suggestion-container task-sync-file-suggest";

    // Position relative to input
    const rect = this.inputEl.getBoundingClientRect();
    this.suggestEl.style.position = "absolute";
    this.suggestEl.style.top = `${rect.bottom + window.scrollY}px`;
    this.suggestEl.style.left = `${rect.left + window.scrollX}px`;
    this.suggestEl.style.width = `${rect.width}px`;
    this.suggestEl.style.zIndex = "1000";
    this.suggestEl.style.backgroundColor = "var(--background-primary)";
    this.suggestEl.style.border = "1px solid var(--background-modifier-border)";
    this.suggestEl.style.borderRadius = "4px";
    this.suggestEl.style.maxHeight = "200px";
    this.suggestEl.style.overflowY = "auto";

    document.body.appendChild(this.suggestEl);
  }

  private renderSuggestions(files: string[]): void {
    if (!this.suggestEl) return;

    this.suggestEl.innerHTML = "";

    files.forEach((file, index) => {
      const item = document.createElement("div");
      item.className = "suggestion-item";
      item.textContent = file;
      item.style.padding = "8px 12px";
      item.style.cursor = "pointer";

      if (index === 0) {
        item.classList.add("is-selected");
        item.style.backgroundColor = "var(--background-modifier-hover)";
      }

      item.addEventListener("click", () => {
        this.inputEl.value = file;
        this.hideSuggestions();
        if (this.onChangeCallback) {
          this.onChangeCallback(file);
        }
      });

      item.addEventListener("mouseenter", () => {
        this.clearSelection();
        item.classList.add("is-selected");
        item.style.backgroundColor = "var(--background-modifier-hover)";
      });

      this.suggestEl.appendChild(item);
    });
  }

  private selectNextSuggestion(): void {
    if (!this.suggestEl) return;

    const items = this.suggestEl.querySelectorAll(".suggestion-item");
    const selected = this.suggestEl.querySelector(".is-selected");

    if (!selected) {
      if (items.length > 0) {
        this.selectItem(items[0] as HTMLElement);
      }
      return;
    }

    const currentIndex = Array.from(items).indexOf(selected);
    const nextIndex = (currentIndex + 1) % items.length;
    this.selectItem(items[nextIndex] as HTMLElement);
  }

  private selectPreviousSuggestion(): void {
    if (!this.suggestEl) return;

    const items = this.suggestEl.querySelectorAll(".suggestion-item");
    const selected = this.suggestEl.querySelector(".is-selected");

    if (!selected) {
      if (items.length > 0) {
        this.selectItem(items[items.length - 1] as HTMLElement);
      }
      return;
    }

    const currentIndex = Array.from(items).indexOf(selected);
    const prevIndex = currentIndex === 0 ? items.length - 1 : currentIndex - 1;
    this.selectItem(items[prevIndex] as HTMLElement);
  }

  private selectItem(item: HTMLElement): void {
    this.clearSelection();
    item.classList.add("is-selected");
    item.style.backgroundColor = "var(--background-modifier-hover)";
  }

  private clearSelection(): void {
    if (!this.suggestEl) return;

    this.suggestEl.querySelectorAll(".suggestion-item").forEach((item) => {
      item.classList.remove("is-selected");
      (item as HTMLElement).style.backgroundColor = "";
    });
  }

  private acceptSelectedSuggestion(): void {
    if (!this.suggestEl) return;

    const selected = this.suggestEl.querySelector(".is-selected");
    if (selected) {
      this.inputEl.value = selected.textContent || "";
      this.hideSuggestions();
      if (this.onChangeCallback) {
        this.onChangeCallback(this.inputEl.value);
      }
    }
  }

  private hideSuggestions(): void {
    if (this.suggestEl) {
      this.suggestEl.remove();
      this.suggestEl = null;
    }
    this.isOpen = false;
  }

  public onChange(callback: (value: string) => void): void {
    this.onChangeCallback = callback;
  }

  public destroy(): void {
    this.hideSuggestions();
  }
}
