<script lang="ts">
  import type { TaskSyncSettings } from "../types";
  import { App } from "obsidian";
  import type TaskSyncPlugin from "../../../../main";
  import Section from "./Section.svelte";

  interface SectionDefinition {
    id: string;
    title: string;
  }

  interface Props {
    settings: TaskSyncSettings;
    saveSettings: (newSettings: TaskSyncSettings) => Promise<void>;
    app: App;
    plugin: TaskSyncPlugin;
  }

  let { settings, saveSettings, app, plugin }: Props = $props();

  let sections: SectionDefinition[] = [
    { id: "general", title: "General" },
    { id: "templates", title: "Templates" },
    { id: "bases", title: "Bases" },
    { id: "task-properties", title: "Task Properties" },
    { id: "task-categories", title: "Task Categories" },
    { id: "task-priorities", title: "Task Priorities" },
    { id: "task-statuses", title: "Task Statuses" },
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
