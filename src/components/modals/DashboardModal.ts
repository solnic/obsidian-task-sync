/**
 * Main dashboard modal for the Task Sync plugin
 * Provides a central interface for viewing and managing tasks, projects, and areas
 */

import { App } from 'obsidian';
import { BaseModal } from '../ui/BaseModal';
import { Task, Project, Area, TaskStatus, TaskPriority } from '../../types/entities';
import TaskSyncPlugin from '../../main';

export interface DashboardData {
  tasks: Task[];
  projects: Project[];
  areas: Area[];
}

export class DashboardModal extends BaseModal {
  private plugin: TaskSyncPlugin;
  private data: DashboardData;
  private currentView: 'overview' | 'tasks' | 'projects' | 'areas' = 'overview';
  private filteredTasks: Task[] = [];
  private searchQuery: string = '';
  private statusFilter: TaskStatus | 'all' = 'all';
  private priorityFilter: TaskPriority | 'all' = 'all';

  constructor(app: App, plugin: TaskSyncPlugin) {
    super(app, {
      title: 'Task Sync Dashboard',
      width: '900px',
      height: '700px',
      className: 'task-sync-dashboard'
    });
    this.plugin = plugin;
    this.data = {
      tasks: [],
      projects: [],
      areas: []
    };
  }

  protected async createContent(): Promise<void> {
    this.setupKeyboardHandlers();

    try {
      this.showLoading('Loading dashboard data...');
      await this.loadData();
      this.renderDashboard();
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      this.showError('Failed to load dashboard data. Please try again.', () => {
        this.createContent();
      });
    }
  }

  private async loadData(): Promise<void> {
    // TODO: Replace with actual data loading from services
    // For now, create mock data to demonstrate the UI
    this.data = {
      tasks: this.createMockTasks(),
      projects: this.createMockProjects(),
      areas: this.createMockAreas()
    };

    this.filteredTasks = [...this.data.tasks];
  }

  private createMockTasks(): Task[] {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    return [
      {
        id: '1',
        name: 'Review project proposal',
        description: 'Review the Q4 project proposal document',
        status: TaskStatus.TODO,
        priority: TaskPriority.HIGH,
        deadline: tomorrow,
        projectId: 'proj1',
        areaId: 'area1',
        tags: ['review', 'urgent'],
        createdAt: now,
        updatedAt: now,
        fileExists: false,
        dependsOn: [],
        blocks: []
      },
      {
        id: '2',
        name: 'Update documentation',
        description: 'Update the API documentation with new endpoints',
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.MEDIUM,
        projectId: 'proj1',
        tags: ['documentation'],
        createdAt: now,
        updatedAt: now,
        fileExists: false,
        dependsOn: [],
        blocks: []
      },
      {
        id: '3',
        name: 'Team meeting preparation',
        description: 'Prepare agenda and materials for weekly team meeting',
        status: TaskStatus.DONE,
        priority: TaskPriority.LOW,
        completedAt: now,
        areaId: 'area2',
        tags: ['meeting'],
        createdAt: now,
        updatedAt: now,
        fileExists: false,
        dependsOn: [],
        blocks: []
      }
    ];
  }

  private createMockProjects(): Project[] {
    const now = new Date();
    return [
      {
        id: 'proj1',
        name: 'Q4 Development Sprint',
        description: 'Major development sprint for Q4 deliverables',
        status: 'active',
        areaId: 'area1',
        tags: ['development', 'sprint'],
        createdAt: now,
        updatedAt: now,
        fileExists: false,
        progress: 0.3,
        taskIds: ['1', '2'],
        objectives: ['Complete API development', 'Implement UI components'],
        successCriteria: ['All tests passing', 'Code review completed']
      }
    ];
  }

