<script lang="ts">
  import type { SettingsSection, TaskSyncSettings } from "../types";
  import { App } from "obsidian";
  import type TaskSyncPlugin from "../../../../main";
  import GeneralSettings from "./GeneralSettings.svelte";
  import TemplatesSettings from "./TemplatesSettings.svelte";
  import BasesSettings from "./BasesSettings.svelte";
  import TaskPropertiesSettings from "./TaskPropertiesSettings.svelte";
  import TaskCategoriesSettings from "./TaskCategoriesSettings.svelte";
  import TaskPrioritiesSettings from "./TaskPrioritiesSettings.svelte";
  import TaskStatusesSettings from "./TaskStatusesSettings.svelte";
  import IntegrationsSettings from "./IntegrationsSettings.svelte";

  interface Props {
    section: SettingsSection;
    settings: TaskSyncSettings;
    saveSettings: (newSettings: TaskSyncSettings) => Promise<void>;
    app: App;
    plugin: TaskSyncPlugin;
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
  <h2 class="task-sync-section-header">{section.title}</h2>
  {#if section.description}
    <p class="task-sync-settings-section-desc">{section.description}</p>
  {/if}

  {#if section.id === "general"}
    <GeneralSettings bind:settings {saveSettings} {section} />
  {:else if section.id === "templates"}
    <TemplatesSettings bind:settings {saveSettings} {section} {app} {plugin} />
  {:else if section.id === "bases"}
    <BasesSettings bind:settings {saveSettings} {section} {app} {plugin} />
  {:else if section.id === "task-properties"}
    <TaskPropertiesSettings bind:settings {saveSettings} {section} {plugin} />
  {:else if section.id === "task-categories"}
    <TaskCategoriesSettings bind:settings {saveSettings} {section} {plugin} />
  {:else if section.id === "task-priorities"}
    <TaskPrioritiesSettings bind:settings {saveSettings} {section} {plugin} />
  {:else if section.id === "task-statuses"}
    <TaskStatusesSettings bind:settings {saveSettings} {section} {plugin} />
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
