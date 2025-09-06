import { Plugin, TFile, MarkdownView, Notice, WorkspaceLeaf } from 'obsidian';
import { VaultScanner } from './services/VaultScannerService';
import { BaseManager } from './services/BaseManager';
import { PluginStorageService } from './services/PluginStorageService';
import { FileChangeListener } from './services/FileChangeListener';
import { TemplateManager } from './services/TemplateManager';
import { TaskCreateModal } from './components/modals/TaskCreateModal';
import { AreaCreateModal, AreaCreateData } from './components/modals/AreaCreateModal';
import { ProjectCreateModal, ProjectCreateData } from './components/modals/ProjectCreateModal';
import { sanitizeFileName, createSafeFileName } from './utils/fileNameSanitizer';
import { TaskSyncSettingTab } from './components/ui/settings';
import type { TaskSyncSettings, TaskType, TaskTypeColor } from './components/ui/settings';
import { EventManager } from './events';
import { StatusDoneHandler } from './events/handlers';
import { TaskPropertyHandler } from './events/handlers/TaskPropertyHandler';
import { AreaPropertyHandler } from './events/handlers/AreaPropertyHandler';
import { ProjectPropertyHandler } from './events/handlers/ProjectPropertyHandler';
import { DEFAULT_SETTINGS, TASK_TYPE_COLORS, validateFolderPath } from './components/ui/settings';
import { GitHubService } from './services/GitHubService';
import { GitHubIssuesView, GITHUB_ISSUES_VIEW_TYPE } from './views/GitHubIssuesView';

import pluralize from 'pluralize';

// Re-export types for backward compatibility
export type { TaskSyncSettings, TaskType, TaskTypeColor };
export { TASK_TYPE_COLORS };

// File context interface for context-aware modal
export interface FileContext {
  type: 'project' | 'area' | 'none';
  name?: string;
  path?: string;
}

// Todo item detection interface
export interface TodoItem {
  text: string;
  completed: boolean;
  indentation: string;
  listMarker: string;
  lineNumber: number;
}

// Extended todo item with parent information
export interface TodoItemWithParent extends TodoItem {
  parentTodo?: TodoItem;
}



export default class TaskSyncPlugin extends Plugin {
  settings: TaskSyncSettings;
  vaultScanner: VaultScanner;
  baseManager: BaseManager;
  templateManager: TemplateManager;
  storageService: PluginStorageService;
  eventManager: EventManager;
  fileChangeListener: FileChangeListener;
  statusDoneHandler: StatusDoneHandler;
  taskPropertyHandler: TaskPropertyHandler;
  areaPropertyHandler: AreaPropertyHandler;
  projectPropertyHandler: ProjectPropertyHandler;
  githubService: GitHubService;

