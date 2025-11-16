/**
 * Settings components exports
 * Adapted from old-stuff for the new architecture
 */

// Main settings tab (requires Obsidian)
export { TaskSyncSettingTab } from "./SettingsTab";

// Validation utilities (pure functions, no Obsidian dependency)
export * from "./validation";

// Suggest components (require Obsidian)
export * from "./suggest";

// Sortable list components (pure components, no Obsidian dependency)
export { SortablePropertyList } from "./SortablePropertyList";
export { SortableGitHubMappingList } from "./SortableGitHubMappingList";

// Svelte components (require Obsidian for settings)
export { default as SettingsView } from "./svelte/SettingsView.svelte";
export { default as Section } from "./svelte/Section.svelte";
export { default as GeneralSettings } from "./svelte/GeneralSettings.svelte";
export { default as TemplatesSettings } from "./svelte/TemplatesSettings.svelte";
export { default as BasesSettings } from "./svelte/BasesSettings.svelte";
export { default as TaskPropertiesSettings } from "./svelte/TaskPropertiesSettings.svelte";

export { default as IntegrationsSettings } from "./svelte/IntegrationsSettings.svelte";
