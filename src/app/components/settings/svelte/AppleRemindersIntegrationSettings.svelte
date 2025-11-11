<script lang="ts">
  import type { TaskSyncSettings } from "../../../types/settings";
  import { Setting } from "obsidian";
  import { onMount } from "svelte";
  import { extensionRegistry } from "../../../core/extension";
  import type { AppleRemindersExtension } from "../../../extensions/apple-reminders/AppleRemindersExtension";
  import Dropdown from "../../Dropdown.svelte";

  let appleRemindersContainer: HTMLElement;

  interface Props {
    settings: TaskSyncSettings;
    saveSettings: (newSettings: TaskSyncSettings) => Promise<void>;
    enabled: boolean;
    onToggle: (enabled: boolean) => Promise<void>;
  }

  let { settings, saveSettings, enabled, onToggle }: Props = $props();

  // Get extension instance
  const extension = $derived(
    extensionRegistry.getById("apple-reminders") as AppleRemindersExtension | undefined
  );

  // Platform check for Apple integrations
  // In test environments with stubs, always return true
  // Otherwise check if we're on macOS or if extension reports platform is supported
  const isPlatformSupported = $derived.by(() => {
    // Check for test environment stubs
    if (typeof window !== 'undefined' && (window as any).__appleRemindersApiStubs) {
      return true;
    }
    // Use extension's method if available (may be stubbed in tests)
    if (extension) {
      return extension.isPlatformSupported();
    }
    // Fall back to checking process.platform
    return process.platform === "darwin";
  });

  // Maintain local state for lists
  let localLists = $state<string[]>([]);

  // Subscribe to extension's lists store and sync to local state
  $effect(() => {
    if (!extension) {
      localLists = [];
      return;
    }

    const listsStore = extension.getLists();
    const unsubscribe = listsStore.subscribe(lists => {
      if (lists && lists.length > 0) {
        localLists = lists.map(list => list.name);
      }
    });

    return () => {
      unsubscribe();
    };
  });

  const availableLists = $derived(localLists);

  // State for loading and errors
  let loadingLists = $state(false);
  let loadError = $state<string | null>(null);
  let settingsCreated = $state(false);

  // State for reminder lists dropdown
  let showListsDropdown = $state(false);
  let listsButtonEl = $state<HTMLButtonElement | null>(null);

  // Local reactive state for selected lists to ensure dropdown updates
  let selectedLists = $state<string[]>([]);

  // Sync selected lists from settings
  $effect(() => {
    selectedLists = settings.integrations.appleReminders.reminderLists || [];
  });

  onMount(() => {
    createAppleRemindersSection();
  });

  // Load available reminder lists from Apple Reminders
  async function loadReminderLists(): Promise<void> {
    if (!isPlatformSupported || !enabled) {
      return;
    }

    // Get fresh extension reference each time
    let currentExtension = extensionRegistry.getById("apple-reminders") as AppleRemindersExtension | undefined;

    // If extension doesn't exist yet, wait for it
    if (!currentExtension) {
      await new Promise(resolve => setTimeout(resolve, 500));
      currentExtension = extensionRegistry.getById("apple-reminders") as AppleRemindersExtension | undefined;
      if (!currentExtension) {
        loadError = "Extension not initialized";
        return;
      }
    }

    try {
      loadingLists = true;
      loadError = null;
      const result = await currentExtension.fetchLists();

      if (result.success && result.data) {
        // Update local state
        localLists = result.data.map(list => list.name);
      } else {
        loadError = result.error?.message || "Failed to load reminder lists";
      }
    } catch (error) {
      console.error("[AppleRemindersSettings] Failed to load reminder lists:", error);
      loadError = error instanceof Error ? error.message : "Unknown error";
    } finally {
      loadingLists = false;
    }
  }

  // Handle list selection from dropdown
  async function handleListSelect(listName: string) {
    const currentLists = settings.integrations.appleReminders.reminderLists || [];
    const newLists = currentLists.includes(listName)
      ? currentLists.filter(l => l !== listName)
      : [...currentLists, listName];

    settings.integrations.appleReminders.reminderLists = newLists;
    selectedLists = newLists; // Update local state immediately for reactivity
    await saveSettings(settings);

    // Immediately update button to reflect change
    updateListsButton();
    // Don't close dropdown - allow multi-select
  }

  // Update button content to show selected lists
  function updateListsButton() {
    if (!listsButtonEl) return;
    listsButtonEl.innerHTML = "";

    const selectedLists = settings.integrations.appleReminders.reminderLists || [];

    if (selectedLists.length === 0) {
      const label = document.createElement("span");
      label.textContent = "All lists";
      label.style.color = "var(--text-muted)";
      listsButtonEl.appendChild(label);
    } else {
      const label = document.createElement("span");
      label.textContent = `${selectedLists.length} list${selectedLists.length === 1 ? '' : 's'} selected`;
      listsButtonEl.appendChild(label);
    }
  }

  // Derived state for dropdown items
  const listDropdownItems = $derived(
    availableLists.map(listName => ({
      value: listName,
      label: listName,
    }))
  );

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
    new Setting(appleRemindersContainer)
      .setName("Reminder Lists")
      .setDesc(
        loadingLists
          ? "Loading available lists..."
          : loadError
            ? `Error: ${loadError}`
            : availableLists.length > 0
              ? "Select which reminder lists to sync (leave empty to sync all)"
              : "No lists loaded. Click the button below to load available lists."
      )
      .addButton((button) => {
        listsButtonEl = button.buttonEl;
        button
          .setButtonText(
            settings.integrations.appleReminders.reminderLists?.length
              ? `${settings.integrations.appleReminders.reminderLists.length} list${settings.integrations.appleReminders.reminderLists.length === 1 ? '' : 's'} selected`
              : "All lists"
          )
          .onClick(() => {
            if (availableLists.length === 0) {
              loadReminderLists();
            } else {
              showListsDropdown = true;
            }
          });
        button.buttonEl.style.minWidth = "150px";
      });
  }

  // Reactive statement to create/destroy settings based on toggle state
  $effect(() => {
    if (enabled && isPlatformSupported) {
      if (!settingsCreated) {
        createAppleRemindersSettings();
        settingsCreated = true;
        // Auto-load reminder lists when integration is enabled (if not already cached)
        if (availableLists.length === 0) {
          loadReminderLists();
        }
      }
    } else {
      if (settingsCreated) {
        clearAppleRemindersSettings();
        settingsCreated = false;
        // Clear error state
        loadError = null;
        listsButtonEl = null;
      }
    }
  });

  // Update lists button content when selection changes
  $effect(() => {
    if (listsButtonEl && settingsCreated) {
      // Access the reactive value to trigger updates
      const selectedLists = settings.integrations.appleReminders.reminderLists;
      updateListsButton();
    }
  });
</script>

<div bind:this={appleRemindersContainer}></div>

{#if showListsDropdown && listsButtonEl && availableLists.length > 0}
  <Dropdown
    anchor={listsButtonEl}
    items={listDropdownItems}
    selectedValues={selectedLists}
    onSelect={handleListSelect}
    onClose={() => (showListsDropdown = false)}
    searchable={true}
    searchPlaceholder="Search lists..."
    keepOpenOnSelect={true}
    testId="apple-reminders-lists-dropdown"
  />
{/if}
