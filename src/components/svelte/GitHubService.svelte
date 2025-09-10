<script lang="ts">
  import { onMount } from "svelte";
  import { Notice } from "obsidian";
  import { getPluginContext } from "./context";
  import ContextWidget from "./ContextWidget.svelte";
  import FilterButton from "./FilterButton.svelte";
  import type {
    GitHubIssue,
    GitHubPullRequest,
    GitHubRepository,
    GitHubOrganization,
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
    let filtered = filterIssues(currentState);
    if (searchQuery) {
      filtered = searchIssues(searchQuery, filtered);
    }
    return filtered;
  });

  let filteredPullRequests = $derived.by(() => {
    let filtered = filterPullRequests(currentState);
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
    }
  });

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

  function filterIssues(state: "open" | "closed" | "all"): GitHubIssue[] {
    if (state === "all") {
      return issues;
    }
    return issues.filter((issue) => issue.state === state);
  }

  function filterPullRequests(
    state: "open" | "closed" | "all"
  ): GitHubPullRequest[] {
    if (state === "all") {
      return pullRequests;
    }
    return pullRequests.filter((pr) => pr.state === state);
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

      // Save settings through the plugin
      const pluginInstance = (window as any).app?.plugins?.plugins?.[
        "obsidian-task-sync"
      ];
      if (pluginInstance) {
        await pluginInstance.saveSettings();
      }
    } catch (err: any) {
      error = err.message || "Failed to load repositories";
    }
  }

  async function loadIssues(): Promise<void> {
    if (!currentRepository || !githubService.isEnabled()) {
      return;
    }

    isLoading = true;
    error = null;

    try {
      issues = await githubService.fetchIssues(currentRepository);

      // Load import status for all issues using task store
      const importedNumbers = new Set<number>();
      for (const issue of issues) {
        if (taskStore.isTaskImported("github", `github-${issue.id}`)) {
          importedNumbers.add(issue.number);
        }
      }
      importedIssues = importedNumbers;

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

      // Load import status for all pull requests using task store
      const importedNumbers = new Set<number>();
      for (const pr of pullRequests) {
        if (taskStore.isTaskImported("github", `github-pr-${pr.id}`)) {
          importedNumbers.add(pr.number);
        }
      }
      importedPullRequests = importedNumbers;

      isLoading = false;
    } catch (err: any) {
      error = err.message || "Failed to load pull requests";
      isLoading = false;
    }
  }

  async function setRepository(repository: string): Promise<void> {
    currentRepository = repository;
    await loadIssues();
    if (activeTab === "pull-requests") {
      await loadPullRequests();
    }
  }

  function setStateFilter(state: "open" | "closed"): void {
    currentState = state;
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
  <!-- Context Widget -->
  <ContextWidget />

  <!-- Header Section -->
  <div class="github-issues-header">
    <!-- Tab header -->
    <div class="tab-header">
      <button
        class="tab-item {activeTab === 'issues' ? 'active' : ''}"
        data-tab="issues"
        data-testid="issues-tab"
        onclick={() => setActiveTab("issues")}
        type="button"
      >
        Issues
      </button>
      <button
        class="tab-item {activeTab === 'pull-requests' ? 'active' : ''}"
        data-tab="pull-requests"
        data-testid="pull-requests-tab"
        onclick={() => setActiveTab("pull-requests")}
        type="button"
      >
        Pull Requests
      </button>
    </div>

    <!-- Issue filters -->
    <div class="issue-filters">
      <!-- Organization filter -->
      <div class="filter-row">
        <FilterButton
          label="Organization"
          currentValue={currentOrganization || "All Organizations"}
          options={["All Organizations", ...availableOrganizations]}
          onselect={(value) =>
            setOrganizationFilter(value === "All Organizations" ? null : value)}
          placeholder="All Organizations"
          testId="organization-filter"
        />
      </div>

      <!-- Repository filter -->
      <div class="filter-row">
        <select
          bind:value={currentRepository}
          onchange={() => setRepository(currentRepository)}
          data-testid="repository-select"
          class="repository-select"
        >
          {#each sortedRepositories as repo}
            <option value={repo.full_name}>{repo.full_name}</option>
          {/each}
          {#if currentRepository && !sortedRepositories.find((r) => r.full_name === currentRepository)}
            <option value={currentRepository}>{currentRepository}</option>
          {/if}
        </select>
      </div>

      <!-- State filters -->
      <div class="state-filters">
        <button
          class="state-filter {currentState === 'open' ? 'active' : ''}"
          data-state="open"
          data-testid="open-filter"
          onclick={() => setStateFilter("open")}
        >
          Open
        </button>
        <button
          class="state-filter {currentState === 'closed' ? 'active' : ''}"
          data-state="closed"
          data-testid="closed-filter"
          onclick={() => setStateFilter("closed")}
        >
          Closed
        </button>
      </div>

      <!-- Search input -->
      <input
        type="text"
        class="search-input"
        placeholder="Search {activeTab === 'issues'
          ? 'issues'
          : 'pull requests'}..."
        bind:value={searchQuery}
        data-testid="search-input"
      />

      <!-- Refresh button -->
      <button
        class="refresh-button"
        title="Refresh"
        onclick={refresh}
        data-testid="refresh-button"
      >
        ↻
      </button>
    </div>
  </div>

  <!-- Content Section -->
  <div class="github-issues-content">
    {#if !githubService.isEnabled()}
      <div class="disabled-message">
        GitHub integration is not enabled. Please configure it in settings.
      </div>
    {:else if error}
      <div class="error-message">
        {error}
      </div>
    {:else if isLoading}
      <div class="loading-indicator">
        Loading {activeTab === "issues" ? "issues" : "pull requests"}...
      </div>
    {:else if activeTab === "issues"}
      <div class="issues-list">
        {#if filteredIssues.length === 0}
          <div class="empty-message">No issues found.</div>
        {:else}
          {#each filteredIssues as issue}
            <div
              class="issue-item {hoveredIssue === issue.number
                ? 'hovered'
                : ''} {importedIssues.has(issue.number) ? 'imported' : ''}"
              onmouseenter={() => (hoveredIssue = issue.number)}
              onmouseleave={() => (hoveredIssue = null)}
              data-testid="issue-item"
              data-imported={importedIssues.has(issue.number)}
              role="listitem"
            >
              <div class="issue-content">
                <div class="issue-title">{issue.title}</div>
                <div class="issue-number">#{issue.number}</div>
                <div class="issue-meta">
                  {#if issue.assignee}
                    Assigned to {issue.assignee.login} •
                  {/if}
                  {issue.state} • {new Date(
                    issue.created_at
                  ).toLocaleDateString()}
                </div>
                {#if issue.labels.length > 0}
                  <div class="issue-labels">
                    {#each issue.labels as label}
                      <span class="issue-label">{label.name}</span>
                    {/each}
                  </div>
                {/if}
              </div>

              <!-- Import overlay -->
              {#if hoveredIssue === issue.number}
                {@const isImported = taskStore.isTaskImported(
                  "github",
                  `github-${issue.id}`
                )}
                {@const isImporting = importingIssues.has(issue.number)}
                <div class="import-overlay">
                  <div class="import-actions">
                    {#if isImported}
                      <span
                        class="import-status imported"
                        data-testid="imported-indicator"
                      >
                        ✓ Imported
                      </span>
                    {:else if isImporting}
                      <span
                        class="import-status importing"
                        data-testid="importing-indicator"
                      >
                        ⏳ Importing...
                      </span>
                    {:else}
                      <button
                        class="import-button"
                        title={dayPlanningMode
                          ? "Add to today"
                          : "Import this issue as a task"}
                        onclick={() => importIssue(issue)}
                        data-testid={dayPlanningMode
                          ? "add-to-today-button"
                          : "issue-import-button"}
                      >
                        {dayPlanningMode ? "Add to today" : "Import"}
                      </button>
                    {/if}
                  </div>
                </div>
              {/if}
            </div>
          {/each}
        {/if}
      </div>
    {:else if activeTab === "pull-requests"}
      <div class="pull-requests-list">
        {#if filteredPullRequests.length === 0}
          <div class="empty-message">No pull requests found.</div>
        {:else}
          {#each filteredPullRequests as pr}
            <div
              class="issue-item {hoveredPullRequest === pr.number
                ? 'hovered'
                : ''} {importedPullRequests.has(pr.number) ? 'imported' : ''}"
              onmouseenter={() => (hoveredPullRequest = pr.number)}
              onmouseleave={() => (hoveredPullRequest = null)}
              data-testid="pr-item"
              data-imported={importedPullRequests.has(pr.number)}
              role="listitem"
            >
              <div class="issue-content">
                <div class="issue-title">{pr.title}</div>
                <div class="issue-number">#{pr.number}</div>
                <div class="issue-meta">
                  {#if pr.assignee}
                    Assigned to {pr.assignee.login} •
                  {/if}
                  {pr.state}
                  {#if pr.merged_at}
                    (merged)
                  {:else if pr.draft}
                    (draft)
                  {/if}
                  • {new Date(pr.created_at).toLocaleDateString()}
                  • {pr.head.ref} → {pr.base.ref}
                </div>
                {#if pr.labels.length > 0}
                  <div class="issue-labels">
                    {#each pr.labels as label}
                      <span class="issue-label">{label.name}</span>
                    {/each}
                  </div>
                {/if}
              </div>

              <!-- Import overlay -->
              {#if hoveredPullRequest === pr.number}
                {@const isImported = taskStore.isTaskImported(
                  "github",
                  `github-pr-${pr.id}`
                )}
                {@const isImporting = importingPullRequests.has(pr.number)}
                <div class="import-overlay">
                  <div class="import-actions">
                    {#if isImported}
                      <span
                        class="import-status imported"
                        data-testid="imported-indicator"
                      >
                        ✓ Imported
                      </span>
                    {:else if isImporting}
                      <span
                        class="import-status importing"
                        data-testid="importing-indicator"
                      >
                        ⏳ Importing...
                      </span>
                    {:else}
                      <button
                        class="import-button"
                        title={dayPlanningMode
                          ? "Add to today"
                          : "Import this pull request as a task"}
                        onclick={() => importPullRequest(pr)}
                        data-testid={dayPlanningMode
                          ? "add-to-today-button"
                          : "pr-import-button"}
                      >
                        {dayPlanningMode ? "Add to today" : "Import"}
                      </button>
                    {/if}
                  </div>
                </div>
              {/if}
            </div>
          {/each}
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .issue-item.imported {
    background-color: var(--background-modifier-success-hover, #d4edda);
    border-left: 3px solid var(--text-success, #28a745);
  }
</style>
