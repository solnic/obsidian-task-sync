/**
 * GitHub Issues View Component
 * Custom ItemView for displaying GitHub issues in the sidebar
 */

import { ItemView, WorkspaceLeaf, Notice } from 'obsidian';
import { GitHubService, GitHubIssue, GitHubRepository } from '../services/GitHubService';
import { GitHubIntegrationSettings } from '../components/ui/settings/types';
import { TaskImportManager } from '../services/TaskImportManager';
import { ImportStatusService } from '../services/ImportStatusService';
import { TaskImportConfig } from '../types/integrations';

export const GITHUB_ISSUES_VIEW_TYPE = 'github-issues';

export interface GitHubIssuesViewSettings {
  githubIntegration: GitHubIntegrationSettings;
}

export interface GitHubIssuesViewDependencies {
  taskImportManager: TaskImportManager;
  importStatusService: ImportStatusService;
}

/**
 * Custom view for browsing GitHub issues
 */
export class GitHubIssuesView extends ItemView {
  private githubService: GitHubService;
  private settings: GitHubIssuesViewSettings;
  private dependencies: GitHubIssuesViewDependencies;
  private issues: GitHubIssue[] = [];
  private repositories: GitHubRepository[] = [];
  private currentRepository: string = '';
  private currentState: 'open' | 'closed' | 'all' = 'open';
  private searchQuery: string = '';
  private error: string | null = null;
  private isLoading: boolean = false;
  private importingIssues: Set<number> = new Set(); // Track which issues are being imported

  constructor(leaf: WorkspaceLeaf, githubService: GitHubService, settings: GitHubIssuesViewSettings, dependencies: GitHubIssuesViewDependencies) {
    console.log('🔧 GitHubIssuesView constructor called');
    console.log('🔧 GitHubIssuesView constructor - settings:', JSON.stringify(settings, null, 2));

    super(leaf);
    this.githubService = githubService;
    this.settings = settings;
    this.dependencies = dependencies;
    this.currentRepository = settings.githubIntegration.defaultRepository;
    this.currentState = settings.githubIntegration.issueFilters.state;

    console.log('✅ GitHubIssuesView constructor completed');
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
    console.log('🔧 GitHubIssuesView.onOpen() called');

    this.containerEl.empty();
    this.containerEl.addClass('github-issues-view');
    // Ensure data-type attribute is set for e2e tests
    this.containerEl.setAttribute('data-type', GITHUB_ISSUES_VIEW_TYPE);

    console.log('🔧 GitHubIssuesView: Container setup complete, calling renderView()');
    this.renderView();

    console.log('🔧 GitHubIssuesView: renderView() complete, checking GitHub service');
    console.log('🔧 GitHubIssuesView: GitHub service enabled:', this.githubService.isEnabled());

    if (this.githubService.isEnabled()) {
      console.log('🔧 GitHubIssuesView: Loading repositories...');
      // Load repositories asynchronously without blocking the view rendering
      this.loadRepositories().then(() => {
        console.log('🔧 GitHubIssuesView: Repository loading completed');
        // Then load issues if we have a current repository
        if (this.currentRepository) {
          console.log('🔧 GitHubIssuesView: Loading issues for repository:', this.currentRepository);
          return this.loadIssues();
        } else {
          console.log('🔧 GitHubIssuesView: No current repository set');
        }
      }).catch((error) => {
        console.error('❌ GitHubIssuesView: Error during async loading:', error);
        this.error = error.message || 'Failed to load GitHub data';
        this.renderView();
      });
    } else {
      console.log('🔧 GitHubIssuesView: GitHub service not enabled, showing disabled state');
    }

    console.log('✅ GitHubIssuesView.onOpen() completed');
  }

  async onClose(): Promise<void> {
    // Cleanup if needed
  }

