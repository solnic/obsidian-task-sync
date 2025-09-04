/**
 * Tests for TasksBaseDefinition class
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TasksBaseDefinition, TasksBaseDefinitionContext } from '../../../../src/services/base-definitions/TasksBaseDefinition';
import { ProjectAreaInfo } from '../../../../src/services/BaseManager';
import { TaskSyncSettings } from '../../../../src/main';

describe('TasksBaseDefinition', () => {
  let settings: TaskSyncSettings;
  let projectsAndAreas: ProjectAreaInfo[];
  let context: TasksBaseDefinitionContext;

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

    projectsAndAreas = [
      { name: 'Task Sync', path: '2. Areas/Task Sync.md', type: 'area' },
      { name: 'Website Redesign', path: '1. Projects/Website Redesign.md', type: 'project' }
    ];

    context = {
      settings,
      projectsAndAreas
    };
  });

  describe('when creating tasks base definition', () => {
    it('should initialize with projects and areas', () => {
      const definition = new TasksBaseDefinition(context);
      expect(definition).toBeDefined();
    });
  });

  describe('when generating base configuration', () => {
    it('should include all required sections', () => {
      const definition = new TasksBaseDefinition(context);
      const config = (definition as any).generateBaseConfig();

      expect(config).toHaveProperty('formulas');
      expect(config).toHaveProperty('properties');
      expect(config).toHaveProperty('views');
    });

    it('should include tasks-specific properties', () => {
      const definition = new TasksBaseDefinition(context);
      const config = (definition as any).generateBaseConfig();

      expect(config.properties).toHaveProperty('note.Status');
      expect(config.properties).toHaveProperty('note.tags');
      expect(config.properties).toHaveProperty('note.Areas');
      expect(config.properties).toHaveProperty('note.Project');
      expect(config.properties).toHaveProperty('note.Priority');
      expect(config.properties).toHaveProperty('note.Parent task');
      expect(config.properties).toHaveProperty('note.Sub-tasks');

      expect(config.properties['note.Status'].displayName).toBe('Done');
      expect(config.properties['note.tags'].displayName).toBe('Tags');
    });
  });

  describe('when generating views', () => {
    it('should include main tasks view', () => {
      const definition = new TasksBaseDefinition(context);
      const config = (definition as any).generateBaseConfig();

      const mainView = config.views.find((v: any) => v.name === 'Tasks');
      expect(mainView).toBeDefined();
      expect(mainView.type).toBe('table');
      expect(mainView.filters.and).toContain('file.folder == "5. Bases/Tasks"');
    });

    it('should include type-specific views', () => {
      const definition = new TasksBaseDefinition(context);
      const config = (definition as any).generateBaseConfig();

      const bugView = config.views.find((v: any) => v.name === 'Bugs');
      const featureView = config.views.find((v: any) => v.name === 'Features');

      expect(bugView).toBeDefined();
      expect(featureView).toBeDefined();
      expect(bugView.filters.and).toContain('Type == "Bug"');
      expect(featureView.filters.and).toContain('Type == "Feature"');
    });

    it('should include area-specific views', () => {
      const definition = new TasksBaseDefinition(context);
      const config = (definition as any).generateBaseConfig();

      const areaView = config.views.find((v: any) => v.name === 'Task Sync');
      expect(areaView).toBeDefined();
      expect(areaView.type).toBe('table');
      expect(areaView.filters.and).toContain('Areas.contains(link("Task Sync"))');
    });

    it('should include project-specific views in main tasks base', () => {
      const definition = new TasksBaseDefinition(context);
      const config = (definition as any).generateBaseConfig();

      const projectView = config.views.find((v: any) => v.name === 'Website Redesign');
      expect(projectView).toBeDefined();
      expect(projectView.filters.and).toContain('Project.contains(link("Website Redesign"))');
    });
  });

  describe('when generating area filter', () => {
    it('should use correct link syntax', () => {
      const definition = new TasksBaseDefinition(context);
      const filter = (definition as any).createAreaFilter({ name: 'Task Sync', type: 'area' });

      expect(filter).toBe('Areas.contains(link("Task Sync"))');
    });
  });

  describe('when generating YAML', () => {
    it('should produce valid YAML with all sections', () => {
      const definition = new TasksBaseDefinition(context);
      const yaml = definition.generateYAML();

      expect(yaml).toContain('formulas:');
      expect(yaml).toContain('properties:');
      expect(yaml).toContain('views:');
      expect(yaml).toContain('name: Tasks');
      expect(yaml).toContain('name: Task Sync');
      expect(yaml).toContain('displayName: Tags');
      expect(yaml).toContain('Areas.contains(link("Task Sync"))');
    });
  });
});
