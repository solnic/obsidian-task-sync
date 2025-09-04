/**
 * Tests for ProjectBaseDefinition class
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ProjectBaseDefinition, ProjectBaseDefinitionContext } from '../../../../src/services/base-definitions/ProjectBaseDefinition';
import { ProjectAreaInfo } from '../../../../src/services/BaseManager';
import { TaskSyncSettings } from '../../../../src/main';

describe('ProjectBaseDefinition', () => {
  let settings: TaskSyncSettings;
  let project: ProjectAreaInfo;
  let context: ProjectBaseDefinitionContext;

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

    project = {
      name: 'Website Redesign',
      path: '1. Projects/Website Redesign.md',
      type: 'project'
    };

    context = {
      settings,
      project
    };
  });

  describe('when creating project base definition', () => {
    it('should initialize with project context', () => {
      const definition = new ProjectBaseDefinition(context);
      expect(definition).toBeDefined();
    });
  });

  describe('when generating base configuration', () => {
    it('should include all required sections', () => {
      const definition = new ProjectBaseDefinition(context);
      const config = (definition as any).generateBaseConfig();

      expect(config).toHaveProperty('formulas');
      expect(config).toHaveProperty('properties');
      expect(config).toHaveProperty('views');
    });

    it('should include project-specific properties', () => {
      const definition = new ProjectBaseDefinition(context);
      const config = (definition as any).generateBaseConfig();

      expect(config.properties).toHaveProperty('file.name');
      expect(config.properties).toHaveProperty('note.Done');
      expect(config.properties).toHaveProperty('note.Areas');
      expect(config.properties).toHaveProperty('file.ctime');
      expect(config.properties).toHaveProperty('file.mtime');

      expect(config.properties['note.Areas'].displayName).toBe('Areas');
    });

    it('should not include project property in project base', () => {
      const definition = new ProjectBaseDefinition(context);
      const config = (definition as any).generateBaseConfig();

      expect(config.properties).not.toHaveProperty('note.Project');
    });
  });

  describe('when generating views', () => {
    it('should include main tasks view with project filter', () => {
      const definition = new ProjectBaseDefinition(context);
      const config = (definition as any).generateBaseConfig();

      const mainView = config.views.find((v: any) => v.name === 'Tasks');
      expect(mainView).toBeDefined();
      expect(mainView.type).toBe('table');
      expect(mainView.filters.and).toContain('file.folder == "5. Bases/Tasks"');
      expect(mainView.filters.and).toContain('Project.contains(link("Website Redesign"))');
    });

    it('should include type-specific views with project filter', () => {
      const definition = new ProjectBaseDefinition(context);
      const config = (definition as any).generateBaseConfig();

      const bugView = config.views.find((v: any) => v.name === 'Bugs');
      const featureView = config.views.find((v: any) => v.name === 'Features');

      expect(bugView).toBeDefined();
      expect(featureView).toBeDefined();
      expect(bugView.filters.and).toContain('Project.contains(link("Website Redesign"))');
      expect(bugView.filters.and).toContain('Type == "Bug"');
      expect(featureView.filters.and).toContain('Project.contains(link("Website Redesign"))');
      expect(featureView.filters.and).toContain('Type == "Feature"');
    });

    it('should include Areas in view order', () => {
      const definition = new ProjectBaseDefinition(context);
      const config = (definition as any).generateBaseConfig();

      const mainView = config.views.find((v: any) => v.name === 'Tasks');
      expect(mainView.order).toContain('Areas');
    });
  });

  describe('when generating project filter', () => {
    it('should use correct project name in filter', () => {
      const definition = new ProjectBaseDefinition(context);
      const filters = (definition as any).getMainViewFilters();

      expect(filters).toContain('Project.contains(link("Website Redesign"))');
    });
  });

  describe('when generating YAML', () => {
    it('should produce valid YAML with project-specific configuration', () => {
      const definition = new ProjectBaseDefinition(context);
      const yaml = definition.generateYAML();

      expect(yaml).toContain('formulas:');
      expect(yaml).toContain('properties:');
      expect(yaml).toContain('views:');
      expect(yaml).toContain('name: Tasks');
      expect(yaml).toContain('name: Bugs');
      expect(yaml).toContain('name: Features');
      expect(yaml).toContain('Project.contains(link("Website Redesign"))');
      expect(yaml).toContain('displayName: Areas');
    });

    it('should not contain Project property in YAML', () => {
      const definition = new ProjectBaseDefinition(context);
      const yaml = definition.generateYAML();

      expect(yaml).not.toContain('note.Project');
    });
  });
});
