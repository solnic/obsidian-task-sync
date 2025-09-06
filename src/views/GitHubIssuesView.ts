/**
 * GitHub Issues View Component
 * Custom ItemView for displaying GitHub issues in the sidebar
 */

import { ItemView, WorkspaceLeaf } from 'obsidian';
import { GitHubService, GitHubIssue, GitHubRepository } from '../services/GitHubService';
import { GitHubIntegrationSettings } from '../components/ui/settings/types';

export const GITHUB_ISSUES_VIEW_TYPE = 'github-issues';

export interface GitHubIssuesViewSettings {
  githubIntegration: GitHubIntegrationSettings;
}

/**
 * Custom view for browsing GitHub issues
 */
export class GitHubIssuesView extends ItemView {
  private githubService: GitHubService;
  private settings: GitHubIssuesViewSettings;
  private issues: GitHubIssue[] = [];
  private repositories: GitHubRepository[] = [];
  private currentRepository: string = '';
  private currentState: 'open' | 'closed' | 'all' = 'open';
  private searchQuery: string = '';
  private error: string | null = null;
  private isLoading: boolean = false;

  constructor(leaf: WorkspaceLeaf, githubService: GitHubService, settings: GitHubIssuesViewSettings) {
    super(leaf);
    this.githubService = githubService;
    this.settings = settings;
    this.currentRepository = settings.githubIntegration.defaultRepository;
    this.currentState = settings.githubIntegration.issueFilters.state;
  }

  getViewType(): string {
    return GITHUB_ISSUES_VIEW_TYPE;
  }

  getDisplayText(): string {
    return 'Task Sync';
  }

  getIcon(): string {
    return 'github';
  }

  async onOpen(): Promise<void> {
    this.containerEl.empty();
    this.containerEl.addClass('github-issues-view');

    this.renderView();

    if (this.githubService.isEnabled()) {
      // Load repositories first to populate the selector
      await this.loadRepositories();

      // Then load issues if we have a current repository
      if (this.currentRepository) {
        await this.loadIssues();
      }
    }
  }

  async onClose(): Promise<void> {
    // Cleanup if needed
  }

  /**
   * Render the main view structure
   */
  private renderView(): void {
    this.containerEl.empty();

    // Header section
    const header = this.containerEl.createDiv('github-issues-header');
    this.renderHeader(header);

    // Content section
    const content = this.containerEl.createDiv('github-issues-content');
    this.renderContent(content);
  }