  /**
   * Render the main view structure
   */
  private renderView(): void {
    console.log('🔧 GitHubIssuesView.renderView() called');

    this.containerEl.empty();

    // Re-add the class and data-type attribute after emptying
    this.containerEl.addClass('github-issues-view');
    this.containerEl.setAttribute('data-type', GITHUB_ISSUES_VIEW_TYPE);

    console.log('🔧 GitHubIssuesView: Creating header and content sections');

    // Header section
    const header = this.containerEl.createDiv('github-issues-header');
    console.log('🔧 GitHubIssuesView: Header div created, calling renderHeader()');
    this.renderHeader(header);

    // Content section
    const content = this.containerEl.createDiv('github-issues-content');
    console.log('🔧 GitHubIssuesView: Content div created, calling renderContent()');
    this.renderContent(content);

    console.log('✅ GitHubIssuesView.renderView() completed');

    // Debug: Check what's actually in the DOM
    setTimeout(() => {
      const headerCheck = this.containerEl.querySelector('.github-issues-header');
      const contentCheck = this.containerEl.querySelector('.github-issues-content');
      console.log('🔍 DOM Check after renderView:');
      console.log('🔍 Header element exists:', !!headerCheck);
      console.log('🔍 Content element exists:', !!contentCheck);
      console.log('🔍 Container children count:', this.containerEl.children.length);
      console.log('🔍 Container HTML:', this.containerEl.innerHTML.substring(0, 200));

      // Also check what the test is looking for
      const testViewElement = document.querySelector('[data-type="github-issues"]');
      console.log('🔍 Test view element found:', !!testViewElement);
      console.log('🔍 Test view element === this.containerEl:', testViewElement === this.containerEl);
      if (testViewElement) {
        const testHeaderCheck = testViewElement.querySelector('.github-issues-header');
        const testContentCheck = testViewElement.querySelector('.github-issues-content');
        console.log('🔍 Test view - Header exists:', !!testHeaderCheck);
        console.log('🔍 Test view - Content exists:', !!testContentCheck);
        console.log('🔍 Test view HTML:', testViewElement.innerHTML.substring(0, 200));
      }
    }, 100);
  }

  /**
   * Render the header with tabs and controls
   */
  private renderHeader(container: HTMLElement): void {
    console.log('🔧 GitHubIssuesView.renderHeader() called');

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

    // Import All button
    const importAllButton = filtersSection.createEl('button', { cls: 'import-all-button' });
    importAllButton.textContent = 'Import All';
    importAllButton.title = 'Import all visible issues as tasks';
    importAllButton.setAttribute('data-test', 'import-all-button');
    importAllButton.addEventListener('click', () => this.importAllIssues());
  }

