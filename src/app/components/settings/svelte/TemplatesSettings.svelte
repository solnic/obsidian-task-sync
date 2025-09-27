<script lang="ts">
  import type {
    SettingsSection,
    TaskSyncSettings,
  } from "../../../types/settings";
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

  let { settings, saveSettings }: Props = $props();

  onMount(() => {
    // Template Folder setting
    new Setting(container)
      .setName("Template Folder")
      .setDesc("Folder where templates are stored")
      .addText((text) => {
        text
          .setPlaceholder("Templates")
          .setValue(settings.templateFolder)
          .onChange((value) => {
            settings.templateFolder = value;
            saveSettings(settings);
          });
      });

    // Use Templater setting
    new Setting(container)
      .setName("Use Templater")
      .setDesc("Enable Templater plugin integration for templates")
      .addToggle((toggle) => {
        toggle.setValue(settings.useTemplater).onChange((value) => {
          settings.useTemplater = value;
          saveSettings(settings);
        });
      });

    // Default Task Template
    new Setting(container)
      .setName("Default Task Template")
      .setDesc("Template file to use when creating new tasks")
      .addText((text) => {
        text
          .setPlaceholder("task-template.md")
          .setValue(settings.defaultTaskTemplate)
          .onChange((value) => {
            settings.defaultTaskTemplate = value;
            saveSettings(settings);
          });
      });

    // Default Project Template
    new Setting(container)
      .setName("Default Project Template")
      .setDesc("Template file to use when creating new projects")
      .addText((text) => {
        text
          .setPlaceholder("project-template.md")
          .setValue(settings.defaultProjectTemplate)
          .onChange((value) => {
            settings.defaultProjectTemplate = value;
            saveSettings(settings);
          });
      });

    // Default Area Template
    new Setting(container)
      .setName("Default Area Template")
      .setDesc("Template file to use when creating new areas")
      .addText((text) => {
        text
          .setPlaceholder("area-template.md")
          .setValue(settings.defaultAreaTemplate)
          .onChange((value) => {
            settings.defaultAreaTemplate = value;
            saveSettings(settings);
          });
      });
  });
</script>

<div bind:this={container}></div>
