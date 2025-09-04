/**
 * Tasks Base Definition
 * Generates configuration for the main Tasks.base file
 */

import { BaseDefinition, BaseDefinitionContext } from './BaseDefinition';
import { BaseConfig, BaseProperty, BaseView, ProjectAreaInfo } from '../BaseManager';

export interface TasksBaseDefinitionContext extends BaseDefinitionContext {
  projectsAndAreas: ProjectAreaInfo[];
}

export class TasksBaseDefinition extends BaseDefinition {
  private projectsAndAreas: ProjectAreaInfo[];

  constructor(context: TasksBaseDefinitionContext) {
    super(context);
    this.projectsAndAreas = context.projectsAndAreas;
  }

  protected generateBaseConfig(): BaseConfig {
    return {
      formulas: this.getCommonFormulas(),
      properties: this.getTasksProperties(),
      views: this.generateAllViews()
    };
  }

  /**
   * Get properties specific to the main Tasks base
   */
  private getTasksProperties(): Record<string, BaseProperty> {
    return {
      ...this.getCommonProperties(),
      'note.Status': {
        displayName: 'Done'
      },
      'note.tags': {
        displayName: 'Tags'
      },
      'note.Areas': {
        displayName: 'Areas'
      },
      'note.Project': {
        displayName: 'Project'
      },
      'note.Priority': {
        displayName: 'Priority'
      },
      'note.Parent task': {
        displayName: 'Parent task'
      },
      'note.Sub-tasks': {
        displayName: 'Sub-tasks'
      }
    };
  }

  /**
   * Generate all views for the Tasks base
   */
  private generateAllViews(): BaseView[] {
    const views: BaseView[] = [];

    // Add main Tasks view
    views.push(this.generateMainTasksView());

    // Add "All" view that shows all tasks without filtering
    views.push(this.generateAllTasksView());

    // Add type-specific views
    views.push(...this.generateTypeSpecificViews());

    // Add area-specific views
    views.push(...this.generateAreaViews());

    // Add project-specific views
    views.push(...this.generateProjectViews());

    return views;
  }

  /**
   * Generate "All" view that shows all tasks without any filtering
   */
  private generateAllTasksView(): BaseView {
    return {
      type: 'table',
      name: 'All',
      filters: {
        and: [`file.folder == "${this.settings.tasksFolder}"`]
      },
      order: this.getMainViewOrder(),
      sort: this.getMainViewSort()
    };
  }

  /**
   * Generate area-specific views
   */
  private generateAreaViews(): BaseView[] {
    return this.projectsAndAreas
      .filter(item => item.type === 'area')
      .map(area => this.createAreaView(area));
  }

  /**
   * Generate project-specific views
   */
  private generateProjectViews(): BaseView[] {
    return this.projectsAndAreas
      .filter(item => item.type === 'project')
      .map(project => this.createProjectView(project));
  }

  /**
   * Create a filtered view for a specific area
   */
  private createAreaView(area: ProjectAreaInfo): BaseView {
    return {
      type: 'table',
      name: area.name,
      filters: {
        and: [
          `file.folder == "${this.settings.tasksFolder}"`,
          this.createAreaFilter(area)
        ]
      },
      order: [
        'Status',
        'formula.Title',
        'formula.Type',
        'tags',
        'file.mtime',
        'file.ctime',
        'Project'
      ],
      sort: [
        { property: 'file.mtime', direction: 'ASC' },
        { property: 'formula.Title', direction: 'ASC' }
      ],
      columnSize: {
        'formula.Title': 382,
        'note.tags': 134,
        'file.mtime': 165,
        'file.ctime': 183
      }
    };
  }

  /**
   * Create a filtered view for a specific project
   */
  private createProjectView(project: ProjectAreaInfo): BaseView {
    return {
      type: 'table',
      name: project.name,
      filters: {
        and: [
          `file.folder == "${this.settings.tasksFolder}"`,
          this.createProjectFilter(project)
        ]
      },
      order: [
        'Status',
        'formula.Title',
        'formula.Type',
        'tags',
        'file.mtime',
        'file.ctime',
        'Areas'
      ],
      sort: [
        { property: 'file.mtime', direction: 'ASC' },
        { property: 'formula.Title', direction: 'ASC' }
      ],
      columnSize: {
        'formula.Title': 382,
        'note.tags': 134,
        'file.mtime': 165,
        'file.ctime': 183
      }
    };
  }

  /**
   * Generate a filter expression for areas
   * IMPORTANT: Obsidian Bases link() function requires ONLY the filename without extension.
   */
  private createAreaFilter(area: ProjectAreaInfo): string {
    return `Areas.contains(link("${area.name}"))`;
  }

  /**
   * Generate a filter expression for projects
   * IMPORTANT: Obsidian Bases link() function requires ONLY the filename without extension.
   */
  private createProjectFilter(project: ProjectAreaInfo): string {
    return `Project.contains(link("${project.name}"))`;
  }

  protected getMainViewFilters(): string[] {
    return [`file.folder == "${this.settings.tasksFolder}"`];
  }

  protected getMainViewOrder(): string[] {
    return [
      'Status',
      'formula.Title',
      'formula.Type',
      'tags',
      'file.mtime',
      'file.ctime',
      'Areas',
      'Project'
    ];
  }

  protected getTypeViewOrder(): string[] {
    return [
      'Status',
      'formula.Title',
      'tags',
      'file.mtime',
      'file.ctime',
      'Areas',
      'Project'
    ];
  }
}
