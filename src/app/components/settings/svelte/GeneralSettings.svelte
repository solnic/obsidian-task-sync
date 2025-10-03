<script lang="ts">
  import type {
    SettingsSection,
    TaskSyncSettings,
  } from "../../../types/settings";
  import { Setting } from "obsidian";
  import { onMount } from "svelte";

  let container: HTMLElement;

  interface Props {
    section: SettingsSection;
    settings: TaskSyncSettings;
    saveSettings: (newSettings: TaskSyncSettings) => Promise<void>;
  }

  let { settings = $bindable(), saveSettings }: Props = $props();

  onMount(() => {
    // Tasks Folder setting
    new Setting(container)
      .setName("Tasks Folder")
      .setDesc("Folder where task files will be stored")
      .addText((text) => {
        text
          .setPlaceholder("Tasks")
          .setValue(settings.tasksFolder)
          .onChange((value) => {
            settings.tasksFolder = value;
            saveSettings(settings);
          });
      });

    // Projects Folder setting
    new Setting(container)
      .setName("Projects Folder")
      .setDesc("Folder where project files will be stored")
      .addText((text) => {
        text
          .setPlaceholder("Projects")
          .setValue(settings.projectsFolder)
          .onChange((value) => {
            settings.projectsFolder = value;
            saveSettings(settings);
          });
      });

    // Areas Folder setting
    new Setting(container)
      .setName("Areas Folder")
      .setDesc("Folder where area files will be stored")
      .addText((text) => {
        text
          .setPlaceholder("Areas")
          .setValue(settings.areasFolder)
          .onChange((value) => {
            settings.areasFolder = value;
            saveSettings(settings);
          });
      });
  });
</script>

<div bind:this={container} data-testid="general-settings"></div>
