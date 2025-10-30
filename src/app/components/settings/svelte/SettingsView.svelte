<script lang="ts">
  import type { TaskSyncSettings } from "../../../types/settings";
  import { App } from "obsidian";
  import Section from "./Section.svelte";

  interface SectionDefinition {
    id: string;
    title: string;
  }

  interface Props {
    settings: TaskSyncSettings;
    saveSettings: (newSettings: TaskSyncSettings) => Promise<void>;
    app: App;
    plugin: any; // Plugin interface
  }

  let { settings, saveSettings, app, plugin }: Props = $props();

  let sections: SectionDefinition[] = [
    { id: "general", title: "General" },
    { id: "templates", title: "Templates" },
    { id: "bases", title: "Bases" },
    { id: "type-note", title: "TypeNote" },
    { id: "integrations", title: "Integrations" },
  ];
</script>

<div class="task-sync-settings">
  <div class="task-sync-settings-header">
    <h2>Task Sync Settings</h2>
    <p>
      Configure your task management system. Changes are saved automatically.
    </p>
  </div>
  <div class="task-sync-settings-sections">
    {#each sections as section (section.id)}
      <Section {section} {settings} {saveSettings} {app} {plugin} />
    {/each}
  </div>
</div>

<style>
  .task-sync-settings {
    padding: 20px;
    max-width: 800px;
  }

  .task-sync-settings-header {
    margin-bottom: 30px;
  }

  .task-sync-settings-header h2 {
    margin: 0 0 8px 0;
    color: var(--text-normal);
    font-size: 24px;
    font-weight: 600;
  }

  .task-sync-settings-header p {
    margin: 0;
    color: var(--text-muted);
    font-size: 14px;
  }

  .task-sync-settings-sections {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }
</style>
