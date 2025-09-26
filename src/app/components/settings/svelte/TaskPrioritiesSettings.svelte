<script lang="ts">
  import type { SettingsSection, TaskSyncSettings } from "../../../types/settings";
  import { onMount } from "svelte";

  let container: HTMLElement;

  interface Props {
    section: SettingsSection;
    settings: TaskSyncSettings;
    saveSettings: (newSettings: TaskSyncSettings) => Promise<void>;
    plugin: any;
  }

  let { settings = $bindable(), saveSettings }: Props = $props();

  onMount(() => {
    // For now, just show a placeholder
    const placeholder = container.createDiv();
    placeholder.innerHTML = `
      <div style="padding: 20px; text-align: center; color: var(--text-muted);">
        <p>Task Priorities settings will be implemented here.</p>
        <p>This will include managing priority levels with colors.</p>
      </div>
    `;
  });
</script>

<div bind:this={container}></div>
