<script lang="ts">
  import { onMount } from "svelte";
  import { Notice } from "obsidian";
  import { getPluginContext } from "./context";
  import FilterButton from "./FilterButton.svelte";
  import SearchInput from "./SearchInput.svelte";
  import GitHubIssueItem from "./GitHubIssueItem.svelte";
  import GitHubPullRequestItem from "./GitHubPullRequestItem.svelte";
  import type {
    GitHubIssue,
    GitHubPullRequest,
    GitHubRepository,
    GitHubOrganization,
    GitHubLabel,
  } from "../../services/GitHubService";
  import type { GitHubIntegrationSettings } from "../ui/settings/types";
  import type { TaskImportConfig } from "../../types/integrations";
  import { taskStore } from "../../stores/taskStore";

  interface Props {
    githubService: any;
    settings: { githubIntegration: GitHubIntegrationSettings };
    dependencies: {
      taskImportManager: any;
      getDefaultImportConfig: () => TaskImportConfig;
    };
    dayPlanningMode?: boolean;
  }

  let {
    githubService,
    settings,
    dependencies,
    dayPlanningMode = false,
  }: Props = $props();

  const { plugin } = getPluginContext();

  // State
  let activeTab = $state<"issues" | "pull-requests">("issues");
  let issues = $state<GitHubIssue[]>([]);
  let pullRequests = $state<GitHubPullRequest[]>([]);
  let repositories = $state<GitHubRepository[]>([]);
  let organizations = $state<GitHubOrganization[]>([]);
  let currentRepository = $state(settings.githubIntegration.defaultRepository);
  let currentOrganization = $state<string | null>(null);
  let currentState = $state<"open" | "closed" | "all">(
    settings.githubIntegration.issueFilters.state
  );
  let assignedToMe = $state(
    settings.githubIntegration.issueFilters.assignee === "me"
  );
  let selectedLabels = $state<string[]>(
    settings.githubIntegration.issueFilters.labels || []
  );
  let availableLabels = $state<GitHubLabel[]>([]);
  let searchQuery = $state("");
  let error = $state<string | null>(null);
  let isLoading = $state(false);
  let importingIssues = $state(new Set<number>());
  let importedIssues = $state(new Set<number>());
  let importingPullRequests = $state(new Set<number>());
  let importedPullRequests = $state(new Set<number>());
  let hoveredIssue = $state<number | null>(null);
  let hoveredPullRequest = $state<number | null>(null);

  // Computed
  let filteredIssues = $derived.by(() => {
    let filtered = filterIssues(currentState, assignedToMe, selectedLabels);
    if (searchQuery) {
      filtered = searchIssues(searchQuery, filtered);
    }
    return filtered;
  });

  let filteredPullRequests = $derived.by(() => {
    let filtered = filterPullRequests(
      currentState,
      assignedToMe,
      selectedLabels
    );
    if (searchQuery) {
      filtered = searchPullRequests(searchQuery, filtered);
    }
    return filtered;
  });

  let filteredRepositories = $derived.by(() => {
    if (!currentOrganization) {
      return repositories;
    }
    return repositories.filter((repo) =>
      repo.full_name.startsWith(currentOrganization + "/")
    );
  });

  let sortedRepositories = $derived.by(() => {
    return [...filteredRepositories].sort((a, b) => {
      // Sort by org first, then by name
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

  let availableOrganizations = $derived.by(() => {
    const orgSet = new Set<string>();
    repositories.forEach((repo) => {
      const org = repo.full_name.split("/")[0];
      orgSet.add(org);
    });
    return Array.from(orgSet).sort();
  });

  onMount(() => {
    if (githubService.isEnabled()) {
      loadRepositories()
        .then(() => {
          if (currentRepository) {
            return loadIssues();
          }
        })
        .catch((err) => {
          error = err.message || "Failed to load GitHub data";
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

  function setActiveTab(tab: "issues" | "pull-requests"): void {
    activeTab = tab;

    refreshImportStatus();

    if (
      tab === "pull-requests" &&
      pullRequests.length === 0 &&
      currentRepository
    ) {
      loadPullRequests();
    }
  }

  function getCurrentUser(): string | null {
    // Extract the username from the first repository's full_name (owner/repo)
    if (repositories.length > 0) {
      const fullName = repositories[0].full_name;
      const [owner] = fullName.split("/");
      return owner;
    }
    return null;
  }

  function filterIssues(
    state: "open" | "closed" | "all",
    assignedToMe: boolean,
    selectedLabels: string[]
  ): GitHubIssue[] {
    let filtered = issues;

    // Filter by state
    if (state !== "all") {
      filtered = filtered.filter((issue) => issue.state === state);
    }

    // Filter by assignee if "assigned to me" is enabled
    if (assignedToMe) {
      // Get current user from GitHub service settings or API
      // For now, we'll use the assignee filter from settings
      const currentUser = getCurrentUser();
      if (currentUser) {
        filtered = filtered.filter(
          (issue) => issue.assignee?.login === currentUser
        );
      }
    }

    // Filter by labels if any are selected
    if (selectedLabels.length > 0) {
      filtered = filtered.filter((issue) =>
        selectedLabels.some((selectedLabel) =>
          issue.labels.some((label) => label.name === selectedLabel)
        )
      );
    }

    return filtered;
  }

  function filterPullRequests(
    state: "open" | "closed" | "all",
    assignedToMe: boolean,
    selectedLabels: string[]
  ): GitHubPullRequest[] {
    let filtered = pullRequests;

    // Filter by state
    if (state !== "all") {
      filtered = filtered.filter((pr) => pr.state === state);
    }

    // Filter by assignee if "assigned to me" is enabled
    if (assignedToMe) {
      const currentUser = getCurrentUser();
      if (currentUser) {
        filtered = filtered.filter(
          (pr) =>
            pr.assignee?.login === currentUser ||
            pr.assignees?.some((assignee) => assignee.login === currentUser)
        );
      }
    }

    // Filter by labels if any are selected
    if (selectedLabels.length > 0) {
      filtered = filtered.filter((pr) =>
        selectedLabels.some((selectedLabel) =>
          pr.labels.some((label) => label.name === selectedLabel)
        )
      );
    }

    return filtered;
  }

  function searchIssues(
    query: string,
    issueList?: GitHubIssue[]
  ): GitHubIssue[] {
    const searchIn = issueList || issues;
    const lowerQuery = query.toLowerCase();

    return searchIn.filter(
      (issue) =>
        issue.title.toLowerCase().includes(lowerQuery) ||
        (issue.body && issue.body.toLowerCase().includes(lowerQuery))
    );
  }

  function searchPullRequests(
    query: string,
    prList?: GitHubPullRequest[]
  ): GitHubPullRequest[] {
    const searchIn = prList || pullRequests;
    const lowerQuery = query.toLowerCase();

    return searchIn.filter(
      (pr) =>
        pr.title.toLowerCase().includes(lowerQuery) ||
        (pr.body && pr.body.toLowerCase().includes(lowerQuery))
    );
  }

  async function loadRepositories(): Promise<void> {
    if (!githubService.isEnabled()) {
      return;
    }

    try {
      const repos = await githubService.fetchRepositories();
      repositories = repos;
      const repositoryNames = repos.map(
        (repo: GitHubRepository) => repo.full_name
      );

      // Update settings with fetched repositories
      settings.githubIntegration.repositories = repositoryNames;

      // Set default repository if not already set
      if (!currentRepository && settings.githubIntegration.defaultRepository) {
        currentRepository = settings.githubIntegration.defaultRepository;
      }

      // Save settings through the plugin (skip template update for repository list updates)
      const pluginInstance = (window as any).app?.plugins?.plugins?.[
        "obsidian-task-sync"
      ];
      if (pluginInstance) {
        await pluginInstance.saveSettings(true); // Skip template update
      }
    } catch (err: any) {
      error = err.message || "Failed to load repositories";
    }
  }

  /**
   * Refresh import status for all issues and pull requests from task store
   * This should be called whenever the component becomes visible to ensure
   * import status is up-to-date with the current state of the task store
   */
  function refreshImportStatus(): void {
    // Refresh import status for issues
    const importedIssueNumbers = new Set<number>();
    for (const issue of issues) {
      if (taskStore.isTaskImported("github", `github-${issue.id}`)) {
        importedIssueNumbers.add(issue.number);
      }
    }
    importedIssues = importedIssueNumbers;

    // Refresh import status for pull requests
    const importedPRNumbers = new Set<number>();
    for (const pr of pullRequests) {
      if (taskStore.isTaskImported("github", `github-${pr.id}`)) {
        importedPRNumbers.add(pr.number);
      }
    }
    importedPullRequests = importedPRNumbers;
  }

  async function loadIssues(): Promise<void> {
    if (!currentRepository || !githubService.isEnabled()) {
      return;
    }

    isLoading = true;
    error = null;

    try {
      issues = await githubService.fetchIssues(currentRepository);

      // Refresh import status after loading issues
      refreshImportStatus();

      isLoading = false;
    } catch (err: any) {
      error = err.message || "Failed to load issues";
      isLoading = false;
    }
  }

  async function loadPullRequests(): Promise<void> {
    if (!currentRepository || !githubService.isEnabled()) {
      return;
    }

    isLoading = true;
    error = null;

    try {
      pullRequests = await githubService.fetchPullRequests(currentRepository);

      // Refresh import status after loading pull requests
      refreshImportStatus();

      isLoading = false;
    } catch (err: any) {
      error = err.message || "Failed to load pull requests";
      isLoading = false;
    }
  }

  async function loadLabels(): Promise<void> {
    if (!currentRepository || !githubService.isEnabled()) {
      return;
    }

    try {
      availableLabels = await githubService.fetchLabels(currentRepository);
    } catch (err: any) {
      console.warn("Failed to load labels:", err.message);
      availableLabels = [];
    }
  }

  async function setRepository(repository: string | null): Promise<void> {
    if (repository) {
      currentRepository = repository;
      await loadIssues();
      await loadLabels();
      if (activeTab === "pull-requests") {
        await loadPullRequests();
      }
    }
  }

  function setStateFilter(state: "open" | "closed"): void {
    currentState = state;
  }

  function toggleAssignedToMe(): void {
    assignedToMe = !assignedToMe;
    // Update the settings to persist the filter
    settings.githubIntegration.issueFilters.assignee = assignedToMe ? "me" : "";
    // Reload data with new filter
    if (currentRepository) {
      loadIssues();
      if (activeTab === "pull-requests") {
        loadPullRequests();
      }
    }
  }

  function setLabelsFilter(labels: string[]): void {
    selectedLabels = labels;
    // Update the settings to persist the filter
    settings.githubIntegration.issueFilters.labels = labels;
    // No need to reload data as filtering is done client-side
  }

  function setOrganizationFilter(org: string | null): void {
    currentOrganization = org;
    // Reset repository selection when changing organization
    if (org && !currentRepository.startsWith(org + "/")) {
      const firstRepoInOrg = filteredRepositories[0];
      if (firstRepoInOrg) {
        setRepository(firstRepoInOrg.full_name);
      }
    }
  }

  async function refresh(): Promise<void> {
    await loadRepositories();
    if (currentRepository) {
      await loadIssues();
      if (activeTab === "pull-requests") {
        await loadPullRequests();
      }
    }
  }

  async function importIssue(issue: GitHubIssue): Promise<void> {
    if (!githubService.isEnabled()) {
      plugin.app.workspace.trigger(
        "notice",
        "GitHub service not available. Please check your configuration."
      );
      return;
    }

    try {
      importingIssues.add(issue.number);
      importingIssues = new Set(importingIssues); // Trigger reactivity

      const config = dependencies.getDefaultImportConfig();
      const result = await githubService.importIssueAsTask(issue, config);

      // Handle successful import or existing task
      if (result.success) {
        if (result.skipped) {
          plugin.app.workspace.trigger(
            "notice",
            `Issue already imported: ${result.reason}`
          );
        } else {
          plugin.app.workspace.trigger(
            "notice",
            `Successfully imported: ${issue.title}`
          );
        }
        importedIssues.add(issue.number);
        importedIssues = new Set(importedIssues); // Trigger reactivity

        // Refresh task store to ensure it knows about the new task
        await taskStore.refreshTasks();
      } else if (
        result.error &&
        result.error.includes("Task already exists:")
      ) {
        // Handle existing task case - extract the file path from the error message
        const existingTaskPath = result.error.replace(
          "Task already exists: ",
          ""
        );

        // Set the taskFilePath so we can still add to daily note
        result.taskFilePath = existingTaskPath;
        result.success = true; // Treat as success for daily note purposes

        plugin.app.workspace.trigger(
          "notice",
          `Task already exists: ${issue.title}`
        );
        importedIssues.add(issue.number);
        importedIssues = new Set(importedIssues); // Trigger reactivity
      } else {
        plugin.app.workspace.trigger(
          "notice",
          `Failed to import issue: ${result.error}`
        );
      }

      // If in day planning mode, add to today's daily note (for both new and existing tasks)
      if (dayPlanningMode && result.taskFilePath) {
        try {
          const dailyResult = await plugin.dailyNoteService.addTaskToToday(
            result.taskFilePath
          );
          if (dailyResult.success) {
            new Notice(`Added "${issue.title}" to today's daily note`);
          } else {
            new Notice(
              `Failed to add to today: ${dailyResult.error || "Unknown error"}`
            );
          }
        } catch (dailyErr: any) {
          console.error("Error adding to today:", dailyErr);
          new Notice(
            `Error adding to today: ${dailyErr.message || "Unknown error"}`
          );
        }
      }
    } catch (err: any) {
      plugin.app.workspace.trigger(
        "notice",
        `Failed to import issue: ${err.message}`
      );
    } finally {
      importingIssues.delete(issue.number);
      importingIssues = new Set(importingIssues); // Trigger reactivity
    }
  }

  async function importPullRequest(pr: GitHubPullRequest): Promise<void> {
    if (!githubService.isEnabled()) {
      plugin.app.workspace.trigger(
        "notice",
        "GitHub service not available. Please check your configuration."
      );
      return;
    }

    try {
      importingPullRequests.add(pr.number);
      importingPullRequests = new Set(importingPullRequests); // Trigger reactivity

      const config = dependencies.getDefaultImportConfig();
      const result = await githubService.importPullRequestAsTask(pr, config);

      if (result.success) {
        if (result.skipped) {
          plugin.app.workspace.trigger(
            "notice",
            `Pull request already imported: ${result.reason}`
          );
        } else {
          plugin.app.workspace.trigger(
            "notice",
            `Successfully imported: ${pr.title}`
          );
        }
        importedPullRequests.add(pr.number);
        importedPullRequests = new Set(importedPullRequests); // Trigger reactivity

        // If in day planning mode, also add to today's daily note
        console.log(
          "🔄 GitHub PR import - dayPlanningMode:",
          dayPlanningMode,
          "taskFilePath:",
          result.taskFilePath
        );
        if (dayPlanningMode && result.taskFilePath) {
          try {
            console.log("🔄 Adding GitHub PR to today's daily note:", pr.title);
            const dailyResult = await plugin.dailyNoteService.addTaskToToday(
              result.taskFilePath
            );
            console.log("🔄 GitHub PR daily note result:", dailyResult);
            if (dailyResult.success) {
              new Notice(`Added "${pr.title}" to today's daily note`);
            } else {
              new Notice(
                `Failed to add to today: ${dailyResult.error || "Unknown error"}`
              );
            }
          } catch (dailyErr: any) {
            console.error("Error adding to today:", dailyErr);
            new Notice(
              `Error adding to today: ${dailyErr.message || "Unknown error"}`
            );
          }
        }
      } else {
        plugin.app.workspace.trigger(
          "notice",
          `Failed to import pull request: ${result.error}`
        );
      }
    } catch (err: any) {
      plugin.app.workspace.trigger(
        "notice",
        `Failed to import pull request: ${err.message}`
      );
    } finally {
      importingPullRequests.delete(pr.number);
      importingPullRequests = new Set(importingPullRequests); // Trigger reactivity
    }
  }

  function updateSettings(newSettings: {
    githubIntegration: GitHubIntegrationSettings;
  }): void {
    settings = newSettings;
    if (newSettings.githubIntegration.defaultRepository !== currentRepository) {
      currentRepository = newSettings.githubIntegration.defaultRepository;
      loadIssues();
    }
  }

  // Expose methods for the wrapper
  $effect(() => {
    if (typeof window !== "undefined") {
      (window as any).__githubServiceMethods = {
        updateSettings,
        refresh,
      };
    }
  });
</script>

<div
  class="github-service"
  data-type="github-service"
  data-testid="github-service"
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
              >
                Closed
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
              currentValue={currentOrganization || "All organizations"}
              options={availableOrganizations}
              placeholder="All organizations"
              onselect={(value) =>
                setOrganizationFilter(
                  value === "All organizations" ? null : value
                )}
              testId="organization-filter"
              autoSuggest={true}
              allowClear={true}
            />
          </div>

          <!-- Repository filter -->
          <div class="task-sync-filter-group task-sync-filter-group--repo">
            <FilterButton
              label="Repository"
              currentValue={currentRepository || "All repositories"}
              options={sortedRepositories.map((repo) => repo.full_name)}
              placeholder="All repositories"
              onselect={(value) =>
                setRepository(value === "All repositories" ? null : value)}
              testId="repository-filter"
              autoSuggest={true}
              allowClear={true}
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
            />
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Content Section -->
  <div class="task-sync-task-list-container">
    {#if !githubService.isEnabled()}
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
      <div class="task-sync-task-list">
        {#if filteredIssues.length === 0}
          <div class="task-sync-empty-message">No issues found.</div>
        {:else}
          {#each filteredIssues as issue}
            {@const isImporting = importingIssues.has(issue.number)}
            {@const isImported = $taskStore.entities.some(
              (task) =>
                task.source?.name === "github" &&
                task.source?.key === `github-${issue.id}`
            )}
            <GitHubIssueItem
              {issue}
              isHovered={hoveredIssue === issue.number}
              {isImported}
              {isImporting}
              onHover={(hovered) =>
                (hoveredIssue = hovered ? issue.number : null)}
              onImport={importIssue}
              {dayPlanningMode}
              testId="issue-item"
            />
          {/each}
        {/if}
      </div>
    {:else if activeTab === "pull-requests"}
      <div class="task-sync-task-list">
        {#if filteredPullRequests.length === 0}
          <div class="task-sync-empty-message">No pull requests found.</div>
        {:else}
          {#each filteredPullRequests as pr}
            {@const isImporting = importingPullRequests.has(pr.number)}
            {@const isImported = $taskStore.entities.some(
              (task) =>
                task.source?.name === "github" &&
                task.source?.key === `github-pr-${pr.id}`
            )}
            <GitHubPullRequestItem
              pullRequest={pr}
              isHovered={hoveredPullRequest === pr.number}
              {isImported}
              {isImporting}
              onHover={(hovered) =>
                (hoveredPullRequest = hovered ? pr.number : null)}
              onImport={importPullRequest}
              {dayPlanningMode}
              testId="pr-item"
            />
          {/each}
        {/if}
      </div>
    {/if}
  </div>
</div>
