<script lang="ts">
  /**
   * AppleRemindersService component for the new architecture
   * Provides Apple Reminders listing and import functionality
   */

  import { onMount, onDestroy } from "svelte";
  import { derived, get } from "svelte/store";
  import SearchInput from "../../../components/SearchInput.svelte";
  import SortDropdown from "../../../components/SortDropdown.svelte";
  import FilterButton from "../../../components/FilterButton.svelte";
  import AppleReminderItem from "./AppleReminderItem.svelte";
  import { taskStore } from "../../../stores/taskStore";
  import type { Task } from "../../../core/entities";
  import type { TaskSyncSettings } from "../../../types/settings";
  import type { Extension } from "../../../core/extension";
  import type { Host } from "../../../core/host";
  import type { AppleRemindersExtension } from "../AppleRemindersExtension";
  import type { DailyPlanningExtension } from "../../daily-planning/DailyPlanningExtension";
  import { getContextStore } from "../../../stores/contextStore";
  import type { AppleRemindersRefreshProgress } from "../AppleRemindersExtension";

  interface SortField {
    key: string;
    label: string;
    direction: "asc" | "desc";
  }

  interface Props {
    settings: TaskSyncSettings;
    extension: Extension;
    host: Host;
    isPlanningActive?: boolean;
    dailyPlanningExtension?: DailyPlanningExtension;
  }

  let {
    settings,
    extension,
    host,
    isPlanningActive = false,
    dailyPlanningExtension,
  }: Props = $props();

  // Cast extension to AppleRemindersExtension for type safety
  const appleRemindersExtension = extension as AppleRemindersExtension;

  // Get the reactive context store
  const contextStore = getContextStore();

  // Derived store: List of imported Apple Reminders tasks
  const importedTasks = derived(taskStore, ($taskStore) => {
    return $taskStore.tasks.filter((task) => task.source.extension === "apple-reminders");
  });

  // Computed daily planning modes
  let dayPlanningMode = $derived.by(() => {
    const context = $contextStore;
    return context?.type === "daily";
  });

  let dailyPlanningWizardMode = $derived(isPlanningActive);

  // ============================================================================
  // REACTIVE STATE - UI state only (data comes from store)
  // ============================================================================

  // Filters - currently applied filters (UI state)
  let filters = $state({
    // Apple Reminders-specific filters
    list: null as string | null, // No default list, user must select
    completed: false, // Show only incomplete reminders by default
    priority: "all" as "all" | "high" | "medium" | "low" | "none",
  });

  // Sort - currently applied sorting logic (UI state)
  let sort = $state<SortField[]>([
    { key: "dueDate", label: "Due Date", direction: "asc" },
    { key: "title", label: "Title", direction: "asc" },
  ]);

  // Search query (part of filtering)
  let searchQuery = $state("");

  // ============================================================================
  // UI STATE (not part of the 3 core states)
  // ============================================================================

  let availableLists = $state<string[]>([]);
  let error = $state<string | null>(null);
  let isLoading = $state(false);
  let hoveredTask = $state<string | null>(null);
  let permissionStatus = $state<"unknown" | "granted" | "denied">("unknown");

  // Available sort fields for Apple Reminders
  const availableSortFields = [
    { key: "title", label: "Title" },
    { key: "createdAt", label: "Created" },
    { key: "dueDate", label: "Due Date" },
    { key: "priority", label: "Priority" },
  ];

  // ============================================================================
  // DATA PROCESSING - Use extension's reactive state
  // ============================================================================

  /**
   * Get tasks from extension's getTasks() method
   * The extension handles combining imported tasks with Apple Reminders API data
   * Note: getTasks() returns a store, so we call it once and subscribe to it
   */
  const extensionTasksStore = appleRemindersExtension.getTasks();

  // Subscribe to the store using Svelte's auto-subscription
  let extensionTasks = $derived($extensionTasksStore);

  // Subscribe to refresh progress
  const refreshProgressStore = appleRemindersExtension.getRefreshProgress();
  let refreshProgress = $derived($refreshProgressStore);

  /**
   * Apply filters, search, and sort to extension tasks
   */
  let tasks = $derived.by((): Task[] => {
    let processed = [...extensionTasks];

    // Apply Apple Reminders-specific filters
    if (!filters.completed) {
      processed = processed.filter((task) => !task.done);
    }

    if (filters.list) {
      processed = processed.filter((task) => {
        const reminderData = task.source.data;
        return reminderData?.list?.name === filters.list;
      });
    }

    if (filters.priority !== "all") {
      processed = processed.filter((task) => {
        if (filters.priority === "none") {
          return !task.priority || task.priority === "";
        }
        return task.priority === filters.priority;
      });
    }

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      processed = processed.filter((task) =>
        task.title.toLowerCase().includes(query) ||
        (task.description && task.description.toLowerCase().includes(query))
      );
    }

    // Apply sort
    if (sort.length > 0) {
      processed.sort((a, b) => {
        for (const sortField of sort) {
          let aVal: any = a[sortField.key as keyof Task];
          let bVal: any = b[sortField.key as keyof Task];

          // Handle null/undefined values
          if (aVal == null && bVal == null) continue;
          if (aVal == null) return sortField.direction === "asc" ? 1 : -1;
          if (bVal == null) return sortField.direction === "asc" ? -1 : 1;

          // Handle different data types
          if (typeof aVal === "string" && typeof bVal === "string") {
            const comparison = aVal.localeCompare(bVal);
            if (comparison !== 0) {
              return sortField.direction === "asc" ? comparison : -comparison;
            }
          } else if (aVal instanceof Date && bVal instanceof Date) {
            const comparison = aVal.getTime() - bVal.getTime();
            if (comparison !== 0) {
              return sortField.direction === "asc" ? comparison : -comparison;
            }
          } else {
            const comparison = String(aVal).localeCompare(String(bVal));
            if (comparison !== 0) {
              return sortField.direction === "asc" ? comparison : -comparison;
            }
          }
        }
        return 0;
      });
    }

    return processed;
  });

  // Track if we've done initial load
  let hasLoadedInitialData = $state(false);

  // ============================================================================
  // INITIALIZATION AND LIFECYCLE
  // ============================================================================

  onMount(async () => {
    console.log('🍎 AppleRemindersService onMount called');
    if (appleRemindersExtension.isEnabled() && !hasLoadedInitialData) {
      console.log('🍎 Loading initial data...');
      await loadInitialData();
      console.log('🍎 Initial data loaded');
    }
    console.log('🍎 AppleRemindersService onMount complete');
  });

  // React to settings changes (specifically the enabled flag)
  $effect(() => {
    const isEnabled = settings.integrations.appleReminders?.enabled;

    if (isEnabled && !hasLoadedInitialData) {
      loadInitialData();
    }
  });

  // ============================================================================
  // EVENT HANDLERS - Simple pass-through, no logic
  // ============================================================================

  function handleSortChange(newSortFields: SortField[]): void {
    sort = newSortFields;
  }

  function setListFilter(list: string | null): void {
    filters = { ...filters, list };
  }

  function toggleCompletedFilter(): void {
    filters = { ...filters, completed: !filters.completed };
  }

  function setPriorityFilter(priority: "all" | "high" | "medium" | "low" | "none"): void {
    filters = { ...filters, priority };
  }

  async function loadInitialData(): Promise<void> {
    // Prevent multiple simultaneous loads
    if (hasLoadedInitialData) {
      console.log('🍎 Initial data already loaded, skipping...');
      return;
    }

    isLoading = true;
    hasLoadedInitialData = true;

    try {
      // Check permissions first
      await checkPermissions();

      if (permissionStatus === "granted") {
        // Always load available reminder lists for the UI dropdown
        await loadReminderLists();

        // Trigger refresh if not already in progress
        // The extension's load() method already starts a refresh asynchronously,
        // so we only need to wait if it hasn't started yet
        if (!appleRemindersExtension.getIsRefreshing()) {
          await appleRemindersExtension.refresh();
        }
      }
    } catch (err: any) {
      console.error("Failed to load initial data:", err);
      error = err.message;
    } finally {
      isLoading = false;
    }
  }

  onDestroy(() => {
    // Cleanup if needed
  });

  async function checkPermissions(): Promise<void> {
    try {
      const result = await appleRemindersExtension.checkPermissions();
      if (result.success && result.data) {
        permissionStatus = result.data === "authorized" ? "granted" : "denied";
      } else {
        permissionStatus = "denied";
        error = result.error?.message || "Permission check failed";
      }
    } catch (err: any) {
      console.error("Failed to check Apple Reminders permissions:", err);
      permissionStatus = "denied";
      error = err.message;
    }
  }

  async function loadReminderLists(): Promise<void> {
    try {
      const result = await appleRemindersExtension.fetchReminderLists();
      if (result.success && result.data) {
        availableLists = result.data.map(list => list.name);

        // Set default list if not already set
        if (!filters.list && availableLists.length > 0) {
          filters = { ...filters, list: availableLists[0] };
        }
      } else {
        error = result.error?.message || "Failed to load reminder lists";
      }
    } catch (err: any) {
      console.error("Failed to load reminder lists:", err);
      error = err.message;
    }
  }

  async function refresh(): Promise<void> {
    // Check if already refreshing to prevent multiple simultaneous refreshes
    if (appleRemindersExtension.getIsRefreshing()) {
      console.log('🍎 Refresh already in progress, skipping...');
      return;
    }

    try {
      // Show loading state
      isLoading = true;
      error = null;

      // Use extension's refresh method (which has its own loading guard)
      await appleRemindersExtension.refresh();

      // Reload lists for the UI dropdowns
      await loadReminderLists();

      isLoading = false;
    } catch (err: any) {
      console.error("Failed to refresh Apple Reminders data:", err);
      error = err.message;
      isLoading = false;
    }
  }

  // Helper to check if a task is imported (exists in main task store)
  function isTaskImported(task: Task): boolean {
    return $importedTasks.some((t) => t.source.keys["apple-reminders"] === task.source.keys["apple-reminders"]);
  }

  /**
   * Schedule a reminder for today.
   * If the task is already imported, schedules the existing task.
   * If not, imports the task first, then schedules it.
   */
  async function scheduleForToday(task: Task): Promise<void> {
    const appleRemindersId = task.source.keys["apple-reminders"];

    if (!dailyPlanningExtension) {
      return;
    }

    // If the task is already imported, find it and schedule it
    if (appleRemindersId && isTaskImported(task)) {
      const state = get(taskStore);
      const existing = state.tasks.find(
        (t) => t.source.keys["apple-reminders"] === appleRemindersId
      );
      if (existing) {
        try {
          if (dailyPlanningWizardMode) {
            dailyPlanningExtension.scheduleTaskForToday(existing.id);
          } else if (dayPlanningMode) {
            await dailyPlanningExtension.addTasksToTodayDailyNote([existing]);
          }
        } catch (err) {
          console.error("Error scheduling existing task for today:", err);
        }
        return;
      }
    }

    // Otherwise, import then schedule via existing flow
    await importTask(task);
  }

  async function importTask(task: Task): Promise<void> {
    try {
      console.log("Importing Apple Reminders task:", task.title);

      // Get the Apple Reminder data from the task
      const reminderData = task.source.data;
      if (!reminderData) {
        console.error("Task has no Apple Reminder data");
        return;
      }

      // Import the reminder as a task (creates file in vault)
      const result = await appleRemindersExtension.importReminderAsTask(reminderData);

      if (result.success) {
        console.log(
          `Successfully imported Apple Reminder "${task.title}" as task ${result.taskId}`
        );

        // Handle Daily Planning integration
        if (result.taskId) {
          if (dailyPlanningWizardMode && dailyPlanningExtension) {
            // In wizard mode, stage the task for today
            try {
              dailyPlanningExtension.scheduleTaskForToday(result.taskId);
              console.log(`Staged task ${result.taskId} for today in Daily Planning`);
            } catch (err: any) {
              console.error("Error staging task for today:", err);
            }
          } else if (dayPlanningMode && dailyPlanningExtension) {
            // In regular day planning mode, add to today's daily note immediately
            try {
              // Get the imported task from the store
              const state = get(taskStore);
              const importedTask = state.tasks.find((t) => t.id === result.taskId);
              if (importedTask) {
                await dailyPlanningExtension.addTasksToTodayDailyNote([importedTask]);
                console.log(`Added task ${result.taskId} to today's daily note`);
              }
            } catch (err: any) {
              console.error("Error adding to today's daily note:", err);
            }
          }
        }
      } else {
        console.error(`Failed to import Apple Reminder: ${result.error}`);
      }
    } catch (error) {
      console.error("Error importing Apple Reminder:", error);
    }
  }
