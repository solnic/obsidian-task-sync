<script lang="ts">
  import { onMount, onDestroy } from "svelte";
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
  let currentUser = $state<{
    login: string;
    id: number;
    avatar_url: string;
  } | null>(null);
  let recentlyUsedOrgs = $state<string[]>([]);
  let recentlyUsedRepos = $state<string[]>([]);

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

  // Computed repository display options - show just repo name when org is selected
  let repositoryDisplayOptions = $derived.by(() => {
    if (currentOrganization) {
      // When an org is selected, show just the repo name
      return sortedRepositories.map((repo) => repo.name);
    } else {
      // When no org is selected, show full name
      return sortedRepositories.map((repo) => repo.full_name);
    }
  });

  // Computed current repository display value
  let currentRepositoryDisplay = $derived.by(() => {
    if (!currentRepository) {
      return "Select repository";
    }

    if (
      currentOrganization &&
      currentRepository.startsWith(currentOrganization + "/")
    ) {
      // Show just the repo name when org is selected
      return currentRepository.split("/")[1];
    } else {
      // Show full name when no org is selected
      return currentRepository;
    }
  });

  let availableOrganizations = $derived.by(() => {
    // Use organizations from GitHub API, not just derived from repositories
    const orgSet = new Set<string>();

    // Add organizations from the GitHub API
    organizations.forEach((org) => {
      orgSet.add(org.login);
    });

    // Also add any organizations found in repositories (for personal repos)
    repositories.forEach((repo) => {
      const org = repo.full_name.split("/")[0];
      orgSet.add(org);
    });

    const orgs = Array.from(orgSet).sort();
    console.log(
      `🐙 UI: Available organizations from API (${organizations.length}) + repositories (${repositories.length}):`,
      orgs
    );
    return orgs;
  });

  // Computed organization options with recently used at the top
  let organizationOptions = $derived.by(() => {
    const allOrgs = availableOrganizations;
    const recentOrgs = recentlyUsedOrgs.filter((org) => allOrgs.includes(org));
    const otherOrgs = allOrgs.filter((org) => !recentOrgs.includes(org));

    const options: string[] = [];
    if (recentOrgs.length > 0) {
      options.push(...recentOrgs);
      if (otherOrgs.length > 0) {
        options.push("---"); // Separator
        options.push(...otherOrgs);
      }
    } else {
      options.push(...otherOrgs);
    }

    console.log(`🐙 UI: Organization options computed:`, options);
    return options;
  });

  // Computed repository options with recently used at the top
  let repositoryOptionsWithRecent = $derived.by(() => {
    const allOptions = repositoryDisplayOptions;
    const recentRepos = recentlyUsedRepos
      .filter((repo) => {
        // Check if the repo exists in current filtered repositories
        if (currentOrganization) {
          // When org is selected, check if repo name exists
          return sortedRepositories.some(
            (r) => r.name === repo || r.full_name === repo
          );
        } else {
          // When no org is selected, check full names
          return sortedRepositories.some((r) => r.full_name === repo);
        }
      })
      .map((repo) => {
        // Convert to display format
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
        options.push("---"); // Separator
        options.push(...otherOptions);
      }
    } else {
      options.push(...otherOptions);
    }

    return options;
  });

  onMount(async () => {
    console.log("🐙 INIT: GitHub component mounting...");
    if (githubService.isEnabled()) {
      console.log(
        "🐙 INIT: GitHub service is enabled, starting initialization..."
      );
      try {
        // First, load recently used filters to restore state
        console.log("🐙 INIT: Loading recently used filters...");
        await loadRecentlyUsedFilters();

        // Then load other data - organizations first, then repositories
        console.log("🐙 INIT: Starting parallel loading of user and data...");
        await Promise.all([
          loadCurrentUser(),
          loadOrganizations().then(async () => {
            console.log(
              "🐙 INIT: Organizations loaded, now loading repositories..."
            );
            await loadRepositories();
            if (currentRepository) {
              console.log(
                `🐙 INIT: Loading issues and labels for repository: ${currentRepository}`
              );
              await loadIssues();
              await loadLabels();
            } else {
              console.log("🐙 INIT: No current repository set");
            }
          }),
        ]);

        console.log("🐙 INIT: Refreshing import status...");
        refreshImportStatus();
        console.log("🐙 INIT: GitHub component initialization completed");
      } catch (err: any) {
        console.error(
          "🐙 INIT: Failed to initialize GitHub component:",
          err.message
        );
        error = err.message || "Failed to load GitHub data";
      }
    } else {
      console.log("🐙 INIT: GitHub service is not enabled");
    }
  });

  // Watch for changes in the task store and refresh import status
  $effect(() => {
    // This effect will run whenever the task store changes
    taskStore.getEntities(); // Access entities to trigger reactivity
    // Refresh import status whenever task store entities change
    refreshImportStatus();
  });

  onDestroy(() => {
    // Save current filter state when component is destroyed
    saveRecentlyUsedFilters();
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

  async function loadCurrentUser(): Promise<void> {
    if (!githubService.isEnabled()) {
      return;
    }

    try {
      currentUser = await githubService.getCurrentUser();
    } catch (err: any) {
      console.warn("Failed to load current user:", err.message);
      currentUser = null;
    }
  }

  function getCurrentUser(): string | null {
    return currentUser?.login || null;
  }

  async function loadRecentlyUsedFilters(): Promise<void> {
    try {
      const data = await plugin.loadData();
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
      }
    } catch (err: any) {
      console.warn("Failed to load recently used filters:", err.message);
    }
  }

  async function saveRecentlyUsedFilters(): Promise<void> {
    try {
      const data = (await plugin.loadData()) || {};
      data.githubRecentlyUsed = {
        organizations: recentlyUsedOrgs,
        repositories: recentlyUsedRepos,
      };
      // Also save current filter selections
      data.githubCurrentFilters = {
        organization: currentOrganization,
        repository: currentRepository,
      };
      await plugin.saveData(data);
    } catch (err: any) {
      console.warn("Failed to save recently used filters:", err.message);
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
      const currentUser = getCurrentUser();
      if (currentUser) {
        filtered = filtered.filter(
          (issue) => issue.assignee?.login === currentUser
        );
      } else {
        // If no current user is available, show no results when "assigned to me" is active
        filtered = [];
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
      } else {
        // If no current user is available, show no results when "assigned to me" is active
        filtered = [];
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

  async function loadOrganizations(): Promise<void> {
    if (!githubService.isEnabled()) {
      console.log(
        "🐙 GitHub service not enabled, skipping organization loading"
      );
      return;
    }

    console.log("🐙 Loading organizations...");
    try {
      const orgs = await githubService.fetchOrganizations();
      console.log(
        `🐙 Loaded ${orgs.length} organizations:`,
        orgs.map((org) => org.login)
      );
      organizations = orgs;
    } catch (err: any) {
      console.error("🐙 Failed to load organizations:", err.message);
      organizations = [];
    }
  }

  async function loadRepositories(): Promise<void> {
    if (!githubService.isEnabled()) {
      console.log("🐙 GitHub service not enabled, skipping repository loading");
      return;
    }

    console.log("🐙 Loading repositories...");
    try {
      // Load user repositories
      console.log("🐙 Loading user repositories...");
      const userRepos = await githubService.fetchRepositories();
      console.log(
        `🐙 Loaded ${userRepos.length} user repositories:`,
        userRepos.map((repo) => repo.full_name)
      );

      // Load organization repositories
      console.log(
        `🐙 Loading repositories for ${organizations.length} organizations...`
      );
      const orgRepos: GitHubRepository[] = [];
      for (const org of organizations) {
        try {
          console.log(`🐙 Loading repositories for organization: ${org.login}`);
          const repos = await githubService.fetchRepositoriesForOrganization(
            org.login
          );
          console.log(
            `🐙 Loaded ${repos.length} repositories for ${org.login}:`,
            repos.map((repo) => repo.full_name)
          );
          orgRepos.push(...repos);
        } catch (err: any) {
          console.error(
            `🐙 Failed to load repositories for organization ${org.login}:`,
            err.message
          );
        }
      }

      // Combine all repositories
      repositories = [...userRepos, ...orgRepos];
      console.log(
        `🐙 Total repositories loaded: ${repositories.length} (${userRepos.length} user + ${orgRepos.length} org)`
      );

      const repositoryNames = repositories.map(
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
      console.error("🐙 Failed to load repositories:", err.message);
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
    currentRepository = repository;

    if (repository) {
      // Track recently used repository
      addRecentlyUsedRepo(repository);
    }

    // Save current filter state
    saveRecentlyUsedFilters();

    if (repository) {
      await loadIssues();
      await loadLabels();
      if (activeTab === "pull-requests") {
        await loadPullRequests();
      }
    } else {
      // No repository selected - clear data and show message
      issues = [];
      pullRequests = [];
      availableLabels = [];
    }
  }

  function setStateFilter(state: "open" | "closed"): void {
    currentState = state;
  }

  function toggleAssignedToMe(): void {
    assignedToMe = !assignedToMe;
    // Update the settings to persist the filter
    settings.githubIntegration.issueFilters.assignee = assignedToMe ? "me" : "";
    // No need to reload data - filtering is reactive and happens client-side
  }

  function setLabelsFilter(labels: string[]): void {
    selectedLabels = labels;
    // Update the settings to persist the filter
    settings.githubIntegration.issueFilters.labels = labels;
    // No need to reload data as filtering is done client-side
  }

  function setOrganizationFilter(org: string | null): void {
    currentOrganization = org;

    // Track recently used organization
    if (org) {
      addRecentlyUsedOrg(org);
    }

    // Save current filter state
    saveRecentlyUsedFilters();

    // Reset repository selection when changing organization
    if (org && !currentRepository.startsWith(org + "/")) {
      const firstRepoInOrg = filteredRepositories[0];
      if (firstRepoInOrg) {
        setRepository(firstRepoInOrg.full_name);
      }
    }
  }

  async function refresh(): Promise<void> {
    console.log("🐙 REFRESH: Starting GitHub data refresh...");

    // Force refresh by clearing cache first
    console.log("🐙 REFRESH: Clearing cache...");
    await githubService.clearCache();

    // Reload organizations first, then repositories
    console.log("🐙 REFRESH: Loading organizations...");
    await loadOrganizations();

    console.log("🐙 REFRESH: Loading repositories...");
    await loadRepositories();

    if (currentRepository) {
      console.log(
        `🐙 REFRESH: Loading issues for repository: ${currentRepository}`
      );
      await loadIssues();
      if (activeTab === "pull-requests") {
        console.log(
          `🐙 REFRESH: Loading pull requests for repository: ${currentRepository}`
        );
        await loadPullRequests();
      }
    } else {
      console.log("🐙 REFRESH: No current repository selected");
    }

    console.log("🐙 REFRESH: Refresh completed");
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
              currentValue={currentOrganization || "Select organization"}
              options={organizationOptions}
              placeholder="Select organization"
              onselect={(value) =>
                setOrganizationFilter(value === "---" ? null : value)}
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
                  return; // Skip separator
                }
                // Convert display value back to full name
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
            {@const isImported = importedIssues.has(issue.number)}
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
            {@const isImported = importedPullRequests.has(pr.number)}
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
