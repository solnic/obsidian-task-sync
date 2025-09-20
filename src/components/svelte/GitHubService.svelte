<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { Notice } from "obsidian";
  import { getPluginContext } from "./context";
  import FilterButton from "./FilterButton.svelte";
  import SearchInput from "./SearchInput.svelte";
  import SortDropdown from "./SortDropdown.svelte";
  import GitHubIssueItem from "./GitHubIssueItem.svelte";
  import GitHubPullRequestItem from "./GitHubPullRequestItem.svelte";
  import type {
    GitHubIssue,
    GitHubPullRequest,
    GitHubRepository,
    GitHubOrganization,
    GitHubLabel,
    GitHubService,
  } from "../../services/GitHubService";
  import type { GitHubIntegrationSettings } from "../ui/settings/types";
  import type { TaskImportConfig } from "../../types/integrations";
  import type { ImportResult } from "../../types/integrations";
  import { taskStore } from "../../stores/taskStore";
  import { scheduleTaskForToday } from "../../stores/dailyPlanningStore";
  import { TaskImportManager } from "../../services/TaskImportManager";

  interface SortField {
    key: string;
    label: string;
    direction: "asc" | "desc";
  }

  interface Props {
    githubService: GitHubService;
    settings: { githubIntegration: GitHubIntegrationSettings };
    dependencies: {
      taskImportManager: TaskImportManager;
      getDefaultImportConfig: () => TaskImportConfig;
    };
    dayPlanningMode?: boolean;
    dailyPlanningWizardMode?: boolean;
  }

  let {
    githubService,
    settings,
    dependencies,
    dayPlanningMode = false,
    dailyPlanningWizardMode = false,
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
    { key: "assignee", label: "Assignee" },
  ];

  // Computed
  let filteredIssues = $derived.by(() => {
    let filtered = filterIssues(currentState, assignedToMe, selectedLabels);
    if (searchQuery) {
      filtered = searchIssues(searchQuery, filtered);
    }
    if (sortFields.length > 0) {
      filtered = sortGitHubItems(filtered, sortFields);
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
    if (sortFields.length > 0) {
      filtered = sortGitHubItems(filtered, sortFields);
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
    isLoading = true;

    if (githubService.isEnabled()) {
      await loadRecentlyUsedFilters();

      await Promise.all([
        loadCurrentUser(),

        loadOrganizations().then(async () => {
          await loadRepositories();

          if (currentRepository) {
            await loadIssues();
            await loadLabels();
          }
        }),
      ]);

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
      const data = (await plugin.loadData()) || {};
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

  function handleSortChange(newSortFields: SortField[]): void {
    sortFields = newSortFields;
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

  function sortGitHubItems<T extends GitHubIssue | GitHubPullRequest>(
    items: T[],
    sortFields: SortField[]
  ): T[] {
    return [...items].sort((a, b) => {
      for (const field of sortFields) {
        let aValue: any;
        let bValue: any;

        // Get values based on field key
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
          case "assignee":
            aValue = a.assignee?.login || "";
            bValue = b.assignee?.login || "";
            break;
          default:
            aValue = "";
            bValue = "";
        }

        // Compare values
        let comparison = 0;
        if (typeof aValue === "string" && typeof bValue === "string") {
          comparison = aValue.localeCompare(bValue);
        } else if (typeof aValue === "number" && typeof bValue === "number") {
          comparison = aValue - bValue;
        } else {
          // Handle mixed types by converting to strings
          comparison = String(aValue).localeCompare(String(bValue));
        }

        // Apply direction
        if (field.direction === "desc") {
          comparison = -comparison;
        }

        // If not equal, return the comparison result
        if (comparison !== 0) {
          return comparison;
        }
      }

      // If all fields are equal, maintain original order
      return 0;
    });
  }

  async function loadOrganizations(): Promise<void> {
    const orgs = await githubService.fetchOrganizations();

    organizations = orgs;
  }

  async function loadRepositories(): Promise<void> {
    const userRepos = await githubService.fetchRepositories();
    const orgRepos: GitHubRepository[] = [];

    for (const org of organizations) {
      const repos = await githubService.fetchRepositoriesForOrganization(
        org.login
      );
      orgRepos.push(...repos);
    }

    repositories = [...userRepos, ...orgRepos];

    const repositoryNames = repositories.map(
      (repo: GitHubRepository) => repo.full_name
    );

    settings.githubIntegration.repositories = repositoryNames;

    if (!currentRepository && settings.githubIntegration.defaultRepository) {
      currentRepository = settings.githubIntegration.defaultRepository;
    }

    const pluginInstance = (window as any).app?.plugins?.plugins?.[
      "obsidian-task-sync"
    ];

    if (pluginInstance) {
      await pluginInstance.saveSettings(true); // Skip template update
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
      // Clear selected labels since no repository is selected
      selectedLabels = [];
      setLabelsFilter([]);
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

  async function refresh(): Promise<void> {
    await githubService.clearCache();

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

  async function importIssue(issue: GitHubIssue): Promise<void> {
    try {
      importingIssues.add(issue.number);
      importingIssues = new Set(importingIssues);

      const config = dependencies.getDefaultImportConfig();
      const result = (await githubService.importIssueAsTask(
        issue,
        config,
        currentRepository
      )) as ImportResult;

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

      // Handle day planning modes
      const taskFilePath = result.taskFilePath;

      if (taskFilePath) {
        if (dailyPlanningWizardMode) {
          // In wizard mode, add to daily planning store for staging
          try {
            // Wait for the task store to be refreshed and find the imported task
            await taskStore.refreshTasks();
            const tasks = taskStore.getEntities();
            const importedTask = tasks.find(
              (task) => task.filePath === taskFilePath
            );

            if (importedTask) {
              scheduleTaskForToday(importedTask);
              new Notice(
                `Scheduled "${issue.title}" for today (pending confirmation)`
              );
            }
          } catch (err: any) {
            new Notice(
              `Error scheduling for today: ${err.message || "Unknown error"}`
            );
          }
        } else if (dayPlanningMode) {
          // In regular day planning mode, add to today's daily note immediately
          try {
            const dailyResult =
              await plugin.dailyNoteService.addTaskToToday(taskFilePath);
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
      const result = await githubService.importPullRequestAsTask(
        pr,
        config,
        currentRepository
      );

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

        if (dailyPlanningWizardMode) {
          // In wizard mode, add to daily planning store for staging
          try {
            const tasks = taskStore.getEntities();
            const importedTask = tasks.find(
              (task) => task.filePath === result.taskFilePath
            );
            if (importedTask) {
              scheduleTaskForToday(importedTask);
              new Notice(
                `Scheduled "${pr.title}" for today (pending confirmation)`
              );
            }
          } catch (err: any) {
            console.error("Error scheduling for today:", err);
            new Notice(
              `Error scheduling for today: ${err.message || "Unknown error"}`
            );
          }
        } else if (dayPlanningMode) {
          // In regular day planning mode, add to today's daily note immediately
          try {
            const dailyResult = await plugin.dailyNoteService.addTaskToToday(
              result.taskFilePath
            );
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
                  return; // Skip separator
                }
                if (value === "" || value === "Select repository") {
                  setRepository(null);
                  return;
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
            {@const importedTask = isImported
              ? taskStore
                  .getEntities()
                  .find(
                    (task) =>
                      task.source?.url === issue.html_url ||
                      (task.source?.name === "GitHub" &&
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
              {dayPlanningMode}
              {dailyPlanningWizardMode}
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
            {@const importedTask = isImported
              ? taskStore
                  .getEntities()
                  .find(
                    (task) =>
                      task.source?.url === pr.html_url ||
                      (task.source?.name === "GitHub" &&
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
              {dayPlanningMode}
              {dailyPlanningWizardMode}
              testId="pr-item"
            />
          {/each}
        {/if}
      </div>
    {/if}
  </div>
</div>
