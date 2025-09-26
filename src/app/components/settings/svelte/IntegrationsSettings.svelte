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
    // GitHub Integration
    new Setting(container)
      .setName("GitHub Integration")
      .setDesc("Enable GitHub issues integration")
      .addToggle((toggle) => {
        toggle
          .setValue(settings.integrations.github.enabled)
          .onChange((value) => {
            settings.integrations.github.enabled = value;
            saveSettings(settings);
          });
      });

    // GitHub Personal Access Token
    new Setting(container)
      .setName("GitHub Personal Access Token")
      .setDesc("Your GitHub personal access token for API access")
      .addText((text) => {
        text
          .setPlaceholder("ghp_...")
          .setValue(settings.integrations.github.personalAccessToken)
          .onChange((value) => {
            settings.integrations.github.personalAccessToken = value;
            saveSettings(settings);
          });
        text.inputEl.type = "password";
      });

    // Apple Reminders Integration
    new Setting(container)
      .setName("Apple Reminders Integration")
      .setDesc("Enable Apple Reminders integration")
      .addToggle((toggle) => {
        toggle
          .setValue(settings.integrations.appleReminders.enabled)
          .onChange((value) => {
            settings.integrations.appleReminders.enabled = value;
            saveSettings(settings);
          });
      });

    // Apple Calendar Integration
    new Setting(container)
      .setName("Apple Calendar Integration")
      .setDesc("Enable Apple Calendar integration")
      .addToggle((toggle) => {
        toggle
          .setValue(settings.integrations.appleCalendar.enabled)
          .onChange((value) => {
            settings.integrations.appleCalendar.enabled = value;
            saveSettings(settings);
          });
      });

    // Placeholder for more detailed integration settings
    const placeholder = container.createDiv();
    placeholder.innerHTML = `
      <div style="padding: 20px; margin-top: 20px; background: var(--background-secondary); border-radius: 6px; color: var(--text-muted);">
        <p><strong>Note:</strong> Detailed integration settings will be implemented in future updates.</p>
        <p>This will include repository selection, label mapping, sync intervals, and more.</p>
      </div>
    `;
  });
</script>

<div bind:this={container}></div>
