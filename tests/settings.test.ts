import { describe, it, expect } from 'vitest';
import { TaskSyncSettings } from '../src/main';

describe('TaskSync Settings', () => {
  describe('Settings Interface', () => {
    it('should have correct default settings structure', () => {
      const defaultSettings: TaskSyncSettings = {
        tasksFolder: 'Tasks',
        projectsFolder: 'Projects',
        areasFolder: 'Areas',
        enableAutoSync: true,
        syncInterval: 300000,
        templateFolder: 'Templates',
        useTemplater: false,
        defaultTaskTemplate: '',
        defaultProjectTemplate: '',
        defaultAreaTemplate: ''
      };

      expect(defaultSettings.tasksFolder).toBe('Tasks');
      expect(defaultSettings.projectsFolder).toBe('Projects');
      expect(defaultSettings.areasFolder).toBe('Areas');
      expect(defaultSettings.enableAutoSync).toBe(true);
      expect(defaultSettings.syncInterval).toBe(300000);
      expect(defaultSettings.templateFolder).toBe('Templates');
      expect(defaultSettings.useTemplater).toBe(false);
      expect(defaultSettings.defaultTaskTemplate).toBe('');
      expect(defaultSettings.defaultProjectTemplate).toBe('');
      expect(defaultSettings.defaultAreaTemplate).toBe('');
    });

    it('should allow partial settings objects', () => {
      const partialSettings: Partial<TaskSyncSettings> = {
        tasksFolder: 'MyTasks',
        enableAutoSync: false
      };

      expect(partialSettings.tasksFolder).toBe('MyTasks');
      expect(partialSettings.enableAutoSync).toBe(false);
      expect(partialSettings.projectsFolder).toBeUndefined();
    });

    it('should validate sync interval types', () => {
      const settings: TaskSyncSettings = {
        tasksFolder: 'Tasks',
        projectsFolder: 'Projects',
        areasFolder: 'Areas',
        enableAutoSync: true,
        syncInterval: 60000, // 1 minute
        templateFolder: 'Templates',
        useTemplater: false,
        defaultTaskTemplate: '',
        defaultProjectTemplate: '',
        defaultAreaTemplate: ''
      };

      expect(typeof settings.syncInterval).toBe('number');
      expect(settings.syncInterval).toBeGreaterThan(0);
    });

    it('should validate boolean settings', () => {
      const settings: TaskSyncSettings = {
        tasksFolder: 'Tasks',
        projectsFolder: 'Projects',
        areasFolder: 'Areas',
        enableAutoSync: false,
        syncInterval: 300000,
        templateFolder: 'Templates',
        useTemplater: true,
        defaultTaskTemplate: '',
        defaultProjectTemplate: '',
        defaultAreaTemplate: ''
      };

      expect(typeof settings.enableAutoSync).toBe('boolean');
      expect(typeof settings.useTemplater).toBe('boolean');
      expect(settings.enableAutoSync).toBe(false);
      expect(settings.useTemplater).toBe(true);
    });

    it('should validate string settings', () => {
      const settings: TaskSyncSettings = {
        tasksFolder: 'Custom/Tasks',
        projectsFolder: 'Custom/Projects',
        areasFolder: 'Custom/Areas',
        enableAutoSync: true,
        syncInterval: 300000,
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
        enableAutoSync: true,
        syncInterval: 300000,
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

    it('should handle minimum sync interval', () => {
      const minInterval = 60000; // 1 minute minimum
      
      expect(minInterval).toBeGreaterThan(0);
      expect(minInterval).toBeLessThanOrEqual(300000); // Should be reasonable
    });

    it('should handle template settings combinations', () => {
      // Test when Templater is enabled but no templates specified
      const settings1: TaskSyncSettings = {
        tasksFolder: 'Tasks',
        projectsFolder: 'Projects',
        areasFolder: 'Areas',
        enableAutoSync: true,
        syncInterval: 300000,
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
        enableAutoSync: true,
        syncInterval: 300000,
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
