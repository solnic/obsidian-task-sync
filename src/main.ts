import { Plugin, PluginSettingTab, Setting } from 'obsidian';

// Settings interface
export interface TaskSyncSettings {
  tasksFolder: string;
  projectsFolder: string;
  areasFolder: string;
  enableAutoSync: boolean;
  syncInterval: number;
  templateFolder: string;
  useTemplater: boolean;
  defaultTaskTemplate: string;
  defaultProjectTemplate: string;
  defaultAreaTemplate: string;
}

// Default settings
const DEFAULT_SETTINGS: TaskSyncSettings = {
  tasksFolder: 'Tasks',
  projectsFolder: 'Projects',
  areasFolder: 'Areas',
  enableAutoSync: true,
  syncInterval: 300000, // 5 minutes
  templateFolder: 'Templates',
  useTemplater: false,
  defaultTaskTemplate: '',
  defaultProjectTemplate: '',
  defaultAreaTemplate: ''
};

export default class TaskSyncPlugin extends Plugin {
  settings: TaskSyncSettings;

  async onload() {
    console.log('Loading Task Sync Plugin');

    // Load settings
    await this.loadSettings();

    // Add settings tab
    this.addSettingTab(new TaskSyncSettingTab(this.app, this));

    // Add commands
    this.addCommand({
      id: 'open-task-dashboard',
      name: 'Open Task Dashboard',
      callback: () => {
        console.log('Opening task dashboard...');
        // TODO: Implement dashboard modal
      }
    });

    this.addCommand({
      id: 'add-task',
      name: 'Add Task',
      callback: () => {
        console.log('Adding new task...');
        // TODO: Implement task creation modal
      }
    });

    this.addCommand({
      id: 'add-project',
      name: 'Add Project',
      callback: () => {
        console.log('Adding new project...');
        // TODO: Implement project creation modal
      }
    });

    this.addCommand({
      id: 'add-area',
      name: 'Add Area',
      callback: () => {
        console.log('Adding new area...');
        // TODO: Implement area creation modal
      }
    });
  }

  onunload() {
    console.log('Unloading Task Sync Plugin');
  }

  async loadSettings() {
    try {
      const loadedData = await this.loadData();
      this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData);

      // Perform settings migration if needed
      await this.migrateSettings();

      // Validate settings
      this.validateSettings();
    } catch (error) {
      console.error('Task Sync: Failed to load settings:', error);
      this.settings = { ...DEFAULT_SETTINGS };
    }
  }

  async saveSettings() {
    try {
      await this.saveData(this.settings);
    } catch (error) {
      console.error('Task Sync: Failed to save settings:', error);
      throw error;
    }
  }

  private async migrateSettings() {
    // Future settings migration logic will go here
    // For now, just ensure we have the current version structure
    if (!this.settings.hasOwnProperty('enableAutoSync')) {
      this.settings.enableAutoSync = DEFAULT_SETTINGS.enableAutoSync;
    }
  }

  private validateSettings() {
    // Validate sync interval
    if (typeof this.settings.syncInterval !== 'number' || this.settings.syncInterval < 60000) {
      console.warn('Task Sync: Invalid sync interval, using default');
      this.settings.syncInterval = DEFAULT_SETTINGS.syncInterval;
    }

    // Validate folder names (allow empty strings but ensure they're strings)
    const folderFields = ['tasksFolder', 'projectsFolder', 'areasFolder', 'templateFolder'];
    folderFields.forEach(field => {
      if (typeof this.settings[field as keyof TaskSyncSettings] !== 'string') {
        console.warn(`Task Sync: Invalid ${field}, using default`);
        (this.settings as any)[field] = (DEFAULT_SETTINGS as any)[field];
      }
    });
  }
}

class TaskSyncSettingTab extends PluginSettingTab {
  plugin: TaskSyncPlugin;

  constructor(app: any, plugin: TaskSyncPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    containerEl.createEl('h2', { text: 'Task Sync Settings' });

    // Folder Settings
    containerEl.createEl('h3', { text: 'Folder Configuration' });

    new Setting(containerEl)
      .setName('Tasks Folder')
      .setDesc('Folder where task files will be stored')
      .addText(text => text
        .setPlaceholder('Tasks')
        .setValue(this.plugin.settings.tasksFolder)
        .onChange(async (value) => {
          this.plugin.settings.tasksFolder = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Projects Folder')
      .setDesc('Folder where project files will be stored')
      .addText(text => text
        .setPlaceholder('Projects')
        .setValue(this.plugin.settings.projectsFolder)
        .onChange(async (value) => {
          this.plugin.settings.projectsFolder = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Areas Folder')
      .setDesc('Folder where area files will be stored')
      .addText(text => text
        .setPlaceholder('Areas')
        .setValue(this.plugin.settings.areasFolder)
        .onChange(async (value) => {
          this.plugin.settings.areasFolder = value;
          await this.plugin.saveSettings();
        }));

    // Sync Settings
    containerEl.createEl('h3', { text: 'Sync Configuration' });

    new Setting(containerEl)
      .setName('Enable Auto Sync')
      .setDesc('Automatically sync tasks at regular intervals')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.enableAutoSync)
        .onChange(async (value) => {
          this.plugin.settings.enableAutoSync = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Sync Interval (minutes)')
      .setDesc('How often to sync tasks (in minutes)')
      .addText(text => text
        .setPlaceholder('5')
        .setValue(String(this.plugin.settings.syncInterval / 60000))
        .onChange(async (value) => {
          const minutes = parseInt(value) || 5;
          this.plugin.settings.syncInterval = minutes * 60000;
          await this.plugin.saveSettings();
        }));

    // Template Settings
    containerEl.createEl('h3', { text: 'Template Configuration' });

    new Setting(containerEl)
      .setName('Template Folder')
      .setDesc('Folder where templates are stored')
      .addText(text => text
        .setPlaceholder('Templates')
        .setValue(this.plugin.settings.templateFolder)
        .onChange(async (value) => {
          this.plugin.settings.templateFolder = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Use Templater Plugin')
      .setDesc('Enable integration with Templater plugin for advanced templates')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.useTemplater)
        .onChange(async (value) => {
          this.plugin.settings.useTemplater = value;
          await this.plugin.saveSettings();
        }));
  }
}
