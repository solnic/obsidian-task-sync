<script lang="ts">
  import type { TaskSyncSettings } from "../../../types/settings";
  import { Setting, Notice } from "obsidian";
  import { onMount } from "svelte";
  import type TaskSyncPlugin from "../../../../main";
  import { taskSyncApp } from "../../../App";
  import { calendarServiceRegistry } from "../../../extensions/calendar/services/CalendarService";
  import type { GoogleCalendarService } from "../../../extensions/calendar/services/GoogleCalendarService";

  let googleCalendarContainer: HTMLElement;

  interface Props {
    settings: TaskSyncSettings;
    saveSettings: (newSettings: TaskSyncSettings) => Promise<void>;
    enabled: boolean;
    onToggle: (enabled: boolean) => Promise<void>;
    plugin: TaskSyncPlugin;
  }

  let { settings, saveSettings, enabled, onToggle, plugin }: Props = $props();

  // Get Google Calendar service
  let googleCalendarService: GoogleCalendarService | undefined;

  onMount(() => {
    createGoogleCalendarSection();

    // Get the Google Calendar service from registry
    const service = calendarServiceRegistry.getService("google-calendar");
    if (service) {
      googleCalendarService = service as GoogleCalendarService;
    }
  });  function createGoogleCalendarSection(): void {
    // Google Calendar integration toggle
    new Setting(googleCalendarContainer)
      .setName("Enable Google Calendar Integration")
      .setDesc(
        "Connect to Google Calendar via OAuth to access calendar events"
      )
      .addToggle((toggle) => {
        toggle.setValue(enabled).onChange(async (value) => {
          await onToggle(value);
        });
      });
  }

  function createGoogleCalendarSettings(): void {
    // OAuth info section
    googleCalendarContainer.createEl("div", {
      text: "Google Calendar uses OAuth 2.0 for authentication. You'll need to create a Google Cloud project and OAuth credentials.",
      cls: "setting-item-description",
    });

    googleCalendarContainer.createEl("a", {
      text: "Learn how to set up Google Calendar OAuth →",
      href: "https://developers.google.com/calendar/api/quickstart/js",
      cls: "external-link",
    });

    // API Key
    new Setting(googleCalendarContainer)
      .setName("API Key")
      .setDesc("Your Google Calendar API key")
      .addText((text) => {
        text
          .setPlaceholder("Enter your API key")
          .setValue(settings.integrations.googleCalendar.apiKey)
          .onChange(async (value) => {
            settings.integrations.googleCalendar.apiKey = value;
            await saveSettings(settings);
          });
      });

    // Client ID
    new Setting(googleCalendarContainer)
      .setName("OAuth Client ID")
      .setDesc("Your OAuth 2.0 Client ID from Google Cloud Console")
      .addText((text) => {
        text
          .setPlaceholder("xxxxxxxxxxxx.apps.googleusercontent.com")
          .setValue(settings.integrations.googleCalendar.clientId)
          .onChange(async (value) => {
            settings.integrations.googleCalendar.clientId = value;
            await saveSettings(settings);
          });
      });

    // Client Secret
    new Setting(googleCalendarContainer)
      .setName("OAuth Client Secret")
      .setDesc("Your OAuth 2.0 Client Secret from Google Cloud Console")
      .addText((text) => {
        text
          .setPlaceholder("Enter your client secret")
          .setValue(settings.integrations.googleCalendar.clientSecret)
          .onChange(async (value) => {
            settings.integrations.googleCalendar.clientSecret = value;
            await saveSettings(settings);
          });
        // Make it a password field
        text.inputEl.type = "password";
      });

    // OAuth authentication button
    new Setting(googleCalendarContainer)
      .setName("Authenticate with Google")
      .setDesc(
        "Click to authenticate and authorize access to your Google Calendar"
      )
      .addButton((button) => {
        button.setButtonText("Authenticate").onClick(async () => {
          // Get OAuth service from Google Calendar service
          if (!googleCalendarService) {
            new Notice("Google Calendar service not available");
            return;
          }

          const oauthService = googleCalendarService.getOAuthService();
          if (!oauthService) {
            new Notice("OAuth service not initialized");
            return;
          }

          // Validate configuration
          if (!settings.integrations.googleCalendar?.clientId ||
              !settings.integrations.googleCalendar?.clientSecret) {
            new Notice("Please configure OAuth Client ID and Secret first");
            return;
          }

          button.setDisabled(true);
          button.setButtonText("Authenticating...");

          try {
            const success = await oauthService.startAuthFlow();

            if (success) {
              // Refresh the settings display to show token status
              createGoogleCalendarSettings();
            }
          } catch (error: any) {
            console.error("OAuth flow error:", error);
            new Notice(`Authentication failed: ${error.message}`);
          } finally {
            button.setDisabled(false);
            button.setButtonText("Authenticate");
          }
        });
      });

    // Revoke token button (only show if authenticated)
    if (settings.integrations.googleCalendar.accessToken) {
      new Setting(googleCalendarContainer)
        .setName("Revoke Authentication")
        .setDesc("Disconnect and clear Google Calendar authentication")
        .addButton((button) => {
          button
            .setButtonText("Revoke")
            .setWarning()
            .onClick(async () => {
              if (!googleCalendarService) {
                new Notice("Google Calendar service not available");
                return;
              }

              const oauthService = googleCalendarService.getOAuthService();
              if (!oauthService) {
                new Notice("OAuth service not initialized");
                return;
              }

              button.setDisabled(true);
              button.setButtonText("Revoking...");

              try {
                await oauthService.revokeTokens();
                // Refresh the settings display
                createGoogleCalendarSettings();
              } catch (error: any) {
                console.error("Token revocation error:", error);
                new Notice(`Failed to revoke: ${error.message}`);
              } finally {
                button.setDisabled(false);
                button.setButtonText("Revoke");
              }
            });
        });
    }

    // Access Token (read-only, set via OAuth)
    new Setting(googleCalendarContainer)
      .setName("Access Token")
      .setDesc("Automatically set after successful authentication")
      .addText((text) => {
        const hasToken = settings.integrations.googleCalendar.accessToken
          ? "✓ Token set"
          : "Not authenticated";
        text
          .setPlaceholder(hasToken)
          .setValue("")
          .setDisabled(true);
        text.inputEl.type = "password";
      });

    // Include location
    new Setting(googleCalendarContainer)
      .setName("Include Location")
      .setDesc("Include event location in the calendar events")
      .addToggle((toggle) => {
        toggle
          .setValue(settings.integrations.googleCalendar.includeLocation)
          .onChange(async (value) => {
            settings.integrations.googleCalendar.includeLocation = value;
            await saveSettings(settings);
          });
      });

    // Include notes
    new Setting(googleCalendarContainer)
      .setName("Include Notes")
      .setDesc("Include event descriptions/notes in the calendar events")
      .addToggle((toggle) => {
        toggle
          .setValue(settings.integrations.googleCalendar.includeNotes)
          .onChange(async (value) => {
            settings.integrations.googleCalendar.includeNotes = value;
            await saveSettings(settings);
          });
      });

    // Default area for imported events
    new Setting(googleCalendarContainer)
      .setName("Default Area")
      .setDesc(
        "Default area to assign to imported calendar events (leave empty for no area)"
      )
      .addText((text) => {
        text
          .setPlaceholder("Calendar Events")
          .setValue(settings.integrations.googleCalendar.defaultArea)
          .onChange(async (value) => {
            settings.integrations.googleCalendar.defaultArea = value;
            await saveSettings(settings);
          });
      });

    // Time format
    new Setting(googleCalendarContainer)
      .setName("Time Format")
      .setDesc("Choose between 12-hour or 24-hour time format")
      .addDropdown((dropdown) => {
        dropdown
          .addOption("12h", "12-hour (AM/PM)")
          .addOption("24h", "24-hour")
          .setValue(settings.integrations.googleCalendar.timeFormat)
          .onChange(async (value: "12h" | "24h") => {
            settings.integrations.googleCalendar.timeFormat = value;
            await saveSettings(settings);
          });
      });

    // Task scheduling section
    googleCalendarContainer.createEl("h4", {
      text: "Task Scheduling",
      cls: "task-sync-subsection-header",
    });

    // Enable task scheduling
    new Setting(googleCalendarContainer)
      .setName("Enable Task Scheduling")
      .setDesc(
        "Allow scheduling tasks as calendar events in Google Calendar"
      )
      .addToggle((toggle) => {
        toggle
          .setValue(settings.integrations.googleCalendar.schedulingEnabled)
          .onChange(async (value) => {
            settings.integrations.googleCalendar.schedulingEnabled = value;
            await saveSettings(settings);
          });
      });

    // Default scheduling calendar
    new Setting(googleCalendarContainer)
      .setName("Default Scheduling Calendar")
      .setDesc("Default calendar to use when scheduling tasks as events")
      .addText((text) => {
        text
          .setPlaceholder("primary")
          .setValue(
            settings.integrations.googleCalendar.defaultSchedulingCalendar
          )
          .onChange(async (value) => {
            settings.integrations.googleCalendar.defaultSchedulingCalendar =
              value;
            await saveSettings(settings);
          });
      });

    // Default event duration
    new Setting(googleCalendarContainer)
      .setName("Default Event Duration")
      .setDesc("Default duration (in minutes) for scheduled task events")
      .addText((text) => {
        text
          .setPlaceholder("60")
          .setValue(
            settings.integrations.googleCalendar.defaultEventDuration.toString()
          )
          .onChange(async (value) => {
            const duration = parseInt(value);
            if (!isNaN(duration) && duration > 0) {
              settings.integrations.googleCalendar.defaultEventDuration =
                duration;
              await saveSettings(settings);
            }
          });
      });

    // Include task details in event
    new Setting(googleCalendarContainer)
      .setName("Include Task Details in Event")
      .setDesc(
        "Include task description and metadata in the calendar event description"
      )
      .addToggle((toggle) => {
        toggle
          .setValue(
            settings.integrations.googleCalendar.includeTaskDetailsInEvent
          )
          .onChange(async (value) => {
            settings.integrations.googleCalendar.includeTaskDetailsInEvent =
              value;
            await saveSettings(settings);
          });
      });
  }

  // Reactive statement to create/destroy settings based on toggle state
  $effect(() => {
    if (enabled) {
      createGoogleCalendarSettings();
    } else {
      // Clear Google Calendar settings when disabled
      const children = Array.from(googleCalendarContainer.children);
      children.slice(1).forEach((child) => child.remove()); // Keep the toggle, remove the rest
    }
  });
</script>

<div bind:this={googleCalendarContainer}></div>
