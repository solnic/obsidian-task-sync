<script lang="ts">
  import type { SettingsSection, TaskSyncSettings } from "../types";
  import { onMount } from "svelte";
  import { DEFAULT_SETTINGS } from "../defaults";
  import { SortablePropertyList } from "../SortablePropertyList";
  import type TaskSyncPlugin from "../../../../main";

  let container: HTMLElement;

  interface Props {
    section: SettingsSection;
    settings: TaskSyncSettings;
    saveSettings: (newSettings: TaskSyncSettings) => Promise<void>;
    plugin: TaskSyncPlugin;
  }

  let { settings = $bindable(), saveSettings, plugin }: Props = $props();

  onMount(() => {
    // Description
    container.createEl("p", {
      text: "Drag and drop to reorder how properties appear in task front-matter.",
      cls: "task-sync-settings-section-desc",
    });

    // Create sortable property list
    const propertyOrder =
      settings.taskPropertyOrder || DEFAULT_SETTINGS.taskPropertyOrder;

    new SortablePropertyList({
      container: container,
      properties: propertyOrder,
      onReorder: async (newOrder: string[]) => {
        settings.taskPropertyOrder = newOrder;
        await saveSettings(settings);

        // Trigger refresh to update existing files with new property order
        await plugin.refresh();
      },
      onReset: async () => {
        settings.taskPropertyOrder = [...DEFAULT_SETTINGS.taskPropertyOrder];
        await saveSettings(settings);

        // Refresh the section
        container.empty();
        recreateSection();
      },
    });
  });

  function recreateSection(): void {
    // Description
    container.createEl("p", {
      text: "Drag and drop to reorder how properties appear in task front-matter.",
      cls: "task-sync-settings-section-desc",
    });

    // Create sortable property list
    const propertyOrder =
      settings.taskPropertyOrder || DEFAULT_SETTINGS.taskPropertyOrder;

    new SortablePropertyList({
      container: container,
      properties: propertyOrder,
      onReorder: async (newOrder: string[]) => {
        settings.taskPropertyOrder = newOrder;
        await saveSettings(settings);

        // Trigger refresh to update existing files with new property order
        await plugin.refresh();
      },
      onReset: async () => {
        settings.taskPropertyOrder = [...DEFAULT_SETTINGS.taskPropertyOrder];
        await saveSettings(settings);

        // Refresh the section
        container.empty();
        recreateSection();
      },
    });
  }
</script>

<div bind:this={container}></div>
