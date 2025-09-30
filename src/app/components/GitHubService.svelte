<script lang="ts">
  /**
   * GitHubService component for the new architecture
   * Provides GitHub issue/PR listing and import functionality
   */

  import { onMount } from "svelte";
  import SearchInput from "./SearchInput.svelte";
  import RefreshButton from "./RefreshButton.svelte";
  import SortDropdown from "./SortDropdown.svelte";
  import type { TaskSyncSettings } from "../types/settings";
  import type { Extension } from "../core/extension";
  import type { Host } from "../core/host";
  import type {
    GitHubIssue,
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
  let repositories = $state<GitHubRepository[]>([]);
  let organizations = $state<GitHubOrganization[]>([]);
  let currentRepository = $state(
    settings.integrations.github.defaultRepository
  );
  let currentOrganization = $state<string | null>(null);
  let currentState = $state<"open" | "closed" | "all">(
    settings.integrations.github.issueFilters.state
  );
  let searchQuery = $state("");
  let error = $state<string | null>(null);
  let isLoading = $state(false);
  let hoveredIssue = $state<number | null>(null);

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

  onMount(async () => {
    isLoading = true;

    if (githubExtension.isEnabled()) {
      await Promise.all([loadRepositories(), loadOrganizations()]);

      if (currentRepository) {
        await loadIssues();
      }
    }

    isLoading = false;
  });

  async function loadRepositories(): Promise<void> {
    try {
      const userRepos = await githubExtension.fetchRepositories();
      repositories = userRepos;
    } catch (err: any) {
      console.error("Failed to load repositories:", err);
      error = err.message;
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

  async function loadIssues(): Promise<void> {
    if (!currentRepository) return;

    try {
      isLoading = true;
      error = null;
      const fetchedIssues = await githubExtension.fetchIssues(currentRepository);
      issues = fetchedIssues;
    } catch (err: any) {
      console.error("Failed to load issues:", err);
      error = err.message;
      issues = [];
    } finally {
      isLoading = false;
    }
  }

  async function refresh(): Promise<void> {
    await githubExtension.clearCache();
    await loadRepositories();
    await loadOrganizations();
    if (currentRepository) {
      await loadIssues();
    }
  }

  function setActiveTab(tab: "issues" | "pull-requests"): void {
    activeTab = tab;
  }

  function setStateFilter(state: "open" | "closed" | "all"): void {
    currentState = state;
  }

  // Computed filtered and sorted issues
  let filteredAndSortedIssues = $derived.by(() => {
    let filtered = issues;

    // Filter by state
    if (currentState !== "all") {
      filtered = filtered.filter((issue) => issue.state === currentState);
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

  function handleSortChange(newSortFields: SortField[]): void {
    sortFields = newSortFields;
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
      </div>
    </div>
  </div>

  <!-- Issues List -->
  {#if activeTab === "issues"}
    <div class="github-issues-list" data-testid="github-issues-list">
      {#if isLoading}
        <div class="loading-message">Loading issues...</div>
      {:else if error}
        <div class="error-message">{error}</div>
      {:else if filteredAndSortedIssues.length === 0}
        <div class="empty-message">No issues found</div>
      {:else}
        {#each filteredAndSortedIssues as issue (issue.id)}
          <div
            class="github-issue-item"
            data-testid="github-issue-item"
            data-issue-number={issue.number}
          >
            <div class="issue-header">
              <span class="issue-number">#{issue.number}</span>
              <span class="issue-title">{issue.title}</span>
              <span class="issue-state issue-state--{issue.state}">
                {issue.state}
              </span>
            </div>
          </div>
        {/each}
      {/if}
    </div>
  {/if}
</div>

