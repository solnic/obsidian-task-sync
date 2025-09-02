import { Plugin, PluginSettingTab, Setting } from 'obsidian';
import { VaultScanner } from './services/VaultScannerService';
import { BaseManager } from './services/BaseManager';
import { TaskCreateModal } from './components/modals/TaskCreateModal';

// Settings interface
export interface TaskSyncSettings {
  tasksFolder: string;
  projectsFolder: string;
  areasFolder: string;
  templateFolder: string;
  useTemplater: boolean;
  defaultTaskTemplate: string;
  defaultProjectTemplate: string;
  defaultAreaTemplate: string;
  // Base-related settings
  basesFolder: string;
  tasksBaseFile: string;
  autoGenerateBases: boolean;
  autoUpdateBaseViews: boolean;
}

// File context interface for context-aware modal
export interface FileContext {
  type: 'project' | 'area' | 'none';
  name?: string;
  path?: string;
}

// Default settings
const DEFAULT_SETTINGS: TaskSyncSettings = {
  tasksFolder: 'Tasks',
  projectsFolder: 'Projects',
  areasFolder: 'Areas',
  templateFolder: 'Templates',
  useTemplater: false,
  defaultTaskTemplate: '',
  defaultProjectTemplate: '',
  defaultAreaTemplate: '',
  // Base-related defaults
  basesFolder: 'Bases',
  tasksBaseFile: 'Tasks.base',
  autoGenerateBases: true,
  autoUpdateBaseViews: true
};

export default class TaskSyncPlugin extends Plugin {
  settings: TaskSyncSettings;
  vaultScanner: VaultScanner;
  baseManager: BaseManager;

