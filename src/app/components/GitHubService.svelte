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
  import { taskStore } from "../stores/taskStore";
  import type { Task } from "../core/entities";
  import type { TaskSyncSettings } from "../types/settings";
  import type { Extension } from "../core/extension";
  import type { Host } from "../core/host";
  import type {
    GitHubIssue,
    GitHubPullRequest,
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
  let issues = $state<GitHubIssue[]>([]);
  let pullRequests = $state<GitHubPullRequest[]>([]);
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
  let hoveredIssue = $state<number | null>(null);
  let hoveredPullRequest = $state<number | null>(null);
  let currentUser = $state<{
    login: string;
    id: number;
    avatar_url: string;
  } | null>(null);

  // Import tracking state
  let importingIssues = $state<Set<number>>(new Set());
  let importedIssues = $state<Set<number>>(new Set());
  let importingPullRequests = $state<Set<number>>(new Set());
  let importedPullRequests = $state<Set<number>>(new Set());

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
        await loadIssues();
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

  async function loadIssues(): Promise<void> {
    if (!currentRepository) {
      return;
    }

    try {
      isLoading = true;
      error = null;
      const fetchedIssues =
        await githubExtension.fetchIssues(currentRepository);
      issues = fetchedIssues;
    } catch (err: any) {
      console.error("Failed to load issues:", err);
      error = err.message;
      issues = [];
    } finally {
      isLoading = false;
    }
  }

  async function loadPullRequests(): Promise<void> {
    if (!currentRepository) return;

    try {
      isLoading = true;
      error = null;
      const fetchedPRs =
        await githubExtension.fetchPullRequests(currentRepository);
      pullRequests = fetchedPRs;
    } catch (err: any) {
      console.error("Failed to load pull requests:", err);
      error = err.message;
      pullRequests = [];
    } finally {
      isLoading = false;
    }
  }

  async function refresh(): Promise<void> {
    await githubExtension.clearCache();
    await loadOrganizations();
    await loadRepositories();
    if (currentRepository) {
      if (activeTab === "issues") {
        await loadIssues();
      } else if (activeTab === "pull-requests") {
        await loadPullRequests();
      }
    }
  }

  function setActiveTab(tab: "issues" | "pull-requests"): void {
    activeTab = tab;

    if (
      tab === "pull-requests" &&
      pullRequests.length === 0 &&
      currentRepository
    ) {
      loadPullRequests();
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
      await loadIssues();
      await loadLabels();
      if (activeTab === "pull-requests") {
        await loadPullRequests();
      }
    } else {
      issues = [];
      pullRequests = [];
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

  // Computed filtered and sorted issues
  let filteredAndSortedIssues = $derived.by(() => {
    let filtered = issues;

    // Filter by state
    if (currentState !== "all") {
      filtered = filtered.filter((issue) => issue.state === currentState);
    }

    // Filter by assignee if "assigned to me" is enabled
    if (assignedToMe && currentUser) {
      filtered = filtered.filter(
        (issue) => issue.assignee?.login === currentUser.login
      );
    }

    // Filter by labels if any are selected
    if (selectedLabels.length > 0) {
      filtered = filtered.filter((issue) =>
        selectedLabels.some((selectedLabel) =>
          issue.labels.some((label) => label.name === selectedLabel)
        )
      );
    }

    // Filter by search query
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (issue) =>
          issue.title.toLowerCase().includes(lowerQuery) ||
          (issue.body && issue.body.toLowerCase().includes(lowerQuery))
      );
    }

    // Sort
    return sortIssues(filtered, sortFields);
  });

  function sortIssues(
    issueList: GitHubIssue[],
    sortFields: SortField[]
  ): GitHubIssue[] {
    return [...issueList].sort((a, b) => {
      for (const field of sortFields) {
        let aValue: any;
        let bValue: any;

        switch (field.key) {
          case "title":
            aValue = a.title || "";
            bValue = b.title || "";
            break;
          case "createdAt":
            aValue = new Date(a.created_at).getTime();
            bValue = new Date(b.created_at).getTime();
            break;
          case "updatedAt":
            aValue = new Date(a.updated_at).getTime();
            bValue = new Date(b.updated_at).getTime();
            break;
          case "number":
            aValue = a.number;
            bValue = b.number;
            break;
          case "state":
            aValue = a.state || "";
            bValue = b.state || "";
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

  // Computed filtered and sorted pull requests
  let filteredAndSortedPullRequests = $derived.by(() => {
    let filtered = pullRequests;

    // Filter by state
    if (currentState !== "all") {
      filtered = filtered.filter((pr) => pr.state === currentState);
    }

    // Filter by assignee if "assigned to me" is enabled
    if (assignedToMe && currentUser) {
      filtered = filtered.filter(
        (pr) =>
          pr.assignee?.login === currentUser.login ||
          pr.assignees?.some((assignee) => assignee.login === currentUser.login)
      );
    }

    // Filter by labels if any are selected
    if (selectedLabels.length > 0) {
      filtered = filtered.filter((pr) =>
        selectedLabels.some((selectedLabel) =>
          pr.labels.some((label) => label.name === selectedLabel)
        )
      );
    }

    // Filter by search query
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (pr) =>
          pr.title.toLowerCase().includes(lowerQuery) ||
          (pr.body && pr.body.toLowerCase().includes(lowerQuery))
      );
    }

    // Sort (reuse sortIssues function as PRs have same structure)
    return sortIssues(filtered as any, sortFields) as any;
  });

  function handleSortChange(newSortFields: SortField[]): void {
    sortFields = newSortFields;
  }

  // Subscribe to task store to get current tasks
  let tasks = $state<readonly Task[]>([]);
  $effect(() => {
    const unsubscribe = taskStore.subscribe((state) => {
      tasks = state.tasks;
    });
    return unsubscribe;
  });

  /**
   * Refresh import status for all issues and pull requests from task store
   */
  function refreshImportStatus(): void {
    // Refresh import status for issues
    const importedIssueNumbers = new Set<number>();
    for (const issue of issues) {
      const isImported = tasks.some(
        (task) =>
          task.source?.url === issue.html_url ||
          (task.source?.extension === "github" && task.title === issue.title)
      );
      if (isImported) {
        importedIssueNumbers.add(issue.number);
      }
    }
    importedIssues = importedIssueNumbers;

    // Refresh import status for pull requests
    const importedPRNumbers = new Set<number>();
    for (const pr of pullRequests) {
      const isImported = tasks.some(
        (task) =>
          task.source?.url === pr.html_url ||
          (task.source?.extension === "github" && task.title === pr.title)
      );
      if (isImported) {
        importedPRNumbers.add(pr.number);
      }
    }
    importedPullRequests = importedPRNumbers;
  }

  async function importIssue(issue: GitHubIssue): Promise<void> {
    try {
      importingIssues.add(issue.number);
      importingIssues = new Set(importingIssues);

      // Import issue using GitHubExtension
      const result = await githubExtension.importIssueAsTask(
        issue,
        currentRepository || ""
      );

      if (result.success) {
        console.log(
          `Successfully imported issue #${issue.number} as task ${result.taskId}`
        );
        // Refresh import status after successful import
        refreshImportStatus();
      } else {
        console.error(`Failed to import issue #${issue.number}:`, result.error);
      }
    } catch (error: any) {
      console.error("Failed to import issue:", error);
    } finally {
      importingIssues.delete(issue.number);
      importingIssues = new Set(importingIssues);
    }
  }

  async function importPullRequest(pr: GitHubPullRequest): Promise<void> {
    try {
      importingPullRequests.add(pr.number);
      importingPullRequests = new Set(importingPullRequests);

      // Import PR using GitHubExtension
      const result = await githubExtension.importPullRequestAsTask(
        pr,
        currentRepository || ""
      );

      if (result.success) {
        console.log(
          `Successfully imported PR #${pr.number} as task ${result.taskId}`
        );
        // Refresh import status after successful import
        refreshImportStatus();
      } else {
        console.error(`Failed to import PR #${pr.number}:`, result.error);
      }
    } catch (error: any) {
      console.error("Failed to import pull request:", error);
    } finally {
      importingPullRequests.delete(pr.number);
      importingPullRequests = new Set(importingPullRequests);
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
    {:else if activeTab === "issues"}
      <div class="task-sync-task-list" data-testid="github-issues-list">
        {#if filteredAndSortedIssues.length === 0}
          <div class="task-sync-empty-message">No issues found.</div>
        {:else}
          {#each filteredAndSortedIssues as issue (issue.id)}
            {@const isImporting = importingIssues.has(issue.number)}
            {@const isImported = importedIssues.has(issue.number)}
            {@const importedTask = isImported
              ? tasks.find(
                  (task) =>
                    task.source?.url === issue.html_url ||
                    (task.source?.extension === "github" &&
                      task.title === issue.title)
                )
              : null}
            {@const isScheduled = importedTask?.doDate != null}
            {@const scheduledDate = importedTask?.doDate}
            <GitHubIssueItem
              {issue}
              repository={currentRepository}
              isHovered={hoveredIssue === issue.number}
              {isImported}
              {isImporting}
              {isScheduled}
              {scheduledDate}
              onHover={(hovered) =>
                (hoveredIssue = hovered ? issue.number : null)}
              onImport={importIssue}
              {host}
              {settings}
              testId="github-issue-item"
            />
          {/each}
        {/if}
      </div>
    {:else if activeTab === "pull-requests"}
      <div class="task-sync-task-list">
        {#if filteredAndSortedPullRequests.length === 0}
          <div class="task-sync-empty-message">No pull requests found.</div>
        {:else}
          {#each filteredAndSortedPullRequests as pr (pr.id)}
            {@const isImporting = importingPullRequests.has(pr.number)}
            {@const isImported = importedPullRequests.has(pr.number)}
            {@const importedTask = isImported
              ? tasks.find(
                  (task) =>
                    task.source?.url === pr.html_url ||
                    (task.source?.extension === "github" &&
                      task.title === pr.title)
                )
              : null}
            {@const isScheduled = importedTask?.doDate != null}
            {@const scheduledDate = importedTask?.doDate}
            <GitHubPullRequestItem
              pullRequest={pr}
              repository={currentRepository}
              isHovered={hoveredPullRequest === pr.number}
              {isImported}
              {isImporting}
              {isScheduled}
              {scheduledDate}
              onHover={(hovered) =>
                (hoveredPullRequest = hovered ? pr.number : null)}
              onImport={importPullRequest}
              {host}
              {settings}
              testId="pr-item"
            />
          {/each}
        {/if}
      </div>
    {/if}
  </div>
</div>
