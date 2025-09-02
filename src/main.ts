import { Plugin, PluginSettingTab, Setting } from 'obsidian';
import { VaultScanner } from './services/VaultScannerService';
import { DashboardModal } from './components/modals/DashboardModal';
import { TaskCreateModal } from './components/modals/TaskCreateModal';
import { ProjectCreateModal } from './components/modals/ProjectCreateModal';
import { AreaCreateModal } from './components/modals/AreaCreateModal';
import { Project, Area, Template } from './types/entities';

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
  vaultScanner: VaultScanner;

  async onload() {
    console.log('Loading Task Sync Plugin');

    // Load settings
    await this.loadSettings();

    // Initialize services
    this.vaultScanner = new VaultScanner(this.app.vault, this.settings);

    // Add settings tab
    this.addSettingTab(new TaskSyncSettingTab(this.app, this));

    // Add commands
    this.addCommand({
      id: 'open-task-dashboard',
      name: 'Open Task Dashboard',
      callback: () => {
        this.openDashboard();
      }
    });

    this.addCommand({
      id: 'add-task',
      name: 'Add Task',
      callback: () => {
        this.openTaskCreateModal();
      }
    });

    this.addCommand({
      id: 'add-project',
      name: 'Add Project',
      callback: () => {
        this.openProjectCreateModal();
      }
    });

    this.addCommand({
      id: 'add-area',
      name: 'Add Area',
      callback: () => {
        this.openAreaCreateModal();
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

  // UI Methods
  private async openDashboard(): Promise<void> {
    try {
      const modal = new DashboardModal(this.app, this);
      modal.open();
    } catch (error) {
      console.error('Failed to open dashboard:', error);
    }
  }

  private async openTaskCreateModal(): Promise<void> {
    try {
      // TODO: Load actual projects and areas from services
      const pickerData = {
        projects: [] as Project[],
        areas: [] as Area[]
      };

      const modal = new TaskCreateModal(this.app, this, pickerData);
      modal.onSubmit(async (taskData) => {
        console.log('Creating task:', taskData);
        // TODO: Implement actual task creation
      });
      modal.open();
    } catch (error) {
      console.error('Failed to open task creation modal:', error);
    }
  }

  private async openProjectCreateModal(): Promise<void> {
    try {
      // TODO: Load actual areas and templates from services
      const areas: Area[] = [];
      const templates: Template[] = [];

      const modal = new ProjectCreateModal(this.app, this, areas, templates);
      modal.onSubmit(async (projectData) => {
        console.log('Creating project:', projectData);
        // TODO: Implement actual project creation
      });
      modal.open();
    } catch (error) {
      console.error('Failed to open project creation modal:', error);
    }
  }

  private async openAreaCreateModal(): Promise<void> {
    try {
      // TODO: Load actual templates from services
      const templates: Template[] = [];

      const modal = new AreaCreateModal(this.app, this, templates);
      modal.onSubmit(async (areaData) => {
        console.log('Creating area:', areaData);
        // TODO: Implement actual area creation
      });
      modal.open();
    } catch (error) {
      console.error('Failed to open area creation modal:', error);
    }
  }
}

class TaskSyncSettingTab extends PluginSettingTab {
  plugin: TaskSyncPlugin;
  private validationErrors: Map<string, string> = new Map();

  constructor(app: any, plugin: TaskSyncPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();
    containerEl.addClass('task-sync-settings');

    // Header
    const header = containerEl.createDiv('task-sync-settings-header');
    header.createEl('h2', { text: 'Task Sync Settings' });
    header.createEl('p', {
      text: 'Configure your task management system. Changes are saved automatically.',
      cls: 'task-sync-settings-description'
    });

    // Create tabbed interface
    this.createTabbedInterface(containerEl);
  }

  private createTabbedInterface(containerEl: HTMLElement): void {
    const tabContainer = containerEl.createDiv('task-sync-settings-tabs');
    const tabHeaders = tabContainer.createDiv('task-sync-settings-tab-headers');
    const tabContent = tabContainer.createDiv('task-sync-settings-tab-content');

    const tabs = [
      { id: 'folders', label: '📁 Folders', content: () => this.createFolderSettings(tabContent) },
      { id: 'sync', label: '🔄 Sync', content: () => this.createSyncSettings(tabContent) },
      { id: 'templates', label: '📝 Templates', content: () => this.createTemplateSettings(tabContent) },
      { id: 'ui', label: '🎨 Interface', content: () => this.createUISettings(tabContent) },
      { id: 'advanced', label: '⚙️ Advanced', content: () => this.createAdvancedSettings(tabContent) }
    ];

    let activeTab = 'folders';

    tabs.forEach((tab, index) => {
      const tabHeader = tabHeaders.createEl('button', {
        text: tab.label,
        cls: `task-sync-settings-tab-header ${index === 0 ? 'active' : ''}`
      });

      tabHeader.addEventListener('click', () => {
        // Update active tab
        tabHeaders.querySelectorAll('.task-sync-settings-tab-header').forEach(h => h.removeClass('active'));
        tabHeader.addClass('active');
        activeTab = tab.id;

        // Update content
        tabContent.empty();
        tab.content();
      });
    });

    // Initialize with first tab
    tabs[0].content();
  }

  private createFolderSettings(container: HTMLElement): void {
    container.createEl('h3', { text: 'Folder Configuration' });
    container.createEl('p', {
      text: 'Specify where your tasks, projects, and areas will be stored in your vault.',
      cls: 'task-sync-settings-section-desc'
    });

    this.createFolderSetting(container, 'tasksFolder', 'Tasks Folder',
      'Folder where task files will be stored', 'Tasks');

    this.createFolderSetting(container, 'projectsFolder', 'Projects Folder',
      'Folder where project files will be stored', 'Projects');

    this.createFolderSetting(container, 'areasFolder', 'Areas Folder',
      'Folder where area files will be stored', 'Areas');

    // Add folder validation info
    const infoBox = container.createDiv('task-sync-settings-info');
    infoBox.createEl('strong', { text: 'Note: ' });
    infoBox.appendText('Folders will be created automatically if they don\'t exist. Use relative paths from your vault root.');
  }

  private createFolderSetting(container: HTMLElement, key: keyof TaskSyncSettings, name: string, desc: string, placeholder: string): void {
    const setting = new Setting(container)
      .setName(name)
      .setDesc(desc)
      .addText(text => {
        text.setPlaceholder(placeholder)
          .setValue(this.plugin.settings[key] as string)
          .onChange(async (value) => {
            const validation = this.validateFolderPath(value);
            if (validation.isValid) {
              this.clearValidationError(key);
              (this.plugin.settings[key] as any) = value;
              await this.plugin.saveSettings();
            } else {
              this.setValidationError(key, validation.error!);
            }
            this.updateSettingValidation(setting, key);
          });
      });

    this.updateSettingValidation(setting, key);
  }

  private createSyncSettings(container: HTMLElement): void {
    container.createEl('h3', { text: 'Sync Configuration' });
    container.createEl('p', {
      text: 'Configure how and when your tasks are synchronized.',
      cls: 'task-sync-settings-section-desc'
    });

    new Setting(container)
      .setName('Enable Auto Sync')
      .setDesc('Automatically sync tasks at regular intervals')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.enableAutoSync)
        .onChange(async (value) => {
          this.plugin.settings.enableAutoSync = value;
          await this.plugin.saveSettings();
        }));

    new Setting(container)
      .setName('Sync Interval (minutes)')
      .setDesc('How often to sync tasks (in minutes)')
      .addText(text => text
        .setPlaceholder('5')
        .setValue(String(this.plugin.settings.syncInterval / 60000))
        .onChange(async (value) => {
          const validation = this.validateSyncInterval(value);
          if (validation.isValid) {
            this.clearValidationError('syncInterval');
            const minutes = parseInt(value) || 5;
            this.plugin.settings.syncInterval = minutes * 60000;
            await this.plugin.saveSettings();
          } else {
            this.setValidationError('syncInterval', validation.error!);
          }
        }));
  }

  private createTemplateSettings(container: HTMLElement): void {
    container.createEl('h3', { text: 'Template Configuration' });
    container.createEl('p', {
      text: 'Configure template integration for creating tasks, projects, and areas.',
      cls: 'task-sync-settings-section-desc'
    });

    this.createFolderSetting(container, 'templateFolder', 'Template Folder',
      'Folder where templates are stored', 'Templates');

    new Setting(container)
      .setName('Use Templater Plugin')
      .setDesc('Enable integration with Templater plugin for advanced templates')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.useTemplater)
        .onChange(async (value) => {
          this.plugin.settings.useTemplater = value;
          await this.plugin.saveSettings();
        }));

    // Default template settings
    new Setting(container)
      .setName('Default Task Template')
      .setDesc('Default template to use when creating new tasks')
      .addText(text => text
        .setPlaceholder('task-template.md')
        .setValue(this.plugin.settings.defaultTaskTemplate)
        .onChange(async (value) => {
          this.plugin.settings.defaultTaskTemplate = value;
          await this.plugin.saveSettings();
        }));

    new Setting(container)
      .setName('Default Project Template')
      .setDesc('Default template to use when creating new projects')
      .addText(text => text
        .setPlaceholder('project-template.md')
        .setValue(this.plugin.settings.defaultProjectTemplate)
        .onChange(async (value) => {
          this.plugin.settings.defaultProjectTemplate = value;
          await this.plugin.saveSettings();
        }));

    new Setting(container)
      .setName('Default Area Template')
      .setDesc('Default template to use when creating new areas')
      .addText(text => text
        .setPlaceholder('area-template.md')
        .setValue(this.plugin.settings.defaultAreaTemplate)
        .onChange(async (value) => {
          this.plugin.settings.defaultAreaTemplate = value;
          await this.plugin.saveSettings();
        }));
  }

  private createUISettings(container: HTMLElement): void {
    container.createEl('h3', { text: 'Interface Settings' });
    container.createEl('p', {
      text: 'Customize the appearance and behavior of the Task Sync interface.',
      cls: 'task-sync-settings-section-desc'
    });

    // TODO: Add UI-specific settings like default view, theme preferences, etc.
    const placeholder = container.createDiv('task-sync-settings-placeholder');
    placeholder.createEl('p', { text: 'UI customization options will be available in a future update.' });
  }

  private createAdvancedSettings(container: HTMLElement): void {
    container.createEl('h3', { text: 'Advanced Settings' });
    container.createEl('p', {
      text: 'Advanced configuration options for power users.',
      cls: 'task-sync-settings-section-desc'
    });

    // TODO: Add advanced settings like debug mode, performance options, etc.
    const placeholder = container.createDiv('task-sync-settings-placeholder');
    placeholder.createEl('p', { text: 'Advanced options will be available in a future update.' });
  }

  // Validation methods
  private validateFolderPath(path: string): { isValid: boolean; error?: string } {
    if (!path.trim()) {
      return { isValid: false, error: 'Folder path cannot be empty' };
    }

    if (path.includes('..') || path.startsWith('/')) {
      return { isValid: false, error: 'Invalid folder path' };
    }

    return { isValid: true };
  }

  private validateSyncInterval(value: string): { isValid: boolean; error?: string } {
    const minutes = parseInt(value);
    if (isNaN(minutes) || minutes < 1) {
      return { isValid: false, error: 'Sync interval must be at least 1 minute' };
    }
    if (minutes > 1440) {
      return { isValid: false, error: 'Sync interval cannot exceed 24 hours (1440 minutes)' };
    }
    return { isValid: true };
  }

  // Validation error management
  private setValidationError(key: string, error: string): void {
    this.validationErrors.set(key, error);
  }

  private clearValidationError(key: string): void {
    this.validationErrors.delete(key);
  }

  private updateSettingValidation(setting: Setting, key: string): void {
    const error = this.validationErrors.get(key);
    if (error) {
      setting.setDesc(`${setting.descEl.textContent} ⚠️ ${error}`);
      setting.settingEl.addClass('task-sync-setting-error');
    } else {
      setting.settingEl.removeClass('task-sync-setting-error');
    }
  }
}
