/**
 * Abstract base class for base file definitions
 * Provides common functionality for generating base YAML configurations
 */

import { TaskSyncSettings } from '../../main';
import { BaseConfig, BaseProperty, BaseView } from '../BaseManager';
import * as yaml from 'js-yaml';
import pluralize from 'pluralize';

export interface BaseDefinitionContext {
  settings: TaskSyncSettings;
  name?: string;
  path?: string;
  type?: 'project' | 'area';
}

export abstract class BaseDefinition {
  protected settings: TaskSyncSettings;
  protected context: BaseDefinitionContext;

  constructor(context: BaseDefinitionContext) {
    this.settings = context.settings;
    this.context = context;
  }

  /**
   * Generate the complete YAML configuration for this base
   */
  generateYAML(): string {
    const config = this.generateBaseConfig();
    return this.serializeBaseConfig(config);
  }

  /**
   * Generate the base configuration object
   */
  protected abstract generateBaseConfig(): BaseConfig;

  /**
   * Get common formulas used across all base types
   */
  protected getCommonFormulas(): Record<string, string> {
    return {
      'Type': this.generateTypeFormula(),
      'Title': 'link(file.name, Title)'
    };
  }

  /**
   * Get common properties used across all base types
   */
  protected getCommonProperties(): Record<string, BaseProperty> {
    return {
      'file.name': {
        displayName: 'Title'
      },
      'note.Done': {
        displayName: 'Done'
      },
      'file.ctime': {
        displayName: 'Created At'
      },
      'file.mtime': {
        displayName: 'Updated At'
      }
    };
  }

  /**
   * Generate type formula based on task types configuration
   * Returns simple Type property since Bases don't support HTML in formulas
   */
  protected generateTypeFormula(): string {
    return 'Type';
  }

  /**
   * Generate main tasks view with context-specific filters
   */
  protected generateMainTasksView(): BaseView {
    return {
      type: 'table',
      name: 'Tasks',
      filters: {
        and: this.getMainViewFilters()
      },
      order: this.getMainViewOrder(),
      sort: this.getMainViewSort()
    };
  }

  /**
   * Generate type-specific views for each task type
   */
  protected generateTypeSpecificViews(): BaseView[] {
    const views: BaseView[] = [];

    for (const taskType of this.settings.taskTypes) {
      if (taskType.name !== 'Task') { // Skip generic 'Task' type
        views.push({
          type: 'table',
          name: pluralize(taskType.name),
          filters: {
            and: [
              ...this.getMainViewFilters(),
              `Type == "${taskType.name}"`
            ]
          },
          order: this.getTypeViewOrder(),
          sort: this.getTypeViewSort()
        });
      }
    }

    return views;
  }

  /**
   * Get filters for the main view - to be implemented by subclasses
   */
  protected abstract getMainViewFilters(): string[];

  /**
   * Get column order for main view - can be overridden by subclasses
   */
  protected getMainViewOrder(): string[] {
    return [
      'Done',
      'formula.Title',
      'formula.Type',
      'file.ctime',
      'file.mtime'
    ];
  }

  /**
   * Get column order for type-specific views - can be overridden by subclasses
   */
  protected getTypeViewOrder(): string[] {
    return [
      'Done',
      'formula.Title',
      'file.ctime',
      'file.mtime'
    ];
  }

  /**
   * Get sort configuration for main view
   */
  protected getMainViewSort(): Array<{ property: string; direction: 'ASC' | 'DESC' }> {
    return [
      { property: 'file.mtime', direction: 'DESC' },
      { property: 'formula.Title', direction: 'ASC' }
    ];
  }

  /**
   * Get sort configuration for type-specific views
   */
  protected getTypeViewSort(): Array<{ property: string; direction: 'ASC' | 'DESC' }> {
    return [
      { property: 'file.mtime', direction: 'DESC' },
      { property: 'formula.Title', direction: 'ASC' }
    ];
  }

  /**
   * Serialize base configuration to YAML format
   */
  protected serializeBaseConfig(config: BaseConfig): string {
    return yaml.dump(config, {
      indent: 2,
      lineWidth: -1,
      noRefs: true,
      sortKeys: false
    });
  }
}
