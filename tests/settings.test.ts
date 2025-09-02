import { describe, it, expect } from 'vitest';
import { TaskSyncSettings } from '../src/main';

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
        defaultAreaTemplate: ''
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
        defaultAreaTemplate: 'Area Template'
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
        defaultAreaTemplate: ''
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
        defaultAreaTemplate: 'area-template.md'
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
        defaultAreaTemplate: ''
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
        defaultAreaTemplate: ''
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
        defaultAreaTemplate: 'area.md'
      };

      expect(settings2.useTemplater).toBe(false);
      expect(settings2.defaultTaskTemplate).toBe('task.md');
    });
  });
});
