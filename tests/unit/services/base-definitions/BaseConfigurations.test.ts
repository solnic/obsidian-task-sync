/**
 * Tests for the new declarative base configuration system
 */

import { describe, it, expect } from 'vitest';
import {
  generateTasksBase,
  generateAreaBase,
  generateProjectBase,
  ProjectAreaInfo,
  FORMULAS,
  Properties,
  PROPERTY_DEFINITIONS,
  SORT_CONFIGS
} from '../../../../src/services/base-definitions/BaseConfigurations';
import { TaskSyncSettings } from '../../../../src/main';
import * as yaml from 'js-yaml';

describe('BaseConfigurations', () => {
  const mockSettings: TaskSyncSettings = {
    tasksFolder: 'Tasks',
    projectsFolder: 'Projects',
    areasFolder: 'Areas',
    templateFolder: 'Templates',
    basesFolder: 'Bases',
    taskTypes: [
      { name: 'Task', color: '#3b82f6' },
      { name: 'Bug', color: '#ef4444' },
      { name: 'Feature', color: '#10b981' }
    ],
    taskPriorities: [
      { name: 'Low', color: 'green' },
      { name: 'Medium', color: 'yellow' },
      { name: 'High', color: 'orange' },
      { name: 'Urgent', color: 'red' }
    ],
    taskStatuses: [
      { name: 'Backlog', color: 'gray' },
      { name: 'In Progress', color: 'blue' },
      { name: 'Done', color: 'green' }
    ],
    projectBasesEnabled: true,
    areaBasesEnabled: true,
    autoSyncAreaProjectBases: true,
    defaultProjectTemplate: '',
    defaultAreaTemplate: '',
    defaultTaskTemplate: '',
    tasksBaseFile: 'Tasks.base',
    autoGenerateBases: true,
    autoUpdateBaseViews: true,
    useTemplater: false
  };

  const mockProjectsAndAreas: ProjectAreaInfo[] = [
    { name: 'Test Area', path: 'Areas/Test Area.md', type: 'area' },
    { name: 'Test Project', path: 'Projects/Test Project.md', type: 'project' }
  ];

  describe('Static configurations', () => {
    it('should have correct formulas', () => {
      expect(FORMULAS.common.Title).toBe('link(file.name, Title)');
    });

    it('should have correct property definitions', () => {
      expect(Properties.TITLE.name).toBe('Title');
      expect(Properties.TITLE.type).toBe('string');
      expect(Properties.DONE.name).toBe('Done');
      expect(Properties.DONE.type).toBe('checkbox');
      expect(Properties.DONE.default).toBe(false);
    });

    it('should have task-specific properties in correct order', () => {
      const taskProperties = PROPERTY_DEFINITIONS.task;
      expect(taskProperties[0].name).toBe('Title');
      expect(taskProperties[1].name).toBe('Type');
      expect(taskProperties[2].name).toBe('Priority');
      expect(taskProperties[3].name).toBe('Areas');
      expect(taskProperties[4].name).toBe('Project');
      expect(taskProperties[5].name).toBe('Done');
      expect(taskProperties[6].name).toBe('Status');
      expect(taskProperties[7].name).toBe('Parent task');
      expect(taskProperties[8].name).toBe('Sub-tasks');
      expect(taskProperties[9].name).toBe('tags');
    });

    it('should have link properties correctly marked', () => {
      expect(Properties.AREAS.link).toBe(true);
      expect(Properties.PROJECT.link).toBe(true);
      expect(Properties.PARENT_TASK.link).toBe(true);
      expect(Properties.SUB_TASKS.link).toBe(true);
      expect(Properties.TYPE.link).toBeUndefined();
      expect(Properties.PRIORITY.link).toBeUndefined();
    });
  });

  describe('generateTasksBase', () => {
    it('should generate valid YAML', () => {
      const result = generateTasksBase(mockSettings, mockProjectsAndAreas);

      expect(() => yaml.load(result)).not.toThrow();
    });

    it('should include all required sections', () => {
      const result = generateTasksBase(mockSettings, mockProjectsAndAreas);

      expect(result).toContain('formulas:');
      expect(result).toContain('properties:');
      expect(result).toContain('views:');
    });

    it('should include correct formulas and properties', () => {
      const result = generateTasksBase(mockSettings, mockProjectsAndAreas);

      expect(result).toContain('Title: link(file.name, Title)');
      expect(result).toContain('- name: Type');
      expect(result).toContain('type: string');
      expect(result).toContain('- name: Project');
      expect(result).toContain('link: true');
    });

    it('should include main views', () => {
      const result = generateTasksBase(mockSettings, mockProjectsAndAreas);

      expect(result).toContain('name: Tasks');
      expect(result).toContain('name: All');
      expect(result).toContain('name: All Bugs');
      expect(result).toContain('name: All Features');
    });

    it('should include priority-based views', () => {
      const result = generateTasksBase(mockSettings, mockProjectsAndAreas);

      expect(result).toContain('name: Bugs • Low priority');
      expect(result).toContain('name: Bugs • Medium priority');
      expect(result).toContain('name: Bugs • High priority');
      expect(result).toContain('name: Bugs • Urgent priority');
      expect(result).toContain('name: Features • Low priority');
      expect(result).toContain('name: Features • Medium priority');
      expect(result).toContain('name: Features • High priority');
      expect(result).toContain('name: Features • Urgent priority');
    });

    it('should include area and project views', () => {
      const result = generateTasksBase(mockSettings, mockProjectsAndAreas);

      expect(result).toContain('name: Test Area');
      expect(result).toContain('name: Test Project');
    });

    it('should include correct filters', () => {
      const result = generateTasksBase(mockSettings, mockProjectsAndAreas);

      expect(result).toContain('file.folder == "Tasks"');
      expect(result).toContain('Type == "Bug"');
      expect(result).toContain('Areas.contains(link("Test Area"))');
      expect(result).toContain('Project.contains(link("Test Project"))');
    });
  });

  describe('generateAreaBase', () => {
    const testArea: ProjectAreaInfo = {
      name: 'Test Area',
      path: 'Areas/Test Area.md',
      type: 'area'
    };

    it('should generate valid YAML', () => {
      const result = generateAreaBase(mockSettings, testArea);

      expect(() => yaml.load(result)).not.toThrow();
    });

    it('should include area-specific filters', () => {
      const result = generateAreaBase(mockSettings, testArea);

      expect(result).toContain('Areas.contains(link("Test Area"))');
    });

    it('should include area properties', () => {
      const result = generateAreaBase(mockSettings, testArea);

      expect(result).toContain('- name: Project');
      expect(result).toContain('type: string');
      expect(result).not.toContain('- name: Areas'); // Areas shouldn't be in area bases
    });
  });

  describe('generateProjectBase', () => {
    const testProject: ProjectAreaInfo = {
      name: 'Test Project',
      path: 'Projects/Test Project.md',
      type: 'project'
    };

    it('should generate valid YAML', () => {
      const result = generateProjectBase(mockSettings, testProject);

      expect(() => yaml.load(result)).not.toThrow();
    });

    it('should include project-specific filters', () => {
      const result = generateProjectBase(mockSettings, testProject);

      expect(result).toContain('Project.contains(link("Test Project"))');
    });

    it('should include project properties', () => {
      const result = generateProjectBase(mockSettings, testProject);

      expect(result).toContain('- name: Areas');
      expect(result).toContain('type: string');
      expect(result).not.toContain('- name: Project'); // Project shouldn't be in project bases
    });
  });

  describe('Sort Configurations', () => {
    it('should sort by Done first in main sort config', () => {
      expect(SORT_CONFIGS.main[0]).toEqual({
        property: 'note.Done',
        direction: 'ASC'
      });
    });

    it('should sort by Done first in area sort config', () => {
      expect(SORT_CONFIGS.area[0]).toEqual({
        property: 'note.Done',
        direction: 'ASC'
      });
    });

    it('should have secondary sorting by modification time and title', () => {
      // Main config: Done -> mtime (DESC) -> Title (ASC)
      expect(SORT_CONFIGS.main[1]).toEqual({
        property: 'file.mtime',
        direction: 'DESC'
      });
      expect(SORT_CONFIGS.main[2]).toEqual({
        property: 'formula.Title',
        direction: 'ASC'
      });

      // Area config: Done -> mtime (ASC) -> Title (ASC)
      expect(SORT_CONFIGS.area[1]).toEqual({
        property: 'file.mtime',
        direction: 'ASC'
      });
      expect(SORT_CONFIGS.area[2]).toEqual({
        property: 'formula.Title',
        direction: 'ASC'
      });
    });

    it('should generate bases with Done-first sorting', () => {
      const tasksBase = generateTasksBase(mockSettings, mockProjectsAndAreas);
      const parsedConfig = yaml.load(tasksBase) as any;

      // Check that the main Tasks view has Done as first sort property
      const mainView = parsedConfig.views.find((view: any) => view.name === 'Tasks');
      expect(mainView.sort[0]).toEqual({
        property: 'note.Done',
        direction: 'ASC'
      });
    });
  });
});