  /**
   * Render the header with tabs and controls
   */
  private renderHeader(container: HTMLElement): void {
    // Tab header (Issues, PRs, Projects)
    const tabHeader = container.createDiv('tab-header');

    const issuesTab = tabHeader.createDiv('tab-item active');
    issuesTab.setAttribute('data-tab', 'issues');
    issuesTab.textContent = 'Issues';

    // Repository selector
    const repoSection = container.createDiv('repository-selector');
    const repoSelect = repoSection.createEl('select');

    if (this.settings.githubIntegration.repositories.length > 0) {
      this.settings.githubIntegration.repositories.forEach(repo => {
        const option = repoSelect.createEl('option');
        option.value = repo;
        option.textContent = repo;
        if (repo === this.currentRepository) {
          option.selected = true;
        }
      });
    } else if (this.currentRepository) {
      const option = repoSelect.createEl('option');
      option.value = this.currentRepository;
      option.textContent = this.currentRepository;
      option.selected = true;
    }

    repoSelect.addEventListener('change', async (e) => {
      const target = e.target as HTMLSelectElement;
      await this.setRepository(target.value);
    });

    // Issue filters
    const filtersSection = container.createDiv('issue-filters');

    // State filters
    const stateFilters = filtersSection.createDiv('state-filters');

    const openFilter = stateFilters.createDiv('state-filter');
    openFilter.setAttribute('data-state', 'open');
    openFilter.textContent = 'Open';
    if (this.currentState === 'open') {
      openFilter.addClass('active');
    }

    const closedFilter = stateFilters.createDiv('state-filter');
    closedFilter.setAttribute('data-state', 'closed');
    closedFilter.textContent = 'Closed';
    if (this.currentState === 'closed') {
      closedFilter.addClass('active');
    }

    openFilter.addEventListener('click', () => this.setStateFilter('open'));
    closedFilter.addEventListener('click', () => this.setStateFilter('closed'));

    // Search input
    const searchInput = filtersSection.createEl('input', { type: 'text', cls: 'search-input' });
    searchInput.placeholder = 'Search issues...';
    searchInput.value = this.searchQuery;
    searchInput.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      this.searchQuery = target.value;
      this.renderIssuesList();
    });

    // Refresh button
    const refreshButton = filtersSection.createEl('button', { cls: 'refresh-button' });
    refreshButton.textContent = '↻';
    refreshButton.title = 'Refresh';
    refreshButton.addEventListener('click', () => this.refresh());
  }

  /**
   * Render the main content area
   */
  private renderContent(container: HTMLElement): void {
    if (!this.githubService.isEnabled()) {
      this.renderDisabledState(container);
      return;
    }

    if (this.error) {
      this.renderErrorState(container);
      return;
    }

    if (this.isLoading) {
      this.renderLoadingState(container);
      return;
    }

    this.renderIssuesList(container);
  }

  /**
   * Render disabled state
   */
  private renderDisabledState(container: HTMLElement): void {
    const message = container.createDiv('disabled-message');
    message.textContent = 'GitHub integration is not enabled. Please configure it in settings.';
  }

  /**
   * Render error state
   */
  private renderErrorState(container: HTMLElement): void {
    const message = container.createDiv('error-message');
    message.textContent = this.error || 'An error occurred while loading issues.';
  }

  /**
   * Render loading state
   */
  private renderLoadingState(container: HTMLElement): void {
    const message = container.createDiv('loading-indicator');
    message.textContent = 'Loading issues...';
  }

  /**
   * Render the issues list
   */
  private renderIssuesList(container?: HTMLElement): void {
    if (!container) {
      const contentEl = this.containerEl.querySelector('.github-issues-content') as HTMLElement;
      if (contentEl) {
        contentEl.empty();
        this.renderIssuesList(contentEl);
      }
      return;
    }

    const issuesList = container.createDiv('issues-list');
    const filteredIssues = this.getFilteredIssues();

    if (filteredIssues.length === 0) {
      const emptyMessage = issuesList.createDiv('empty-message');
      emptyMessage.textContent = 'No issues found.';
      return;
    }

    filteredIssues.forEach(issue => {
      const issueItem = issuesList.createDiv('issue-item');

      const issueTitle = issueItem.createDiv('issue-title');
      issueTitle.textContent = issue.title;

      const issueNumber = issueItem.createDiv('issue-number');
      issueNumber.textContent = `#${issue.number}`;

      const issueMeta = issueItem.createDiv('issue-meta');
      if (issue.assignee) {
        issueMeta.textContent += `Assigned to ${issue.assignee.login} • `;
      }
      issueMeta.textContent += `${issue.state} • ${new Date(issue.created_at).toLocaleDateString()}`;

      if (issue.labels.length > 0) {
        const labelsContainer = issueItem.createDiv('issue-labels');
        issue.labels.forEach(label => {
          const labelEl = labelsContainer.createSpan('issue-label');
          labelEl.textContent = label.name;
        });
      }
    });
  }

  /**
   * Get filtered issues based on current filters
   */
  private getFilteredIssues(): GitHubIssue[] {
    let filtered = this.filterIssues(this.currentState);

    if (this.searchQuery) {
      filtered = this.searchIssues(this.searchQuery, filtered);
    }

    return filtered;
  }

  /**
   * Filter issues by state
   */
  filterIssues(state: 'open' | 'closed' | 'all'): GitHubIssue[] {
    if (state === 'all') {
      return this.issues;
    }
    return this.issues.filter(issue => issue.state === state);
  }

  /**
   * Search issues by title and body
   */
  searchIssues(query: string, issues?: GitHubIssue[]): GitHubIssue[] {
    const searchIn = issues || this.issues;
    const lowerQuery = query.toLowerCase();

    return searchIn.filter(issue =>
      issue.title.toLowerCase().includes(lowerQuery) ||
      (issue.body && issue.body.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Load repositories from GitHub and update settings
   */
  async loadRepositories(): Promise<void> {
    if (!this.githubService.isEnabled()) {
      return;
    }

    try {
      const repositories = await this.githubService.fetchRepositories();
      const repositoryNames = repositories.map(repo => repo.full_name);

      // Update settings with fetched repositories
      this.settings.githubIntegration.repositories = repositoryNames;

      // Save settings through the plugin
      const plugin = (window as any).app?.plugins?.plugins?.['obsidian-task-sync'];
      if (plugin) {
        await plugin.saveSettings();
      }

      // Re-render to update repository selector
      this.renderView();
    } catch (error: any) {
      console.error('Failed to load repositories:', error);
      this.error = error.message || 'Failed to load repositories';
      this.renderView();
    }
  }

  /**
   * Load issues from GitHub
   */
  async loadIssues(): Promise<void> {
    if (!this.currentRepository || !this.githubService.isEnabled()) {
      return;
    }

    this.isLoading = true;
    this.error = null;
    this.renderView();

    try {
      this.issues = await this.githubService.fetchIssues(this.currentRepository);
      this.isLoading = false;
      this.renderView();
    } catch (error: any) {
      this.error = error.message || 'Failed to load issues';
      this.isLoading = false;
      this.renderView();
    }
  }

  /**
   * Set the current repository and reload issues
   */
  async setRepository(repository: string): Promise<void> {
    this.currentRepository = repository;
    await this.loadIssues();
  }

  /**
   * Set the state filter and re-render
   */
  private setStateFilter(state: 'open' | 'closed'): void {
    this.currentState = state;

    // Update active state in UI
    const stateFilters = this.containerEl.querySelectorAll('.state-filter');
    stateFilters.forEach(filter => {
      filter.removeClass('active');
      if (filter.getAttribute('data-state') === state) {
        filter.addClass('active');
      }
    });

    this.renderIssuesList();
  }

  /**
   * Refresh repositories and issues
   */
  async refresh(): Promise<void> {
    // Load repositories first to populate the selector
    await this.loadRepositories();

    // Then load issues if we have a current repository
    if (this.currentRepository) {
      await this.loadIssues();
    }
  }

  /**
   * Update settings and refresh if needed
   */
  updateSettings(settings: GitHubIssuesViewSettings): void {
    this.settings = settings;
    this.githubService.updateSettings(settings);

    if (settings.githubIntegration.defaultRepository !== this.currentRepository) {
      this.currentRepository = settings.githubIntegration.defaultRepository;
      this.loadIssues();
    }
  }
}