  private createMockAreas(): Area[] {
    const now = new Date();
    return [
      {
        id: 'area1',
        name: 'Work',
        description: 'Professional work and projects',
        tags: ['professional'],
        createdAt: now,
        updatedAt: now,
        fileExists: false,
        projectIds: ['proj1'],
        goals: ['Advance career', 'Complete projects on time'],
        isActive: true
      },
      {
        id: 'area2',
        name: 'Personal',
        description: 'Personal tasks and activities',
        tags: ['personal'],
        createdAt: now,
        updatedAt: now,
        fileExists: false,
        projectIds: [],
        goals: ['Maintain work-life balance', 'Personal development'],
        isActive: true
      }
    ];
  }

  private renderDashboard(): void {
    this.contentEl.empty();

    // Create header with navigation tabs
    this.createDashboardHeader();

    // Create main content area
    const mainContent = this.contentEl.createDiv('task-sync-dashboard-content');

    // Render current view
    switch (this.currentView) {
      case 'overview':
        this.renderOverview(mainContent);
        break;
      case 'tasks':
        this.renderTasksView(mainContent);
        break;
      case 'projects':
        this.renderProjectsView(mainContent);
        break;
      case 'areas':
        this.renderAreasView(mainContent);
        break;
    }
  }

  private createDashboardHeader(): void {
    const header = this.contentEl.createDiv('task-sync-dashboard-header');

    // Create navigation tabs
    const tabs = [
      { id: 'overview', label: 'Overview', icon: '📊' },
      { id: 'tasks', label: 'Tasks', icon: '✅' },
      { id: 'projects', label: 'Projects', icon: '📁' },
      { id: 'areas', label: 'Areas', icon: '🏷️' }
    ];

    const tabContainer = header.createDiv('task-sync-dashboard-tabs');

    tabs.forEach(tab => {
      const tabButton = tabContainer.createEl('button', {
        text: `${tab.icon} ${tab.label}`,
        cls: `task-sync-dashboard-tab ${this.currentView === tab.id ? 'active' : ''}`
      });

      tabButton.addEventListener('click', () => {
        this.currentView = tab.id as any;
        this.renderDashboard();
      });
    });

    // Add quick action buttons
    const actions = header.createDiv('task-sync-dashboard-actions');

    this.createButton(actions, '+ Task', () => {
      // TODO: Open task creation modal
      console.log('Create new task');
    }, 'primary');

    this.createButton(actions, '+ Project', () => {
      // TODO: Open project creation modal
      console.log('Create new project');
    }, 'secondary');
  }

  private renderOverview(container: HTMLElement): void {
    // Statistics cards
    const statsContainer = container.createDiv('task-sync-dashboard-stats');

    const taskStats = this.calculateTaskStats();

    this.createStatCard(statsContainer, 'Total Tasks', taskStats.total.toString(), '📝');
    this.createStatCard(statsContainer, 'In Progress', taskStats.inProgress.toString(), '🔄');
    this.createStatCard(statsContainer, 'Completed', taskStats.completed.toString(), '✅');
    this.createStatCard(statsContainer, 'Overdue', taskStats.overdue.toString(), '⚠️');

    // Recent tasks section
    const recentSection = container.createDiv('task-sync-dashboard-section');
    recentSection.createEl('h3', { text: 'Recent Tasks' });

    const recentTasks = this.data.tasks.slice(0, 5);
    this.renderTaskList(recentSection, recentTasks, true);

    // Projects overview
    const projectsSection = container.createDiv('task-sync-dashboard-section');
    projectsSection.createEl('h3', { text: 'Active Projects' });

    if (this.data.projects.length === 0) {
      projectsSection.createEl('p', {
        text: 'No projects found. Create your first project to get started.',
        cls: 'task-sync-empty-state'
      });
    } else {
      this.renderProjectList(projectsSection, this.data.projects);
    }
  }

  private renderTasksView(container: HTMLElement): void {
    // Create filters
    const filtersContainer = container.createDiv('task-sync-dashboard-filters');
    this.createTaskFilters(filtersContainer);

    // Create task list
    const tasksContainer = container.createDiv('task-sync-dashboard-tasks');
    this.renderTaskList(tasksContainer, this.filteredTasks);
  }

  private renderProjectsView(container: HTMLElement): void {
    const projectsContainer = container.createDiv('task-sync-dashboard-projects');

    if (this.data.projects.length === 0) {
      this.createEmptyState(projectsContainer, 'No projects found', 'Create your first project to organize your tasks.');
    } else {
      this.renderProjectList(projectsContainer, this.data.projects);
    }
  }