</script>

<div
  class="task-sync-service-container apple-reminders-service"
  data-testid="apple-reminders-service"
>
  <!-- Header Section -->
  <header>
    <!-- 1. Search with refresh group -->
    <SearchInput
      bind:value={searchQuery}
      placeholder="Search reminders..."
      onInput={(value) => (searchQuery = value)}
      service="apple-reminders"
      disabled={isLoading}
      onRefresh={refresh}
    />

    <!-- 2. Primary filter buttons group - List selection -->
    <div class="primary-filters">
      <FilterButton
        label="List"
        currentValue={filters.list || "All Lists"}
        options={["All Lists", ...availableLists]}
        placeholder="Select list"
        onselect={(value) =>
          setListFilter(value === "All Lists" ? null : value)}
        testId="list-filter"
        autoSuggest={true}
        allowClear={true}
        isActive={!!filters.list}
      />
    </div>

    <!-- 3. Secondary filter buttons group - Completed + Priority -->
    <div class="secondary-filters-row-1">
      <button
        class="task-sync-filter-toggle {filters.completed ? 'active' : ''}"
        data-testid="completed-filter"
        onclick={() => toggleCompletedFilter()}
      >
        {filters.completed ? 'Show All' : 'Show Completed'}
      </button>

      <button
        class="task-sync-filter-toggle {filters.priority === 'high' ? 'active' : ''}"
        data-testid="high-priority-filter"
        onclick={() => setPriorityFilter(filters.priority === 'high' ? 'all' : 'high')}
      >
        High Priority
      </button>
      <button
        class="task-sync-filter-toggle {filters.priority === 'medium' ? 'active' : ''}"
        data-testid="medium-priority-filter"
        onclick={() => setPriorityFilter(filters.priority === 'medium' ? 'all' : 'medium')}
      >
        Medium Priority
      </button>
      <button
        class="task-sync-filter-toggle {filters.priority === 'low' ? 'active' : ''}"
        data-testid="low-priority-filter"
        onclick={() => setPriorityFilter(filters.priority === 'low' ? 'all' : 'low')}
      >
        Low Priority
      </button>
    </div>

    <!-- 4. Sort controls group -->
    <SortDropdown
      sortFields={sort}
      availableFields={availableSortFields}
      onSortChange={handleSortChange}
    />
  </header>

  <!-- Progress Indicator -->
  {#if refreshProgress.status !== 'idle' && refreshProgress.status !== 'complete'}
    <div class="task-sync-progress-container" data-testid="refresh-progress">
      <div class="task-sync-progress-header">
        <span class="task-sync-progress-status">
          {#if refreshProgress.status === 'checking-permissions'}
            Checking permissions...
          {:else if refreshProgress.status === 'fetching-lists'}
            Fetching reminder lists...
          {:else if refreshProgress.status === 'fetching-reminders'}
            Fetching reminders{refreshProgress.currentList ? ` from "${refreshProgress.currentList}"` : ''}...
          {:else if refreshProgress.status === 'processing'}
            Processing reminders...
          {:else if refreshProgress.status === 'error'}
            <span class="task-sync-progress-error">Error: {refreshProgress.error || 'Unknown error'}</span>
          {/if}
        </span>
        <span class="task-sync-progress-percentage">{refreshProgress.percentage}%</span>
      </div>

      <div class="task-sync-progress-bar">
        <div
          class="task-sync-progress-bar-fill"
          style="width: {refreshProgress.percentage}%"
        ></div>
      </div>

      {#if refreshProgress.status === 'fetching-reminders' && refreshProgress.totalLists > 0}
        <div class="task-sync-progress-details">
          <span>Lists: {refreshProgress.processedLists} / {refreshProgress.totalLists}</span>
          <span>Reminders: {refreshProgress.processedReminders}</span>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Content Section -->
  <div class="task-sync-task-list-container">
    {#if !appleRemindersExtension.isEnabled()}
      <div class="task-sync-disabled-message">
        Apple Reminders integration is not enabled. Please configure it in settings.
      </div>
    {:else if !appleRemindersExtension.isPlatformSupported()}
      <div class="task-sync-error-message">
        Apple Reminders integration is only available on macOS.
      </div>
    {:else if permissionStatus === "denied"}
      <div class="task-sync-error-message" data-testid="permission-denied-message">
        Apple Reminders access denied. Please grant permission in System Preferences > Security & Privacy > Privacy > Reminders.
      </div>
    {:else if error && refreshProgress.status !== 'error'}
      <div class="task-sync-error-message">
        {error}
      </div>
    {:else if isLoading && refreshProgress.status === 'idle'}
      <div class="task-sync-loading-indicator" data-testid="loading-indicator">
        Loading reminders...
      </div>
    {:else}
      <div class="task-sync-task-list" data-testid="apple-reminders-list">
        {#if tasks.length === 0}
          <div class="task-sync-empty-message">
            No reminders found.
          </div>
        {:else}
          {#each tasks as task (task.id)}
            <AppleReminderItem
              {task}
              isHovered={hoveredTask === task.id}
              isImported={isTaskImported(task)}
              onHover={(hovered) => (hoveredTask = hovered ? task.id : null)}
              onImport={scheduleForToday}
              {dayPlanningMode}
              {dailyPlanningWizardMode}
              {settings}
              testId="apple-reminder-item"
            />
          {/each}
        {/if}
      </div>
    {/if}
  </div>
</div>
