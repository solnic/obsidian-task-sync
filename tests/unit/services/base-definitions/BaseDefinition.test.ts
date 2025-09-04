/**
 * Tests for BaseDefinition abstract class
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BaseDefinition, BaseDefinitionContext } from '../../../../src/services/base-definitions/BaseDefinition';
import { BaseConfig } from '../../../../src/services/BaseManager';
import { TaskSyncSettings } from '../../../../src/main';

// Concrete implementation for testing
class TestBaseDefinition extends BaseDefinition {
  protected generateBaseConfig(): BaseConfig {
    return {
      formulas: this.getCommonFormulas(),
      properties: this.getCommonProperties(),
      views: [this.generateMainTasksView()]
    };
  }

  protected getMainViewFilters(): string[] {
    return [`file.folder == "${this.settings.tasksFolder}"`];
  }
}

describe('BaseDefinition', () => {
  let settings: TaskSyncSettings;
  let context: BaseDefinitionContext;

  beforeEach(() => {
    settings = {
      tasksFolder: '5. Bases/Tasks',
      basesFolder: '5. Bases',
      tasksBaseFile: 'Tasks.base',
      taskTypes: [
        { name: 'Bug', color: '#ff0000' },
        { name: 'Feature', color: '#00ff00' },
        { name: 'Task', color: '#0000ff' }
      ]
    } as TaskSyncSettings;

    context = {
      settings,
      name: 'Test',
      type: 'area'
    };
  });

  describe('when creating a base definition', () => {
    it('should initialize with settings and context', () => {
      const definition = new TestBaseDefinition(context);
      expect(definition).toBeDefined();
    });
  });

  describe('when generating common formulas', () => {
    it('should include Type and Title formulas', () => {
      const definition = new TestBaseDefinition(context);
      const formulas = (definition as any).getCommonFormulas();

      expect(formulas).toHaveProperty('Type');
      expect(formulas).toHaveProperty('Title');
      expect(formulas.Title).toBe('link(file.name, Title)');
    });

    it('should generate simple type formula', () => {
      const definition = new TestBaseDefinition(context);
      const formulas = (definition as any).getCommonFormulas();

      expect(formulas.Type).toBe('Type');
    });
  });

  describe('when generating common properties', () => {
    it('should include standard properties', () => {
      const definition = new TestBaseDefinition(context);
      const properties = (definition as any).getCommonProperties();

      expect(properties).toHaveProperty('file.name');
      expect(properties).toHaveProperty('note.Done');
      expect(properties).toHaveProperty('file.ctime');
      expect(properties).toHaveProperty('file.mtime');

      expect(properties['file.name'].displayName).toBe('Title');
      expect(properties['note.Done'].displayName).toBe('Done');
      expect(properties['file.ctime'].displayName).toBe('Created At');
      expect(properties['file.mtime'].displayName).toBe('Updated At');
    });
  });

  describe('when generating main tasks view', () => {
    it('should create table view with correct structure', () => {
      const definition = new TestBaseDefinition(context);
      const view = (definition as any).generateMainTasksView();

      expect(view.type).toBe('table');
      expect(view.name).toBe('Tasks');
      expect(view.filters.and).toContain('file.folder == "5. Bases/Tasks"');
      expect(view.order).toContain('Done');
      expect(view.order).toContain('formula.Title');
      expect(view.sort).toHaveLength(2);
    });
  });

  describe('when generating type-specific views', () => {
    it('should create views for each task type except generic Task', () => {
      const definition = new TestBaseDefinition(context);
      const views = (definition as any).generateTypeSpecificViews();

      expect(views).toHaveLength(2); // Bug and Feature, not Task
      expect(views[0].name).toBe('Bugs');
      expect(views[1].name).toBe('Features');
    });

    it('should include type filter in each view', () => {
      const definition = new TestBaseDefinition(context);
      const views = (definition as any).generateTypeSpecificViews();

      expect(views[0].filters.and).toContain('Type == "Bug"');
      expect(views[1].filters.and).toContain('Type == "Feature"');
    });
  });

  describe('when generating YAML', () => {
    it('should return valid YAML string', () => {
      const definition = new TestBaseDefinition(context);
      const yaml = definition.generateYAML();

      expect(yaml).toContain('formulas:');
      expect(yaml).toContain('properties:');
      expect(yaml).toContain('views:');
      expect(yaml).toContain('Type:');
      expect(yaml).toContain('Title:');
    });

    it('should include all configured elements', () => {
      const definition = new TestBaseDefinition(context);
      const yaml = definition.generateYAML();

      expect(yaml).toContain('link(file.name, Title)');
      expect(yaml).toContain('displayName: Done');
      expect(yaml).toContain('name: Tasks');
      expect(yaml).toContain('type: table');
    });
  });
});
