/**
 * Project Base Definition
 * Generates configuration for project-specific base files
 */

import { BaseDefinition, BaseDefinitionContext } from './BaseDefinition';
import { BaseConfig, BaseProperty, BaseView, ProjectAreaInfo } from '../BaseManager';

export interface ProjectBaseDefinitionContext extends BaseDefinitionContext {
  project: ProjectAreaInfo;
}

export class ProjectBaseDefinition extends BaseDefinition {
  private project: ProjectAreaInfo;

  constructor(context: ProjectBaseDefinitionContext) {
    super(context);
    this.project = context.project;
  }

  protected generateBaseConfig(): BaseConfig {
    return {
      formulas: this.getCommonFormulas(),
      properties: this.getProjectProperties(),
      views: this.generateAllViews()
    };
  }

  /**
   * Get properties specific to project bases
   */
  private getProjectProperties(): Record<string, BaseProperty> {
    return {
      ...this.getCommonProperties(),
      'note.Areas': {
        displayName: 'Areas'
      }
    };
  }

  /**
   * Generate all views for the project base
   */
  private generateAllViews(): BaseView[] {
    const views = [];

    // Add main Tasks view
    views.push(this.generateMainTasksView());

    // Add type-specific views
    views.push(...this.generateTypeSpecificViews());

    return views;
  }

  /**
   * Generate a filter expression for this specific project
   * IMPORTANT: Obsidian Bases link() function requires ONLY the filename without extension.
   */
  private createProjectFilter(): string {
    return `Project.contains(link("${this.project.name}"))`;
  }

  protected getMainViewFilters(): string[] {
    return [
      `file.folder == "${this.settings.tasksFolder}"`,
      this.createProjectFilter()
    ];
  }

  protected getMainViewOrder(): string[] {
    return [
      'Done',
      'formula.Title',
      'Areas',
      'formula.Type',
      'file.ctime',
      'file.mtime'
    ];
  }

  protected getTypeViewOrder(): string[] {
    return [
      'Done',
      'formula.Title',
      'Areas',
      'file.ctime',
      'file.mtime'
    ];
  }
}
