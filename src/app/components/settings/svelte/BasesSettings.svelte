<script lang="ts">
  import type { SettingsSection, TaskSyncSettings } from "../../../types/settings";
  import { Setting, App } from "obsidian";
  import { onMount } from "svelte";

  let container: HTMLElement;

  interface Props {
    section: SettingsSection;
    settings: TaskSyncSettings;
    saveSettings: (newSettings: TaskSyncSettings) => Promise<void>;
    app: App;
    plugin: any;
  }

  let { settings = $bindable(), saveSettings }: Props = $props();

  onMount(() => {
    // Bases Folder setting
    new Setting(container)
      .setName("Bases Folder")
      .setDesc("Folder where base files are stored")
      .addText((text) => {
        text
          .setPlaceholder("Bases")
          .setValue(settings.basesFolder)
          .onChange((value) => {
            settings.basesFolder = value;
            saveSettings(settings);
          });
      });

    // Tasks Base File
    new Setting(container)
      .setName("Tasks Base File")
      .setDesc("Base file for task views")
      .addText((text) => {
        text
          .setPlaceholder("Tasks.base")
          .setValue(settings.tasksBaseFile)
          .onChange((value) => {
            settings.tasksBaseFile = value;
            saveSettings(settings);
          });
      });

    // Auto Generate Bases
    new Setting(container)
      .setName("Auto Generate Bases")
      .setDesc("Automatically generate base files when needed")
      .addToggle((toggle) => {
        toggle
          .setValue(settings.autoGenerateBases)
          .onChange((value) => {
            settings.autoGenerateBases = value;
            saveSettings(settings);
          });
      });

    // Auto Update Base Views
    new Setting(container)
      .setName("Auto Update Base Views")
      .setDesc("Automatically update base views when data changes")
      .addToggle((toggle) => {
        toggle
          .setValue(settings.autoUpdateBaseViews)
          .onChange((value) => {
            settings.autoUpdateBaseViews = value;
            saveSettings(settings);
          });
      });

    // Area Bases Enabled
    new Setting(container)
      .setName("Area Bases Enabled")
      .setDesc("Enable individual base files for each area")
      .addToggle((toggle) => {
        toggle
          .setValue(settings.areaBasesEnabled)
          .onChange((value) => {
            settings.areaBasesEnabled = value;
            saveSettings(settings);
          });
      });

    // Project Bases Enabled
    new Setting(container)
      .setName("Project Bases Enabled")
      .setDesc("Enable individual base files for each project")
      .addToggle((toggle) => {
        toggle
          .setValue(settings.projectBasesEnabled)
          .onChange((value) => {
            settings.projectBasesEnabled = value;
            saveSettings(settings);
          });
      });
  });
</script>

<div bind:this={container}></div>