  private renderAreasView(container: HTMLElement): void {
    const areasContainer = container.createDiv('task-sync-dashboard-areas');

    if (this.data.areas.length === 0) {
      this.createEmptyState(areasContainer, 'No areas found', 'Create areas to organize your projects and tasks.');
    } else {
      this.renderAreaList(areasContainer, this.data.areas);
    }
  }

  private createStatCard(container: HTMLElement, title: string, value: string, icon: string): void {
    const card = container.createDiv('task-sync-stat-card');
    card.createEl('div', { text: icon, cls: 'task-sync-stat-icon' });
    card.createEl('div', { text: value, cls: 'task-sync-stat-value' });
    card.createEl('div', { text: title, cls: 'task-sync-stat-title' });
  }

  private calculateTaskStats() {
    const now = new Date();
    return {
      total: this.data.tasks.length,
      inProgress: this.data.tasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length,
      completed: this.data.tasks.filter(t => t.status === TaskStatus.DONE).length,
      overdue: this.data.tasks.filter(t => t.deadline && t.deadline < now && t.status !== TaskStatus.DONE).length
    };
  }

  private createTaskFilters(container: HTMLElement): void {
    const searchContainer = container.createDiv('task-sync-filter-group');
    searchContainer.createEl('label', { text: 'Search:' });
    const searchInput = searchContainer.createEl('input', {
      type: 'text',
      placeholder: 'Search tasks...',
      value: this.searchQuery
    });

    searchInput.addEventListener('input', (e) => {
      this.searchQuery = (e.target as HTMLInputElement).value;
      this.applyFilters();
    });

    // Status filter
    const statusContainer = container.createDiv('task-sync-filter-group');
    statusContainer.createEl('label', { text: 'Status:' });
    const statusSelect = statusContainer.createEl('select');

    statusSelect.createEl('option', { value: 'all', text: 'All Statuses' });
    Object.values(TaskStatus).forEach(status => {
      statusSelect.createEl('option', { value: status, text: status });
    });

    statusSelect.value = this.statusFilter;
    statusSelect.addEventListener('change', (e) => {
      this.statusFilter = (e.target as HTMLSelectElement).value as any;
      this.applyFilters();
    });

    // Priority filter
    const priorityContainer = container.createDiv('task-sync-filter-group');
    priorityContainer.createEl('label', { text: 'Priority:' });
    const prioritySelect = priorityContainer.createEl('select');

    prioritySelect.createEl('option', { value: 'all', text: 'All Priorities' });
    Object.values(TaskPriority).forEach(priority => {
      prioritySelect.createEl('option', { value: priority, text: priority });
    });

    prioritySelect.value = this.priorityFilter;
    prioritySelect.addEventListener('change', (e) => {
      this.priorityFilter = (e.target as HTMLSelectElement).value as any;
      this.applyFilters();
    });
  }

  private applyFilters(): void {
    this.filteredTasks = this.data.tasks.filter(task => {
      // Search filter
      if (this.searchQuery && !task.name.toLowerCase().includes(this.searchQuery.toLowerCase())) {
        return false;
      }

      // Status filter
      if (this.statusFilter !== 'all' && task.status !== this.statusFilter) {
        return false;
      }

      // Priority filter
      if (this.priorityFilter !== 'all' && task.priority !== this.priorityFilter) {
        return false;
      }

      return true;
    });

    // Re-render tasks view if currently active
    if (this.currentView === 'tasks') {
      this.renderDashboard();
    }
  }

