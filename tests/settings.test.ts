import { describe, it, expect } from 'vitest';
import { TaskSyncSettings } from '../src/main';
import { validateFolderPath } from '../src/components/ui/settings';

describe('TaskSync Settings', () => {
  describe('Settings Interface', () => {
    it('should have correct default settings structure', () => {
      const defaultSettings: TaskSyncSettings = {
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
          { name: 'Feature', color: 'green' },
          { name: 'Improvement', color: 'purple' },
          { name: 'Chore', color: 'gray' }
        ],
        taskPriorities: [
          { name: 'Low', color: 'green' },
          { name: 'Medium', color: 'yellow' },
          { name: 'High', color: 'orange' },
          { name: 'Urgent', color: 'red' }
        ],
        taskStatuses: [
          { name: 'Backlog', color: 'gray', isDone: false },
          { name: 'In Progress', color: 'blue', isDone: false },
          { name: 'Done', color: 'green', isDone: true }
        ],
        areaBasesEnabled: true,
        projectBasesEnabled: true,
        autoSyncAreaProjectBases: true,
        taskPropertyOrder: ['TITLE', 'TYPE', 'PRIORITY', 'AREAS', 'PROJECT', 'DONE', 'STATUS', 'PARENT_TASK', 'SUB_TASKS', 'TAGS']
      };

      expect(defaultSettings.tasksFolder).toBe('Tasks');
      expect(defaultSettings.projectsFolder).toBe('Projects');
      expect(defaultSettings.areasFolder).toBe('Areas');
      expect(defaultSettings.templateFolder).toBe('Templates');
      expect(defaultSettings.useTemplater).toBe(false);
      expect(defaultSettings.defaultTaskTemplate).toBe('');
      expect(defaultSettings.defaultProjectTemplate).toBe('');
      expect(defaultSettings.defaultAreaTemplate).toBe('');
    });

    it('should allow partial settings objects', () => {
      const partialSettings: Partial<TaskSyncSettings> = {
        tasksFolder: 'MyTasks',
        useTemplater: true
      };

      expect(partialSettings.tasksFolder).toBe('MyTasks');
      expect(partialSettings.useTemplater).toBe(true);
      expect(partialSettings.projectsFolder).toBeUndefined();
    });

    it('should validate template settings', () => {
      const settings: TaskSyncSettings = {
        tasksFolder: 'Tasks',
        projectsFolder: 'Projects',
        areasFolder: 'Areas',
        templateFolder: 'Templates',
        useTemplater: false,
        defaultTaskTemplate: 'Task Template',
        defaultProjectTemplate: 'Project Template',
        defaultAreaTemplate: 'Area Template',
        defaultParentTaskTemplate: 'Parent Task Template',
        basesFolder: 'Bases',
        tasksBaseFile: 'Tasks.base',
        autoGenerateBases: true,
        autoUpdateBaseViews: true,
        taskTypes: [
          { name: 'Task', color: 'blue' },
          { name: 'Bug', color: 'red' },
          { name: 'Feature', color: 'green' },
          { name: 'Improvement', color: 'purple' },
          { name: 'Chore', color: 'gray' }
        ],
        taskPriorities: [
          { name: 'Low', color: 'green' },
          { name: 'Medium', color: 'yellow' },
          { name: 'High', color: 'orange' },
          { name: 'Urgent', color: 'red' }
        ],
        taskStatuses: [
          { name: 'Backlog', color: 'gray', isDone: false },
          { name: 'In Progress', color: 'blue', isDone: false },
          { name: 'Done', color: 'green', isDone: true }
        ],
        areaBasesEnabled: true,
        projectBasesEnabled: true,
        autoSyncAreaProjectBases: true,
        taskPropertyOrder: ['TITLE', 'TYPE', 'PRIORITY', 'AREAS', 'PROJECT', 'DONE', 'STATUS', 'PARENT_TASK', 'SUB_TASKS', 'TAGS']
      };

      expect(typeof settings.defaultTaskTemplate).toBe('string');
      expect(settings.defaultTaskTemplate).toBe('Task Template');
    });

    it('should validate boolean settings', () => {
      const settings: TaskSyncSettings = {
        tasksFolder: 'Tasks',
        projectsFolder: 'Projects',
        areasFolder: 'Areas',
        templateFolder: 'Templates',
        useTemplater: true,
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
          { name: 'Feature', color: 'green' },
          { name: 'Improvement', color: 'purple' },
          { name: 'Chore', color: 'gray' }
        ],
        taskPriorities: [
          { name: 'Low', color: 'green' },
          { name: 'Medium', color: 'yellow' },
          { name: 'High', color: 'orange' },
          { name: 'Urgent', color: 'red' }
        ],
        taskStatuses: [
          { name: 'Backlog', color: 'gray', isDone: false },
          { name: 'In Progress', color: 'blue', isDone: false },
          { name: 'Done', color: 'green', isDone: true }
        ],
        areaBasesEnabled: true,
        projectBasesEnabled: true,
        autoSyncAreaProjectBases: true,
        taskPropertyOrder: ['TITLE', 'TYPE', 'PRIORITY', 'AREAS', 'PROJECT', 'DONE', 'STATUS', 'PARENT_TASK', 'SUB_TASKS', 'TAGS']
      };

      expect(typeof settings.useTemplater).toBe('boolean');
      expect(settings.useTemplater).toBe(true);
    });

    it('should validate string settings', () => {
      const settings: TaskSyncSettings = {
        tasksFolder: 'Custom/Tasks',
        projectsFolder: 'Custom/Projects',
        areasFolder: 'Custom/Areas',
        templateFolder: 'Custom/Templates',
        useTemplater: false,
        defaultTaskTemplate: 'task-template.md',
        defaultProjectTemplate: 'project-template.md',
        defaultAreaTemplate: 'area-template.md',
        defaultParentTaskTemplate: 'parent-task-template.md',
        basesFolder: 'Bases',
        tasksBaseFile: 'Tasks.base',
        autoGenerateBases: true,
        autoUpdateBaseViews: true,
        taskTypes: [
          { name: 'Task', color: 'blue' },
          { name: 'Bug', color: 'red' },
          { name: 'Feature', color: 'green' },
          { name: 'Improvement', color: 'purple' },
          { name: 'Chore', color: 'gray' }
        ],
        taskPriorities: [
          { name: 'Low', color: 'green' },
          { name: 'Medium', color: 'yellow' },
          { name: 'High', color: 'orange' },
          { name: 'Urgent', color: 'red' }
        ],
        taskStatuses: [
          { name: 'Backlog', color: 'gray', isDone: false },
          { name: 'In Progress', color: 'blue', isDone: false },
          { name: 'Done', color: 'green', isDone: true }
        ],
        areaBasesEnabled: true,
        projectBasesEnabled: true,
        autoSyncAreaProjectBases: true,
        taskPropertyOrder: ['TITLE', 'TYPE', 'PRIORITY', 'AREAS', 'PROJECT', 'DONE', 'STATUS', 'PARENT_TASK', 'SUB_TASKS', 'TAGS']
      };

      expect(typeof settings.tasksFolder).toBe('string');
      expect(typeof settings.projectsFolder).toBe('string');
      expect(typeof settings.areasFolder).toBe('string');
      expect(typeof settings.templateFolder).toBe('string');
      expect(typeof settings.defaultTaskTemplate).toBe('string');
      expect(typeof settings.defaultProjectTemplate).toBe('string');
      expect(typeof settings.defaultAreaTemplate).toBe('string');
    });
  });

  describe('Settings Validation Logic', () => {
    it('should handle empty folder paths', () => {
      const settings: TaskSyncSettings = {
        tasksFolder: '',
        projectsFolder: '',
        areasFolder: '',
        templateFolder: '',
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
          { name: 'Feature', color: 'green' },
          { name: 'Improvement', color: 'purple' },
          { name: 'Chore', color: 'gray' }
        ],
        taskPriorities: [
          { name: 'Low', color: 'green' },
          { name: 'Medium', color: 'yellow' },
          { name: 'High', color: 'orange' },
          { name: 'Urgent', color: 'red' }
        ],
        taskStatuses: [
          { name: 'Backlog', color: 'gray', isDone: false },
          { name: 'In Progress', color: 'blue', isDone: false },
          { name: 'Done', color: 'green', isDone: true }
        ],
        areaBasesEnabled: true,
        projectBasesEnabled: true,
        autoSyncAreaProjectBases: true,
        taskPropertyOrder: ['TITLE', 'TYPE', 'PRIORITY', 'AREAS', 'PROJECT', 'DONE', 'STATUS', 'PARENT_TASK', 'SUB_TASKS', 'TAGS']
      };

      // Empty strings should be valid (user might not want to use certain folders)
      expect(settings.tasksFolder).toBe('');
      expect(settings.projectsFolder).toBe('');
      expect(settings.areasFolder).toBe('');
      expect(settings.templateFolder).toBe('');
    });

    it('should handle template folder validation', () => {
      const templateFolder = 'Templates';

      expect(typeof templateFolder).toBe('string');
      expect(templateFolder.length).toBeGreaterThan(0);
    });

    it('should handle template settings combinations', () => {
      // Test when Templater is enabled but no templates specified
      const settings1: TaskSyncSettings = {
        tasksFolder: 'Tasks',
        projectsFolder: 'Projects',
        areasFolder: 'Areas',
        templateFolder: 'Templates',
        useTemplater: true,
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
          { name: 'Feature', color: 'green' },
          { name: 'Improvement', color: 'purple' },
          { name: 'Chore', color: 'gray' }
        ],
        taskPriorities: [
          { name: 'Low', color: 'green' },
          { name: 'Medium', color: 'yellow' },
          { name: 'High', color: 'orange' },
          { name: 'Urgent', color: 'red' }
        ],
        taskStatuses: [
          { name: 'Backlog', color: 'gray', isDone: false },
          { name: 'In Progress', color: 'blue', isDone: false },
          { name: 'Done', color: 'green', isDone: true }
        ],
        areaBasesEnabled: true,
        projectBasesEnabled: true,
        autoSyncAreaProjectBases: true,
        taskPropertyOrder: ['TITLE', 'TYPE', 'PRIORITY', 'AREAS', 'PROJECT', 'DONE', 'STATUS', 'PARENT_TASK', 'SUB_TASKS', 'TAGS']
      };

      expect(settings1.useTemplater).toBe(true);
      expect(settings1.defaultTaskTemplate).toBe('');

      // Test when Templater is disabled but templates are specified
      const settings2: TaskSyncSettings = {
        tasksFolder: 'Tasks',
        projectsFolder: 'Projects',
        areasFolder: 'Areas',
        templateFolder: 'Templates',
        useTemplater: false,
        defaultTaskTemplate: 'task.md',
        defaultProjectTemplate: 'project.md',
        defaultAreaTemplate: 'area.md',
        defaultParentTaskTemplate: 'parent-task.md',
        basesFolder: 'Bases',
        tasksBaseFile: 'Tasks.base',
        autoGenerateBases: true,
        autoUpdateBaseViews: true,
        taskTypes: [
          { name: 'Task', color: 'blue' },
          { name: 'Bug', color: 'red' },
          { name: 'Feature', color: 'green' },
          { name: 'Improvement', color: 'purple' },
          { name: 'Chore', color: 'gray' }
        ],
        taskPriorities: [
          { name: 'Low', color: 'green' },
          { name: 'Medium', color: 'yellow' },
          { name: 'High', color: 'orange' },
          { name: 'Urgent', color: 'red' }
        ],
        taskStatuses: [
          { name: 'Backlog', color: 'gray', isDone: false },
          { name: 'In Progress', color: 'blue', isDone: false },
          { name: 'Done', color: 'green', isDone: true }
        ],
        areaBasesEnabled: true,
        projectBasesEnabled: true,
        autoSyncAreaProjectBases: true,
        taskPropertyOrder: ['TITLE', 'TYPE', 'PRIORITY', 'AREAS', 'PROJECT', 'DONE', 'STATUS', 'PARENT_TASK', 'SUB_TASKS', 'TAGS']
      };

      expect(settings2.useTemplater).toBe(false);
      expect(settings2.defaultTaskTemplate).toBe('task.md');
    });
  });

  describe('Folder Path Validation', () => {
    it('should reject "Obsidian" folder names', () => {
      const result1 = validateFolderPath('Obsidian');
      expect(result1.isValid).toBe(false);
      expect(result1.error).toContain('Obsidian');
      expect(result1.error).toContain('not recommended');

      const result2 = validateFolderPath('Obsidian/Templates');
      expect(result2.isValid).toBe(false);
      expect(result2.error).toContain('Obsidian');

      const result3 = validateFolderPath('obsidian/templates');
      expect(result3.isValid).toBe(false);
      expect(result3.error).toContain('obsidian');
    });

    it('should accept valid folder names', () => {
      const result1 = validateFolderPath('Templates');
      expect(result1.isValid).toBe(true);

      const result2 = validateFolderPath('MyTemplates');
      expect(result2.isValid).toBe(true);

      const result3 = validateFolderPath('Custom/Templates');
      expect(result3.isValid).toBe(true);

      const result4 = validateFolderPath('');
      expect(result4.isValid).toBe(true);
    });

    it('should reject invalid characters', () => {
      const result1 = validateFolderPath('Templates<>');
      expect(result1.isValid).toBe(false);
      expect(result1.error).toContain('invalid characters');

      const result2 = validateFolderPath('Templates|Test');
      expect(result2.isValid).toBe(false);
      expect(result2.error).toContain('invalid characters');
    });
  });
});
