<script lang="ts">
  /**
   * GitHubService component for the new architecture
   * Provides GitHub issue/PR listing and import functionality
   */

  import { onMount, onDestroy } from "svelte";
  import { derived, get } from "svelte/store";
  import SearchInput from "../../../components/SearchInput.svelte";
  import SortDropdown from "../../../components/SortDropdown.svelte";
  import FilterButton from "../../../components/FilterButton.svelte";
  import GitHubIssueItem from "./GitHubIssueItem.svelte";
  import GitHubPullRequestItem from "./GitHubPullRequestItem.svelte";
  import { taskStore } from "../../../stores/taskStore";
  import type { Task } from "../../../core/entities";
  import type { TaskSyncSettings } from "../../../types/settings";
  import type { Extension } from "../../../core/extension";
  import type { Host } from "../../../core/host";
  import type {
    GitHubRepository,
    GitHubOrganization,
    GitHubLabel,
  } from "../../../cache/schemas/github";
  import type { GitHubExtension } from "../GitHubExtension";
  import type { DailyPlanningExtension } from "../../daily-planning/DailyPlanningExtension";
  import { getContextStore } from "../../../stores/contextStore";

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

  // Cast extension to GitHubExtension for type safety
  const githubExtension = extension as GitHubExtension;

  // Get the reactive context store
  const contextStore = getContextStore();

  // Derived store: List of imported GitHub tasks
  const importedTasks = derived(taskStore, ($taskStore) => {
    return $taskStore.tasks.filter((task) => task.source.extension === "github");
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
    // GitHub-specific filters
    repository: settings.integrations.github.defaultRepository,
    organization: null as string | null,
    state: settings.integrations.github.issueFilters.state as
      | "open"
      | "closed"
      | "all",
    assignedToMe: settings.integrations.github.issueFilters.assignee === "me",
    labels:
      settings.integrations.github.issueFilters.labels || ([] as string[]),
    type: "issues" as "issues" | "pull-requests",
    currentUser: null as {
      login: string;
      id: number;
      avatar_url: string;
    } | null,
  });

  // Sort - currently applied sorting logic (UI state)
  let sort = $state<SortField[]>([
    { key: "updatedAt", label: "Updated", direction: "desc" },
    { key: "title", label: "Title", direction: "asc" },
  ]);

  // Search query (part of filtering)
  let searchQuery = $state("");

  // ============================================================================
  // UI STATE (not part of the 3 core states)
  // ============================================================================

  let repositories = $state<GitHubRepository[]>([]);
  let organizations = $state<GitHubOrganization[]>([]);
  let availableLabels = $state<GitHubLabel[]>([]);
  let error = $state<string | null>(null);
  let isLoading = $state(false);
  let recentlyUsedOrgs = $state<string[]>([]);
  let recentlyUsedRepos = $state<string[]>([]);
  let hoveredTask = $state<string | null>(null);

  // Available sort fields for GitHub issues/PRs
  const availableSortFields = [
    { key: "title", label: "Title" },
    { key: "createdAt", label: "Created" },
    { key: "updatedAt", label: "Updated" },
    { key: "number", label: "Number" },
    { key: "state", label: "State" },
  ];

  // ============================================================================
  // DATA PROCESSING - Use extension's reactive state
  // ============================================================================

  /**
   * Get tasks from extension's getTasks() method
   * The extension handles combining imported tasks with GitHub API data
   * and ensures stable IDs for non-imported tasks
   *
   * The extension now manages filter state internally, so we update it
   * when our local filters change.
   */
  let extensionTasksStore = $derived(githubExtension.getTasks());

  let extensionTasks = $derived($extensionTasksStore);

  // Sync local filters to extension state
  $effect(() => {
    githubExtension.setFilters({
      repository: filters.repository,
      type: filters.type,
    });
  });

  /**
   * Apply filters, search, and sort to extension tasks
   */
  let tasks = $derived.by((): Task[] => {
    if (!filters.repository) {
      return [];
    }

    // Apply GitHub-specific filters using extension
    let processed: readonly Task[] = githubExtension.filterTasks(
      extensionTasks,
      {
        state: filters.state,
        assignedToMe: filters.assignedToMe,
        labels: filters.labels,
        currentUser: filters.currentUser,
      }
    );

    // Apply search using extension
    if (searchQuery) {
      processed = githubExtension.searchTasks(searchQuery, processed);
    }

    // Apply sort using extension
    if (sort.length > 0) {
      processed = githubExtension.sortTasks(processed, sort);
    }

    return [...processed];
  });

  // ============================================================================
  // UI COMPUTED VALUES - For dropdowns and display
  // ============================================================================

  // Computed - filtered repositories based on organization
  let filteredRepositories = $derived.by(() => {
    if (!filters.organization) {
      return repositories;
    }
    return repositories.filter((repo) =>
      repo.full_name.startsWith(filters.organization + "/")
    );
  });

  // Computed - sorted repositories
  let sortedRepositories = $derived.by(() => {
    return [...filteredRepositories].sort((a, b) => {
      const aOrg = a.full_name.split("/")[0];
      const bOrg = b.full_name.split("/")[0];
      const aName = a.full_name.split("/")[1];
      const bName = b.full_name.split("/")[1];

      if (aOrg !== bOrg) {
        return aOrg.localeCompare(bOrg);
      }
      return aName.localeCompare(bName);
    });
  });

  // Computed - repository display options (show just repo name when org is selected)
  let repositoryDisplayOptions = $derived.by(() => {
    if (filters.organization) {
      return sortedRepositories.map((repo) => repo.name);
    } else {
      return sortedRepositories.map((repo) => repo.full_name);
    }
  });

  // Computed - current repository display value
  let currentRepositoryDisplay = $derived.by(() => {
    if (!filters.repository) {
      return "Select repository";
    }

    if (
      filters.organization &&
      filters.repository.startsWith(filters.organization + "/")
    ) {
      return filters.repository.split("/")[1];
    } else {
      return filters.repository;
    }
  });

  // Computed - available organizations
  let availableOrganizations = $derived.by(() => {
    const orgSet = new Set<string>();

    organizations.forEach((org) => {
      orgSet.add(org.login);
    });

    repositories.forEach((repo) => {
      const org = repo.full_name.split("/")[0];
      orgSet.add(org);
    });

    return Array.from(orgSet).sort();
  });

  // Computed - organization options with recently used at the top
  let organizationOptions = $derived.by(() => {
    const allOrgs = availableOrganizations;
    const recentOrgs = recentlyUsedOrgs.filter((org) => allOrgs.includes(org));
    const otherOrgs = allOrgs.filter((org) => !recentOrgs.includes(org));

    const options: string[] = ["Select organization"];

    if (recentOrgs.length > 0) {
      options.push(...recentOrgs);

      if (otherOrgs.length > 0) {
        options.push("---");
        options.push(...otherOrgs);
      }
    } else {
      options.push(...otherOrgs);
    }
    return options;
  });

  // Computed - repository options with recently used at the top
  let repositoryOptionsWithRecent = $derived.by(() => {
    const allOptions = repositoryDisplayOptions;

    const recentRepos = recentlyUsedRepos
      .filter((repo) => {
        if (filters.organization) {
          return sortedRepositories.some(
            (r) => r.name === repo || r.full_name === repo
          );
        } else {
          return sortedRepositories.some((r) => r.full_name === repo);
        }
      })
      .map((repo) => {
        if (filters.organization && repo.includes("/")) {
          return repo.split("/")[1];
        }
        return repo;
      });

    const otherOptions = allOptions.filter(
      (option) => !recentRepos.includes(option)
    );

    const options: string[] = ["Select repository"];

    if (recentRepos.length > 0) {
      options.push(...recentRepos);
      if (otherOptions.length > 0) {
        options.push("---");
        options.push(...otherOptions);
      }
    } else {
      options.push(...otherOptions);
    }

    return options;
  });

  // Track if we've done initial load
  let hasLoadedInitialData = $state(false);
  let hasLoadedRecentlyUsedData = $state(false);

  // ============================================================================
  // INITIALIZATION AND LIFECYCLE
  // ============================================================================

  onMount(async () => {
    if (githubExtension.isEnabled() && !hasLoadedInitialData) {
      await loadInitialData();
    }
  });

  // React to settings changes (specifically the enabled flag)
  $effect(() => {
    const isEnabled = settings.integrations.github.enabled;

    if (isEnabled && !hasLoadedInitialData) {
      loadInitialData();
    }
  });

  // Save recently used filters when they change
  $effect(() => {
    // React to changes in recently used arrays
    recentlyUsedOrgs;
    recentlyUsedRepos;

    // Only save if we've loaded initial data AND recently used data
    // This prevents overwriting saved data with empty arrays on initial load
    if (hasLoadedInitialData && hasLoadedRecentlyUsedData) {
      saveRecentlyUsedFilters();
    }
  });

  // React to filter changes - tasks are now automatically reactive
  // No need to manually reload tasks since they're reactive to the filters

  // ============================================================================
  // EVENT HANDLERS - Simple pass-through, no logic
  // ============================================================================

  function handleSortChange(newSortFields: SortField[]): void {
    sort = newSortFields;
  }

  function setActiveTab(tab: "issues" | "pull-requests"): void {
    filters = { ...filters, type: tab };
  }

  function setStateFilter(state: "open" | "closed" | "all"): void {
    filters = { ...filters, state };
  }

  function toggleAssignedToMe(): void {
    filters = { ...filters, assignedToMe: !filters.assignedToMe };
    // Update the settings to persist the filter
    settings.integrations.github.issueFilters.assignee = filters.assignedToMe
      ? "me"
      : "";
  }

  function setLabelsFilter(labels: string[]): void {
    filters = { ...filters, labels };
    // Update the settings to persist the filter
    settings.integrations.github.issueFilters.labels = labels;
  }

  function setOrganizationFilter(org: string | null): void {
    filters = { ...filters, organization: org };

    if (org) {
      addRecentlyUsedOrg(org);
    }

    // Save current filter state
    saveRecentlyUsedFilters();

    if (org) {
      // Reset repository selection when changing organization
      if (!filters.repository || !filters.repository.startsWith(org + "/")) {
        const firstRepoInOrg = filteredRepositories[0];
        if (firstRepoInOrg) {
          setRepository(firstRepoInOrg.full_name);
        }
      }
    } else {
      // Clear repository selection when no organization is selected
      setRepository(null);
    }
  }

  async function setRepository(repository: string | null): Promise<void> {
    filters = { ...filters, repository };

    if (repository) {
      addRecentlyUsedRepo(repository);
    }

    // Save current filter state
    saveRecentlyUsedFilters();

    if (repository) {
      await loadLabels();
    } else {
      availableLabels = [];
      filters = { ...filters, labels: [] };
    }
  }

  async function loadInitialData(): Promise<void> {
    if (hasLoadedInitialData) {
      return;
    }

    isLoading = true;
    hasLoadedInitialData = true;

    try {
      // Load recently used filters first
      await loadRecentlyUsedFilters();

      // Load current user and organizations
      await Promise.all([loadCurrentUser(), loadOrganizations()]);

      // Then load repositories (which needs organizations to be loaded)
      await loadRepositories();

      // Tasks are now reactive, no need to manually load
    } finally {
      isLoading = false;
    }
  }

  onDestroy(() => {
    // Save filter state when component is destroyed
    saveRecentlyUsedFilters();
  });

  async function loadCurrentUser(): Promise<void> {
    try {
      const user = await githubExtension.getCurrentUser();
      filters = { ...filters, currentUser: user };
    } catch (err: any) {
      console.warn("Failed to load current user:", err.message);
      filters = { ...filters, currentUser: null };
    }
  }

  async function loadOrganizations(): Promise<void> {
    try {
      const orgs = await githubExtension.fetchOrganizations();
      organizations = orgs;
    } catch (err: any) {
      console.error("Failed to load organizations:", err);
    }
  }

  async function loadRepositories(): Promise<void> {
    try {
      const userRepos = await githubExtension.fetchRepositories();
      const orgRepos: GitHubRepository[] = [];

      // Load repositories for each organization
      for (const org of organizations) {
        try {
          const repos = await githubExtension.fetchRepositoriesForOrganization(
            org.login
          );
          orgRepos.push(...repos);
        } catch (err: any) {
          console.warn(
            `Failed to load repositories for organization ${org.login}:`,
            err
          );
        }
      }

      repositories = [...userRepos, ...orgRepos];
    } catch (err: any) {
      console.error("Failed to load repositories:", err);
      error = err.message;
    }
  }

  async function refresh(): Promise<void> {
    try {
      // Show loading state
      isLoading = true;
      error = null;

      // Use extension's refresh method which handles everything:
      // - Clears cache and reloads GitHub API data
      // - Updates reactive cache for UI
      // - Refreshes tasks via TaskSourceManager
      await githubExtension.refresh();

      // Reload organizations and repositories for the UI dropdowns
      // These are not handled by the TaskSource since they're UI-specific
      await loadOrganizations();
      await loadRepositories();

      isLoading = false;
    } catch (err: any) {
      console.error("Failed to refresh GitHub data:", err);
      error = err.message;
      isLoading = false;
    }
  }

  async function loadLabels(): Promise<void> {
    if (!filters.repository) {
      return;
    }

    try {
      availableLabels = await githubExtension.fetchLabels(filters.repository);

      // Validate selected labels against available labels
      // Remove any selected labels that are no longer available
      const availableLabelNames = availableLabels.map((label) => label.name);
      const validSelectedLabels = filters.labels.filter((label) =>
        availableLabelNames.includes(label)
      );

      if (validSelectedLabels.length !== filters.labels.length) {
        setLabelsFilter(validSelectedLabels);
      }
    } catch (err: any) {
      console.warn("Failed to load labels:", err.message);
      availableLabels = [];
      // Clear selected labels if we can't load available labels
      setLabelsFilter([]);
    }
  }

  function addRecentlyUsedOrg(org: string): void {
    if (!org || recentlyUsedOrgs.includes(org)) return;

    recentlyUsedOrgs = [
      org,
      ...recentlyUsedOrgs.filter((o) => o !== org),
    ].slice(0, 5);
    // Don't save here - let the caller save to avoid double saves
  }

  function addRecentlyUsedRepo(repo: string): void {
    if (!repo || recentlyUsedRepos.includes(repo)) return;

    recentlyUsedRepos = [
      repo,
      ...recentlyUsedRepos.filter((r) => r !== repo),
    ].slice(0, 5);
    // Don't save here - let the caller save to avoid double saves
  }

  function removeRecentlyUsedOrg(org: string): void {
    recentlyUsedOrgs = recentlyUsedOrgs.filter((o) => o !== org);
    saveRecentlyUsedFilters();
  }

  function removeRecentlyUsedRepo(repo: string): void {
    recentlyUsedRepos = recentlyUsedRepos.filter((r) => r !== repo);
    saveRecentlyUsedFilters();
  }

  async function loadRecentlyUsedFilters(): Promise<void> {
    try {
      const data = await host.loadData();
      if (data?.githubRecentlyUsed) {
        recentlyUsedOrgs = data.githubRecentlyUsed.organizations || [];
        recentlyUsedRepos = data.githubRecentlyUsed.repositories || [];
      }

      // Also restore current filter selections
      if (data?.githubCurrentFilters) {
        if (data.githubCurrentFilters.organization !== undefined) {
          filters = {
            ...filters,
            organization: data.githubCurrentFilters.organization,
          };
        }
        if (data.githubCurrentFilters.repository !== undefined) {
          filters = {
            ...filters,
            repository: data.githubCurrentFilters.repository,
          };
        }
        if (data.githubCurrentFilters.sortFields !== undefined) {
          sort = data.githubCurrentFilters.sortFields;
        }
      }

      hasLoadedRecentlyUsedData = true;
    } catch (err: any) {
      console.warn("Failed to load recently used filters:", err.message);
      hasLoadedRecentlyUsedData = true; // Set to true even on error to prevent infinite loops
    }
  }

  async function saveRecentlyUsedFilters(): Promise<void> {
    try {
      const data = (await host.loadData()) || {};
      data.githubRecentlyUsed = {
        organizations: recentlyUsedOrgs,
        repositories: recentlyUsedRepos,
      };
      // Also save current filter selections and sort state
      data.githubCurrentFilters = {
        organization: filters.organization,
        repository: filters.repository,
        sortFields: sort,
      };
      await host.saveData(data);
    } catch (err: any) {
      console.warn("Failed to save recently used filters:", err.message);
    }
  }

  // Helper to check if a task is imported (exists in main task store)
  function isTaskImported(task: Task): boolean {
    return $importedTasks.some((t) => t.source.keys.github === task.source.keys.github);
  }

  /**
   * Schedule an issue/PR for today.
   * If the task is already imported, schedules the existing task.
   * If not, imports the task first, then schedules it.
   */
  async function scheduleForToday(task: Task): Promise<void> {
    const githubUrl = task.source.keys.github;

    if (!dailyPlanningExtension) {
      return;
    }

    // If the task is already imported, find it and schedule it
    if (githubUrl && isTaskImported(task)) {
      const state = get(taskStore);
      const existing = state.tasks.find(
        (t) => t.source.keys.github === githubUrl
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
    const githubData = task.source.data;

    // Determine if it's an issue or PR and import accordingly
    const isPR = "head" in githubData && "base" in githubData;
    const result = isPR
      ? await githubExtension.importPullRequestAsTask(
          githubData,
          filters.repository || ""
        )
      : await githubExtension.importIssueAsTask(
          githubData,
          filters.repository || ""
        );

    if (result.success) {
      console.log(
        `Successfully imported ${isPR ? "PR" : "issue"} #${githubData.number} as task ${result.taskId}`
      );

      // Handle Daily Planning integration
      if (dailyPlanningWizardMode && dailyPlanningExtension) {
        // In wizard mode, stage the task for today
        try {
          dailyPlanningExtension.scheduleTaskForToday(result.taskId);
          console.log(
            `Staged task ${result.taskId} for today in Daily Planning`
          );
        } catch (err: any) {
          console.error("Error staging task for today:", err);
        }
      } else if (dayPlanningMode && dailyPlanningExtension) {
        // In regular day planning mode, add to today's daily note immediately
        try {
          await dailyPlanningExtension.addTasksToTodayDailyNote([
            { id: result.taskId, title: githubData.title } as Task,
          ]);
          console.log(`Added task ${result.taskId} to today's daily note`);
        } catch (err: any) {
          console.error("Error adding to today's daily note:", err);
        }
      }
    } else {
      console.error(
        `Failed to import ${isPR ? "PR" : "issue"} #${githubData.number}:`,
        result.error
      );
    }
  }
</script>

<div
  class="task-sync-service-container github-service"
  data-testid="github-service"
>
  <!-- Header Section -->
  <header>
    <!-- 1. Search with refresh group -->
    <SearchInput
      bind:value={searchQuery}
      placeholder="Search {filters.type === 'issues'
        ? 'issues'
        : 'pull requests'}..."
      onInput={(value) => (searchQuery = value)}
      service="github"
      disabled={isLoading}
      onRefresh={refresh}
    />

    <!-- 2. Primary filter buttons group - Org/Repo pulldowns 50/50 -->
    <div class="primary-filters">
      <FilterButton
        label="Organization"
        currentValue={filters.organization || "Select organization"}
        options={organizationOptions}
        placeholder="Select organization"
        onselect={(value) =>
          setOrganizationFilter(
            value === "---" || value === "" || value === "Select organization"
              ? null
              : value
          )}
        testId="organization-filter"
        autoSuggest={true}
        allowClear={true}
        isActive={!!filters.organization}
        recentlyUsedItems={recentlyUsedOrgs}
        onRemoveRecentItem={removeRecentlyUsedOrg}
      />

      <FilterButton
        label="Repository"
        currentValue={currentRepositoryDisplay}
        options={repositoryOptionsWithRecent}
        placeholder="Select repository"
        onselect={(value) => {
          if (value === "---") {
            return;
          }
          if (value === "" || value === "Select repository") {
            setRepository(null);
            return;
          }
          let fullName = value;
          if (filters.organization && !value.includes("/")) {
            fullName = `${filters.organization}/${value}`;
          }
          setRepository(fullName);
        }}
        testId="repository-filter"
        autoSuggest={true}
        allowClear={true}
        isActive={!!filters.repository}
        recentlyUsedItems={recentlyUsedRepos}
        onRemoveRecentItem={removeRecentlyUsedRepo}
      />
    </div>

    <!-- 3. Secondary filter buttons group - first row: Issues/PRs + Open/Closed -->
    <div class="secondary-filters-row-1">
      <button
        class="task-sync-filter-toggle {filters.type === 'issues'
          ? 'active'
          : ''}"
        data-tab="issues"
        data-testid="issues-tab"
        onclick={() => setActiveTab("issues")}
      >
        Issues
      </button>
      <button
        class="task-sync-filter-toggle {filters.type === 'pull-requests'
          ? 'active'
          : ''}"
        data-tab="pull-requests"
        data-testid="pull-requests-tab"
        onclick={() => setActiveTab("pull-requests")}
      >
        Pull Requests
      </button>

      <button
        class="task-sync-filter-toggle {filters.state === 'open'
          ? 'active'
          : ''}"
        data-state="open"
        data-testid="open-filter"
        onclick={() => setStateFilter("open")}
      >
        Open
      </button>
      <button
        class="task-sync-filter-toggle {filters.state === 'closed'
          ? 'active'
          : ''}"
        data-state="closed"
        data-testid="closed-filter"
        onclick={() => setStateFilter("closed")}
      >
        Closed
      </button>
    </div>

    <!-- 4. Secondary filter buttons group - second row: Labels + Assigned to me -->
    <div class="secondary-filters-row-2">
      <FilterButton
        label="Labels"
        currentValue={filters.labels.length > 0
          ? `${filters.labels.length} selected`
          : "All labels"}
        options={["All labels", ...availableLabels.map((label) => label.name)]}
        placeholder="All labels"
        disabled={availableLabels.length === 0}
        onselect={(value) => {
          if (value === "All labels") {
            setLabelsFilter([]);
          } else {
            const newLabels = filters.labels.includes(value)
              ? filters.labels.filter((l) => l !== value)
              : [...filters.labels, value];
            setLabelsFilter(newLabels);
          }
        }}
        testId="labels-filter"
        autoSuggest={true}
        allowClear={true}
        isActive={filters.labels.length > 0}
      />

      <button
        class="task-sync-filter-toggle {filters.assignedToMe ? 'active' : ''}"
        data-testid="assigned-to-me-filter"
        onclick={() => toggleAssignedToMe()}
      >
        Assigned to me
      </button>
    </div>

    <!-- 5. Sort controls group -->
    <SortDropdown
      sortFields={sort}
      availableFields={availableSortFields}
      onSortChange={handleSortChange}
    />
  </header>

  <!-- Content Section -->
  <div class="task-sync-task-list-container">
    {#if !githubExtension.isEnabled()}
      <div class="task-sync-disabled-message">
        GitHub integration is not enabled. Please configure it in settings.
      </div>
    {:else if error}
      <div class="task-sync-error-message">
        {error}
      </div>
    {:else if isLoading}
      <div class="task-sync-loading-indicator" data-testid="loading-indicator">
        Loading {filters.type === "issues" ? "issues" : "pull requests"}...
      </div>
    {:else}
      <div
        class="task-sync-task-list"
        data-testid={filters.type === "issues"
          ? "github-issues-list"
          : "github-prs-list"}
      >
        {#if tasks.length === 0}
          <div class="task-sync-empty-message">
            No {filters.type === "issues" ? "issues" : "pull requests"} found.
          </div>
        {:else}
          {#each tasks as task (task.id)}
            {@const isImported = isTaskImported(task)}
            {@const isScheduled = task.doDate != null}
            {@const scheduledDate = task.doDate}
            {@const githubData = task.source?.data}
            {@const isPR =
              githubData && "head" in githubData && "base" in githubData}
            {#if isPR}
              <GitHubPullRequestItem
                {task}
                repository={filters.repository}
                isHovered={hoveredTask === task.id}
                {isImported}
                {isScheduled}
                {scheduledDate}
                {dayPlanningMode}
                {dailyPlanningWizardMode}
                onHover={(hovered) => (hoveredTask = hovered ? task.id : null)}
                onImport={() => scheduleForToday(task)}
                {host}
                {settings}
                testId="pr-item"
              />
            {:else}
              <GitHubIssueItem
                {task}
                repository={filters.repository}
                isHovered={hoveredTask === task.id}
                {isImported}
                {isScheduled}
                {scheduledDate}
                {dayPlanningMode}
                {dailyPlanningWizardMode}
                onHover={(hovered) => (hoveredTask = hovered ? task.id : null)}
                onImport={() => scheduleForToday(task)}
                {host}
                {settings}
                testId="github-issue-item"
              />
            {/if}
          {/each}
        {/if}
      </div>
    {/if}
  </div>
</div>