  private renderTaskList(container: HTMLElement, tasks: Task[], compact: boolean = false): void {
    if (tasks.length === 0) {
      this.createEmptyState(container, 'No tasks found', 'Create your first task to get started.');
      return;
    }

    const taskList = container.createDiv('task-sync-task-list');

    tasks.forEach(task => {
      const taskItem = taskList.createDiv('task-sync-task-item');

      // Status indicator
      const statusIcon = this.getStatusIcon(task.status);
      taskItem.createEl('span', { text: statusIcon, cls: 'task-sync-task-status' });

      // Task content
      const taskContent = taskItem.createDiv('task-sync-task-content');
      taskContent.createEl('div', { text: task.name, cls: 'task-sync-task-name' });

      if (!compact && task.description) {
        taskContent.createEl('div', { text: task.description, cls: 'task-sync-task-description' });
      }

      // Task metadata
      const taskMeta = taskItem.createDiv('task-sync-task-meta');

      if (task.priority) {
        taskMeta.createEl('span', {
          text: task.priority,
          cls: `task-sync-priority task-sync-priority-${task.priority}`
        });
      }

      if (task.deadline) {
        const deadlineText = this.formatDate(task.deadline);
        const isOverdue = task.deadline < new Date() && task.status !== TaskStatus.DONE;
        taskMeta.createEl('span', {
          text: deadlineText,
          cls: `task-sync-deadline ${isOverdue ? 'overdue' : ''}`
        });
      }

      // Task actions
      const taskActions = taskItem.createDiv('task-sync-task-actions');
      this.createButton(taskActions, 'Edit', () => {
        // TODO: Open task edit modal
        console.log('Edit task:', task.id);
      }, 'secondary');
    });
  }

  private renderProjectList(container: HTMLElement, projects: Project[]): void {
    const projectList = container.createDiv('task-sync-project-list');

    projects.forEach(project => {
      const projectItem = projectList.createDiv('task-sync-project-item');

      projectItem.createEl('h4', { text: project.name, cls: 'task-sync-project-name' });

      if (project.description) {
        projectItem.createEl('p', { text: project.description, cls: 'task-sync-project-description' });
      }

      // Project stats
      const projectTasks = this.data.tasks.filter(t => t.projectId === project.id);
      const completedTasks = projectTasks.filter(t => t.status === TaskStatus.DONE).length;

      const projectMeta = projectItem.createDiv('task-sync-project-meta');
      projectMeta.createEl('span', { text: `${completedTasks}/${projectTasks.length} tasks completed` });

      // Project actions
      const projectActions = projectItem.createDiv('task-sync-project-actions');
      this.createButton(projectActions, 'View Tasks', () => {
        this.currentView = 'tasks';
        this.filteredTasks = projectTasks;
        this.renderDashboard();
      }, 'secondary');
    });
  }

  private renderAreaList(container: HTMLElement, areas: Area[]): void {
    const areaList = container.createDiv('task-sync-area-list');

    areas.forEach(area => {
      const areaItem = areaList.createDiv('task-sync-area-item');

      areaItem.createEl('h4', { text: area.name, cls: 'task-sync-area-name' });

      if (area.description) {
        areaItem.createEl('p', { text: area.description, cls: 'task-sync-area-description' });
      }

      // Area stats
      const areaTasks = this.data.tasks.filter(t => t.areaId === area.id);
      const areaProjects = this.data.projects.filter(p => p.areaId === area.id);

      const areaMeta = areaItem.createDiv('task-sync-area-meta');
      areaMeta.createEl('span', { text: `${areaProjects.length} projects, ${areaTasks.length} tasks` });
    });
  }

  private createEmptyState(container: HTMLElement, title: string, description: string): void {
    const emptyState = container.createDiv('task-sync-empty-state');
    emptyState.createEl('h3', { text: title });
    emptyState.createEl('p', { text: description });
  }

  private getStatusIcon(status: TaskStatus): string {
    switch (status) {
      case TaskStatus.TODO: return '⭕';
      case TaskStatus.IN_PROGRESS: return '🔄';
      case TaskStatus.WAITING: return '⏸️';
      case TaskStatus.DONE: return '✅';
      case TaskStatus.CANCELLED: return '❌';
      default: return '⭕';
    }
  }

  private formatDate(date: Date): string {
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays < 0) return `${Math.abs(diffDays)} days ago`;
    if (diffDays < 7) return `In ${diffDays} days`;

    return date.toLocaleDateString();
  }
}
