/**
 * Settings Store - Reactive Svelte store for plugin settings
 * Provides a centralized, reactive API for settings management
 */

import { writable, derived, get } from "svelte/store";
import type {
  TaskSyncSettings,
  GitHubIntegrationSettings,
  AppleRemindersIntegrationSettings,
} from "../components/ui/settings/types";

interface SettingsStoreState {
  settings: TaskSyncSettings | null;
  isLoaded: boolean;
}

export class SettingsStore {
  private _store = writable<SettingsStoreState>({
    settings: null,
    isLoaded: false,
  });

  // Main store subscription
  public subscribe = this._store.subscribe;

  // Derived stores for specific settings sections
  public githubIntegration = derived(
    this._store,
    ($store) => $store.settings?.githubIntegration || null
  );

  public appleRemindersIntegration = derived(
    this._store,
    ($store) => $store.settings?.appleRemindersIntegration || null
  );

  public appleCalendarIntegration = derived(
    this._store,
    ($store) => $store.settings?.appleCalendarIntegration || null
  );

  public taskTypes = derived(
    this._store,
    ($store) => $store.settings?.taskTypes || []
  );

  public taskPriorities = derived(
    this._store,
    ($store) => $store.settings?.taskPriorities || []
  );

  public taskStatuses = derived(
    this._store,
    ($store) => $store.settings?.taskStatuses || []
  );

  public folders = derived(this._store, ($store) => ({
    tasks: $store.settings?.tasksFolder || "",
    projects: $store.settings?.projectsFolder || "",
    areas: $store.settings?.areasFolder || "",
    templates: $store.settings?.templateFolder || "",
    dailyNotes: $store.settings?.dailyNotesFolder || "",
    bases: $store.settings?.basesFolder || "",
  }));

  public templates = derived(this._store, ($store) => ({
    task: $store.settings?.defaultTaskTemplate || "",
    project: $store.settings?.defaultProjectTemplate || "",
    area: $store.settings?.defaultAreaTemplate || "",
    parentTask: $store.settings?.defaultParentTaskTemplate || "",
  }));

  public bases = derived(this._store, ($store) => ({
    tasksBaseFile: $store.settings?.tasksBaseFile || "",
    autoGenerate: $store.settings?.autoGenerateBases || false,
    autoUpdate: $store.settings?.autoUpdateBaseViews || false,
    areaBasesEnabled: $store.settings?.areaBasesEnabled || false,
    projectBasesEnabled: $store.settings?.projectBasesEnabled || false,
    autoSyncAreaProjectBases:
      $store.settings?.autoSyncAreaProjectBases || false,
  }));

  /**
   * Initialize the store with current settings
   */
  initialize(settings: TaskSyncSettings): void {
    this._store.set({
      settings,
      isLoaded: true,
    });
  }

  /**
   * Update the entire settings object
   */
  updateSettings(settings: TaskSyncSettings): void {
    this._store.update((state) => ({
      ...state,
      settings,
    }));
  }

  /**
   * Update a specific section of settings
   */
  updateSection<K extends keyof TaskSyncSettings>(
    section: K,
    value: TaskSyncSettings[K]
  ): void {
    this._store.update((state) => {
      if (!state.settings) return state;

      return {
        ...state,
        settings: {
          ...state.settings,
          [section]: value,
        },
      };
    });
  }

  /**
   * Update GitHub integration settings
   */
  updateGitHubIntegration(settings: GitHubIntegrationSettings): void {
    this.updateSection("githubIntegration", settings);
  }

  /**
   * Update Apple Reminders integration settings
   */
  updateAppleRemindersIntegration(
    settings: AppleRemindersIntegrationSettings
  ): void {
    this.updateSection("appleRemindersIntegration", settings);
  }

  /**
   * Get current settings (non-reactive)
   */
  getCurrentSettings(): TaskSyncSettings | null {
    const state = get(this._store);
    return state.settings;
  }

  /**
   * Check if settings are loaded
   */
  isSettingsLoaded(): boolean {
    const state = get(this._store);
    return state.isLoaded;
  }
}

// Export singleton instance
export const settingsStore = new SettingsStore();
