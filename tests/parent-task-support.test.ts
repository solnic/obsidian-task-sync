import { describe, it, expect } from 'vitest';
import {
  generateParentTaskBase,
  Properties,
  generateParentTaskFrontMatter,
  FILTER_GENERATORS
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
      expect(Properties.SUB_TASKS.type).toBe('array');
      expect(Properties.SUB_TASKS.link).toBe(true);
    });

    it('should define Parent task as string with link', () => {
      expect(Properties.PARENT_TASK.type).toBe('string');
      expect(Properties.PARENT_TASK.link).toBe(true);
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
    it('should generate parent task front-matter with correct type', () => {
      const taskData = {
        name: 'Epic Feature',
        subTasks: ['Sub-task 1', 'Sub-task 2'],
        type: 'Feature',
        tags: [] as string[],
        done: false,
        status: 'Backlog'
      };

      const frontMatter = generateParentTaskFrontMatter(taskData);

      expect(frontMatter).toContain('Type: Parent Task');
      expect(frontMatter).toContain('Title: Epic Feature');
      expect(frontMatter).toContain('Sub-tasks: ["[[Sub-task 1]]", "[[Sub-task 2]]"]');
    });

    it('should handle linked properties with proper quoting', () => {
      const taskData = {
        name: 'Parent Task',
        parentTask: 'Higher Level Task',
        subTasks: ['Child Task 1', 'Child Task 2'],
        tags: [] as string[],
        done: false,
        status: 'Backlog'
      };

      const frontMatter = generateParentTaskFrontMatter(taskData);

      // Parent task should be quoted as a link
      expect(frontMatter).toContain('Parent task: "[[Higher Level Task]]"');

      // Sub-tasks should be an array of quoted links
      expect(frontMatter).toContain('Sub-tasks: ["[[Child Task 1]]", "[[Child Task 2]]"]');
    });

    it('should include base embedding in template content', () => {
      const taskData = {
        name: 'Epic Feature',
        tags: [] as string[],
        done: false,
        status: 'Backlog'
      };

      const frontMatter = generateParentTaskFrontMatter(taskData);

      expect(frontMatter).toContain('## Sub-tasks');
      expect(frontMatter).toContain('![[Epic Feature.base]]');
    });
  });

  describe('Sub-task Filtering', () => {
    it('should exclude sub-tasks from main views', () => {
      // This would be tested in integration tests, but we can verify
      // that the filter generator includes the exclude sub-tasks filter
      expect(FILTER_GENERATORS.excludeSubTasks()).toBe('!"Parent task" || "Parent task" == null');
    });
  });
});