  async onload() {
    console.log('Loading Task Sync Plugin');

    // Load settings
    await this.loadSettings();

    // Initialize services
    this.vaultScanner = new VaultScanner(this.app.vault, this.settings);
    this.baseManager = new BaseManager(this.app, this.app.vault, this.settings);
    this.templateManager = new TemplateManager(this.app, this.app.vault, this.settings);
    this.storageService = new PluginStorageService(this.app, this);
    this.githubService = new GitHubService(this.settings);

    // Initialize storage service
    await this.storageService.initialize();

    // Validate and create missing templates
    await this.validateAndCreateTemplates();

    // Initialize event system
    this.eventManager = new EventManager();
    this.statusDoneHandler = new StatusDoneHandler(this.app, this.settings);
    this.taskPropertyHandler = new TaskPropertyHandler(this.app, this.settings);
    this.areaPropertyHandler = new AreaPropertyHandler(this.app, this.settings);
    this.projectPropertyHandler = new ProjectPropertyHandler(this.app, this.settings);
    this.fileChangeListener = new FileChangeListener(this.app, this.app.vault, this.eventManager, this.settings);

    // Register event handlers
    this.eventManager.registerHandler(this.statusDoneHandler);
    this.eventManager.registerHandler(this.taskPropertyHandler);
    this.eventManager.registerHandler(this.areaPropertyHandler);
    this.eventManager.registerHandler(this.projectPropertyHandler);

    // Initialize file change listener
    await this.fileChangeListener.initialize();

    // Add settings tab
    this.addSettingTab(new TaskSyncSettingTab(this.app, this));

    // Register GitHub Issues view
    this.registerView(
      GITHUB_ISSUES_VIEW_TYPE,
      (leaf) => new GitHubIssuesView(leaf, this.githubService, { githubIntegration: this.settings.githubIntegration })
    );

    // Create GitHub Issues view in right sidebar if it doesn't exist
    this.app.workspace.onLayoutReady(() => {
      this.initializeGitHubIssuesView();
    });

    // Note: Removed automatic folder creation - Obsidian handles this automatically
    // Base files and templates will be created on-demand when needed

    // Add commands
    this.addCommand({
      id: 'add-task',
      name: 'Add Task',
      callback: () => {
        this.openTaskCreateModal();
      }
    });

    this.addCommand({
      id: 'refresh',
      name: 'Refresh',
      callback: async () => {
        await this.refresh();
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

    this.addCommand({
      id: 'promote-todo-to-task',
      name: 'Promote Todo to Task',
      callback: async () => {
        await this.promoteTodoToTask();
      }
    });

    this.addCommand({
      id: 'revert-promoted-todo',
      name: 'Revert Promoted Todo',
      callback: async () => {
        await this.revertPromotedTodo();
      }
    });


  }

  onunload() {
    console.log('Unloading Task Sync Plugin');

    // Cleanup event system
    if (this.fileChangeListener) {
      this.fileChangeListener.cleanup();
    }

    if (this.eventManager) {
      this.eventManager.clear();
    }
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

      // Update event system with new settings
      if (this.statusDoneHandler) {
        this.statusDoneHandler.updateSettings(this.settings);
      }
      if (this.taskPropertyHandler) {
        this.taskPropertyHandler.updateSettings(this.settings);
      }
      if (this.areaPropertyHandler) {
        this.areaPropertyHandler.updateSettings(this.settings);
      }
      if (this.projectPropertyHandler) {
        this.projectPropertyHandler.updateSettings(this.settings);
      }
      if (this.statusDoneHandler || this.taskPropertyHandler || this.areaPropertyHandler || this.projectPropertyHandler) {
        console.log('Task Sync: Event system updated with new settings');
      }

      // Update GitHub service with new settings
      if (this.githubService) {
        this.githubService.updateSettings(this.settings);
      }

      // Update GitHub Issues view if it's open
      const githubLeaves = this.app.workspace.getLeavesOfType(GITHUB_ISSUES_VIEW_TYPE);
      githubLeaves.forEach(leaf => {
        const view = leaf.view as GitHubIssuesView;
        if (view && view.updateSettings) {
          view.updateSettings({ githubIntegration: this.settings.githubIntegration });
        }
      });

      // Note: FileChangeListener will get updated settings automatically since it references this.settings
    } catch (error) {
      console.error('Task Sync: Failed to save settings:', error);
      throw error;
    }
  }

  private async migrateSettings() {
    // Migrate taskPropertyOrder setting for existing users
    if (!this.settings.taskPropertyOrder) {
      this.settings.taskPropertyOrder = [...DEFAULT_SETTINGS.taskPropertyOrder];
      console.log('Task Sync: Migrated taskPropertyOrder setting to default order');
    }

    // Future settings migration logic will go here
  }

  private validateSettings() {
    // Validate folder names (allow empty strings but ensure they're strings)
    const folderFields = ['tasksFolder', 'projectsFolder', 'areasFolder', 'templateFolder'];
    folderFields.forEach(field => {
      const folderPath = this.settings[field as keyof TaskSyncSettings] as string;

      if (typeof folderPath !== 'string') {
        console.warn(`Task Sync: Invalid ${field}, using default`);
        (this.settings as any)[field] = (DEFAULT_SETTINGS as any)[field];
        return;
      }

      // Validate folder path using validation function
      const validation = validateFolderPath(folderPath);
      if (!validation.isValid) {
        console.error(`Task Sync: Invalid ${field}: ${validation.error}`);
        console.warn(`Task Sync: Resetting ${field} to default value`);
        (this.settings as any)[field] = (DEFAULT_SETTINGS as any)[field];
      }
    });
  }

  /**
   * Validate that configured template files exist and create missing default templates
   */
  private async validateAndCreateTemplates(): Promise<void> {
    try {
      let settingsUpdated = false;

      // Check and create default Task template if missing or not configured
      if (!this.settings.defaultTaskTemplate) {
        // Set default template name if not configured
        this.settings.defaultTaskTemplate = DEFAULT_SETTINGS.defaultTaskTemplate;
        settingsUpdated = true;
        console.log(`Task Sync: No task template configured, setting default: ${this.settings.defaultTaskTemplate}`);
      }

      if (this.settings.defaultTaskTemplate) {
        const taskTemplatePath = `${this.settings.templateFolder}/${this.settings.defaultTaskTemplate}`;
        const taskTemplateExists = await this.app.vault.adapter.exists(taskTemplatePath);

        if (!taskTemplateExists) {
          console.log(`Task Sync: Default task template '${this.settings.defaultTaskTemplate}' not found, creating it...`);
          try {
            await this.templateManager.createTaskTemplate(this.settings.defaultTaskTemplate);
            console.log(`Task Sync: Created default task template: ${taskTemplatePath}`);
          } catch (error) {
            console.error(`Task Sync: Failed to create default task template:`, error);
          }
        }
      }

      // Check and create default Area template if missing or not configured
      if (!this.settings.defaultAreaTemplate) {
        this.settings.defaultAreaTemplate = DEFAULT_SETTINGS.defaultAreaTemplate;
        settingsUpdated = true;
        console.log(`Task Sync: No area template configured, setting default: ${this.settings.defaultAreaTemplate}`);
      }

      if (this.settings.defaultAreaTemplate) {
        const areaTemplatePath = `${this.settings.templateFolder}/${this.settings.defaultAreaTemplate}`;
        const areaTemplateExists = await this.app.vault.adapter.exists(areaTemplatePath);

        if (!areaTemplateExists) {
          console.log(`Task Sync: Default area template '${this.settings.defaultAreaTemplate}' not found, creating it...`);
          try {
            await this.templateManager.createAreaTemplate(this.settings.defaultAreaTemplate);
            console.log(`Task Sync: Created default area template: ${areaTemplatePath}`);
          } catch (error) {
            console.error(`Task Sync: Failed to create default area template:`, error);
          }
        }
      }

      // Check and create default Project template if missing or not configured
      if (!this.settings.defaultProjectTemplate) {
        this.settings.defaultProjectTemplate = DEFAULT_SETTINGS.defaultProjectTemplate;
        settingsUpdated = true;
        console.log(`Task Sync: No project template configured, setting default: ${this.settings.defaultProjectTemplate}`);
      }

      if (this.settings.defaultProjectTemplate) {
        const projectTemplatePath = `${this.settings.templateFolder}/${this.settings.defaultProjectTemplate}`;
        const projectTemplateExists = await this.app.vault.adapter.exists(projectTemplatePath);

        if (!projectTemplateExists) {
          console.log(`Task Sync: Default project template '${this.settings.defaultProjectTemplate}' not found, creating it...`);
          try {
            await this.templateManager.createProjectTemplate(this.settings.defaultProjectTemplate);
            console.log(`Task Sync: Created default project template: ${projectTemplatePath}`);
          } catch (error) {
            console.error(`Task Sync: Failed to create default project template:`, error);
          }
        }
      }

      // Check and create default Parent Task template if missing or not configured
      if (!this.settings.defaultParentTaskTemplate) {
        this.settings.defaultParentTaskTemplate = DEFAULT_SETTINGS.defaultParentTaskTemplate;
        settingsUpdated = true;
        console.log(`Task Sync: No parent task template configured, setting default: ${this.settings.defaultParentTaskTemplate}`);
      }

      if (this.settings.defaultParentTaskTemplate) {
        const parentTaskTemplatePath = `${this.settings.templateFolder}/${this.settings.defaultParentTaskTemplate}`;
        const parentTaskTemplateExists = await this.app.vault.adapter.exists(parentTaskTemplatePath);

        if (!parentTaskTemplateExists) {
          console.log(`Task Sync: Default parent task template '${this.settings.defaultParentTaskTemplate}' not found, creating it...`);
          try {
            await this.templateManager.createParentTaskTemplate(this.settings.defaultParentTaskTemplate);
            console.log(`Task Sync: Created default parent task template: ${parentTaskTemplatePath}`);
          } catch (error) {
            console.error(`Task Sync: Failed to create default parent task template:`, error);
          }
        }
      }

      // Save settings if any templates were created
      if (settingsUpdated) {
        await this.saveSettings();
      }
    } catch (error) {
      console.error('Task Sync: Failed to validate and create templates:', error);
    }
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



  /**
   * Initialize GitHub Issues view in the right sidebar if it doesn't already exist
   */
  private async initializeGitHubIssuesView(): Promise<void> {
    try {
      console.log('🔧 Initializing GitHub Issues view...');

      // Check if GitHub Issues view already exists
      const existingLeaves = this.app.workspace.getLeavesOfType(GITHUB_ISSUES_VIEW_TYPE);
      console.log(`🔧 Found ${existingLeaves.length} existing GitHub Issues views`);

      if (existingLeaves.length > 0) {
        console.log('✅ GitHub Issues view already exists, skipping creation');
        return; // View already exists
      }

      console.log('🔧 Creating GitHub Issues view in right sidebar...');

      // Create the view in the right sidebar
      const rightLeaf = this.app.workspace.getRightLeaf(false);
      await rightLeaf.setViewState({
        type: GITHUB_ISSUES_VIEW_TYPE,
        active: false // Don't make it active by default
      });

      console.log('✅ GitHub Issues view created successfully');
    } catch (error) {
      console.error('❌ Failed to initialize GitHub Issues view:', error);
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

  /**
   * Detect todo item under cursor in the active editor
   */
  private detectTodoUnderCursor(): TodoItem | null {
    const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);

    if (!markdownView) {
      return null;
    }
    const editor = markdownView.editor;

    if (!editor) {
      return null;
    }

    const cursor = editor.getCursor();
    const line = editor.getLine(cursor.line);

    // Regex to match todo items: optional whitespace, list marker (- or *), checkbox, text
    const todoRegex = /^(\s*)([-*])\s*\[([xX\s])\]\s*(.+)$/;
    const match = line.match(todoRegex);

    if (!match) {
      return null;
    }

    const [, indentation, listMarker, checkboxState, text] = match;

    return {
      text: text.trim(),
      completed: checkboxState.toLowerCase() === 'x',
      indentation,
      listMarker,
      lineNumber: cursor.line
    };
  }

  /**
   * Detect todo item with parent information
   */
  private detectTodoWithParent(): TodoItemWithParent | null {
    const currentTodo = this.detectTodoUnderCursor();
    if (!currentTodo) {
      return null;
    }

    const parentTodo = this.findParentTodo(currentTodo);

    return {
      ...currentTodo,
      parentTodo
    };
  }

  /**
   * Find parent todo by looking at lines above the current todo
   * Only supports 1 level of nesting for simplicity
   */
  private findParentTodo(currentTodo: TodoItem): TodoItem | null {
    const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!markdownView) {
      return null;
    }

    const editor = markdownView.editor;
    const currentIndentLevel = currentTodo.indentation.length;

    // If current todo has no indentation, it can't have a parent
    if (currentIndentLevel === 0) {
      return null;
    }

    // Look backwards from current line to find a todo with less indentation
    for (let lineNum = currentTodo.lineNumber - 1; lineNum >= 0; lineNum--) {
      const line = editor.getLine(lineNum);
      const todoRegex = /^(\s*)([-*])\s*\[([xX\s])\]\s*(.+)$/;
      const match = line.match(todoRegex);

      if (match) {
        const [, indentation, listMarker, checkboxState, text] = match;
        const indentLevel = indentation.length;

        // Found a potential parent (less indented)
        if (indentLevel < currentIndentLevel) {
          return {
            text: text.trim(),
            completed: checkboxState.toLowerCase() === 'x',
            indentation,
            listMarker,
            lineNumber: lineNum
          };
        }
      }
    }

    return null;
  }

  /**
   * Update parent task's sub-tasks field to include the new child task
   */
  private async updateParentTaskSubTasks(parentTaskName: string, childTaskName: string): Promise<void> {
    try {
      const parentTaskPath = `${this.settings.tasksFolder}/${createSafeFileName(parentTaskName)}`;
      const parentFile = this.app.vault.getAbstractFileByPath(parentTaskPath);

      if (parentFile instanceof TFile) {
        const content = await this.app.vault.read(parentFile);

        // Parse front-matter to get current sub-tasks
        const frontMatterRegex = /^---\n([\s\S]*?)\n---/;
        const match = content.match(frontMatterRegex);

        if (match) {
          const frontMatter = match[1];
          const subTasksMatch = frontMatter.match(/^Sub-tasks:\s*(.*)$/m);

          let currentSubTasks: string[] = [];
          if (subTasksMatch && subTasksMatch[1].trim()) {
            // Parse existing sub-tasks (could be comma-separated or array format)
            const subTasksValue = subTasksMatch[1].trim();
            if (subTasksValue.startsWith('[') && subTasksValue.endsWith(']')) {
              // Array format: ["[[task1]]", "[[task2]]"]
              try {
                const parsed = JSON.parse(subTasksValue);
                currentSubTasks = parsed.map((item: string) => item.replace(/^\[\[(.+)\]\]$/, '$1'));
              } catch (e) {
                // Fallback: parse manually
                currentSubTasks = subTasksValue.slice(1, -1).split(',').map(t =>
                  t.trim().replace(/^"?\[\[(.+)\]\]"?$/, '$1').replace(/['"]/g, '')
                );
              }
            } else {
              // Comma-separated format: task1, task2
              currentSubTasks = subTasksValue.split(',').map(t => t.trim());
            }
          }

          // Add new child task if not already present
          if (!currentSubTasks.includes(childTaskName)) {
            currentSubTasks.push(childTaskName);

            // Update the sub-tasks field in array format with quoted links
            const linkedSubTasks = currentSubTasks.filter(t => t).map(task => `"[[${task}]]"`);
            const updatedSubTasks = `[${linkedSubTasks.join(', ')}]`;
            const updatedFrontMatter = frontMatter.replace(
              /^Sub-tasks:\s*.*$/m,
              `Sub-tasks: ${updatedSubTasks}`
            );

            const updatedContent = content.replace(frontMatterRegex, `---\n${updatedFrontMatter}\n---`);
            await this.app.vault.modify(parentFile, updatedContent);

            console.log(`Updated parent task ${parentTaskName} with sub-task: ${childTaskName}`);
          }
        }
      }
    } catch (error) {
      console.error(`Failed to update parent task sub-tasks: ${error}`);
    }
  }

  /**
   * Promote a todo item under cursor to a task
   */
  private async promoteTodoToTask(): Promise<void> {
    try {
      const todoWithParent = this.detectTodoWithParent();

      if (!todoWithParent) {
        new Notice('No todo item found under cursor');
        return;
      }

      // Get current file context
      const context = this.detectCurrentFileContext();

      let parentTaskName: string | undefined;

      // If this todo has a parent, create the parent task first
      if (todoWithParent.parentTodo) {
        const parentTaskData = {
          name: todoWithParent.parentTodo.text,
          type: this.settings.taskTypes[0]?.name || 'Task',
          done: todoWithParent.parentTodo.completed,
          status: todoWithParent.parentTodo.completed ? 'Done' : 'Backlog',
          tags: [] as string[],
          // Include the child task in sub-tasks field from the start
          subTasks: [todoWithParent.text],
          // Set context-specific fields
          ...(context.type === 'project' && context.name ? { project: context.name } : {}),
          ...(context.type === 'area' && context.name ? { areas: context.name } : {})
        };

        // Check if parent task already exists
        const parentTaskPath = `${this.settings.tasksFolder}/${createSafeFileName(todoWithParent.parentTodo.text)}`;
        const parentExists = await this.app.vault.adapter.exists(parentTaskPath);

        if (!parentExists) {
          await this.createTask(parentTaskData);
          console.log(`Created parent task: ${todoWithParent.parentTodo.text}`);

          // Create base for parent task to show its sub-tasks
          try {
            await this.baseManager.createOrUpdateParentTaskBase(todoWithParent.parentTodo.text);
          } catch (error) {
            console.error('Failed to create parent task base:', error);
          }
        } else {
          // If parent exists, update its sub-tasks field
          await this.updateParentTaskSubTasks(todoWithParent.parentTodo.text, todoWithParent.text);
        }

        parentTaskName = todoWithParent.parentTodo.text;
      }

      // Prepare child task data
      const taskData = {
        name: todoWithParent.text,
        type: this.settings.taskTypes[0]?.name || 'Task',
        done: todoWithParent.completed,
        status: todoWithParent.completed ? 'Done' : 'Backlog',
        tags: [] as string[],
        // Set parent task as a link if exists
        ...(parentTaskName ? { parentTask: `[[${parentTaskName}]]` } : {}),
        // Set context-specific fields
        ...(context.type === 'project' && context.name ? { project: context.name } : {}),
        ...(context.type === 'area' && context.name ? { areas: context.name } : {})
      };

      // Create the child task
      await this.createTask(taskData);

      // Replace the todo line with a link to the created task
      const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (!markdownView) {
        throw new Error('No active markdown view found');
      }
      const editor = markdownView.editor;

      // Get current file path for tracking
      const activeFile = markdownView.file;
      if (!activeFile) {
        throw new Error('No active file found');
      }

      // Store original line content for tracking
      const originalLine = editor.getLine(todoWithParent.lineNumber);

      // Keep the todo format but link to the task to indicate promotion
      let replacementLine: string;
      if (todoWithParent.completed) {
        // Keep the completed checkbox and add the link
        replacementLine = `${todoWithParent.indentation}${todoWithParent.listMarker} [x] [[${todoWithParent.text}]]`;
      } else {
        // Keep the uncompleted checkbox and add the link
        replacementLine = `${todoWithParent.indentation}${todoWithParent.listMarker} [ ] [[${todoWithParent.text}]]`;
      }

      editor.setLine(todoWithParent.lineNumber, replacementLine);

      // Track the promoted todo
      const taskPath = `${this.settings.tasksFolder}/${createSafeFileName(todoWithParent.text)}`;
      await this.storageService.trackPromotedTodo(
        todoWithParent.text,
        originalLine,
        activeFile.path,
        todoWithParent.lineNumber,
        todoWithParent.text,
        taskPath,
        todoWithParent.parentTodo ? {
          text: todoWithParent.parentTodo.text,
          lineNumber: todoWithParent.parentTodo.lineNumber,
          taskName: todoWithParent.parentTodo.text
        } : undefined
      );

      // Also replace parent todo line if it exists and wasn't already promoted
      if (todoWithParent.parentTodo) {
        const parentLine = editor.getLine(todoWithParent.parentTodo.lineNumber);
        // Only replace if it's still a todo (not already a link)
        if (parentLine.includes('[ ]') || parentLine.includes('[x]') || parentLine.includes('[X]')) {
          const originalParentLine = parentLine;
          let parentReplacementLine: string;
          if (todoWithParent.parentTodo.completed) {
            parentReplacementLine = `${todoWithParent.parentTodo.indentation}${todoWithParent.parentTodo.listMarker} [x] [[${todoWithParent.parentTodo.text}]]`;
          } else {
            parentReplacementLine = `${todoWithParent.parentTodo.indentation}${todoWithParent.parentTodo.listMarker} [ ] [[${todoWithParent.parentTodo.text}]]`;
          }
          editor.setLine(todoWithParent.parentTodo.lineNumber, parentReplacementLine);

          // Track the parent todo promotion as well
          const parentTaskPath = `${this.settings.tasksFolder}/${createSafeFileName(todoWithParent.parentTodo.text)}`;
          await this.storageService.trackPromotedTodo(
            todoWithParent.parentTodo.text,
            originalParentLine,
            activeFile.path,
            todoWithParent.parentTodo.lineNumber,
            todoWithParent.parentTodo.text,
            parentTaskPath
          );
        }
      }

      const message = parentTaskName
        ? `Todo promoted to task with parent: ${todoWithParent.text} (parent: ${parentTaskName})`
        : `Todo promoted to task: ${todoWithParent.text}`;
      new Notice(message);

      // Refresh base views if auto-update is enabled
      if (this.settings.autoUpdateBaseViews) {
        await this.refreshBaseViews();
      }

    } catch (error) {
      console.error('Failed to promote todo to task:', error);
      new Notice('Failed to promote todo to task');
    }
  }

  /**
   * Revert a promoted todo back to its original format
   */
  private async revertPromotedTodo(): Promise<void> {
    try {
      const activeFile = this.app.workspace.getActiveFile();
      if (!activeFile) {
        new Notice('No active file found');
        return;
      }

      // Get promoted todos for the current file
      const promotedTodos = this.storageService.getPromotedTodosForFile(activeFile.path);

      if (promotedTodos.length === 0) {
        new Notice('No promoted todos found in this file');
        return;
      }

      // For now, revert the most recent promoted todo
      // TODO: In the future, we could show a modal to let user choose which one to revert
      const mostRecent = promotedTodos[promotedTodos.length - 1];

      const success = await this.storageService.revertPromotedTodo(mostRecent.id);

      if (success) {
        new Notice(`Reverted promoted todo: ${mostRecent.originalText}`);
      } else {
        new Notice('Failed to revert promoted todo');
      }

    } catch (error) {
      console.error('Failed to revert promoted todo:', error);
      new Notice('Failed to revert promoted todo');
    }
  }

  // Task creation logic
  // This is the SINGLE METHOD for creating tasks - all task creation must go through this method
  // to ensure consistent property setting and context handling
  async createTask(taskData: any): Promise<void> {
    try {
      const taskFileName = createSafeFileName(taskData.name);
      const taskPath = `${this.settings.tasksFolder}/${taskFileName}`;

      // Create task content based on whether it's a parent task
      const isParentTask = taskData.subTasks && taskData.subTasks.length > 0;
      const taskContent = isParentTask
        ? await this.generateParentTaskContent(taskData)
        : await this.generateTaskContent(taskData);

      await this.app.vault.create(taskPath, taskContent);
      console.log('Task created successfully:', taskPath);
    } catch (error) {
      console.error('Failed to create task:', error);
      throw error;
    }
  }

  private async generateTaskContent(taskData: any): Promise<string> {
    // Always use template - it should be created during initialization
    if (!this.settings.defaultTaskTemplate) {
      throw new Error('No default task template configured');
    }

    return await this.generateFromTemplate(this.settings.defaultTaskTemplate, taskData, 'task');
  }

  /**
   * Generate default parent task content
   */
  private async generateParentTaskContent(taskData: any): Promise<string> {
    // Always use template - it should be created during initialization
    if (!this.settings.defaultParentTaskTemplate) {
      throw new Error('No default parent task template configured');
    }

    return await this.generateFromTemplate(this.settings.defaultParentTaskTemplate, taskData, 'task');
  }

  /**
   * Create a new area
   */
  private async createArea(areaData: AreaCreateData): Promise<void> {
    try {
      const areaFileName = createSafeFileName(areaData.name);
      const areaPath = `${this.settings.areasFolder}/${areaFileName}`;

      // Use template if configured, otherwise use default
      let areaContent: string;
      if (this.settings.defaultAreaTemplate) {
        areaContent = await this.generateFromTemplate(this.settings.defaultAreaTemplate, areaData, 'area');
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
      const projectFileName = createSafeFileName(projectData.name);
      const projectPath = `${this.settings.projectsFolder}/${projectFileName}`;

      // Use template if configured, otherwise use default
      let projectContent: string;
      if (this.settings.defaultProjectTemplate) {
        projectContent = await this.generateFromTemplate(this.settings.defaultProjectTemplate, projectData, 'project');
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
    // Import the new front-matter generator
    const { generateAreaFrontMatter } = require('./services/base-definitions/FrontMatterGenerator');

    return generateAreaFrontMatter(areaData);
  }

  /**
   * Generate default project content
   */
  private generateProjectContent(projectData: ProjectCreateData): string {
    // Import the new front-matter generator
    const { generateProjectFrontMatter } = require('./services/base-definitions/FrontMatterGenerator');


    return generateProjectFrontMatter(projectData);
  }

  /**
   * Generate content from template with proper base embedding
   */
  private async generateFromTemplate(templateName: string, data: any, entityType?: 'task' | 'project' | 'area'): Promise<string> {
    try {

      const templatePath = `${this.settings.templateFolder}/${templateName}`;
      let templateFile = this.app.vault.getAbstractFileByPath(templatePath);

      // Also check if the file actually exists on disk, not just in Obsidian's cache
      const fileExistsOnDisk = await this.app.vault.adapter.exists(templatePath);

      if (!templateFile || !(templateFile instanceof TFile) || !fileExistsOnDisk) {
        console.warn(`Template not found: ${templatePath}, creating it...`);

        // Try to create the missing template
        if (entityType === 'task' && templateName === this.settings.defaultTaskTemplate) {
          await this.templateManager.createTaskTemplate(templateName);
        } else if (entityType === 'task' && templateName === this.settings.defaultParentTaskTemplate) {
          await this.templateManager.createParentTaskTemplate(templateName);
        } else if (entityType === 'area' && templateName === this.settings.defaultAreaTemplate) {
          await this.templateManager.createAreaTemplate(templateName);
        } else if (entityType === 'project' && templateName === this.settings.defaultProjectTemplate) {
          await this.templateManager.createProjectTemplate(templateName);
        } else {
          // Unknown template, can't create it
          throw new Error(`Template not found: ${templatePath}`);
        }

        // Wait for Obsidian to process the new file and retry multiple times
        let retries = 0;
        const maxRetries = 10;
        while (retries < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 200));
          templateFile = this.app.vault.getAbstractFileByPath(templatePath);
          if (templateFile && templateFile instanceof TFile) {
            break;
          }
          retries++;
        }

        if (!templateFile || !(templateFile instanceof TFile)) {
          throw new Error(`Failed to create template after ${maxRetries} retries: ${templatePath}`);
        }
      }

      let templateContent = await this.app.vault.read(templateFile);

      // Replace template variables
      templateContent = this.processTemplateVariables(templateContent, data);

      // Ensure proper base embedding (only for projects and areas, not tasks)
      if (entityType !== 'task') {
        templateContent = this.ensureProperBaseEmbedding(templateContent, data);
      }

      return templateContent;
    } catch (error) {
      console.error(`Failed to process template ${templateName}:`, error);
      // For tasks, re-throw to let the calling method handle fallback
      if (entityType === 'task') {
        throw error;
      }
      // For projects and areas, fall back to default generation
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

    // Handle front-matter fields specifically for tasks
    if (data.name && processedContent.includes('Title: \'\'')) {
      processedContent = processedContent.replace('Title: \'\'', `Title: '${data.name}'`);
    } else if (data.name && processedContent.includes('Title: ""')) {
      processedContent = processedContent.replace('Title: ""', `Title: "${data.name}"`);
    } else if (data.name && processedContent.includes('Title:')) {
      // Handle cases where Title is empty without quotes
      processedContent = processedContent.replace(/^Title:\s*$/m, `Title: '${data.name}'`);
    }

    // Handle Type field - replace any existing Type value with the provided one
    if (data.type) {
      // First try to replace empty Type fields
      if (processedContent.includes('Type: \'\'')) {
        processedContent = processedContent.replace('Type: \'\'', `Type: ${data.type}`);
      } else if (processedContent.includes('Type: ""')) {
        processedContent = processedContent.replace('Type: ""', `Type: ${data.type}`);
      } else if (processedContent.includes('Type:')) {
        // Replace any Type field value, including existing non-empty values
        processedContent = processedContent.replace(/^Type:\s*.*$/m, `Type: ${data.type}`);
      }
    }

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
      // Convert areas to proper array format for YAML
      const areasArray = Array.isArray(data.areas) ? data.areas : data.areas.split(',').map((s: string) => s.trim());

      // For template variables, use array format
      const yamlArray = areasArray.map((area: string) => `  - ${area}`).join('\n');
      const areasYaml = `Areas:\n${yamlArray}`;

      // Replace {{areas}} with proper YAML array format
      processedContent = processedContent.replace(/Areas:\s*\{\{areas\}\}/g, areasYaml);

      // Also handle standalone {{areas}} replacement for content (not properties)
      const areasStr = areasArray.join(', ');
      processedContent = processedContent.replace(/\{\{areas\}\}/g, areasStr);

      // Also update the Areas field in YAML front-matter if it's an empty array
      if (processedContent.includes('Areas: []')) {
        processedContent = processedContent.replace('Areas: []', areasYaml);
      }
    }

    // Replace task-specific variables
    if (data.type) {
      processedContent = processedContent.replace(/\{\{type\}\}/g, data.type);
    }

    if (data.priority) {
      processedContent = processedContent.replace(/\{\{priority\}\}/g, data.priority);
    }

    if (data.status) {
      processedContent = processedContent.replace(/\{\{status\}\}/g, data.status);
    }

    if (data.project) {
      processedContent = processedContent.replace(/\{\{project\}\}/g, data.project);
    }

    if (data.parentTask) {
      processedContent = processedContent.replace(/\{\{parentTask\}\}/g, data.parentTask);
    }

    if (data.subTasks) {
      const subTasksStr = Array.isArray(data.subTasks) ? data.subTasks.join(', ') : data.subTasks;
      processedContent = processedContent.replace(/\{\{subTasks\}\}/g, subTasksStr);
    }

    if (data.tags) {
      const tagsStr = Array.isArray(data.tags) ? data.tags.join(', ') : data.tags;
      processedContent = processedContent.replace(/\{\{tags\}\}/g, tagsStr);
    }

    if (data.done !== undefined) {
      processedContent = processedContent.replace(/\{\{done\}\}/g, data.done.toString());
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
   * Comprehensive refresh operation - updates file properties and regenerates bases
   */
  async refresh(): Promise<void> {
    try {
      const results = {
        filesUpdated: 0,
        propertiesUpdated: 0,
        basesRegenerated: 0,
        templatesUpdated: 0,
        errors: [] as string[]
      };

      console.log('Task Sync: Starting comprehensive refresh...');

      // 1. Update task/project/area file properties
      await this.updateFileProperties(results);

      // 2. Update template files to match current property order
      await this.updateTemplateFiles(results);

      // 3. Regenerate all base files (existing functionality)
      await this.regenerateBases();
      results.basesRegenerated = 1;

      // 4. Provide feedback
      this.showRefreshResults(results);

      console.log('Task Sync: Refresh completed successfully');
    } catch (error) {
      console.error('Task Sync: Refresh failed:', error);
      throw error;
    }
  }

  /**
   * Update properties in all task, project, and area files to match current schema
   */
  private async updateFileProperties(results: any): Promise<void> {
    try {
      console.log('Task Sync: Starting file property updates...');

      // Update task files
      await this.updateTaskFiles(results);

      // Update project files
      await this.updateProjectFiles(results);

      // Update area files
      await this.updateAreaFiles(results);

      console.log(`Task Sync: Updated properties in ${results.filesUpdated} files (${results.propertiesUpdated} properties changed)`);
    } catch (error) {
      console.error('Task Sync: Failed to update file properties:', error);
      results.errors.push(`Failed to update file properties: ${error.message}`);
    }
  }

  /**
   * Update task files to match current schema
   */
  private async updateTaskFiles(results: any): Promise<void> {
    try {
      const taskFiles = await this.vaultScanner.scanTasksFolder();
      for (const filePath of taskFiles) {
        await this.updateSingleFile(filePath, 'task', results);
      }
    } catch (error) {
      console.error('Task Sync: Failed to update task files:', error);
      results.errors.push(`Failed to update task files: ${error.message}`);
    }
  }

  /**
   * Update project files to match current schema
   */
  private async updateProjectFiles(results: any): Promise<void> {
    try {
      const projectFiles = await this.vaultScanner.scanProjectsFolder();
      for (const filePath of projectFiles) {
        await this.updateSingleFile(filePath, 'project', results);
      }
    } catch (error) {
      console.error('Task Sync: Failed to update project files:', error);
      results.errors.push(`Failed to update project files: ${error.message}`);
    }
  }

  /**
   * Update area files to match current schema
   */
  private async updateAreaFiles(results: any): Promise<void> {
    try {
      const areaFiles = await this.vaultScanner.scanAreasFolder();
      for (const filePath of areaFiles) {
        await this.updateSingleFile(filePath, 'area', results);
      }
    } catch (error) {
      console.error('Task Sync: Failed to update area files:', error);
      results.errors.push(`Failed to update area files: ${error.message}`);
    }
  }

  /**
   * Update template files to match current property order
   */
  private async updateTemplateFiles(results: any): Promise<void> {
    try {
      console.log('Task Sync: Starting template file updates...');

      // Update task templates
      await this.updateTaskTemplates(results);

      console.log(`Task Sync: Updated ${results.templatesUpdated} template files`);
    } catch (error) {
      console.error('Task Sync: Failed to update template files:', error);
      results.errors.push(`Failed to update template files: ${error.message}`);
    }
  }

  /**
   * Update task template files to match current property order
   */
  private async updateTaskTemplates(results: any): Promise<void> {
    try {
      const templateFiles = this.app.vault.getMarkdownFiles().filter(file =>
        file.path.startsWith(this.settings.templateFolder + '/') &&
        file.path.endsWith('.md')
      );

      for (const file of templateFiles) {
        const content = await this.app.vault.read(file);

        // Check if this is a task template (has task-like front-matter)
        if (this.isTaskTemplate(content)) {
          const updatedContent = await this.updateTaskTemplateContent(content);
          if (updatedContent !== content) {
            await this.app.vault.modify(file, updatedContent);
            results.templatesUpdated++;
            console.log(`Task Sync: Updated template ${file.path}`);
          }
        }
      }
    } catch (error) {
      console.error('Task Sync: Failed to update task templates:', error);
      results.errors.push(`Failed to update task templates: ${error.message}`);
    }
  }

  /**
   * Check if a template file is a task template
   */
  private isTaskTemplate(content: string): boolean {
    // Check if the template has task-like properties in front-matter
    const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontMatterMatch) {
      return false;
    }

    const frontMatterText = frontMatterMatch[1];
    const taskProperties = ['Title', 'Type', 'Priority', 'Status', 'Done'];

    return taskProperties.some(prop => frontMatterText.includes(`${prop}:`));
  }

  /**
   * Update task template content to match current property order
   */
  private async updateTaskTemplateContent(content: string): Promise<string> {
    const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    if (!frontMatterMatch) {
      return content;
    }

    const [, frontMatterText, bodyContent] = frontMatterMatch;

    // Parse existing front-matter
    const existingData: Record<string, string> = {};
    const lines = frontMatterText.split('\n');
    for (const line of lines) {
      const match = line.match(/^([^:]+):\s*(.*)$/);
      if (match) {
        const [, key, value] = match;
        existingData[key.trim()] = value;
      }
    }

    // Get the current property order
    const properties = this.getTaskPropertiesInOrder();

    // Regenerate front-matter in correct order
    const frontMatterLines = ['---'];
    for (const prop of properties) {
      const value = existingData[prop.name] || '';
      frontMatterLines.push(`${prop.name}: ${value}`);
    }

    // Add any additional properties not in the schema
    for (const [key, value] of Object.entries(existingData)) {
      if (!properties.some((p: any) => p.name === key)) {
        frontMatterLines.push(`${key}: ${value}`);
      }
    }

    frontMatterLines.push('---');

    return frontMatterLines.join('\n') + '\n' + bodyContent;
  }

  /**
   * Get the current front-matter schema for a file type
   */
  private getFrontMatterSchema(type: 'task' | 'project' | 'area') {
    const { generateTaskFrontMatter, generateProjectFrontMatter, generateAreaFrontMatter } = require('./services/base-definitions/BaseConfigurations');

    let properties;
    switch (type) {
      case 'task':
        // For tasks, use the custom property order from settings
        properties = this.getTaskPropertiesInOrder();
        break;
      case 'project':
        properties = generateProjectFrontMatter();
        break;
      case 'area':
        properties = generateAreaFrontMatter();
        break;
      default:
        return {};
    }

    // Convert property definitions to schema objects
    const schema: Record<string, any> = {};
    properties.forEach((prop: any) => {
      schema[prop.name] = {
        type: prop.type,
        ...(prop.default !== undefined && { default: prop.default }),
        ...(prop.link && { link: prop.link })
      };
    });
    return schema;
  }

  /**
   * Get task properties in the custom order from settings
   */
  private getTaskPropertiesInOrder() {
    const { PROPERTY_REGISTRY, PROPERTY_SETS } = require('./services/base-definitions/BaseConfigurations');

    // Get property order from settings or use default
    const propertyOrder = this.settings.taskPropertyOrder || PROPERTY_SETS.TASK_FRONTMATTER;

    // Validate property order - ensure all required properties are present
    const requiredProperties = PROPERTY_SETS.TASK_FRONTMATTER;
    const isValidOrder = requiredProperties.every((prop: any) => propertyOrder.includes(prop)) &&
      propertyOrder.every((prop: any) => requiredProperties.includes(prop as typeof requiredProperties[number]));

    // Use validated order or fall back to default
    const finalPropertyOrder = isValidOrder ? propertyOrder : requiredProperties;

    // Convert property keys to property definitions in the correct order
    return finalPropertyOrder.map((propertyKey: any) => {
      const prop = PROPERTY_REGISTRY[propertyKey as keyof typeof PROPERTY_REGISTRY];
      return { ...prop };
    }).filter((prop: any) => prop); // Filter out any undefined properties
  }

  /**
   * Extract front-matter data from file content
   */
  private extractFrontMatterData(content: string): Record<string, any> | null {
    const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontMatterMatch) {
      return null;
    }

    const frontMatterText = frontMatterMatch[1];
    const data: Record<string, any> = {};

    // Simple YAML-like parsing for front-matter
    const lines = frontMatterText.split('\n');
    for (const line of lines) {
      const match = line.match(/^([^:]+):\s*(.*)$/);
      if (match) {
        const [, key, value] = match;
        data[key.trim()] = value.trim();
      }
    }

    return data;
  }

  /**
   * Extract property order from front-matter content
   */
  private extractPropertyOrder(content: string): string[] {
    const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontMatterMatch) {
      return [];
    }

    const frontMatterText = frontMatterMatch[1];
    const properties: string[] = [];

    const lines = frontMatterText.split('\n');
    for (const line of lines) {
      const match = line.match(/^([^:]+):\s*/);
      if (match) {
        properties.push(match[1].trim());
      }
    }

    return properties;
  }

  /**
   * Check if property order matches the expected schema order
   */
  private isPropertyOrderCorrect(content: string, schema: Record<string, any>): boolean {
    const currentOrder = this.extractPropertyOrder(content);
    const expectedOrder = Object.keys(schema);

    // Filter current order to only include properties that are in the schema
    const currentSchemaProperties = currentOrder.filter(prop => prop in schema);

    // Compare the order of schema properties
    for (let i = 0; i < Math.min(currentSchemaProperties.length, expectedOrder.length); i++) {
      if (currentSchemaProperties[i] !== expectedOrder[i]) {
        return false;
      }
    }

    return currentSchemaProperties.length === expectedOrder.length;
  }

  /**
   * Update a single file's properties to match current schema
   */
  private async updateSingleFile(filePath: string, type: 'task' | 'project' | 'area', results: any): Promise<void> {
    try {
      const file = this.app.vault.getAbstractFileByPath(filePath);
      if (!file || !(file instanceof TFile)) {
        console.log(`Task Sync: Skipping non-file: ${filePath}`);
        return;
      }

      const content = await this.app.vault.read(file);

      // Extract existing front-matter
      const existingFrontMatter = this.extractFrontMatterData(content);
      if (!existingFrontMatter) {
        // No front-matter exists, skip this file
        console.log(`Task Sync: Skipping file without front-matter: ${filePath}`);
        return;
      }

      // Check if file has correct Type property for its expected type
      if (type === 'project') {
        if (!existingFrontMatter.Type || existingFrontMatter.Type !== 'Project') {
          // For projects, Type property must be 'Project'
          console.log(`Task Sync: Skipping file with incorrect Type property: ${filePath} (expected: Project, found: ${existingFrontMatter.Type || 'missing'})`);
          return;
        }
      }
      if (type === 'area') {
        if (!existingFrontMatter.Type || existingFrontMatter.Type !== 'Area') {
          // For areas, Type property must be 'Area'
          console.log(`Task Sync: Skipping file with incorrect Type property: ${filePath} (expected: Area, found: ${existingFrontMatter.Type || 'missing'})`);
          return;
        }
      }
      if (type === 'task' && existingFrontMatter.Type) {
        // For tasks, check if Type is one of the configured task types (Type is optional for tasks)
        const validTaskTypes = this.settings.taskTypes.map(t => t.name);
        if (!validTaskTypes.includes(existingFrontMatter.Type)) {
          console.log(`Task Sync: Skipping file with incorrect Type property: ${filePath} (expected one of: ${validTaskTypes.join(', ')}, found: ${existingFrontMatter.Type})`);
          return;
        }
      }

      // Get current schema for this file type
      const currentSchema = this.getFrontMatterSchema(type);
      if (!currentSchema) {
        console.warn(`Task Sync: No schema found for file type: ${type}`);
        return;
      }

      let hasChanges = false;
      let propertiesChanged = 0;

      // Create updated front-matter object
      const updatedFrontMatter = { ...existingFrontMatter };

      // Add all missing fields from schema
      for (const [fieldName, fieldConfig] of Object.entries(currentSchema)) {
        try {
          const config = fieldConfig as { default?: any };
          if (config && !(fieldName in updatedFrontMatter)) {
            // Add any field that's defined in the schema
            updatedFrontMatter[fieldName] = config.default || '';
            hasChanges = true;
            propertiesChanged++;
            console.log(`Task Sync: Added missing field '${fieldName}' to ${filePath}`);
          }
        } catch (fieldError) {
          console.warn(`Task Sync: Error processing field ${fieldName} in ${filePath}:`, fieldError);
        }
      }

      // Remove obsolete fields (fields not in current schema) - but be conservative
      const validFields = new Set(Object.keys(currentSchema));
      for (const fieldName of Object.keys(updatedFrontMatter)) {
        // Only remove fields that are clearly not part of the schema
        // Keep common fields that might be used by other plugins
        const commonFields = ['tags', 'aliases', 'cssclass', 'publish'];
        if (!validFields.has(fieldName) && !commonFields.includes(fieldName)) {
          console.log(`Task Sync: Removing obsolete field '${fieldName}' from ${filePath}`);
          delete updatedFrontMatter[fieldName];
          hasChanges = true;
          propertiesChanged++;
        }
      }

      // Check if property order matches schema
      if (!hasChanges && !this.isPropertyOrderCorrect(content, currentSchema)) {
        console.log(`Task Sync: Property order needs updating in ${filePath}`);
        hasChanges = true;
        propertiesChanged++; // Count order change as one property change
      }

      // Only update the file if there are changes
      if (hasChanges) {
        // Regenerate the front-matter section
        const frontMatterLines = ['---'];

        // Include ALL fields from the schema, regardless of value
        for (const [fieldName] of Object.entries(currentSchema)) {
          const value = updatedFrontMatter[fieldName];
          frontMatterLines.push(`${fieldName}: ${value}`);
        }

        // Add any additional fields that aren't in the schema but exist in the file
        for (const [key, value] of Object.entries(updatedFrontMatter)) {
          if (!(key in currentSchema)) {
            frontMatterLines.push(`${key}: ${value}`);
          }
        }

        frontMatterLines.push('---');

        // Extract body content (everything after front-matter)
        const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
        const bodyContent = frontMatterMatch ? frontMatterMatch[2] : content;

        // Combine updated front-matter with existing body
        const updatedContent = frontMatterLines.join('\n') + '\n' + bodyContent;

        // Write back to file
        await this.app.vault.modify(file, updatedContent);

        results.filesUpdated++;
        results.propertiesUpdated += propertiesChanged;
        console.log(`Task Sync: Updated ${propertiesChanged} properties in ${filePath}`);
      } else {
        console.log(`Task Sync: No changes needed for ${filePath}`);
      }
    } catch (error) {
      console.error(`Task Sync: Failed to update file ${filePath}:`, error);
      results.errors.push(`Failed to update ${filePath}: ${error.message}`);
    }
  }

  /**
   * Show refresh results to the user
   */
  private showRefreshResults(results: any): void {
    const { filesUpdated, propertiesUpdated, basesRegenerated, templatesUpdated, errors } = results;

    let message = 'Refresh completed!\n\n';
    message += `• Files updated: ${filesUpdated}\n`;
    message += `• Properties updated: ${propertiesUpdated}\n`;
    message += `• Templates updated: ${templatesUpdated}\n`;
    message += `• Bases regenerated: ${basesRegenerated}\n`;

    if (errors.length > 0) {
      message += `\nErrors encountered:\n`;
      errors.forEach((error: string) => {
        message += `• ${error}\n`;
      });
    }

    // Show a notice to the user
    new Notice(message, 5000);
    console.log('Task Sync: Refresh results:', results);
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



