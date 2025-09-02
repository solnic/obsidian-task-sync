import { describe, it, expect, beforeEach, vi } from 'vitest';
import TaskSyncPlugin, { TaskSyncSettings } from '../src/main';

describe('TaskSyncPlugin', () => {
  let plugin: TaskSyncPlugin;
  let mockApp: any;

  beforeEach(() => {
    mockApp = {
      vault: {
        adapter: {
          exists: vi.fn(),
          read: vi.fn(),
          write: vi.fn(),
          mkdir: vi.fn(),
        },
      },
      workspace: {
        on: vi.fn(),
        off: vi.fn(),
      },
    };

    plugin = new TaskSyncPlugin(mockApp, {
      id: 'obsidian-task-sync',
      name: 'Task Sync',
      version: '1.0.0',
      minAppVersion: '0.15.0',
      description: 'Test plugin',
      author: 'Test Author',
    });
  });

  describe('Plugin Lifecycle', () => {
    it('should load successfully', async () => {
      const loadDataSpy = vi.spyOn(plugin, 'loadData').mockResolvedValue({});
      const addCommandSpy = vi.spyOn(plugin, 'addCommand');
      const addSettingTabSpy = vi.spyOn(plugin, 'addSettingTab');

      await plugin.onload();

      expect(loadDataSpy).toHaveBeenCalled();
      expect(addCommandSpy).toHaveBeenCalledTimes(4); // 4 commands defined
      expect(addSettingTabSpy).toHaveBeenCalled();
    });

    it('should unload successfully', () => {
      const consoleSpy = vi.spyOn(console, 'log');

      plugin.onunload();

      expect(consoleSpy).toHaveBeenCalledWith('Unloading Task Sync Plugin');
    });
  });

  describe('Settings Management', () => {
    it('should load default settings when no saved data exists', async () => {
      vi.spyOn(plugin, 'loadData').mockResolvedValue(null);

      await plugin.loadSettings();

      expect(plugin.settings).toEqual({
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
      });
    });

    it('should merge saved settings with defaults', async () => {
      const savedSettings = {
        tasksFolder: 'MyTasks',
        enableAutoSync: false,
      };
      vi.spyOn(plugin, 'loadData').mockResolvedValue(savedSettings);

      await plugin.loadSettings();

      expect(plugin.settings.tasksFolder).toBe('MyTasks');
      expect(plugin.settings.enableAutoSync).toBe(false);
      expect(plugin.settings.projectsFolder).toBe('Projects'); // Should use default
    });

    it('should save settings correctly', async () => {
      const saveDataSpy = vi.spyOn(plugin, 'saveData').mockResolvedValue();
      plugin.settings = {
        tasksFolder: 'CustomTasks',
        projectsFolder: 'CustomProjects',
        areasFolder: 'CustomAreas',
        enableAutoSync: true,
        syncInterval: 600000,
        templateFolder: 'CustomTemplates',
        useTemplater: true,
        defaultTaskTemplate: 'task-template',
        defaultProjectTemplate: 'project-template',
        defaultAreaTemplate: 'area-template'
      };

      await plugin.saveSettings();

      expect(saveDataSpy).toHaveBeenCalledWith(plugin.settings);
    });
  });

  describe('Commands', () => {
    it('should register all required commands', async () => {
      const addCommandSpy = vi.spyOn(plugin, 'addCommand');

      await plugin.onload();

      const commandIds = addCommandSpy.mock.calls.map(call => call[0].id);
      expect(commandIds).toContain('open-task-dashboard');
      expect(commandIds).toContain('add-task');
      expect(commandIds).toContain('add-project');
      expect(commandIds).toContain('add-area');
    });

    it('should have proper command names', async () => {
      const addCommandSpy = vi.spyOn(plugin, 'addCommand');

      await plugin.onload();

      const commands = addCommandSpy.mock.calls.map(call => ({
        id: call[0].id,
        name: call[0].name
      }));

      expect(commands).toContainEqual({ id: 'open-task-dashboard', name: 'Open Task Dashboard' });
      expect(commands).toContainEqual({ id: 'add-task', name: 'Add Task' });
      expect(commands).toContainEqual({ id: 'add-project', name: 'Add Project' });
      expect(commands).toContainEqual({ id: 'add-area', name: 'Add Area' });
    });
  });

  describe('Settings Validation', () => {
    it('should handle invalid sync interval', async () => {
      const savedSettings = {
        syncInterval: 'invalid' as any,
      };
      vi.spyOn(plugin, 'loadData').mockResolvedValue(savedSettings);

      await plugin.loadSettings();

      // Should fall back to default when invalid
      expect(plugin.settings.syncInterval).toBe(300000);
    });

    it('should handle empty folder names', async () => {
      const savedSettings = {
        tasksFolder: '',
        projectsFolder: '',
        areasFolder: '',
      };
      vi.spyOn(plugin, 'loadData').mockResolvedValue(savedSettings);

      await plugin.loadSettings();

      expect(plugin.settings.tasksFolder).toBe('');
      expect(plugin.settings.projectsFolder).toBe('');
      expect(plugin.settings.areasFolder).toBe('');
    });
  });
});
