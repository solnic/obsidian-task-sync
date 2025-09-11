<script lang="ts">
  import { onMount } from "svelte";
  import { Notice } from "obsidian";
  import { getPluginContext } from "./context";
  import FilterButton from "./FilterButton.svelte";
  import SearchInput from "./SearchInput.svelte";
  import AppleReminderItem from "./AppleReminderItem.svelte";
  import type {
    AppleReminder,
    AppleRemindersList,
  } from "../../types/apple-reminders";
  import type { AppleRemindersIntegrationSettings } from "../ui/settings/types";
  import type { TaskImportConfig } from "../../types/integrations";
  import { taskStore } from "../../stores/taskStore";

  interface Props {
    appleRemindersService: any;
    settings: { appleRemindersIntegration: AppleRemindersIntegrationSettings };
    dependencies: {
      taskImportManager: any;
      getDefaultImportConfig: () => TaskImportConfig;
    };
    dayPlanningMode?: boolean;
  }

  let {
    appleRemindersService,
    settings,
    dependencies,
    dayPlanningMode = false,
  }: Props = $props();

  const { plugin } = getPluginContext();

  // State
  let reminders = $state<AppleReminder[]>([]);
  let reminderLists = $state<AppleRemindersList[]>([]);
  let currentList = $state<string | null>(null);
  let currentState = $state<"active" | "completed" | "all">("active");
  let searchQuery = $state("");
  let error = $state<string | null>(null);
  let isLoading = $state(false);
  let importingReminders = $state(new Set<string>());
  let importedReminders = $state(new Set<string>());
  let hoveredReminder = $state<string | null>(null);

  // Computed
  let filteredReminders = $derived.by(() => {
    let filtered = filterReminders(currentState);
    if (searchQuery) {
      filtered = searchReminders(searchQuery, filtered);
    }
    return filtered;
  });

  let availableLists = $derived.by(() => {
    return reminderLists.map((list) => list.name).sort();
  });

  onMount(() => {
    if (appleRemindersService.isEnabled()) {
      loadReminderLists()
        .then(() => {
          return loadReminders();
        })
        .catch((err) => {
          error = err.message || "Failed to load Apple Reminders data";
        });

      refreshImportStatus();
    }
  });

  // Watch for changes in the task store and refresh import status
  $effect(() => {
    // This effect will run whenever the task store changes
    taskStore.getEntities(); // Access entities to trigger reactivity
    // Refresh import status whenever task store entities change
    refreshImportStatus();
  });

  function filterReminders(
    state: "active" | "completed" | "all"
  ): AppleReminder[] {
    if (state === "all") {
      return reminders;
    }
    return reminders.filter((reminder) =>
      state === "completed" ? reminder.completed : !reminder.completed
    );
  }

  function searchReminders(
    query: string,
    reminderList?: AppleReminder[]
  ): AppleReminder[] {
    const searchIn = reminderList || reminders;
    const lowerQuery = query.toLowerCase();

    return searchIn.filter(
      (reminder) =>
        reminder.title.toLowerCase().includes(lowerQuery) ||
        (reminder.notes && reminder.notes.toLowerCase().includes(lowerQuery))
    );
  }

  async function loadReminderLists(): Promise<void> {
    if (!appleRemindersService.isEnabled()) {
      return;
    }

    try {
      const result = await appleRemindersService.fetchReminderLists();
      if (result.success) {
        reminderLists = result.data;
      } else {
        error = result.error?.message || "Failed to load reminder lists";
      }
    } catch (err: any) {
      error = err.message || "Failed to load reminder lists";
    }
  }

  /**
   * Refresh import status for all reminders from task store
   * This should be called whenever the component becomes visible to ensure
   * import status is up-to-date with the current state of the task store
   */
  function refreshImportStatus(): void {
    const importedReminderIds = new Set<string>();
    for (const reminder of reminders) {
      if (taskStore.isTaskImported("apple-reminders", reminder.id)) {
        importedReminderIds.add(reminder.id);
      }
    }
    importedReminders = importedReminderIds;
  }

  async function loadReminders(): Promise<void> {
    if (!appleRemindersService.isEnabled()) {
      return;
    }

    isLoading = true;
    error = null;

    try {
      const filter = {
        includeCompleted:
          settings.appleRemindersIntegration.includeCompletedReminders,
        listNames: currentList ? [currentList] : undefined,
        excludeAllDay:
          settings.appleRemindersIntegration.excludeAllDayReminders,
      };

      const result = await appleRemindersService.fetchReminders(filter);
      if (result.success) {
        reminders = result.data;
        // Refresh import status after loading reminders
        refreshImportStatus();
      } else {
        error = result.error?.message || "Failed to load reminders";
      }

      isLoading = false;
    } catch (err: any) {
      error = err.message || "Failed to load reminders";
      isLoading = false;
    }
  }

  async function setList(listName: string | null): Promise<void> {
    currentList = listName;
    await loadReminders();
  }

  function setStateFilter(state: "active" | "completed" | "all"): void {
    currentState = state;
  }

  async function refresh(): Promise<void> {
    await loadReminders();
  }

  async function importReminder(reminder: AppleReminder): Promise<void> {
    if (importingReminders.has(reminder.id)) {
      return; // Already importing
    }

    importingReminders.add(reminder.id);

    try {
      const config = dependencies.getDefaultImportConfig();

      if (dayPlanningMode) {
        // In day planning mode, add to today instead of regular import
        const result = await appleRemindersService.importReminderAsTask(
          reminder,
          {
            ...config,
            addToToday: true,
          }
        );

        if (result.success) {
          new Notice(`Added "${reminder.title}" to today's daily note`);
        } else {
          new Notice(
            `Failed to add reminder to today: ${result.error || "Unknown error"}`
          );
        }
      } else {
        // Regular import
        const result = await appleRemindersService.importReminderAsTask(
          reminder,
          config
        );

        if (result.success && !result.skipped) {
          new Notice(`Imported reminder: ${reminder.title}`);
          importedReminders.add(reminder.id);
        } else if (result.skipped) {
          new Notice(`Reminder already imported: ${reminder.title}`);
          importedReminders.add(reminder.id);
        } else {
          new Notice(
            `Failed to import reminder: ${result.error || "Unknown error"}`
          );
        }
      }
    } catch (error: any) {
      console.error("Error importing reminder:", error);
      new Notice(
        `Error importing reminder: ${error.message || "Unknown error"}`
      );
    } finally {
      importingReminders.delete(reminder.id);
    }
  }

  // Expose methods for the wrapper
  $effect(() => {
    if (typeof window !== "undefined") {
      (window as any).__appleRemindersServiceMethods = {
        refresh,
      };
    }
  });
