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
  PROPERTIES
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

    it('should have correct common properties', () => {
      expect(PROPERTIES.common['file.name'].displayName).toBe('Title');
      expect(PROPERTIES.common['note.Done'].displayName).toBe('Done');
    });

    it('should have task-specific properties', () => {
      expect(PROPERTIES.task['note.Type'].displayName).toBe('Type');
      expect(PROPERTIES.task['note.Status'].displayName).toBe('Done');
      expect(PROPERTIES.task['note.Project'].displayName).toBe('Project');
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

    it('should include correct formulas', () => {
      const result = generateTasksBase(mockSettings, mockProjectsAndAreas);

      expect(result).toContain('Title: link(file.name, Title)');
      expect(result).toContain('note.Type:');
      expect(result).toContain('displayName: Type');
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

      expect(result).toContain('displayName: Project');
      expect(result).not.toContain('note.Areas'); // Areas shouldn't be in area bases
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

      expect(result).toContain('displayName: Areas');
      expect(result).not.toContain('note.Project'); // Project shouldn't be in project bases
    });
  });
});