  /**
   * Render the main content area
   */
  private renderContent(container: HTMLElement): void {
    console.log('🔧 GitHubIssuesView.renderContent() called');
    console.log('🔧 GitHubIssuesView: GitHub service enabled:', this.githubService.isEnabled());
    console.log('🔧 GitHubIssuesView: Error state:', this.error);
    console.log('🔧 GitHubIssuesView: Loading state:', this.isLoading);

    if (!this.githubService.isEnabled()) {
      console.log('🔧 GitHubIssuesView: Rendering disabled state');
      this.renderDisabledState(container);
      return;
    }

    if (this.error) {
      console.log('🔧 GitHubIssuesView: Rendering error state');
      this.renderErrorState(container);
      return;
    }

    if (this.isLoading) {
      console.log('🔧 GitHubIssuesView: Rendering loading state');
      this.renderLoadingState(container);
      return;
    }

    console.log('🔧 GitHubIssuesView: Rendering issues list');
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

      const issueContent = issueItem.createDiv('issue-content');

      const issueTitle = issueContent.createDiv('issue-title');
      issueTitle.textContent = issue.title;

      const issueNumber = issueContent.createDiv('issue-number');
      issueNumber.textContent = `#${issue.number}`;

      const issueMeta = issueContent.createDiv('issue-meta');
      if (issue.assignee) {
        issueMeta.textContent += `Assigned to ${issue.assignee.login} • `;
      }
      issueMeta.textContent += `${issue.state} • ${new Date(issue.created_at).toLocaleDateString()}`;

      if (issue.labels.length > 0) {
        const labelsContainer = issueContent.createDiv('issue-labels');
        issue.labels.forEach(label => {
          const labelEl = labelsContainer.createSpan('issue-label');
          labelEl.textContent = label.name;
        });
      }

      // Import actions container
      const actionsContainer = issueItem.createDiv('issue-actions');

      // Check if issue is already imported
      const isImported = this.dependencies.importStatusService.isTaskImported(`github-${issue.id}`, 'github');
      const isImporting = this.importingIssues.has(issue.number);

      if (isImported) {
        const importedIndicator = actionsContainer.createSpan('import-status imported');
        importedIndicator.textContent = '✓ Imported';
        importedIndicator.title = 'This issue has already been imported as a task';
      } else if (isImporting) {
        const importingIndicator = actionsContainer.createSpan('import-status importing');
        importingIndicator.textContent = '⏳ Importing...';
        importingIndicator.title = 'Import in progress';
      } else {
        const importButton = actionsContainer.createEl('button', { cls: 'import-button' });
        importButton.textContent = 'Import';
        importButton.title = 'Import this issue as a task';
        importButton.setAttribute('data-test', 'issue-import-button');
        importButton.addEventListener('click', () => this.importIssue(issue));
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
    console.log('🔧 GitHubIssuesView.loadRepositories() called');

    if (!this.githubService.isEnabled()) {
      console.log('🔧 GitHubIssuesView: GitHub service not enabled, skipping repository load');
      return;
    }

    try {
      console.log('🔧 GitHubIssuesView: Fetching repositories from GitHub...');
      const repositories = await this.githubService.fetchRepositories();
      const repositoryNames = repositories.map(repo => repo.full_name);

      console.log('🔧 GitHubIssuesView: Fetched repositories:', repositoryNames);

      // Update settings with fetched repositories
      this.settings.githubIntegration.repositories = repositoryNames;

      // Save settings through the plugin
      const plugin = (window as any).app?.plugins?.plugins?.['obsidian-task-sync'];
      if (plugin) {
        await plugin.saveSettings();
      }

      console.log('🔧 GitHubIssuesView: Updating repository selector after repository load...');
      // Update just the repository selector instead of re-rendering the entire view
      this.updateRepositorySelector();
      console.log('✅ GitHubIssuesView: Repository load completed successfully');
    } catch (error: any) {
      console.error('❌ GitHubIssuesView: Failed to load repositories:', error);
      this.error = error.message || 'Failed to load repositories';
      console.log('🔧 GitHubIssuesView: Updating view after repository load error...');
      // Update just the content area to show the error instead of re-rendering everything
      this.updateContentArea();
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
    // Update content area to show loading state without full re-render
    this.updateContentArea();

    try {
      this.issues = await this.githubService.fetchIssues(this.currentRepository);
      this.isLoading = false;
      // Update content area to show issues without full re-render
      this.updateContentArea();
    } catch (error: any) {
      this.error = error.message || 'Failed to load issues';
      this.isLoading = false;
      // Update content area to show error without full re-render
      this.updateContentArea();
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
   * Update just the repository selector without re-rendering the entire view
   */
  private updateRepositorySelector(): void {
    const repoSelect = this.containerEl.querySelector('.repository-selector select') as HTMLSelectElement;
    if (!repoSelect) return;

    // Clear existing options
    repoSelect.innerHTML = '';

    // Add repository options
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
  }

  /**
   * Update just the content area without re-rendering the entire view
   */
  private updateContentArea(): void {
    const contentEl = this.containerEl.querySelector('.github-issues-content') as HTMLElement;
    if (!contentEl) return;

    contentEl.empty();
    this.renderContent(contentEl);
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

  /**
   * Import a single GitHub issue as a task
   */
  private async importIssue(issue: GitHubIssue): Promise<void> {
    try {
      // Mark as importing
      this.importingIssues.add(issue.number);
      this.renderIssuesList(); // Re-render to show importing state

      // Get default import configuration
      const config = this.getDefaultImportConfig();

      // Import the issue
      const result = await this.githubService.importIssueAsTask(issue, config);

      if (result.success) {
        if (result.skipped) {
          new Notice(`Issue already imported: ${result.reason}`);
        } else {
          new Notice(`Successfully imported: ${issue.title}`);
        }
      } else {
        new Notice(`Failed to import issue: ${result.error}`);
      }
    } catch (error) {
      console.error('Error importing issue:', error);
      new Notice(`Failed to import issue: ${error.message}`);
    } finally {
      // Remove from importing set and re-render
      this.importingIssues.delete(issue.number);
      this.renderIssuesList();
    }
  }

  /**
   * Import all visible issues as tasks
   */
  private async importAllIssues(): Promise<void> {
    const filteredIssues = this.getFilteredIssues();

    if (filteredIssues.length === 0) {
      new Notice('No issues to import');
      return;
    }

    // Confirm bulk import
    const confirmed = confirm(`Import ${filteredIssues.length} issues as tasks?`);
    if (!confirmed) {
      return;
    }

    let imported = 0;
    let skipped = 0;
    let failed = 0;

    new Notice(`Starting import of ${filteredIssues.length} issues...`);

    for (const issue of filteredIssues) {
      try {
        // Mark as importing
        this.importingIssues.add(issue.number);

        // Get default import configuration
        const config = this.getDefaultImportConfig();

        // Import the issue
        const result = await this.githubService.importIssueAsTask(issue, config);

        if (result.success) {
          if (result.skipped) {
            skipped++;
          } else {
            imported++;
          }
        } else {
          failed++;
          console.error(`Failed to import issue ${issue.number}:`, result.error);
        }
      } catch (error) {
        failed++;
        console.error(`Error importing issue ${issue.number}:`, error);
      } finally {
        this.importingIssues.delete(issue.number);
      }
    }

    // Re-render to update import status
    this.renderIssuesList();

    // Show summary
    new Notice(`Import complete: ${imported} imported, ${skipped} skipped, ${failed} failed`);
  }

  /**
   * Get default import configuration
   */
  private getDefaultImportConfig(): TaskImportConfig {
    return {
      taskType: 'Task',
      importLabelsAsTags: true,
      preserveAssignee: true
    };
  }
}
