<script lang="ts">
  import type {
    SettingsSection,
    TaskSyncSettings,
  } from "../../../types/settings";
  import { App } from "obsidian";
  import GeneralSettings from "./GeneralSettings.svelte";
  import TemplatesSettings from "./TemplatesSettings.svelte";
  import BasesSettings from "./BasesSettings.svelte";
  import IntegrationsSettings from "./IntegrationsSettings.svelte";
  import TypeNoteSettings from "./TypeNoteSettings.svelte";

  interface Props {
    section: SettingsSection;
    settings: TaskSyncSettings;
    saveSettings: (newSettings: TaskSyncSettings) => Promise<void>;
    app: App;
    plugin: any; // Plugin interface
  }

  let {
    section,
    settings = $bindable(),
    saveSettings,
    app,
    plugin,
  }: Props = $props();
</script>

<div class="task-sync-settings-section">
  <h2
    class="task-sync-section-header"
    data-testid="settings-section-{section.id}"
  >
    {section.title}
  </h2>
  {#if section.description}
    <p class="task-sync-settings-section-desc">{section.description}</p>
  {/if}

  {#if section.id === "general"}
    <GeneralSettings bind:settings {saveSettings} {section} />
  {:else if section.id === "templates"}
    <TemplatesSettings bind:settings {saveSettings} {section} {app} {plugin} />
  {:else if section.id === "bases"}
    <BasesSettings bind:settings {saveSettings} {section} {app} {plugin} />
  {:else if section.id === "type-note"}
    <TypeNoteSettings bind:settings {saveSettings} {section} {plugin} />
  {:else if section.id === "integrations"}
    <IntegrationsSettings
      bind:settings
      {saveSettings}
      {section}
      {app}
      {plugin}
    />
  {/if}
</div>

<style>
  .task-sync-settings-section {
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    padding: 20px;
  }

  .task-sync-section-header {
    margin: 0 0 16px 0;
    color: var(--text-normal);
    font-size: 18px;
    font-weight: 600;
    border-bottom: 1px solid var(--background-modifier-border);
    padding-bottom: 8px;
  }

  .task-sync-settings-section-desc {
    margin: 0 0 16px 0;
    color: var(--text-muted);
    font-size: 14px;
    line-height: 1.4;
  }
</style>