</script>

<div
  class="apple-reminders-service"
  data-type="apple-reminders-service"
  data-testid="apple-reminders-service"
>
  <!-- Header Section -->
  <div class="apple-reminders-header">
    <!-- Search and Filters -->
    <div class="search-and-filters">
      <SearchInput
        bind:value={searchQuery}
        placeholder="Search reminders..."
        onInput={(value) => (searchQuery = value)}
        onRefresh={refresh}
        testId="apple-reminders-search-input"
      />

      <div class="filter-controls">
        <!-- List Filter -->
        <FilterButton
          label="List"
          currentValue={currentList || "All Lists"}
          options={["All Lists", ...availableLists]}
          onselect={(value: string) =>
            setList(value === "All Lists" ? null : value)}
          testId="list-filter"
        />

        <!-- State Filter -->
        <FilterButton
          label="State"
          currentValue={currentState === "active"
            ? "Active"
            : currentState === "completed"
              ? "Completed"
              : "All"}
          options={["Active", "Completed", "All"]}
          onselect={(value: string) =>
            setStateFilter(
              value.toLowerCase() as "active" | "completed" | "all"
            )}
          testId="state-filter"
        />
      </div>
    </div>
  </div>

  <!-- Content Section -->
  <div class="task-sync-task-list-container">
    {#if error}
      <div class="task-sync-error-message">
        {error}
      </div>
    {:else if isLoading}
      <div class="task-sync-loading-indicator">Loading reminders...</div>
    {:else}
      <div class="task-sync-task-list">
        {#if filteredReminders.length === 0}
          <div class="task-sync-empty-message">
            {searchQuery
              ? "No reminders match your search."
              : "No reminders found."}
          </div>
        {:else}
          {#each filteredReminders as reminder (reminder.id)}
            <AppleReminderItem
              {reminder}
              isHovered={hoveredReminder === reminder.id}
              isImported={importedReminders.has(reminder.id)}
              isImporting={importingReminders.has(reminder.id)}
              onHover={(hovered) =>
                (hoveredReminder = hovered ? reminder.id : null)}
              onImport={importReminder}
              {dayPlanningMode}
              testId="apple-reminder-item-{reminder.title
                .replace(/\s+/g, '-')
                .toLowerCase()}"
            />
          {/each}
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  /* No local styles needed - using shared task list styles */
</style>
