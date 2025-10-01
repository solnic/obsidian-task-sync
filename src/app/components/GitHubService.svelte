<script lang="ts">
  /**
   * GitHubService component for the new architecture
   * Provides GitHub issue/PR listing and import functionality
   */

  import { onMount, onDestroy } from "svelte";
  import SearchInput from "./SearchInput.svelte";
  import SortDropdown from "./SortDropdown.svelte";
  import FilterButton from "./FilterButton.svelte";
  import GitHubIssueItem from "./GitHubIssueItem.svelte";
  import GitHubPullRequestItem from "./GitHubPullRequestItem.svelte";
  import type { Task } from "../core/entities";
  import type { TaskSyncSettings } from "../types/settings";
  import type { Extension } from "../core/extension";
  import type { Host } from "../core/host";
  import type {
    GitHubRepository,
    GitHubOrganization,
    GitHubLabel,
  } from "../cache/schemas/github";
  import type { GitHubExtension } from "../extensions/GitHubExtension";

  interface SortField {
    key: string;
    label: string;
    direction: "asc" | "desc";
  }

  interface Props {
    settings: TaskSyncSettings;
    extension: Extension;
    host: Host;
    testId?: string;
  }

  let { settings, extension, host, testId }: Props = $props();

  // Cast extension to GitHubExtension for type safety
  const githubExtension = extension as GitHubExtension;

  // State
  let activeTab = $state<"issues" | "pull-requests">("issues");
  let tasks = $state<Task[]>([]); // All tasks (both imported and available)
  let repositories = $state<GitHubRepository[]>([]);
  let organizations = $state<GitHubOrganization[]>([]);
  let currentRepository = $state(
    settings.integrations.github.defaultRepository
  );
  let currentOrganization = $state<string | null>(null);
  let currentState = $state<"open" | "closed" | "all">(
    settings.integrations.github.issueFilters.state
  );
  let assignedToMe = $state(
    settings.integrations.github.issueFilters.assignee === "me"
  );
  let selectedLabels = $state<string[]>(
    settings.integrations.github.issueFilters.labels || []
  );
  let availableLabels = $state<GitHubLabel[]>([]);
  let searchQuery = $state("");
  let error = $state<string | null>(null);
  let isLoading = $state(false);
  let recentlyUsedOrgs = $state<string[]>([]);
  let recentlyUsedRepos = $state<string[]>([]);
  let hoveredTask = $state<string | null>(null); // Task ID instead of issue/PR number
  let currentUser = $state<{
    login: string;
    id: number;
    avatar_url: string;
  } | null>(null);

  // Import tracking state - now just track which tasks are being imported
  let importingTasks = $state<Set<string>>(new Set()); // Task IDs

  // Sorting state
  let sortFields = $state<SortField[]>([
    { key: "updatedAt", label: "Updated", direction: "desc" },
    { key: "title", label: "Title", direction: "asc" },
  ]);

  // Available sort fields for GitHub issues/PRs
  const availableSortFields = [
    { key: "title", label: "Title" },
    { key: "createdAt", label: "Created" },
    { key: "updatedAt", label: "Updated" },
    { key: "number", label: "Number" },
    { key: "state", label: "State" },
  ];

  // Computed - filtered repositories based on organization
  let filteredRepositories = $derived.by(() => {
    if (!currentOrganization) {
      return repositories;
    }
    return repositories.filter((repo) =>
      repo.full_name.startsWith(currentOrganization + "/")
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
    if (currentOrganization) {
      return sortedRepositories.map((repo) => repo.name);
    } else {
      return sortedRepositories.map((repo) => repo.full_name);
    }
  });

  // Computed - current repository display value
  let currentRepositoryDisplay = $derived.by(() => {
    if (!currentRepository) {
      return "Select repository";
    }

    if (
      currentOrganization &&
      currentRepository.startsWith(currentOrganization + "/")
    ) {
      return currentRepository.split("/")[1];
    } else {
      return currentRepository;
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

    const options: string[] = [];

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
        if (currentOrganization) {
          return sortedRepositories.some(
            (r) => r.name === repo || r.full_name === repo
          );
        } else {
          return sortedRepositories.some((r) => r.full_name === repo);
        }
      })
      .map((repo) => {
        if (currentOrganization && repo.includes("/")) {
          return repo.split("/")[1];
        }
        return repo;
      });

    const otherOptions = allOptions.filter(
      (option) => !recentRepos.includes(option)
    );

    const options: string[] = [];
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

      if (currentRepository) {
        await loadTasks();
      }
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
      currentUser = await githubExtension.getCurrentUser();
    } catch (err: any) {
      console.warn("Failed to load current user:", err.message);
      currentUser = null;
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

  async function loadTasks(): Promise<void> {
    if (!currentRepository) {
      return;
    }

    try {
      isLoading = true;
      error = null;
      const fetchedTasks = await githubExtension.getTasksForRepository(
        currentRepository,
        activeTab
      );
      tasks = fetchedTasks;
    } catch (err: any) {
      console.error("Failed to load tasks:", err);
      error = err.message;
      tasks = [];
    } finally {
      isLoading = false;
    }
  }

  async function refresh(): Promise<void> {
    await githubExtension.clearCache();
    await loadOrganizations();
    await loadRepositories();
    if (currentRepository) {
      await loadTasks();
    }
  }

  function setActiveTab(tab: "issues" | "pull-requests"): void {
    activeTab = tab;

    // Reload tasks when switching tabs
    if (currentRepository) {
      loadTasks();
    }
  }

  function setStateFilter(state: "open" | "closed" | "all"): void {
    currentState = state;
  }

  function toggleAssignedToMe(): void {
    assignedToMe = !assignedToMe;
    // Update the settings to persist the filter
    settings.integrations.github.issueFilters.assignee = assignedToMe
      ? "me"
      : "";
    // No need to reload data - filtering is reactive and happens client-side
  }

  function setLabelsFilter(labels: string[]): void {
    selectedLabels = labels;
    // Update the settings to persist the filter
    settings.integrations.github.issueFilters.labels = labels;
    // No need to reload data as filtering is done client-side
  }

  function setOrganizationFilter(org: string | null): void {
    currentOrganization = org;

    if (org) {
      addRecentlyUsedOrg(org);
    }

    // Save current filter state
    saveRecentlyUsedFilters();

    if (org) {
      // Reset repository selection when changing organization
      if (!currentRepository || !currentRepository.startsWith(org + "/")) {
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

  async function loadLabels(): Promise<void> {
    if (!currentRepository) {
      return;
    }

    try {
      availableLabels = await githubExtension.fetchLabels(currentRepository);

      // Validate selected labels against available labels
      // Remove any selected labels that are no longer available
      const availableLabelNames = availableLabels.map((label) => label.name);
      const validSelectedLabels = selectedLabels.filter((label) =>
        availableLabelNames.includes(label)
      );

      if (validSelectedLabels.length !== selectedLabels.length) {
        selectedLabels = validSelectedLabels;
        setLabelsFilter(validSelectedLabels);
      }
    } catch (err: any) {
      console.warn("Failed to load labels:", err.message);
      availableLabels = [];
      // Clear selected labels if we can't load available labels
      selectedLabels = [];
      setLabelsFilter([]);
    }
  }

  async function setRepository(repository: string | null): Promise<void> {
    currentRepository = repository;

    if (repository) {
      addRecentlyUsedRepo(repository);
    }

    if (repository) {
      await loadTasks();
      await loadLabels();
    } else {
      tasks = [];
      availableLabels = [];
      selectedLabels = [];
    }
  }

  function addRecentlyUsedOrg(org: string): void {
    if (!org || recentlyUsedOrgs.includes(org)) return;

    recentlyUsedOrgs = [
      org,
      ...recentlyUsedOrgs.filter((o) => o !== org),
    ].slice(0, 5);
    saveRecentlyUsedFilters();
  }

  function addRecentlyUsedRepo(repo: string): void {
    if (!repo || recentlyUsedRepos.includes(repo)) return;

    recentlyUsedRepos = [
      repo,
      ...recentlyUsedRepos.filter((r) => r !== repo),
    ].slice(0, 5);
    saveRecentlyUsedFilters();
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
          currentOrganization = data.githubCurrentFilters.organization;
        }
        if (data.githubCurrentFilters.repository !== undefined) {
          currentRepository = data.githubCurrentFilters.repository;
        }
        if (data.githubCurrentFilters.sortFields !== undefined) {
          sortFields = data.githubCurrentFilters.sortFields;
        }
      }
    } catch (err: any) {
      console.warn("Failed to load recently used filters:", err.message);
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
        organization: currentOrganization,
        repository: currentRepository,
        sortFields: sortFields,
      };
      await host.saveData(data);
    } catch (err: any) {
      console.warn("Failed to save recently used filters:", err.message);
    }
  }

  // Computed filtered and sorted tasks
  let filteredAndSortedTasks = $derived.by(() => {
    let filtered = tasks;

    // Filter by state (using source.data which contains the GitHub issue/PR)
    if (currentState !== "all") {
      filtered = filtered.filter((task) => {
        const githubData = task.source?.data;
        return githubData && githubData.state === currentState;
      });
    }

    // Filter by assignee if "assigned to me" is enabled
    if (assignedToMe && currentUser) {
      filtered = filtered.filter((task) => {
        const githubData = task.source?.data;
        return githubData && githubData.assignee?.login === currentUser.login;
      });
    }

    // Filter by labels if any are selected
    if (selectedLabels.length > 0) {
      filtered = filtered.filter((task) => {
        const githubData = task.source?.data;
        return (
          githubData &&
          githubData.labels &&
          selectedLabels.some((selectedLabel) =>
            githubData.labels.some((label: any) => label.name === selectedLabel)
          )
        );
      });
    }

    // Filter by search query
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      filtered = filtered.filter((task) => {
        const githubData = task.source?.data;
        return (
          task.title.toLowerCase().includes(lowerQuery) ||
          (task.description &&
            task.description.toLowerCase().includes(lowerQuery)) ||
          (githubData?.body &&
            githubData.body.toLowerCase().includes(lowerQuery))
        );
      });
    }

    // Sort
    return sortTasks(filtered, sortFields);
  });

  function sortTasks(taskList: Task[], sortFields: SortField[]): Task[] {
    return [...taskList].sort((a, b) => {
      for (const field of sortFields) {
        let aValue: any;
        let bValue: any;

        const aGithubData = a.source?.data;
        const bGithubData = b.source?.data;

        switch (field.key) {
          case "title":
            aValue = a.title || "";
            bValue = b.title || "";
            break;
          case "createdAt":
            aValue = a.createdAt.getTime();
            bValue = b.createdAt.getTime();
            break;
          case "updatedAt":
            aValue = a.updatedAt.getTime();
            bValue = b.updatedAt.getTime();
            break;
          case "number":
            aValue = aGithubData?.number || 0;
            bValue = bGithubData?.number || 0;
            break;
          case "state":
            aValue = aGithubData?.state || "";
            bValue = bGithubData?.state || "";
            break;
          default:
            aValue = "";
            bValue = "";
        }

        let comparison = 0;
        if (typeof aValue === "string" && typeof bValue === "string") {
          comparison = aValue.localeCompare(bValue);
        } else if (typeof aValue === "number" && typeof bValue === "number") {
          comparison = aValue - bValue;
        }

        if (field.direction === "desc") {
          comparison = -comparison;
        }

        if (comparison !== 0) {
          return comparison;
        }
      }

      return 0;
    });
  }

  function handleSortChange(newSortFields: SortField[]): void {
    sortFields = newSortFields;
  }

  // Helper to check if a task is imported (has a real ID, not a temp one)
  function isTaskImported(task: Task): boolean {
    return !task.id.startsWith("github-temp-");
  }

  async function importTask(task: Task): Promise<void> {
    try {
      importingTasks.add(task.id);
      importingTasks = new Set(importingTasks);

      const githubData = task.source?.data;
      if (!githubData) {
        console.error("Task has no GitHub data");
        return;
      }

      // Determine if it's an issue or PR and import accordingly
      const isPR = "head" in githubData && "base" in githubData;
      const result = isPR
        ? await githubExtension.importPullRequestAsTask(
            githubData,
            currentRepository || ""
          )
        : await githubExtension.importIssueAsTask(
            githubData,
            currentRepository || ""
          );

      if (result.success) {
        console.log(
          `Successfully imported ${isPR ? "PR" : "issue"} #${githubData.number} as task ${result.taskId}`
        );
        // Reload tasks to get the updated list with the imported task
        await loadTasks();
      } else {
        console.error(
          `Failed to import ${isPR ? "PR" : "issue"} #${githubData.number}:`,
          result.error
        );
      }
    } catch (error: any) {
      console.error("Failed to import task:", error);
    } finally {
      importingTasks.delete(task.id);
      importingTasks = new Set(importingTasks);
    }
  }
