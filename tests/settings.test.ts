import { describe, it, expect } from 'vitest';
import { TaskSyncSettings } from '../src/main';
import { validateFolderPath } from '../src/components/ui/settings';
import { DEFAULT_SETTINGS } from '../src/components/ui/settings/defaults';
import { PROPERTY_SETS } from '../src/services/base-definitions/BaseConfigurations';

describe('TaskSync Settings', () => {
  describe('Settings Interface', () => {
    it('should have correct default settings structure', () => {
      // Test the actual DEFAULT_SETTINGS values
      expect(DEFAULT_SETTINGS.tasksFolder).toBe('Tasks');
      expect(DEFAULT_SETTINGS.projectsFolder).toBe('Projects');
      expect(DEFAULT_SETTINGS.areasFolder).toBe('Areas');
      expect(DEFAULT_SETTINGS.templateFolder).toBe('Templates');
      expect(DEFAULT_SETTINGS.useTemplater).toBe(false);
      expect(DEFAULT_SETTINGS.defaultTaskTemplate).toBe('Task.md');
      expect(DEFAULT_SETTINGS.defaultProjectTemplate).toBe('project-template.md');
      expect(DEFAULT_SETTINGS.defaultAreaTemplate).toBe('area-template.md');
      expect(DEFAULT_SETTINGS.defaultParentTaskTemplate).toBe('parent-task-template.md');
      expect(DEFAULT_SETTINGS.autoUpdateBaseViews).toBe(true);
      expect(DEFAULT_SETTINGS.areaBasesEnabled).toBe(true);
      expect(DEFAULT_SETTINGS.projectBasesEnabled).toBe(true);
      expect(DEFAULT_SETTINGS.autoSyncAreaProjectBases).toBe(true);

      // Test array structures
      expect(Array.isArray(DEFAULT_SETTINGS.taskTypes)).toBe(true);
      expect(DEFAULT_SETTINGS.taskTypes).toHaveLength(5);
      expect(Array.isArray(DEFAULT_SETTINGS.taskPriorities)).toBe(true);
      expect(DEFAULT_SETTINGS.taskPriorities).toHaveLength(4);
      expect(Array.isArray(DEFAULT_SETTINGS.taskStatuses)).toBe(true);
      expect(DEFAULT_SETTINGS.taskStatuses).toHaveLength(3);
      expect(Array.isArray(DEFAULT_SETTINGS.taskPropertyOrder)).toBe(true);
      expect(DEFAULT_SETTINGS.taskPropertyOrder).toHaveLength(PROPERTY_SETS.TASK_FRONTMATTER.length);
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
        ...DEFAULT_SETTINGS
      };

      expect(typeof settings.defaultTaskTemplate).toBe('string');
      expect(settings.defaultTaskTemplate).toBe('Task.md');
    });

    it('should validate boolean settings', () => {
      const settings: TaskSyncSettings = {
        ...DEFAULT_SETTINGS,
        useTemplater: true
      };

      expect(typeof settings.useTemplater).toBe('boolean');
      expect(settings.useTemplater).toBe(true);
    });

    it('should validate string settings', () => {
      const settings: TaskSyncSettings = {
        ...DEFAULT_SETTINGS,
        tasksFolder: 'Custom/Tasks',
        projectsFolder: 'Custom/Projects',
        areasFolder: 'Custom/Areas',
        templateFolder: 'Custom/Templates',
        defaultTaskTemplate: 'task-template.md',
        defaultProjectTemplate: 'project-template.md',
        defaultAreaTemplate: 'area-template.md',
        defaultParentTaskTemplate: 'parent-task-template.md'
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
        ...DEFAULT_SETTINGS,
        tasksFolder: '',
        projectsFolder: '',
        areasFolder: '',
        templateFolder: ''
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
        ...DEFAULT_SETTINGS,
        useTemplater: true
      };

      expect(settings1.useTemplater).toBe(true);
      expect(settings1.defaultTaskTemplate).toBe('Task.md'); // DEFAULT_SETTINGS has 'Task.md', not empty string

      // Test when Templater is disabled but templates are specified
      const settings2: TaskSyncSettings = {
        ...DEFAULT_SETTINGS,
        useTemplater: false,
        defaultTaskTemplate: 'task.md',
        defaultProjectTemplate: 'project.md',
        defaultAreaTemplate: 'area.md',
        defaultParentTaskTemplate: 'parent-task.md'
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
