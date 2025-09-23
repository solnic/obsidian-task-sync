<script lang="ts">
  import type { TaskSyncSettings } from "../types";
  import { Setting } from "obsidian";
  import { onMount } from "svelte";

  let appleCalendarContainer: HTMLElement;

  interface Props {
    settings: TaskSyncSettings;
    saveSettings: (newSettings: TaskSyncSettings) => Promise<void>;
    enabled: boolean;
    onToggle: (enabled: boolean) => Promise<void>;
  }

  let { settings, saveSettings, enabled, onToggle }: Props = $props();

  onMount(() => {
    createAppleCalendarSection();
  });

  function createAppleCalendarSection(): void {
    // Apple Calendar integration toggle
    new Setting(appleCalendarContainer)
      .setName("Enable Apple Calendar Integration")
      .setDesc(
        "Connect to iCloud Calendar via CalDAV to insert events into daily notes"
      )
      .addToggle((toggle) => {
        toggle.setValue(enabled).onChange(async (value) => {
          await onToggle(value);
        });
      });
  }

  function createAppleCalendarSettings(): void {
    // Apple ID (username)
    new Setting(appleCalendarContainer)
      .setName("Apple ID")
      .setDesc("Your Apple ID email address for iCloud Calendar access")
      .addText((text) => {
        text
          .setPlaceholder("your-email@icloud.com")
          .setValue(settings.integrations.appleCalendar.username)
          .onChange(async (value) => {
            settings.integrations.appleCalendar.username = value;
            await saveSettings(settings);
          });
      });

    // App-specific password
    new Setting(appleCalendarContainer)
      .setName("App-Specific Password")
      .setDesc(
        "Generate an app-specific password in your Apple ID settings for CalDAV access"
      )
      .addText((text) => {
        text
          .setPlaceholder("xxxx-xxxx-xxxx-xxxx")
          .setValue(settings.integrations.appleCalendar.appSpecificPassword)
          .onChange(async (value) => {
            settings.integrations.appleCalendar.appSpecificPassword = value;
            await saveSettings(settings);
          });
        // Make it a password field
        text.inputEl.type = "password";
      });

    // Include location
    new Setting(appleCalendarContainer)
      .setName("Include Location")
      .setDesc("Include event location in the inserted calendar events")
      .addToggle((toggle) => {
        toggle
          .setValue(settings.integrations.appleCalendar.includeLocation)
          .onChange(async (value) => {
            settings.integrations.appleCalendar.includeLocation = value;
            await saveSettings(settings);
          });
      });

    // Include notes
    new Setting(appleCalendarContainer)
      .setName("Include Notes")
      .setDesc(
        "Include event descriptions/notes in the inserted calendar events"
      )
      .addToggle((toggle) => {
        toggle
          .setValue(settings.integrations.appleCalendar.includeNotes)
          .onChange(async (value) => {
            settings.integrations.appleCalendar.includeNotes = value;
            await saveSettings(settings);
          });
      });

    // Default area for imported events
    new Setting(appleCalendarContainer)
      .setName("Default Area")
      .setDesc(
        "Default area to assign to imported calendar events (leave empty for no area)"
      )
      .addText((text) => {
        text
          .setPlaceholder("Calendar Events")
          .setValue(settings.integrations.appleCalendar.defaultArea)
          .onChange(async (value) => {
            settings.integrations.appleCalendar.defaultArea = value;
            await saveSettings(settings);
          });
      });

    // Time format
    new Setting(appleCalendarContainer)
      .setName("Time Format")
      .setDesc("Choose between 12-hour or 24-hour time format")
      .addDropdown((dropdown) => {
        dropdown
          .addOption("12h", "12-hour (AM/PM)")
          .addOption("24h", "24-hour")
          .setValue(settings.integrations.appleCalendar.timeFormat)
          .onChange(async (value: "12h" | "24h") => {
            settings.integrations.appleCalendar.timeFormat = value;
            await saveSettings(settings);
          });
      });

    // Day view configuration section
    appleCalendarContainer.createEl("h4", {
      text: "Day View Configuration",
      cls: "task-sync-subsection-header",
    });

    // Start hour
    new Setting(appleCalendarContainer)
      .setName("Start Hour")
      .setDesc("Starting hour for the day view (0-23)")
      .addDropdown((dropdown) => {
        for (let i = 0; i < 24; i++) {
          const hour = i.toString().padStart(2, "0");
          dropdown.addOption(i.toString(), `${hour}:00`);
        }
        dropdown
          .setValue(settings.integrations.appleCalendar.startHour.toString())
          .onChange(async (value) => {
            const hour = parseInt(value);
            if (!isNaN(hour) && hour >= 0 && hour < 24) {
              settings.integrations.appleCalendar.startHour = hour;
              await saveSettings(settings);
            }
          });
      });

    // End hour
    new Setting(appleCalendarContainer)
      .setName("End Hour")
      .setDesc("Ending hour for the day view (0-23)")
      .addDropdown((dropdown) => {
        for (let i = 0; i < 24; i++) {
          const hour = i.toString().padStart(2, "0");
          dropdown.addOption(i.toString(), `${hour}:00`);
        }
        dropdown
          .setValue(settings.integrations.appleCalendar.endHour.toString())
          .onChange(async (value) => {
            const hour = parseInt(value);
            if (!isNaN(hour) && hour >= 0 && hour < 24) {
              settings.integrations.appleCalendar.endHour = hour;
              await saveSettings(settings);
            }
          });
      });
  }

  // Reactive statement to create/destroy settings based on toggle state
  $effect(() => {
    if (enabled) {
      createAppleCalendarSettings();
    } else {
      // Clear Apple Calendar settings when disabled
      const children = Array.from(appleCalendarContainer.children);
      children.slice(1).forEach((child) => child.remove()); // Keep the toggle, remove the rest
    }
  });
</script>

<div bind:this={appleCalendarContainer}></div>
