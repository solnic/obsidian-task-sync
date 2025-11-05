<script lang="ts">
  import type { TaskSyncSettings } from "../../../types/settings";
  import { Setting } from "obsidian";
  import { onMount } from "svelte";

  let appleRemindersContainer: HTMLElement;

  interface Props {
    settings: TaskSyncSettings;
    saveSettings: (newSettings: TaskSyncSettings) => Promise<void>;
    enabled: boolean;
    onToggle: (enabled: boolean) => Promise<void>;
  }

  let { settings, saveSettings, enabled, onToggle }: Props = $props();

  // Platform check for Apple integrations
  const isPlatformSupported = process.platform === "darwin";

  onMount(() => {
    createAppleRemindersSection();
  });

  function createAppleRemindersSection(): void {
    if (!isPlatformSupported) {
      appleRemindersContainer.createDiv({
        text: "Apple Reminders integration is only available on macOS",
        cls: "task-sync-platform-warning",
      });
    }

    // Apple Reminders integration toggle
    new Setting(appleRemindersContainer)
      .setName("Enable Apple Reminders Integration")
      .setDesc(
        isPlatformSupported
          ? "Connect to Apple Reminders to import reminders as tasks"
          : "Apple Reminders integration (macOS only)"
      )
      .addToggle((toggle) => {
        toggle
          .setValue(enabled)
          .setDisabled(!isPlatformSupported)
          .onChange(async (value) => {
            await onToggle(value);
          });
      });
  }

  function createAppleRemindersSettings(): void {
    // Include completed reminders
    new Setting(appleRemindersContainer)
      .setName("Include Completed Reminders")
      .setDesc("Import completed reminders along with active ones")
      .addToggle((toggle) => {
        toggle
          .setValue(
            settings.integrations.appleReminders.includeCompletedReminders
          )
          .onChange(async (value) => {
            settings.integrations.appleReminders.includeCompletedReminders =
              value;
            await saveSettings(settings);
          });
      });

    // Exclude all-day reminders
    new Setting(appleRemindersContainer)
      .setName("Exclude All-Day Reminders")
      .setDesc("Skip reminders that are set for all day")
      .addToggle((toggle) => {
        toggle
          .setValue(settings.integrations.appleReminders.excludeAllDayReminders)
          .onChange(async (value) => {
            settings.integrations.appleReminders.excludeAllDayReminders = value;
            await saveSettings(settings);
          });
      });

    // Default task type
    new Setting(appleRemindersContainer)
      .setName("Default Task Type")
      .setDesc("Default task type for imported reminders")
      .addDropdown((dropdown) => {
        // Add task types from settings
        settings.taskCategories.forEach((taskCategory) => {
          dropdown.addOption(taskCategory.name, taskCategory.name);
        });

        dropdown
          .setValue(settings.integrations.appleReminders.defaultTaskType)
          .onChange(async (value) => {
            settings.integrations.appleReminders.defaultTaskType = value;
            await saveSettings(settings);
          });
      });

    // Import notes as description
    new Setting(appleRemindersContainer)
      .setName("Import Notes as Description")
      .setDesc("Import reminder notes as task descriptions")
      .addToggle((toggle) => {
        toggle
          .setValue(
            settings.integrations.appleReminders.importNotesAsDescription
          )
          .onChange(async (value) => {
            settings.integrations.appleReminders.importNotesAsDescription =
              value;
            await saveSettings(settings);
          });
      });

    // Preserve priority
    new Setting(appleRemindersContainer)
      .setName("Preserve Priority")
      .setDesc("Map Apple Reminders priority levels to task priorities")
      .addToggle((toggle) => {
        toggle
          .setValue(settings.integrations.appleReminders.preservePriority)
          .onChange(async (value) => {
            settings.integrations.appleReminders.preservePriority = value;
            await saveSettings(settings);
          });
      });

    // Sync interval
    new Setting(appleRemindersContainer)
      .setName("Sync Interval (minutes)")
      .setDesc("How often to check for new reminders (for future auto-sync)")
      .addText((text) => {
        text
          .setPlaceholder("60")
          .setValue(
            settings.integrations.appleReminders.syncInterval.toString()
          )
          .onChange(async (value) => {
            const interval = parseInt(value);
            if (!isNaN(interval) && interval > 0) {
              settings.integrations.appleReminders.syncInterval = interval;
              await saveSettings(settings);
            }
          });
      });
  }

  // Reactive statement to create/destroy settings based on toggle state
  $effect(() => {
    if (enabled && isPlatformSupported) {
      createAppleRemindersSettings();
    } else {
      // Clear Apple Reminders settings when disabled
      const children = Array.from(appleRemindersContainer.children);
      children
        .slice(isPlatformSupported ? 1 : 2)
        .forEach((child) => child.remove()); // Keep the warning and toggle
    }
  });
</script>

<div bind:this={appleRemindersContainer}></div>
