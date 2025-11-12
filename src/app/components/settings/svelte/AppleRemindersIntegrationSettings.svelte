<script lang="ts">
  import type { TaskSyncSettings } from "../../../types/settings";
  import { Setting } from "obsidian";
  import { onMount } from "svelte";
  import { extensionRegistry } from "../../../core/extension";
  import type { AppleRemindersExtension } from "../../../extensions/apple-reminders/AppleRemindersExtension";

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

  // State for available reminder lists
  let availableReminderLists = $state<string[]>([]);
  let loadingLists = $state(false);
  let availableListsDiv: HTMLElement | null = null;
  let settingsCreated = $state(false);
  let loadListsButton: HTMLButtonElement | null = null;

  // Derived state for button text
  const loadListsButtonText = $derived(loadingLists ? "Loading..." : "Load Lists");

  onMount(() => {
    createAppleRemindersSection();
  });

  // Load available reminder lists from Apple Reminders
  async function loadReminderLists(): Promise<void> {
    if (!isPlatformSupported || !enabled) {
      return;
    }

    const extension = extensionRegistry.getById("apple-reminders") as AppleRemindersExtension;
    if (!extension) {
      return;
    }

    try {
      loadingLists = true;
      const result = await extension.fetchLists();
      if (result.success && result.data) {
        availableReminderLists = result.data.map(list => list.name).sort();
      }
    } catch (error) {
      console.error("Failed to load reminder lists:", error);
    } finally {
      loadingLists = false;
    }
  }

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

  function clearAppleRemindersSettings(): void {
    // Remove all children except the platform warning (if present) and the toggle
    const children = Array.from(appleRemindersContainer.children);
    const keepCount = isPlatformSupported ? 1 : 2; // Keep toggle (and warning on non-macOS)
    children.slice(keepCount).forEach((child) => child.remove());

    // Clear available lists div reference
    if (availableListsDiv) {
      availableListsDiv = null;
    }
  }

  function createAppleRemindersSettings(): void {
    // Clear existing settings first to avoid duplicates
    clearAppleRemindersSettings();

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

    // Reminder Lists Selection
    const reminderListsSetting = new Setting(appleRemindersContainer)
      .setName("Reminder Lists")
      .setDesc("Select which reminder lists to sync (leave empty to sync all lists)")
      .addButton((button) => {
        loadListsButton = button.buttonEl;
        button
          .setButtonText("Load Lists")
          .onClick(async () => {
            await loadReminderLists();
          });
      });

    // Add text area for selected lists
    reminderListsSetting.addTextArea((textArea) => {
      textArea
        .setPlaceholder("Enter reminder list names, one per line")
        .setValue(settings.integrations.appleReminders.reminderLists?.join('\n') || '')
        .onChange(async (value) => {
          const lists = value
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);
          settings.integrations.appleReminders.reminderLists = lists;
          await saveSettings(settings);
        });

      // Style the text area
      textArea.inputEl.rows = 4;
      textArea.inputEl.style.width = "100%";
      textArea.inputEl.style.resize = "vertical";
    });
  }

  // Reactive statement to create/destroy settings based on toggle state
  $effect(() => {
    if (enabled && isPlatformSupported) {
      if (!settingsCreated) {
        createAppleRemindersSettings();
        settingsCreated = true;
        // Load reminder lists when integration is enabled
        loadReminderLists();
      }
    } else {
      if (settingsCreated) {
        clearAppleRemindersSettings();
        settingsCreated = false;
        // Clear loaded lists
        availableReminderLists = [];
        loadListsButton = null;
      }
    }
  });

  // Update load lists button state reactively
  $effect(() => {
    if (loadListsButton) {
      loadListsButton.textContent = loadListsButtonText;
      loadListsButton.disabled = loadingLists;
    }
  });

  // Separate effect to manage available lists display
  $effect(() => {
    // Only run if settings are created
    if (!settingsCreated) {
      return;
    }

    // Show available lists if loaded
    if (availableReminderLists.length > 0) {
      // Remove existing div if it exists to avoid duplicates
      if (availableListsDiv) {
        availableListsDiv.remove();
      }

      availableListsDiv = appleRemindersContainer.createDiv({
        cls: "task-sync-available-lists"
      });
      availableListsDiv.createEl("small", {
        text: `Available lists: ${availableReminderLists.join(', ')}`,
        cls: "task-sync-hint"
      });
    } else if (availableListsDiv) {
      // Clean up the div if lists are empty
      availableListsDiv.remove();
      availableListsDiv = null;
    }
  });
</script>

<div bind:this={appleRemindersContainer}></div>
