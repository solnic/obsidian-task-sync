<script lang="ts">
  import type { SettingsSection, TaskSyncSettings } from "../types";
  import { App } from "obsidian";
  import type TaskSyncPlugin from "../../../../main";
  import GitHubIntegrationSettings from "./GitHubIntegrationSettings.svelte";
  import AppleRemindersIntegrationSettings from "./AppleRemindersIntegrationSettings.svelte";
  import AppleCalendarIntegrationSettings from "./AppleCalendarIntegrationSettings.svelte";

  interface Props {
    section: SettingsSection;
    settings: TaskSyncSettings;
    saveSettings: (newSettings: TaskSyncSettings) => Promise<void>;
    app: App;
    plugin: TaskSyncPlugin;
  }

  let { settings = $bindable(), saveSettings, app, plugin }: Props = $props();

  // Local state for integration toggles
  let githubEnabled = $state(settings.integrations.github.enabled);
  let appleRemindersEnabled = $state(
    settings.integrations.appleReminders.enabled
  );
  let appleCalendarEnabled = $state(
    settings.integrations.appleCalendar.enabled
  );

  // Update settings when local state changes
  async function updateGitHubEnabled(enabled: boolean) {
    githubEnabled = enabled;
    settings.integrations.github.enabled = enabled;
    await saveSettings(settings);
  }

  async function updateAppleRemindersEnabled(enabled: boolean) {
    appleRemindersEnabled = enabled;
    settings.integrations.appleReminders.enabled = enabled;
    await saveSettings(settings);
  }

  async function updateAppleCalendarEnabled(enabled: boolean) {
    appleCalendarEnabled = enabled;
    settings.integrations.appleCalendar.enabled = enabled;
    await saveSettings(settings);
  }
</script>

<div>
  <!-- GitHub Integration Section -->
  <h3 class="task-sync-subsection-header">GitHub</h3>
  <GitHubIntegrationSettings
    {settings}
    {saveSettings}
    {app}
    {plugin}
    enabled={githubEnabled}
    onToggle={updateGitHubEnabled}
  />

  <!-- Apple Reminders Integration Section -->
  <h3 class="task-sync-subsection-header">Apple Reminders</h3>
  <AppleRemindersIntegrationSettings
    {settings}
    {saveSettings}
    enabled={appleRemindersEnabled}
    onToggle={updateAppleRemindersEnabled}
  />

  <!-- Apple Calendar Integration Section -->
  <h3 class="task-sync-subsection-header">Apple Calendar</h3>
  <AppleCalendarIntegrationSettings
    {settings}
    {saveSettings}
    enabled={appleCalendarEnabled}
    onToggle={updateAppleCalendarEnabled}
  />
</div>
