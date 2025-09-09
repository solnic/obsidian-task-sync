<script lang="ts">
  import { onMount } from "svelte";
  import { getPluginContext } from "./context";
  import ContextWidget from "./ContextWidget.svelte";
  import type {
    GitHubIssue,
    GitHubRepository,
  } from "../../services/GitHubService";
  import type { GitHubIntegrationSettings } from "../ui/settings/types";
  import type { TaskImportConfig } from "../../types/integrations";

  interface Props {
    githubService: any;
    settings: { githubIntegration: GitHubIntegrationSettings };
    dependencies: {
      taskImportManager: any;
      importStatusService: any;
      getDefaultImportConfig: () => TaskImportConfig;
    };
  }

  let { githubService, settings, dependencies }: Props = $props();

  const { plugin } = getPluginContext();

  // State
  let issues = $state<GitHubIssue[]>([]);
  let repositories = $state<GitHubRepository[]>([]);
  let currentRepository = $state(settings.githubIntegration.defaultRepository);
  let currentState = $state<"open" | "closed" | "all">(
    settings.githubIntegration.issueFilters.state
  );
  let searchQuery = $state("");
  let error = $state<string | null>(null);
  let isLoading = $state(false);
  let importingIssues = $state(new Set<number>());
  let importedIssues = $state(new Set<number>());
  let hoveredIssue = $state<number | null>(null);

  // Computed
  let filteredIssues = $derived.by(() => {
    let filtered = filterIssues(currentState);
    if (searchQuery) {
      filtered = searchIssues(searchQuery, filtered);
    }
    return filtered;
  });

  let sortedRepositories = $derived.by(() => {
    return [...repositories].sort((a, b) => {
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

  function filterIssues(state: "open" | "closed" | "all"): GitHubIssue[] {
    if (state === "all") {
      return issues;
    }
    return issues.filter((issue) => issue.state === state);
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

      // Load import status for all issues
      const importedNumbers = new Set<number>();
      for (const issue of issues) {
        if (
          dependencies.importStatusService.isTaskImported(
            `github-${issue.id}`,
            "github"
          )
        ) {
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

  async function setRepository(repository: string): Promise<void> {
    currentRepository = repository;
    await loadIssues();
  }

  function setStateFilter(state: "open" | "closed"): void {
    currentState = state;
  }

  async function refresh(): Promise<void> {
    await loadRepositories();
    if (currentRepository) {
      await loadIssues();
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
      } else {
        plugin.app.workspace.trigger(
          "notice",
          `Failed to import issue: ${result.error}`
        );
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
      (window as any).__githubIssuesViewMethods = {
        updateSettings,
        refresh,
      };
    }
  });
</script>

<div class="github-issues-view" data-type="github-issues">
  <!-- Context Widget -->
  <ContextWidget />

  <!-- Header Section -->
  <div class="github-issues-header">
    <!-- Tab header -->
    <div class="tab-header">
      <div class="tab-item active" data-tab="issues" data-testid="issues-tab">
        Issues
      </div>
    </div>

    <!-- Repository selector -->
    <div class="repository-selector">
      <select
        bind:value={currentRepository}
        onchange={() => setRepository(currentRepository)}
        data-testid="repository-select"
      >
        {#each sortedRepositories as repo}
          <option value={repo.full_name}>{repo.full_name}</option>
        {/each}
        {#if currentRepository && !sortedRepositories.find((r) => r.full_name === currentRepository)}
          <option value={currentRepository}>{currentRepository}</option>
        {/if}
      </select>
    </div>

    <!-- Issue filters -->
    <div class="issue-filters">
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
        placeholder="Search issues..."
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
      <div class="loading-indicator">Loading issues...</div>
    {:else}
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
                {@const isImported =
                  dependencies.importStatusService.isTaskImported(
                    `github-${issue.id}`,
                    "github"
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
                        title="Import this issue as a task"
                        onclick={() => importIssue(issue)}
                        data-testid="issue-import-button"
                      >
                        Import
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