</script>

<div
  class="github-service"
  data-type="github-service"
  data-testid={testId || "github-service"}
>
  <!-- Header Section -->
  <div class="github-service-header">
    <!-- Search and Filters -->
    <div class="search-and-filters">
      <SearchInput
        bind:value={searchQuery}
        placeholder="Search {activeTab === 'issues'
          ? 'issues'
          : 'pull requests'}..."
        onInput={(value) => (searchQuery = value)}
        onRefresh={refresh}
        testId="search-input"
      />

      <!-- Filter Section -->
      <div class="task-sync-filter-section">
        <!-- Primary filters row -->
        <div class="task-sync-filter-row task-sync-filter-row--primary">
          <!-- Type filters (Issues/Pull Requests) -->
          <div class="task-sync-filter-group task-sync-filter-group--type">
            <div class="task-sync-type-filters">
              <button
                class="task-sync-filter-toggle {activeTab === 'issues'
                  ? 'active'
                  : ''}"
                data-tab="issues"
                data-testid="issues-tab"
                onclick={() => setActiveTab("issues")}
                type="button"
              >
                Issues
              </button>
              <button
                class="task-sync-filter-toggle {activeTab === 'pull-requests'
                  ? 'active'
                  : ''}"
                data-tab="pull-requests"
                data-testid="pull-requests-tab"
                onclick={() => setActiveTab("pull-requests")}
                type="button"
              >
                Pull Requests
              </button>
            </div>
          </div>

          <!-- State filters -->
          <div class="task-sync-filter-group task-sync-filter-group--state">
            <div class="task-sync-state-filters">
              <button
                class="task-sync-filter-toggle {currentState === 'open'
                  ? 'active'
                  : ''}"
                data-state="open"
                data-testid="open-filter"
                onclick={() => setStateFilter("open")}
                type="button"
              >
                Open
              </button>
              <button
                class="task-sync-filter-toggle {currentState === 'closed'
                  ? 'active'
                  : ''}"
                data-state="closed"
                data-testid="closed-filter"
                onclick={() => setStateFilter("closed")}
                type="button"
              >
                Closed
              </button>
              <button
                class="task-sync-filter-toggle {currentState === 'all'
                  ? 'active'
                  : ''}"
                data-state="all"
                data-testid="all-filter"
                onclick={() => setStateFilter("all")}
                type="button"
              >
                All
              </button>
            </div>
          </div>
        </div>

        <!-- Secondary filters row -->
        <div class="task-sync-filter-row task-sync-filter-row--secondary">
          <!-- Organization filter -->
          <div class="task-sync-filter-group task-sync-filter-group--org">
            <FilterButton
              label="Organization"
              currentValue={currentOrganization || "Select organization"}
              options={organizationOptions}
              placeholder="Select organization"
              onselect={(value) =>
                setOrganizationFilter(
                  value === "---" ||
                    value === "" ||
                    value === "Select organization"
                    ? null
                    : value
                )}
              testId="organization-filter"
              autoSuggest={true}
              allowClear={true}
              isActive={!!currentOrganization}
              recentlyUsedItems={recentlyUsedOrgs}
              onRemoveRecentItem={removeRecentlyUsedOrg}
            />
          </div>

          <!-- Repository filter -->
          <div class="task-sync-filter-group task-sync-filter-group--repo">
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
                if (currentOrganization && !value.includes("/")) {
                  fullName = `${currentOrganization}/${value}`;
                }
                setRepository(fullName);
              }}
              testId="repository-filter"
              autoSuggest={true}
              allowClear={true}
              isActive={!!currentRepository}
              recentlyUsedItems={recentlyUsedRepos}
              onRemoveRecentItem={removeRecentlyUsedRepo}
            />
          </div>

          <!-- Assigned to me filter -->
          <div class="task-sync-filter-group task-sync-filter-group--assignee">
            <button
              class="task-sync-filter-toggle {assignedToMe ? 'active' : ''}"
              data-testid="assigned-to-me-filter"
              onclick={() => toggleAssignedToMe()}
              type="button"
            >
              Assigned to me
            </button>
          </div>

          <!-- Labels filter -->
          <div class="task-sync-filter-group task-sync-filter-group--labels">
            <FilterButton
              label="Labels"
              currentValue={selectedLabels.length > 0
                ? `${selectedLabels.length} selected`
                : "All labels"}
              options={[
                "All labels",
                ...availableLabels.map((label) => label.name),
              ]}
              placeholder="All labels"
              disabled={availableLabels.length === 0}
              onselect={(value) => {
                if (value === "All labels") {
                  setLabelsFilter([]);
                } else {
                  // Toggle label selection
                  const newLabels = selectedLabels.includes(value)
                    ? selectedLabels.filter((l) => l !== value)
                    : [...selectedLabels, value];
                  setLabelsFilter(newLabels);
                }
              }}
              testId="labels-filter"
              autoSuggest={true}
              allowClear={true}
              isActive={selectedLabels.length > 0}
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
    {#if !githubExtension.isEnabled()}
      <div class="task-sync-disabled-message">
        GitHub integration is not enabled. Please configure it in settings.
      </div>
    {:else if error}
      <div class="task-sync-error-message">
        {error}
      </div>
    {:else if isLoading}
      <div class="task-sync-loading-indicator">
        Loading {activeTab === "issues" ? "issues" : "pull requests"}...
      </div>
    {:else}
      <div
        class="task-sync-task-list"
        data-testid={activeTab === "issues"
          ? "github-issues-list"
          : "github-prs-list"}
      >
        {#if filteredAndSortedTasks.length === 0}
          <div class="task-sync-empty-message">
            No {activeTab === "issues" ? "issues" : "pull requests"} found.
          </div>
        {:else}
          {#each filteredAndSortedTasks as task (task.id)}
            {@const isImporting = importingTasks.has(task.id)}
            {@const isImported = isTaskImported(task)}
            {@const isScheduled = task.doDate != null}
            {@const scheduledDate = task.doDate}
            {@const githubData = task.source?.data}
            {@const isPR =
              githubData && "head" in githubData && "base" in githubData}
            {#if isPR}
              <GitHubPullRequestItem
                pullRequest={githubData}
                repository={currentRepository}
                isHovered={hoveredTask === task.id}
                {isImported}
                {isImporting}
                {isScheduled}
                {scheduledDate}
                onHover={(hovered) => (hoveredTask = hovered ? task.id : null)}
                onImport={() => importTask(task)}
                {host}
                {settings}
                testId="pr-item"
              />
            {:else}
              <GitHubIssueItem
                issue={githubData}
                repository={currentRepository}
                isHovered={hoveredTask === task.id}
                {isImported}
                {isImporting}
                {isScheduled}
                {scheduledDate}
                onHover={(hovered) => (hoveredTask = hovered ? task.id : null)}
                onImport={() => importTask(task)}
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
