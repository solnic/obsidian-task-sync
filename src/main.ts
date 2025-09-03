import { Plugin, PluginSettingTab, Setting, TFile } from 'obsidian';
import { VaultScanner } from './services/VaultScannerService';
import { BaseManager } from './services/BaseManager';
import { TaskCreateModal } from './components/modals/TaskCreateModal';
import { AreaCreateModal, AreaCreateData } from './components/modals/AreaCreateModal';
import { ProjectCreateModal, ProjectCreateData } from './components/modals/ProjectCreateModal';
import pluralize from 'pluralize';

// Task type interface with color support
export interface TaskType {
  name: string;
  color: string;
}

// Available colors for task types
export const TASK_TYPE_COLORS = [
  'blue', 'red', 'green', 'yellow', 'purple', 'orange', 'pink', 'gray', 'teal', 'indigo'
] as const;

export type TaskTypeColor = typeof TASK_TYPE_COLORS[number];

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
  // Task types configuration
  taskTypes: TaskType[];
  // Individual area/project bases
  areaBasesEnabled: boolean;
  projectBasesEnabled: boolean;
  autoSyncAreaProjectBases: boolean;
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
  autoUpdateBaseViews: true,
  // Task types defaults
  taskTypes: [
    { name: 'Task', color: 'blue' },
    { name: 'Bug', color: 'red' },
    { name: 'Feature', color: 'green' },
    { name: 'Improvement', color: 'purple' },
    { name: 'Chore', color: 'gray' }
  ],
  // Individual area/project bases defaults
  areaBasesEnabled: true,
  projectBasesEnabled: true,
  autoSyncAreaProjectBases: true
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
    this.baseManager = new BaseManager(this.app, this.app.vault, this.settings);

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

    this.addCommand({
      id: 'create-area',
      name: 'Create Area',
      callback: () => {
        this.openAreaCreateModal();
      }
    });

    this.addCommand({
      id: 'create-project',
      name: 'Create Project',
      callback: () => {
        this.openProjectCreateModal();
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

  /**
   * Open area creation modal
   */
  private openAreaCreateModal(): void {
    try {
      const modal = new AreaCreateModal(this.app, this);
      modal.onSubmit(async (areaData) => {
        await this.createArea(areaData);
        // Refresh base views if auto-update is enabled
        if (this.settings.autoUpdateBaseViews) {
          await this.refreshBaseViews();
        }
      });
      modal.open();
    } catch (error) {
      console.error('Failed to open area creation modal:', error);
    }
  }

  /**
   * Open project creation modal
   */
  private openProjectCreateModal(): void {
    try {
      const modal = new ProjectCreateModal(this.app, this);
      modal.onSubmit(async (projectData) => {
        await this.createProject(projectData);
        // Refresh base views if auto-update is enabled
        if (this.settings.autoUpdateBaseViews) {
          await this.refreshBaseViews();
        }
      });
      modal.open();
    } catch (error) {
      console.error('Failed to open project creation modal:', error);
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
      const taskFileName = `${taskData.name}.md`;
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

  /**
   * Create a new area
   */
  private async createArea(areaData: AreaCreateData): Promise<void> {
    try {
      const areaFileName = `${areaData.name}.md`;
      const areaPath = `${this.settings.areasFolder}/${areaFileName}`;

      // Use template if configured, otherwise use default
      let areaContent: string;
      if (this.settings.defaultAreaTemplate) {
        areaContent = await this.generateFromTemplate(this.settings.defaultAreaTemplate, areaData);
      } else {
        areaContent = this.generateAreaContent(areaData);
      }

      await this.app.vault.create(areaPath, areaContent);
      console.log('Area created successfully:', areaPath);

      // Create individual base if enabled
      if (this.settings.areaBasesEnabled && this.settings.autoSyncAreaProjectBases) {
        await this.baseManager.createOrUpdateAreaBase({
          name: areaData.name,
          path: areaPath,
          type: 'area'
        });
      }
    } catch (error) {
      console.error('Failed to create area:', error);
      throw error;
    }
  }

  /**
   * Create a new project
   */
  private async createProject(projectData: ProjectCreateData): Promise<void> {
    try {
      const projectFileName = `${projectData.name}.md`;
      const projectPath = `${this.settings.projectsFolder}/${projectFileName}`;

      // Use template if configured, otherwise use default
      let projectContent: string;
      if (this.settings.defaultProjectTemplate) {
        projectContent = await this.generateFromTemplate(this.settings.defaultProjectTemplate, projectData);
      } else {
        projectContent = this.generateProjectContent(projectData);
      }

      await this.app.vault.create(projectPath, projectContent);
      console.log('Project created successfully:', projectPath);

      // Create individual base if enabled
      if (this.settings.projectBasesEnabled && this.settings.autoSyncAreaProjectBases) {
        await this.baseManager.createOrUpdateProjectBase({
          name: projectData.name,
          path: projectPath,
          type: 'project'
        });
      }
    } catch (error) {
      console.error('Failed to create project:', error);
      throw error;
    }
  }

  /**
   * Generate default area content
   */
  private generateAreaContent(areaData: AreaCreateData): string {
    const frontmatter = [
      '---',
      `Name: ${areaData.name}`,
      `Type: Area`,
      '---',
      '',
      '## Notes',
      '',
      areaData.description || 'This is a cool area',
      '',
      '## Tasks',
      '',
      `![[${areaData.name}.base]]`,
      ''
    ];

    return frontmatter.join('\n');
  }

  /**
   * Generate default project content
   */
  private generateProjectContent(projectData: ProjectCreateData): string {
    const frontmatter = [
      '---',
      `Name: ${projectData.name}`,
      `Type: Project`,
      `Areas: ${projectData.areas || ''}`,
      '---',
      '',
      '## Notes',
      '',
      projectData.description || 'This is a cool project',
      '',
      '## Tasks',
      '',
      `![[${projectData.name}.base]]`,
      ''
    ];

    return frontmatter.join('\n');
  }

  /**
   * Generate content from template with proper base embedding
   */
  private async generateFromTemplate(templateName: string, data: any): Promise<string> {
    try {
      const templatePath = `${this.settings.templateFolder}/${templateName}`;
      const templateFile = this.app.vault.getAbstractFileByPath(templatePath);

      if (!templateFile || !(templateFile instanceof TFile)) {
        console.warn(`Template not found: ${templatePath}, using default content`);
        if (data.hasOwnProperty('areas')) {
          return this.generateProjectContent(data as ProjectCreateData);
        } else {
          return this.generateAreaContent(data as AreaCreateData);
        }
      }

      let templateContent = await this.app.vault.read(templateFile);

      // Replace template variables
      templateContent = this.processTemplateVariables(templateContent, data);

      // Ensure proper base embedding
      templateContent = this.ensureProperBaseEmbedding(templateContent, data);

      return templateContent;
    } catch (error) {
      console.error(`Failed to process template ${templateName}:`, error);
      // Fallback to default content
      if (data.hasOwnProperty('areas')) {
        return this.generateProjectContent(data as ProjectCreateData);
      } else {
        return this.generateAreaContent(data as AreaCreateData);
      }
    }
  }

  /**
   * Process template variables with {{tasks}} syntax support
   */
  private processTemplateVariables(content: string, data: any): string {
    let processedContent = content;

    // Replace common variables
    if (data.name) {
      processedContent = processedContent.replace(/<% tp\.file\.title %>/g, data.name);
      processedContent = processedContent.replace(/\{\{title\}\}/g, data.name);
      processedContent = processedContent.replace(/\{\{name\}\}/g, data.name);
    }

    if (data.description) {
      processedContent = processedContent.replace(/\{\{description\}\}/g, data.description);
    }

    if (data.areas) {
      processedContent = processedContent.replace(/\{\{areas\}\}/g, data.areas);
    }

    // Replace {{tasks}} with appropriate base embed
    if (data.name) {
      const baseEmbed = `![[${this.settings.basesFolder}/${data.name}.base]]`;
      processedContent = processedContent.replace(/\{\{tasks\}\}/g, baseEmbed);
    }

    // Replace date variables
    const now = new Date();
    processedContent = processedContent.replace(/\{\{date\}\}/g, now.toISOString().split('T')[0]);
    processedContent = processedContent.replace(/\{\{time\}\}/g, now.toISOString());

    // Process Templater syntax if enabled
    if (this.settings.useTemplater) {
      processedContent = this.processTemplaterSyntax(processedContent, data);
    }

    return processedContent;
  }

  /**
   * Process Templater plugin syntax if available
   */
  private processTemplaterSyntax(content: string, data: any): string {
    let processedContent = content;

    // Check if Templater plugin is available
    const templaterPlugin = (this.app as any).plugins?.plugins?.['templater-obsidian'];
    if (!templaterPlugin) {
      console.warn('Templater plugin not found, falling back to basic processing');
      return processedContent;
    }

    // Basic Templater syntax processing (can be extended)
    if (data.name) {
      processedContent = processedContent.replace(/<% tp\.file\.title %>/g, data.name);
      processedContent = processedContent.replace(/<% tp\.file\.basename %>/g, data.name);
    }

    // Add more Templater syntax processing as needed
    const now = new Date();
    processedContent = processedContent.replace(/<% tp\.date\.now\(\) %>/g, now.toISOString().split('T')[0]);
    processedContent = processedContent.replace(/<% tp\.date\.now\("YYYY-MM-DD"\) %>/g, now.toISOString().split('T')[0]);

    return processedContent;
  }

  /**
   * Ensure proper base embedding in template content
   */
  private ensureProperBaseEmbedding(content: string, data: any): string {
    const entityName = data.name;
    const expectedBaseEmbed = `![[${this.settings.basesFolder}/${entityName}.base]]`;

    // Check if {{tasks}} was already processed (content contains the expected base embed)
    if (content.includes(expectedBaseEmbed)) {
      return content; // {{tasks}} was processed, no need to add more
    }

    // Check if template has generic Tasks.base embedding - replace it first
    const genericBasePattern = /!\[\[Tasks\.base\]\]/;
    if (genericBasePattern.test(content)) {
      // Replace generic with specific
      return content.replace(genericBasePattern, expectedBaseEmbed);
    }

    // Check if template has any other base embedding already (including display text)
    const anyBasePattern = /!\[\[.*\.base(\|.*?)?\]\]/;
    if (anyBasePattern.test(content)) {
      return content; // Template already has some base embedding, don't interfere
    }

    // Only add base embedding if no base-related content exists
    if (!content.includes('![[') || !content.includes('.base]]')) {
      return content.trim() + `\n\n## Tasks\n${expectedBaseEmbed}`;
    }

    return content;
  }

  // Base Management Methods

  /**
   * Initialize bases on plugin load
   */
  private async initializeBases(): Promise<void> {
    try {
      await this.baseManager.ensureBasesFolder();
      await this.regenerateBases();

      // Auto-generate individual bases for existing areas and projects
      if (this.settings.areaBasesEnabled || this.settings.projectBasesEnabled) {
        await this.autoGenerateExistingBases();
      }

      console.log('Task Sync: Bases initialized successfully');
    } catch (error) {
      console.error('Task Sync: Failed to initialize bases:', error);
    }
  }

  /**
   * Auto-generate bases for existing areas and projects
   */
  private async autoGenerateExistingBases(): Promise<void> {
    try {
      console.log('Auto-generating bases for existing areas and projects...');
      const projectsAndAreas = await this.baseManager.getProjectsAndAreas();

      for (const item of projectsAndAreas) {
        if (item.type === 'area' && this.settings.areaBasesEnabled) {
          await this.baseManager.createOrUpdateAreaBase(item);
        } else if (item.type === 'project' && this.settings.projectBasesEnabled) {
          await this.baseManager.createOrUpdateProjectBase(item);
        }
      }

      console.log('Auto-generation of existing bases completed');
    } catch (error) {
      console.error('Failed to auto-generate existing bases:', error);
    }
  }

  /**
   * Regenerate all base files
   */
  async regenerateBases(): Promise<void> {
    try {
      const projectsAndAreas = await this.baseManager.getProjectsAndAreas();
      await this.baseManager.createOrUpdateTasksBase(projectsAndAreas);

      // Generate individual area and project bases if enabled
      if (this.settings.areaBasesEnabled || this.settings.projectBasesEnabled) {
        await this.baseManager.syncAreaProjectBases();
      }

      // Ensure base embedding in project and area files that don't have individual bases
      for (const item of projectsAndAreas) {
        const shouldHaveIndividualBase =
          (item.type === 'area' && this.settings.areaBasesEnabled) ||
          (item.type === 'project' && this.settings.projectBasesEnabled);

        if (!shouldHaveIndividualBase) {
          await this.baseManager.ensureBaseEmbedding(item.path);
        }
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

  /**
   * Sync area and project bases when settings change
   */
  async syncAreaProjectBases(): Promise<void> {
    try {
      console.log('Syncing area and project bases...');
      await this.baseManager.syncAreaProjectBases();
      console.log('Area and project bases synced successfully');
    } catch (error) {
      console.error('Failed to sync area and project bases:', error);
      throw error;
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

    // Create section-based interface
    this.createSectionInterface(containerEl);
  }

  private createSectionInterface(containerEl: HTMLElement): void {
    const sectionsContainer = containerEl.createDiv('task-sync-settings-sections');

    // Create all sections in order
    this.createGeneralSection(sectionsContainer);
    this.createTemplatesSection(sectionsContainer);
    this.createBasesSection(sectionsContainer);
    this.createTaskTypesSection(sectionsContainer);
  }

  private createGeneralSection(container: HTMLElement): void {
    const section = container.createDiv('task-sync-settings-section');

    // Section header
    section.createEl('h2', { text: 'General', cls: 'task-sync-section-header' });

    this.createFolderSetting(section, 'tasksFolder', 'Tasks Folder',
      'Folder where task files will be stored', 'Tasks');

    this.createFolderSetting(section, 'projectsFolder', 'Projects Folder',
      'Folder where project files will be stored', 'Projects');

    this.createFolderSetting(section, 'areasFolder', 'Areas Folder',
      'Folder where area files will be stored', 'Areas');

    // Add folder validation info
    const infoBox = section.createDiv('task-sync-settings-info');
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



  private createTemplatesSection(container: HTMLElement): void {
    const section = container.createDiv('task-sync-settings-section');

    // Section header
    section.createEl('h2', { text: 'Templates', cls: 'task-sync-section-header' });

    this.createFolderSetting(section, 'templateFolder', 'Template Folder',
      'Folder where templates are stored', 'Templates');

    new Setting(section)
      .setName('Use Templater Plugin')
      .setDesc('Enable integration with Templater plugin for advanced templates')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.useTemplater)
        .onChange(async (value) => {
          this.plugin.settings.useTemplater = value;
          await this.plugin.saveSettings();
        }));

    // Default template settings
    new Setting(section)
      .setName('Default Task Template')
      .setDesc('Default template to use when creating new tasks')
      .addText(text => text
        .setPlaceholder('task-template.md')
        .setValue(this.plugin.settings.defaultTaskTemplate)
        .onChange(async (value) => {
          this.plugin.settings.defaultTaskTemplate = value;
          await this.plugin.saveSettings();
        }));

    new Setting(section)
      .setName('Default Project Template')
      .setDesc('Default template to use when creating new projects')
      .addText(text => text
        .setPlaceholder('project-template.md')
        .setValue(this.plugin.settings.defaultProjectTemplate)
        .onChange(async (value) => {
          this.plugin.settings.defaultProjectTemplate = value;
          await this.plugin.saveSettings();
        }));

    new Setting(section)
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

  private createBasesSection(container: HTMLElement): void {
    const section = container.createDiv('task-sync-settings-section');

    // Section header
    section.createEl('h2', { text: 'Bases Integration', cls: 'task-sync-section-header' });

    this.createFolderSetting(section, 'basesFolder', 'Bases Folder',
      'Folder where .base files are stored', 'Bases');

    new Setting(section)
      .setName('Tasks Base File')
      .setDesc('Name of the main tasks base file')
      .addText(text => text
        .setPlaceholder('Tasks.base')
        .setValue(this.plugin.settings.tasksBaseFile)
        .onChange(async (value) => {
          this.plugin.settings.tasksBaseFile = value;
          await this.plugin.saveSettings();
        }));

    new Setting(section)
      .setName('Auto-Generate Bases')
      .setDesc('Automatically create and update base files when the plugin loads')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.autoGenerateBases)
        .onChange(async (value) => {
          this.plugin.settings.autoGenerateBases = value;
          await this.plugin.saveSettings();
        }));

    new Setting(section)
      .setName('Auto-Update Base Views')
      .setDesc('Automatically refresh base views when tasks, projects, or areas change')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.autoUpdateBaseViews)
        .onChange(async (value) => {
          this.plugin.settings.autoUpdateBaseViews = value;
          await this.plugin.saveSettings();
        }));

    new Setting(section)
      .setName('Enable Area Bases')
      .setDesc('Create individual base files for each area with filtered views')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.areaBasesEnabled)
        .onChange(async (value) => {
          this.plugin.settings.areaBasesEnabled = value;
          await this.plugin.saveSettings();
        }));

    new Setting(section)
      .setName('Enable Project Bases')
      .setDesc('Create individual base files for each project with filtered views')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.projectBasesEnabled)
        .onChange(async (value) => {
          this.plugin.settings.projectBasesEnabled = value;
          await this.plugin.saveSettings();
        }));

    new Setting(section)
      .setName('Auto-Sync Area/Project Bases')
      .setDesc('Automatically update area and project bases when settings change')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.autoSyncAreaProjectBases)
        .onChange(async (value) => {
          this.plugin.settings.autoSyncAreaProjectBases = value;
          await this.plugin.saveSettings();
        }));

    // Action buttons
    const actionsContainer = section.createDiv('task-sync-settings-actions');

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

  private createTaskTypesSection(container: HTMLElement): void {
    const section = container.createDiv('task-sync-settings-section');

    // Section header
    section.createEl('h2', { text: 'Task Types', cls: 'task-sync-section-header' });
    section.createEl('p', {
      text: 'Configure task types with colors for better visual organization.',
      cls: 'task-sync-settings-section-desc'
    });

    // Render existing task types
    this.renderTaskTypeSettings(section);

    // Add new task type section
    this.createAddTaskTypeSection(section);
  }

  private renderTaskTypeSettings(container: HTMLElement): void {
    const count = this.plugin.settings.taskTypes.length;

    if (count === 0) {
      const emptySetting = new Setting(container)
        .setName('No task types configured')
        .setDesc('Add your first task type below to get started');
      emptySetting.settingEl.addClass('task-sync-empty-state');
      return;
    }

    // Create a setting for each task type
    this.plugin.settings.taskTypes.forEach((taskType, index) => {
      const setting = new Setting(container)
        .setName(taskType.name)
        .setDesc(`Configure the "${taskType.name}" task type`)
        .addDropdown(dropdown => {
          // Add color options
          TASK_TYPE_COLORS.forEach(color => {
            dropdown.addOption(color, color.charAt(0).toUpperCase() + color.slice(1));
          });

          dropdown.setValue(taskType.color)
            .onChange(async (value: TaskTypeColor) => {
              this.plugin.settings.taskTypes[index].color = value;
              await this.plugin.saveSettings();

              // Trigger base sync if enabled
              if (this.plugin.settings.autoSyncAreaProjectBases) {
                await this.plugin.syncAreaProjectBases();
              }
            });
        });

      // Add color preview badge
      const colorPreview = setting.controlEl.createDiv('task-type-preview');
      colorPreview.innerHTML = `<span class="task-type-badge task-type-${taskType.color}">${taskType.name}</span>`;

      // Add delete button (don't allow deleting if it's the last type)
      if (this.plugin.settings.taskTypes.length > 1) {
        setting.addButton(button => {
          button.setButtonText('Delete')
            .setWarning()
            .onClick(async () => {
              this.plugin.settings.taskTypes.splice(index, 1);
              await this.plugin.saveSettings();

              // Refresh the entire section
              container.empty();
              this.createTaskTypesSection(container);

              // Trigger base sync if enabled
              if (this.plugin.settings.autoSyncAreaProjectBases) {
                await this.plugin.syncAreaProjectBases();
              }
            });
        });
      }
    });
  }

  private createAddTaskTypeSection(container: HTMLElement): void {
    let newTypeName = '';
    let newTypeColor: TaskTypeColor = 'blue';

    const addSetting = new Setting(container)
      .setName('Add New Task Type')
      .setDesc('Create a new task type with a custom color')
      .addText(text => {
        text.setPlaceholder('e.g., Epic, Story, Research')
          .onChange((value) => {
            newTypeName = value.trim();
          });
      })
      .addDropdown(dropdown => {
        TASK_TYPE_COLORS.forEach(color => {
          dropdown.addOption(color, color.charAt(0).toUpperCase() + color.slice(1));
        });

        dropdown.setValue(newTypeColor)
          .onChange((value: TaskTypeColor) => {
            newTypeColor = value;
          });
      })
      .addButton(button => {
        button.setButtonText('Add Task Type')
          .setCta()
          .onClick(async () => {
            if (newTypeName && !this.plugin.settings.taskTypes.some(t => t.name === newTypeName)) {
              this.plugin.settings.taskTypes.push({ name: newTypeName, color: newTypeColor });
              await this.plugin.saveSettings();

              // Refresh the entire section
              container.empty();
              this.createTaskTypesSection(container);

              // Trigger base sync if enabled
              if (this.plugin.settings.autoSyncAreaProjectBases) {
                await this.plugin.syncAreaProjectBases();
              }
            }
          });
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
