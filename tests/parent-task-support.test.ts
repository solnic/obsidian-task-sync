import { describe, it, expect } from 'vitest';
import {
  generateParentTaskBase,
  PROPERTY_REGISTRY,
  generateTaskFrontMatter
} from '../src/services/base-definitions';
import { TaskSyncSettings } from '../src/main';

describe('Parent Task Support', () => {
  const mockSettings: TaskSyncSettings = {
    tasksFolder: 'Tasks',
    projectsFolder: 'Projects',
    areasFolder: 'Areas',
    templateFolder: 'Templates',
    useTemplater: false,
    defaultTaskTemplate: '',
    defaultProjectTemplate: '',
    defaultAreaTemplate: '',
    defaultParentTaskTemplate: '',
    basesFolder: 'Bases',
    tasksBaseFile: 'Tasks.base',
    autoGenerateBases: true,
    autoUpdateBaseViews: true,
    taskTypes: [
      { name: 'Task', color: 'blue' },
      { name: 'Bug', color: 'red' },
      { name: 'Feature', color: 'green' }
    ],
    taskPriorities: [
      { name: 'Low', color: 'green' },
      { name: 'High', color: 'red' }
    ],
    taskStatuses: [
      { name: 'Backlog', color: 'gray', isDone: false },
      { name: 'Done', color: 'green', isDone: true }
    ],
    areaBasesEnabled: true,
    projectBasesEnabled: true,
    autoSyncAreaProjectBases: true
  };

  describe('Property Definitions', () => {
    it('should define Sub-tasks as array type', () => {
      expect(PROPERTY_REGISTRY.SUB_TASKS.type).toBe('array');
      expect(PROPERTY_REGISTRY.SUB_TASKS.link).toBe(true);
    });

    it('should define Parent task as string with link', () => {
      expect(PROPERTY_REGISTRY.PARENT_TASK.type).toBe('string');
      expect(PROPERTY_REGISTRY.PARENT_TASK.link).toBe(true);
    });
  });

  describe('Parent Task Base Generation', () => {
    it('should generate base configuration for parent task', () => {
      const parentTaskName = 'Epic Feature Development';
      const baseConfig = generateParentTaskBase(mockSettings, parentTaskName);

      expect(baseConfig).toContain('Sub-tasks');
      expect(baseConfig).toContain('All Related');
      expect(baseConfig).toContain(`"Parent task".contains(link("${parentTaskName}"))`);
      expect(baseConfig).toContain(`file.name == "${parentTaskName}"`);
    });

    it('should include proper filters for sub-tasks', () => {
      const parentTaskName = 'Test Parent';
      const baseConfig = generateParentTaskBase(mockSettings, parentTaskName);

      // Should filter by tasks folder and parent task
      expect(baseConfig).toContain(`file.folder == "${mockSettings.tasksFolder}"`);
      expect(baseConfig).toContain(`"Parent task".contains(link("${parentTaskName}"))`);
    });
  });

  describe('Front-matter Generation', () => {
    it('should generate task front-matter properties', () => {
      const properties = generateTaskFrontMatter();

      // Should include all expected properties
      const propertyNames = properties.map(p => p.name);
      expect(propertyNames).toContain('Title');
      expect(propertyNames).toContain('Type');
      expect(propertyNames).toContain('Sub-tasks');
      expect(propertyNames).toContain('Parent task');
    });

    it('should have correct property types for parent task fields', () => {
      const properties = generateTaskFrontMatter();

      const subTasksProp = properties.find(p => p.name === 'Sub-tasks');
      expect(subTasksProp?.type).toBe('array');
      expect(subTasksProp?.link).toBe(true);

      const parentTaskProp = properties.find(p => p.name === 'Parent task');
      expect(parentTaskProp?.type).toBe('string');
      expect(parentTaskProp?.link).toBe(true);
    });
  });

  describe('Sub-task Filtering', () => {
    it('should include sub-tasks in parent task base configuration', () => {
      const parentTaskName = 'Test Parent';
      const baseConfig = generateParentTaskBase(mockSettings, parentTaskName);

      // Should include filter to show tasks that have this parent
      expect(baseConfig).toContain('"Parent task".contains(link("Test Parent"))');
      // Should have a sub-tasks view
      expect(baseConfig).toContain('Sub-tasks');
    });
  });
});
