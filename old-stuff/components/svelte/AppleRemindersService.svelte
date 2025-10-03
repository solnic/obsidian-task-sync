<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { Notice } from "obsidian";
  import { getPluginContext } from "./context";
  import FilterButton from "./FilterButton.svelte";
  import SearchInput from "./SearchInput.svelte";
  import SortDropdown from "./SortDropdown.svelte";
  import AppleReminderItem from "./AppleReminderItem.svelte";
  import type {
    AppleReminder,
    AppleRemindersList,
  } from "../../types/apple-reminders";
  import type { AppleRemindersIntegrationSettings } from "../ui/settings/types";
  import type { TaskImportConfig } from "../../types/integrations";
  import { taskStore } from "../../stores/taskStore";
  import { scheduleTaskForToday } from "../../stores/dailyPlanningStore";

  interface SortField {
    key: string;
    label: string;
    direction: "asc" | "desc";
  }

  interface Props {
    appleRemindersService: any;
    settings: { appleRemindersIntegration: AppleRemindersIntegrationSettings };
    dependencies: {
      taskImportManager: any;
      getDefaultImportConfig: () => TaskImportConfig;
    };
    dayPlanningMode?: boolean;
    dailyPlanningWizardMode?: boolean;
  }

  let {
    appleRemindersService,
    settings,
    dependencies,
    dayPlanningMode = false,
    dailyPlanningWizardMode = false,
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
  let loadingMessage = $state("Loading reminders...");
  let importingReminders = $state(new Set<string>());
  let importedReminders = $state(new Set<string>());
  let hoveredReminder = $state<string | null>(null);

  // Sorting state
  let sortFields = $state<SortField[]>([
    { key: "dueDate", label: "Due Date", direction: "asc" },
    { key: "title", label: "Title", direction: "asc" },
  ]);

  // Available sort fields for Apple Reminders
  const availableSortFields = [
    { key: "title", label: "Title" },
    { key: "dueDate", label: "Due Date" },
    { key: "creationDate", label: "Created" },
    { key: "modificationDate", label: "Modified" },
    { key: "priority", label: "Priority" },
    { key: "completed", label: "Completed" },
  ];

  // Computed
  let filteredReminders = $derived.by(() => {
    let filtered = filterReminders(currentState);
    if (searchQuery) {
      filtered = searchReminders(searchQuery, filtered);
    }
    if (sortFields.length > 0) {
      filtered = sortReminders(filtered, sortFields);
    }
    return filtered;
  });

  let availableLists = $derived.by(() => {
    return reminderLists.map((list) => list.name).sort();
  });

  onMount(() => {
    if (appleRemindersService.isEnabled()) {
      isLoading = true;

      loadReminderLists()
        .then(() => {
          return loadReminders();
        })
        .catch((err) => {
          error = err.message || "Failed to load Apple Reminders data";
        });

      refreshImportStatus();
    }

    // Load sort state
    loadSortState();
  });

  onDestroy(() => {
    // Save current sort state when component is destroyed
    saveSortState();
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
    let filtered = reminders;

    // Filter by selected list first
    if (currentList) {
      filtered = filtered.filter(
        (reminder) => reminder.list.name === currentList
      );
    }

    // Then filter by completion state
    if (state === "all") {
      return filtered;
    }
    return filtered.filter((reminder) =>
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

  function sortReminders(
    reminderList: AppleReminder[],
    sortFields: SortField[]
  ): AppleReminder[] {
    return [...reminderList].sort((a, b) => {
      for (const field of sortFields) {
        let aValue: any;
        let bValue: any;

        // Get values based on field key
        switch (field.key) {
          case "title":
            aValue = a.title || "";
            bValue = b.title || "";
            break;
          case "dueDate":
            aValue = a.dueDate ? new Date(a.dueDate).getTime() : 0;
            bValue = b.dueDate ? new Date(b.dueDate).getTime() : 0;
            break;
          case "creationDate":
            aValue = a.creationDate ? new Date(a.creationDate).getTime() : 0;
            bValue = b.creationDate ? new Date(b.creationDate).getTime() : 0;
            break;
          case "modificationDate":
            aValue = a.modificationDate
              ? new Date(a.modificationDate).getTime()
              : 0;
            bValue = b.modificationDate
              ? new Date(b.modificationDate).getTime()
              : 0;
            break;
          case "priority":
            aValue = a.priority || 0;
            bValue = b.priority || 0;
            break;
          case "completed":
            aValue = a.completed ? 1 : 0;
            bValue = b.completed ? 1 : 0;
            break;
          default:
            aValue = "";
            bValue = "";
        }

        // Compare values
        let comparison = 0;
        if (typeof aValue === "string" && typeof bValue === "string") {
          comparison = aValue.localeCompare(bValue);
        } else if (typeof aValue === "number" && typeof bValue === "number") {
          comparison = aValue - bValue;
        } else {
          // Handle mixed types by converting to strings
          comparison = String(aValue).localeCompare(String(bValue));
        }

        // Apply direction
        if (field.direction === "desc") {
          comparison = -comparison;
        }

        // If not equal, return the comparison result
        if (comparison !== 0) {
          return comparison;
        }
      }

      // If all fields are equal, maintain original order
      return 0;
    });
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
      const isImported = taskStore.isTaskImported(
        "apple-reminders",
        reminder.id
      );
      if (isImported) {
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
    loadingMessage = "Checking cache...";

    try {
      // Always fetch all reminders (no list filtering at API level)
      // List filtering will be done in memory via filterReminders()
      const filter = {
        includeCompleted:
          settings.appleRemindersIntegration.includeCompletedReminders,
        excludeAllDay:
          settings.appleRemindersIntegration.excludeAllDayReminders,
      };

      loadingMessage = "Loading reminders from Apple Reminders...";
      const result = await appleRemindersService.fetchReminders(
        filter,
        (message: string, percentage?: number) => {
          loadingMessage =
            percentage !== undefined ? `${message} (${percentage}%)` : message;
        }
      );

      if (result.success) {
        loadingMessage = "Processing reminders...";
        reminders = result.data;
        // Refresh import status after loading reminders
        refreshImportStatus();
        loadingMessage = "Complete";
      } else {
        error = result.error?.message || "Failed to load reminders";
      }

      isLoading = false;
    } catch (err: any) {
      error = err.message || "Failed to load reminders";
      isLoading = false;
    }
  }

  function setList(listName: string | null): void {
    currentList = listName;
  }

  function setStateFilter(state: "active" | "completed" | "all"): void {
    currentState = state;
  }

  async function refresh(): Promise<void> {
    // Clear cache to ensure we get fresh data from Apple Reminders
    await appleRemindersService.clearCache();
    await loadReminderLists();
    await loadReminders();
  }

  async function forceRefresh(): Promise<void> {
    // Force refresh by clearing cache first, then reloading
    await appleRemindersService.clearCache();
    await loadReminderLists();
    await loadReminders();
  }

  function handleSortChange(newSortFields: SortField[]): void {
    sortFields = newSortFields;
    saveSortState();
  }

  async function saveSortState(): Promise<void> {
    try {
      const data = (await plugin.loadData()) || {};
      data.appleRemindersSortFields = sortFields;
      await plugin.saveData(data);
    } catch (err: any) {
      console.warn("Failed to save sort state:", err.message);
    }
  }

  async function loadSortState(): Promise<void> {
    try {
      const data = await plugin.loadData();
      if (data?.appleRemindersSortFields) {
        sortFields = data.appleRemindersSortFields;
      }
    } catch (err: any) {
      console.warn("Failed to load sort state:", err.message);
    }
  }

  async function importReminder(reminder: AppleReminder): Promise<void> {
    if (importingReminders.has(reminder.id)) {
      return; // Already importing
    }

    // Create new Set to trigger reactivity
    importingReminders = new Set([...importingReminders, reminder.id]);

    try {
      const config = dependencies.getDefaultImportConfig();

      if (dailyPlanningWizardMode) {
        // In wizard mode, import and add to daily planning store for staging
        const result = await appleRemindersService.importReminderAsTask(
          reminder,
          config
        );

        if (result.success) {
          if (result.taskFilePath) {
            try {
              const tasks = taskStore.getEntities();
              const importedTask = tasks.find(
                (task) => task.filePath === result.taskFilePath
              );
              if (importedTask) {
                scheduleTaskForToday(importedTask);
                new Notice(
                  `Scheduled "${reminder.title}" for today (pending confirmation)`
                );
              }
            } catch (err: any) {
              console.error("Error scheduling for today:", err);
              new Notice(
                `Error scheduling for today: ${err.message || "Unknown error"}`
              );
            }
          }
          // Create new Set to trigger reactivity
          importedReminders = new Set([...importedReminders, reminder.id]);
        } else {
          new Notice(
            `Failed to import reminder: ${result.error || "Unknown error"}`
          );
        }
      } else if (dayPlanningMode) {
        // In regular day planning mode, add to today's daily note immediately
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
          // Create new Set to trigger reactivity
          importedReminders = new Set([...importedReminders, reminder.id]);
        } else if (result.skipped) {
          new Notice(`Reminder already imported: ${reminder.title}`);
          // Create new Set to trigger reactivity
          importedReminders = new Set([...importedReminders, reminder.id]);
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
      // Create new Set to trigger reactivity
      const newImportingReminders = new Set(importingReminders);
      newImportingReminders.delete(reminder.id);
      importingReminders = newImportingReminders;
    }
  }

  // Method to force refresh import status without reloading reminders
  function forceRefreshImportStatus(): void {
    refreshImportStatus();
  }

  // Expose methods for the wrapper
  $effect(() => {
    if (typeof window !== "undefined") {
      (window as any).__appleRemindersServiceMethods = {
        refresh,
        forceRefreshImportStatus,
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

      <!-- Filter Section -->
      <div class="task-sync-filter-section">
        <div class="task-sync-filter-row task-sync-filter-row--secondary">
          <!-- List Filter -->
          <div class="task-sync-filter-group task-sync-filter-group--dropdown">
            <FilterButton
              label="List"
              currentValue={currentList || "All Lists"}
              options={["All Lists", ...availableLists]}
              onselect={(value: string) =>
                setList(value === "All Lists" ? null : value)}
              testId="list-filter"
              autoSuggest={true}
              allowClear={true}
              isActive={!!currentList}
            />
          </div>

          <!-- State Filter -->
          <div class="task-sync-filter-group task-sync-filter-group--dropdown">
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
              autoSuggest={true}
              allowClear={true}
              isActive={currentState !== "active"}
            />
          </div>
        </div>
      </div>

      <!-- Sort Section -->
      <div class="task-sync-sort-section">
        <SortDropdown
          {sortFields}
          availableFields={availableSortFields}
          onSortChange={handleSortChange}
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
      <div class="task-sync-loading-indicator">{loadingMessage}</div>
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
            {@const isImported = importedReminders.has(reminder.id)}
            {@const importedTask = isImported
              ? taskStore
                  .getEntities()
                  .find(
                    (task) =>
                      task.source?.url === reminder.id ||
                      (task.source?.name === "Apple Reminders" &&
                        task.title === reminder.title)
                  )
              : null}
            {@const isScheduled = importedTask?.doDate != null}
            {@const scheduledDate = importedTask?.doDate}
            <AppleReminderItem
              {reminder}
              isHovered={hoveredReminder === reminder.id}
              {isImported}
              isImporting={importingReminders.has(reminder.id)}
              {isScheduled}
              {scheduledDate}
              onHover={(hovered) =>
                (hoveredReminder = hovered ? reminder.id : null)}
              onImport={importReminder}
              {dayPlanningMode}
              {dailyPlanningWizardMode}
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
