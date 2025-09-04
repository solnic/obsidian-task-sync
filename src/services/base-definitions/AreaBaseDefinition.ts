/**
 * Area Base Definition
 * Generates configuration for area-specific base files
 */

import { BaseDefinition, BaseDefinitionContext } from './BaseDefinition';
import { BaseConfig, BaseProperty, BaseView, ProjectAreaInfo } from '../BaseManager';

export interface AreaBaseDefinitionContext extends BaseDefinitionContext {
  area: ProjectAreaInfo;
}

export class AreaBaseDefinition extends BaseDefinition {
  private area: ProjectAreaInfo;

  constructor(context: AreaBaseDefinitionContext) {
    super(context);
    this.area = context.area;
  }

  protected generateBaseConfig(): BaseConfig {
    return {
      formulas: this.getCommonFormulas(),
      properties: this.getAreaProperties(),
      views: this.generateAllViews()
    };
  }

  /**
   * Get properties specific to area bases
   */
  private getAreaProperties(): Record<string, BaseProperty> {
    return {
      ...this.getCommonProperties(),
      'note.Project': {
        displayName: 'Project'
      }
    };
  }

  /**
   * Generate all views for the area base
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
   * Generate a filter expression for this specific area
   * IMPORTANT: Obsidian Bases link() function requires ONLY the filename without extension.
   */
  private createAreaFilter(): string {
    return `Areas.contains(link("${this.area.name}"))`;
  }

  protected getMainViewFilters(): string[] {
    return [
      `file.folder == "${this.settings.tasksFolder}"`,
      this.createAreaFilter()
    ];
  }

  protected getMainViewOrder(): string[] {
    return [
      'Done',
      'formula.Title',
      'Project',
      'formula.Type',
      'file.ctime',
      'file.mtime'
    ];
  }

  protected getTypeViewOrder(): string[] {
    return [
      'Done',
      'formula.Title',
      'Project',
      'file.ctime',
      'file.mtime'
    ];
  }
}
