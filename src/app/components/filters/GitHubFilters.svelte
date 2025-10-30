<script lang="ts">
  /**
   * GitHubFilters component
   * Encapsulates all filter logic for GitHub tasks
   * Manages its own state, settings persistence, and recently-used items
   */

  import FilterButton from "../FilterButton.svelte";
  import type { TaskSyncSettings } from "../../types/settings";
  import type { Host } from "../../core/host";
  import type { GitHubExtension } from "../../extensions/github/GitHubExtension";
  import type {
    GitHubRepository,
    GitHubOrganization,
    GitHubLabel,
  } from "../../cache/schemas/github";

  interface GitHubTaskFilters {
    repository?: string | null;
    organization?: string | null;
    state?: "open" | "closed" | "all";
    assignedToMe?: boolean;
    labels?: string[];
    type?: "issues" | "pull-requests";
  }

  interface Props {
    // Current filter values (bindable for two-way sync)
    filters: $bindable<GitHubTaskFilters>;

    // Settings object (passed as entire object)
    settings: TaskSyncSettings;

    // Host for persistence
    host: Host;

    // GitHub extension (typed specifically for GitHub-specific methods)
    extension: GitHubExtension;
  }

  let { filters = $bindable({}), settings, host, extension }: Props = $props();

  // ============================================================================
  // INTERNAL STATE - Managed by this component
  // ============================================================================

  let currentRepository = $state<string | null>(
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
  let activeTab = $state<"issues" | "pull-requests">("issues");

  // Data from GitHub API
  let repositories = $state<GitHubRepository[]>([]);
  let organizations = $state<GitHubOrganization[]>([]);
  let availableLabels = $state<GitHubLabel[]>([]);
  let currentUser = $state<{
    login: string;
    id: number;
    avatar_url: string;
  } | null>(null);

  // Recently used items
  let recentlyUsedOrgs = $state<string[]>([]);
  let recentlyUsedRepos = $state<string[]>([]);

  // Loading state
  let isLoadingData = $state(false);

  // ============================================================================
  // LOAD INITIAL DATA
  // ============================================================================

  $effect(() => {
    if (extension.isEnabled()) {
      loadInitialData();
    }
  });

  async function loadInitialData(): Promise<void> {
    isLoadingData = true;
    try {
      await loadRecentlyUsedFilters();
      await Promise.all([loadCurrentUser(), loadOrganizations()]);
      await loadRepositories();
      if (currentRepository) {
        await loadLabels();
      }
    } finally {
      isLoadingData = false;
    }
  }

  async function loadCurrentUser(): Promise<void> {
    try {
      currentUser = await extension.getCurrentUser();
    } catch (err: any) {
      console.warn("Failed to load current user:", err.message);
      currentUser = null;
    }
  }

  async function loadOrganizations(): Promise<void> {
    try {
      organizations = await extension.fetchOrganizations();
    } catch (err: any) {
      console.error("Failed to load organizations:", err);
    }
  }

  async function loadRepositories(): Promise<void> {
    try {
      const userRepos = await extension.fetchRepositories();
      const orgRepos: GitHubRepository[] = [];

      for (const org of organizations) {
        try {
          const repos = await extension.fetchRepositoriesForOrganization(
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
    }
  }

  async function loadLabels(): Promise<void> {
    if (!currentRepository) return;

    try {
      availableLabels = await extension.fetchLabels(currentRepository);

      // Validate selected labels
      const availableLabelNames = availableLabels.map((label) => label.name);
      const validSelectedLabels = selectedLabels.filter((label) =>
        availableLabelNames.includes(label)
      );

      if (validSelectedLabels.length !== selectedLabels.length) {
        selectedLabels = validSelectedLabels;
      }
    } catch (err: any) {
      console.warn("Failed to load labels:", err.message);
      availableLabels = [];
      selectedLabels = [];
    }
  }

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  let filteredRepositories = $derived.by(() => {
    if (!currentOrganization) return repositories;
    return repositories.filter((repo) =>
      repo.full_name.startsWith(currentOrganization + "/")
    );
  });

  let sortedRepositories = $derived.by(() => {
    return [...filteredRepositories].sort((a, b) => {
      const aOrg = a.full_name.split("/")[0];
      const bOrg = b.full_name.split("/")[0];
      const aName = a.full_name.split("/")[1];
      const bName = b.full_name.split("/")[1];

      if (aOrg !== bOrg) return aOrg.localeCompare(bOrg);
      return aName.localeCompare(bName);
    });
  });

  let repositoryDisplayOptions = $derived.by(() => {
    if (currentOrganization) {
      return sortedRepositories.map((repo) => repo.name);
    } else {
      return sortedRepositories.map((repo) => repo.full_name);
    }
  });

  let currentRepositoryDisplay = $derived.by(() => {
    if (!currentRepository) return "Select repository";

    if (
      currentOrganization &&
      currentRepository.startsWith(currentOrganization + "/")
    ) {
      return currentRepository.split("/")[1];
    } else {
      return currentRepository;
    }
  });

  let availableOrganizations = $derived.by(() => {
    const orgSet = new Set<string>();
    organizations.forEach((org) => orgSet.add(org.login));
    repositories.forEach((repo) => {
      const org = repo.full_name.split("/")[0];
      orgSet.add(org);
    });
    return Array.from(orgSet).sort();
  });

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

  // ============================================================================
  // UPDATE FILTERS WHEN INTERNAL STATE CHANGES
  // ============================================================================

  $effect(() => {
    filters = {
      repository: currentRepository,
      organization: currentOrganization,
      state: currentState,
      assignedToMe,
      labels: selectedLabels,
      type: activeTab,
    };
  });

  // ============================================================================
  // SETTINGS PERSISTENCE
  // ============================================================================

  async function loadRecentlyUsedFilters(): Promise<void> {
    try {
      const data = await host.loadData();
      if (data?.githubRecentlyUsed) {
        recentlyUsedOrgs = data.githubRecentlyUsed.organizations || [];
        recentlyUsedRepos = data.githubRecentlyUsed.repositories || [];
      }

      if (data?.githubCurrentFilters) {
        if (data.githubCurrentFilters.organization !== undefined) {
          currentOrganization = data.githubCurrentFilters.organization;
        }
        if (data.githubCurrentFilters.repository !== undefined) {
          currentRepository = data.githubCurrentFilters.repository;
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
      data.githubCurrentFilters = {
        organization: currentOrganization,
        repository: currentRepository,
      };
      await host.saveData(data);
    } catch (err: any) {
      console.warn("Failed to save recently used filters:", err.message);
    }
  }

  // Save recently used filters when organization or repository changes
  $effect(() => {
    // React to changes in current filters
    currentOrganization;
    currentRepository;

    // Save current filters to storage
    saveRecentlyUsedFilters();
  });

  // ============================================================================
  // RECENTLY USED MANAGEMENT
  // ============================================================================

  function addRecentlyUsedOrg(org: string): void {
    if (!org || recentlyUsedOrgs.includes(org)) return;
    recentlyUsedOrgs = [
      org,
      ...recentlyUsedOrgs.filter((o) => o !== org),
    ].slice(0, 5);
  }

  function addRecentlyUsedRepo(repo: string): void {
    if (!repo || recentlyUsedRepos.includes(repo)) return;
    recentlyUsedRepos = [
      repo,
      ...recentlyUsedRepos.filter((r) => r !== repo),
    ].slice(0, 5);
  }

  function removeRecentlyUsedOrg(org: string): void {
    recentlyUsedOrgs = recentlyUsedOrgs.filter((o) => o !== org);
  }

  function removeRecentlyUsedRepo(repo: string): void {
    recentlyUsedRepos = recentlyUsedRepos.filter((r) => r !== repo);
  }

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  function setOrganizationFilter(org: string | null): void {
    currentOrganization = org;
    if (org) {
      addRecentlyUsedOrg(org);
      // Reset repository selection when changing organization
      if (!currentRepository || !currentRepository.startsWith(org + "/")) {
        const firstRepoInOrg = filteredRepositories[0];
        if (firstRepoInOrg) {
          setRepository(firstRepoInOrg.full_name);
        }
      }
    } else {
      setRepository(null);
    }
  }

  async function setRepository(repository: string | null): Promise<void> {
    currentRepository = repository;
    if (repository) {
      addRecentlyUsedRepo(repository);
      await loadLabels();
    } else {
      availableLabels = [];
      selectedLabels = [];
    }
  }
</script>

<!-- Primary filters - Org/Repo -->
<div class="primary-filters">
  <FilterButton
    label="Organization"
    currentValue={currentOrganization || "Select organization"}
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
    isActive={!!currentOrganization}
    recentlyUsedItems={recentlyUsedOrgs}
    onRemoveRecentItem={removeRecentlyUsedOrg}
  />

  <FilterButton
    label="Repository"
    currentValue={currentRepositoryDisplay}
    options={repositoryOptionsWithRecent}
    placeholder="Select repository"
    onselect={(value) => {
      if (value === "---") return;
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

<!-- Secondary filters - Issues/PRs + Open/Closed -->
<div class="secondary-filters-row-1">
  <button
    class="task-sync-filter-toggle {activeTab === 'issues' ? 'active' : ''}"
    data-tab="issues"
    data-testid="issues-tab"
    onclick={() => (activeTab = "issues")}
  >
    Issues
  </button>
  <button
    class="task-sync-filter-toggle {activeTab === 'pull-requests'
      ? 'active'
      : ''}"
    data-tab="pull-requests"
    data-testid="pull-requests-tab"
    onclick={() => (activeTab = "pull-requests")}
  >
    Pull Requests
  </button>

  <button
    class="task-sync-filter-toggle {currentState === 'open' ? 'active' : ''}"
    data-state="open"
    data-testid="open-filter"
    onclick={() => (currentState = "open")}
  >
    Open
  </button>
  <button
    class="task-sync-filter-toggle {currentState === 'closed' ? 'active' : ''}"
    data-state="closed"
    data-testid="closed-filter"
    onclick={() => (currentState = "closed")}
  >
    Closed
  </button>
</div>

<!-- Secondary filters - Labels + Assigned to me -->
<div class="secondary-filters-row-2">
  <FilterButton
    label="Labels"
    currentValue={selectedLabels.length > 0
      ? `${selectedLabels.length} selected`
      : "All labels"}
    options={["All labels", ...availableLabels.map((label) => label.name)]}
    placeholder="All labels"
    disabled={availableLabels.length === 0}
    onselect={(value) => {
      if (value === "All labels") {
        selectedLabels = [];
      } else {
        const newLabels = selectedLabels.includes(value)
          ? selectedLabels.filter((l) => l !== value)
          : [...selectedLabels, value];
        selectedLabels = newLabels;
      }
    }}
    testId="labels-filter"
    autoSuggest={true}
    allowClear={true}
    isActive={selectedLabels.length > 0}
  />

  <button
    class="task-sync-filter-toggle {assignedToMe ? 'active' : ''}"
    data-testid="assigned-to-me-filter"
    onclick={() => (assignedToMe = !assignedToMe)}
  >
    Assigned to me
  </button>
</div>
