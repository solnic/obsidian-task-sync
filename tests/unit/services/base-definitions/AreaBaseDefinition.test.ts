/**
 * Tests for AreaBaseDefinition class
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AreaBaseDefinition, AreaBaseDefinitionContext } from '../../../../src/services/base-definitions/AreaBaseDefinition';
import { ProjectAreaInfo } from '../../../../src/services/BaseManager';
import { TaskSyncSettings } from '../../../../src/main';

describe('AreaBaseDefinition', () => {
  let settings: TaskSyncSettings;
  let area: ProjectAreaInfo;
  let context: AreaBaseDefinitionContext;

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

    area = {
      name: 'Task Sync',
      path: '2. Areas/Task Sync.md',
      type: 'area'
    };

    context = {
      settings,
      area
    };
  });

  describe('when creating area base definition', () => {
    it('should initialize with area context', () => {
      const definition = new AreaBaseDefinition(context);
      expect(definition).toBeDefined();
    });
  });

  describe('when generating base configuration', () => {
    it('should include all required sections', () => {
      const definition = new AreaBaseDefinition(context);
      const config = (definition as any).generateBaseConfig();

      expect(config).toHaveProperty('formulas');
      expect(config).toHaveProperty('properties');
      expect(config).toHaveProperty('views');
    });

    it('should include area-specific properties', () => {
      const definition = new AreaBaseDefinition(context);
      const config = (definition as any).generateBaseConfig();

      expect(config.properties).toHaveProperty('file.name');
      expect(config.properties).toHaveProperty('note.Done');
      expect(config.properties).toHaveProperty('note.Project');
      expect(config.properties).toHaveProperty('file.ctime');
      expect(config.properties).toHaveProperty('file.mtime');

      expect(config.properties['note.Project'].displayName).toBe('Project');
    });

    it('should not include areas property in area base', () => {
      const definition = new AreaBaseDefinition(context);
      const config = (definition as any).generateBaseConfig();

      expect(config.properties).not.toHaveProperty('note.Areas');
    });
  });

  describe('when generating views', () => {
    it('should include main tasks view with area filter', () => {
      const definition = new AreaBaseDefinition(context);
      const config = (definition as any).generateBaseConfig();

      const mainView = config.views.find((v: any) => v.name === 'Tasks');
      expect(mainView).toBeDefined();
      expect(mainView.type).toBe('table');
      expect(mainView.filters.and).toContain('file.folder == "5. Bases/Tasks"');
      expect(mainView.filters.and).toContain('Areas.contains(link("Task Sync"))');
    });

    it('should include type-specific views with area filter', () => {
      const definition = new AreaBaseDefinition(context);
      const config = (definition as any).generateBaseConfig();

      const bugView = config.views.find((v: any) => v.name === 'Bugs');
      const featureView = config.views.find((v: any) => v.name === 'Features');

      expect(bugView).toBeDefined();
      expect(featureView).toBeDefined();
      expect(bugView.filters.and).toContain('Areas.contains(link("Task Sync"))');
      expect(bugView.filters.and).toContain('Type == "Bug"');
      expect(featureView.filters.and).toContain('Areas.contains(link("Task Sync"))');
      expect(featureView.filters.and).toContain('Type == "Feature"');
    });

    it('should include Project in view order', () => {
      const definition = new AreaBaseDefinition(context);
      const config = (definition as any).generateBaseConfig();

      const mainView = config.views.find((v: any) => v.name === 'Tasks');
      expect(mainView.order).toContain('Project');
    });
  });

  describe('when generating area filter', () => {
    it('should use correct area name in filter', () => {
      const definition = new AreaBaseDefinition(context);
      const filters = (definition as any).getMainViewFilters();

      expect(filters).toContain('Areas.contains(link("Task Sync"))');
    });
  });

  describe('when generating YAML', () => {
    it('should produce valid YAML with area-specific configuration', () => {
      const definition = new AreaBaseDefinition(context);
      const yaml = definition.generateYAML();

      expect(yaml).toContain('formulas:');
      expect(yaml).toContain('properties:');
      expect(yaml).toContain('views:');
      expect(yaml).toContain('name: Tasks');
      expect(yaml).toContain('name: Bugs');
      expect(yaml).toContain('name: Features');
      expect(yaml).toContain('Areas.contains(link("Task Sync"))');
      expect(yaml).toContain('displayName: Project');
    });

    it('should not contain Areas property in YAML', () => {
      const definition = new AreaBaseDefinition(context);
      const yaml = definition.generateYAML();

      expect(yaml).not.toContain('note.Areas');
    });
  });
});