  async onload() {
    console.log('Loading Task Sync Plugin');

    // Load settings
    await this.loadSettings();

    // Initialize services
    this.vaultScanner = new VaultScanner(this.app.vault, this.settings);
    this.baseManager = new BaseManager(this.app.vault, this.settings);

    // Add settings tab
    this.addSettingTab(new TaskSyncSettingTab(this.app, this));

    // Initialize bases if auto-generate is enabled
    if (this.settings.autoGenerateBases) {
      await this.initializeBases();
    }

    // Add commands
    this.addCommand({
      id: 'add-task',
      name: 'Add Task',
      callback: () => {
        this.openTaskCreateModal();
      }
    });

    this.addCommand({
      id: 'regenerate-bases',
      name: 'Regenerate Task Bases',
      callback: async () => {
        await this.regenerateBases();
      }
    });

    this.addCommand({
      id: 'refresh-base-views',
      name: 'Refresh Base Views',
      callback: async () => {
        await this.refreshBaseViews();
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
  }

  private validateSettings() {
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
  private async openTaskCreateModal(): Promise<void> {
    try {
      const context = this.detectCurrentFileContext();
      const modal = new TaskCreateModal(this.app, this, context);
      modal.onSubmit(async (taskData) => {
        await this.createTask(taskData);
        // Refresh base views if auto-update is enabled
        if (this.settings.autoUpdateBaseViews) {
          await this.refreshBaseViews();
        }
      });
      modal.open();
    } catch (error) {
      console.error('Failed to open task creation modal:', error);
    }
  }

  private detectCurrentFileContext(): FileContext {
    const activeFile = this.app.workspace.getActiveFile();

    if (!activeFile) {
      return { type: 'none' };
    }

    const filePath = activeFile.path;
    const fileName = activeFile.name;

    // Check if file is in projects folder
    if (filePath.startsWith(this.settings.projectsFolder + '/')) {
      return {
        type: 'project',
        name: fileName.replace('.md', ''),
        path: filePath
      };
    }

    // Check if file is in areas folder
    if (filePath.startsWith(this.settings.areasFolder + '/')) {
      return {
        type: 'area',
        name: fileName.replace('.md', ''),
        path: filePath
      };
    }

    return { type: 'none' };
  }

  // Task creation logic
  private async createTask(taskData: any): Promise<void> {
    try {
      const taskFileName = `${taskData.name.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '-')}.md`;
      const taskPath = `${this.settings.tasksFolder}/${taskFileName}`;

      // Create task content based on your template structure
      const taskContent = this.generateTaskContent(taskData);

      await this.app.vault.create(taskPath, taskContent);
      console.log('Task created successfully:', taskPath);
    } catch (error) {
      console.error('Failed to create task:', error);
      throw error;
    }
  }

  private generateTaskContent(taskData: any): string {
    const frontmatter = [
      '---',
      `Title: ${taskData.name}`,
      `Type: ${taskData.type || 'Task'}`,
      `Areas: ${taskData.areas || ''}`,
      `Parent task: ${taskData.parentTask || ''}`,
      `Sub-tasks: ${taskData.subTasks || ''}`,
      `tags: ${taskData.tags ? taskData.tags.join(', ') : ''}`,
      `Project: ${taskData.project || ''}`,
      `Done: ${taskData.done || false}`,
      `Status: ${taskData.status || 'Backlog'}`,
      `Priority: ${taskData.priority || ''}`,
      '---',
      '',
      taskData.description || 'Task description...',
      ''
    ];

    return frontmatter.join('\n');
  }

  // Base Management Methods

  /**
   * Initialize bases on plugin load
   */
  private async initializeBases(): Promise<void> {
    try {
      await this.baseManager.ensureBasesFolder();
      await this.regenerateBases();
      console.log('Task Sync: Bases initialized successfully');
    } catch (error) {
      console.error('Task Sync: Failed to initialize bases:', error);
    }
  }

  /**
   * Regenerate all base files
   */
  async regenerateBases(): Promise<void> {
    try {
      const projectsAndAreas = await this.baseManager.getProjectsAndAreas();
      await this.baseManager.createOrUpdateTasksBase(projectsAndAreas);

      // Ensure base embedding in project and area files
      for (const item of projectsAndAreas) {
        await this.baseManager.ensureBaseEmbedding(item.path);
      }

      console.log('Task Sync: Bases regenerated successfully');
    } catch (error) {
      console.error('Task Sync: Failed to regenerate bases:', error);
    }
  }

  /**
   * Refresh base views (same as regenerate for now)
   */
  private async refreshBaseViews(): Promise<void> {
    await this.regenerateBases();
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
      { id: 'templates', label: '📝 Templates', content: () => this.createTemplateSettings(tabContent) },
      { id: 'bases', label: '🗂️ Bases', content: () => this.createBaseSettings(tabContent) }
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

  private createBaseSettings(container: HTMLElement): void {
    container.createEl('h3', { text: 'Bases Configuration' });
    container.createEl('p', {
      text: 'Configure Obsidian Bases integration for task management and visualization.',
      cls: 'task-sync-settings-section-desc'
    });

    this.createFolderSetting(container, 'basesFolder', 'Bases Folder',
      'Folder where .base files are stored', 'Bases');

    new Setting(container)
      .setName('Tasks Base File')
      .setDesc('Name of the main tasks base file')
      .addText(text => text
        .setPlaceholder('Tasks.base')
        .setValue(this.plugin.settings.tasksBaseFile)
        .onChange(async (value) => {
          this.plugin.settings.tasksBaseFile = value;
          await this.plugin.saveSettings();
        }));

    new Setting(container)
      .setName('Auto-Generate Bases')
      .setDesc('Automatically create and update base files when the plugin loads')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.autoGenerateBases)
        .onChange(async (value) => {
          this.plugin.settings.autoGenerateBases = value;
          await this.plugin.saveSettings();
        }));

    new Setting(container)
      .setName('Auto-Update Base Views')
      .setDesc('Automatically refresh base views when tasks, projects, or areas change')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.autoUpdateBaseViews)
        .onChange(async (value) => {
          this.plugin.settings.autoUpdateBaseViews = value;
          await this.plugin.saveSettings();
        }));

    // Action buttons
    const actionsContainer = container.createDiv('task-sync-settings-actions');

    const regenerateButton = actionsContainer.createEl('button', {
      text: 'Regenerate Bases',
      cls: 'mod-cta'
    });
    regenerateButton.addEventListener('click', async () => {
      regenerateButton.disabled = true;
      regenerateButton.setText('Regenerating...');
      try {
        await this.plugin.regenerateBases();
        regenerateButton.setText('✓ Regenerated');
        setTimeout(() => {
          regenerateButton.disabled = false;
          regenerateButton.setText('Regenerate Bases');
        }, 2000);
      } catch (error) {
        regenerateButton.setText('✗ Failed');
        console.error('Failed to regenerate bases:', error);
        setTimeout(() => {
          regenerateButton.disabled = false;
          regenerateButton.setText('Regenerate Bases');
        }, 2000);
      }
    });
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
