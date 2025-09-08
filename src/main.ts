import { Plugin, TFile, MarkdownView, Notice, WorkspaceLeaf, Modal, App } from 'obsidian';
import { VaultScanner } from './services/VaultScannerService';
import { BaseManager } from './services/BaseManager';
import { PluginStorageService } from './services/PluginStorageService';
import { FileChangeListener } from './services/FileChangeListener';
import { TemplateManager } from './services/TemplateManager';
import { TaskFileManager } from './services/TaskFileManager';
import { AreaFileManager } from './services/AreaFileManager';
import { ProjectFileManager } from './services/ProjectFileManager';
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
import { TaskImportManager } from './services/TaskImportManager';
import { ImportStatusService } from './services/ImportStatusService';
import { GitHubIssuesView, GITHUB_ISSUES_VIEW_TYPE } from './views/GitHubIssuesView';
import { TaskImportConfig } from './types/integrations';


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
  taskImportManager: TaskImportManager;
  importStatusService: ImportStatusService;
  taskFileManager: TaskFileManager;
  areaFileManager: AreaFileManager;
  projectFileManager: ProjectFileManager;

  // Global context system
  private currentContext: FileContext = { type: 'none' };

  async onload() {
    console.log('Loading Task Sync Plugin');

    // Load settings
    await this.loadSettings();

    // Initialize services
    console.log('🔧 Initializing services with settings:', {
      taskTypes: this.settings.taskTypes,
      githubIntegration: this.settings.githubIntegration
    });

    this.vaultScanner = new VaultScanner(this.app.vault, this.settings);
    this.baseManager = new BaseManager(this.app, this.app.vault, this.settings);
    this.templateManager = new TemplateManager(this.app, this.app.vault, this.settings);
    this.storageService = new PluginStorageService(this.app, this);
    this.githubService = new GitHubService(this.settings);

    // Initialize import services
    this.taskImportManager = new TaskImportManager(this.app, this.app.vault, this.settings);
    this.importStatusService = new ImportStatusService(this);
    this.taskFileManager = new TaskFileManager(this.app, this.app.vault, this.settings);
    this.areaFileManager = new AreaFileManager(this.app, this.app.vault, this.settings);
    this.projectFileManager = new ProjectFileManager(this.app, this.app.vault, this.settings);

    // Initialize import status service with persisted data
    await this.importStatusService.initialize();

    // Wire up GitHub service with import dependencies
    this.githubService.setImportDependencies(this.taskImportManager, this.importStatusService);

    // Initialize storage service
    await this.storageService.initialize();

    // Ensure templates exist
    await this.templateManager.ensureTemplatesExist();

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

    // Initialize context tracking system
    this.initializeContextTracking();

    // Add settings tab
    this.addSettingTab(new TaskSyncSettingTab(this.app, this));

    // Register GitHub Issues view
    this.registerView(
      GITHUB_ISSUES_VIEW_TYPE,
      (leaf) => new GitHubIssuesView(
        leaf,
        this.githubService,
        { githubIntegration: this.settings.githubIntegration },
        {
          taskImportManager: this.taskImportManager,
          importStatusService: this.importStatusService,
          getDefaultImportConfig: () => this.getDefaultImportConfig()
        }
      )
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

    // GitHub Import Commands
    this.addCommand({
      id: 'import-github-issue',
      name: 'Import GitHub Issue',
      callback: async () => {
        await this.importGitHubIssue();
      }
    });

    this.addCommand({
      id: 'import-all-github-issues',
      name: 'Import All GitHub Issues',
      callback: async () => {
        await this.importAllGitHubIssues();
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
      console.log('🔧 Loaded data from storage:', loadedData);
      console.log('🔧 DEFAULT_SETTINGS.taskTypes:', DEFAULT_SETTINGS.taskTypes);

      this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData);
      console.log('🔧 Final settings after merge:', {
        taskTypes: this.settings.taskTypes,
        githubIntegration: this.settings.githubIntegration
      });

      // Validate settings
      this.validateSettings();
    } catch (error) {
      console.error('Task Sync: Failed to load settings:', error);
      this.settings = { ...DEFAULT_SETTINGS };
      console.log('🔧 Using fallback DEFAULT_SETTINGS:', {
        taskTypes: this.settings.taskTypes
      });
    }
  }

  async saveSettings() {
    try {
      // Validate settings before saving
      this.validateSettings();

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

      // Update TaskImportManager with new settings
      if (this.taskImportManager) {
        this.taskImportManager.updateSettings(this.settings);
      }

      // Update GitHub Issues view if it's open
      const githubLeaves = this.app.workspace.getLeavesOfType(GITHUB_ISSUES_VIEW_TYPE);
      githubLeaves.forEach(leaf => {
        const view = leaf.view as GitHubIssuesView;
        if (view && view.updateSettings) {
          view.updateSettings({ githubIntegration: this.settings.githubIntegration });
        }
      });

      // Update TemplateManager with new settings and handle template updates
      if (this.templateManager) {
        this.templateManager.updateSettings(this.settings);
        await this.templateManager.updateTemplatesOnSettingsChange();
        console.log('Task Sync: TemplateManager updated with new settings');
      }

      // Update BaseManager with new settings
      if (this.baseManager) {
        this.baseManager.updateSettings(this.settings);
        console.log('Task Sync: BaseManager updated with new settings');
      }

      // Update file managers with new settings
      if (this.taskFileManager) {
        this.taskFileManager.updateSettings(this.settings);
      }
      if (this.areaFileManager) {
        this.areaFileManager.updateSettings(this.settings);
      }
      if (this.projectFileManager) {
        this.projectFileManager.updateSettings(this.settings);
      }

      // Note: FileChangeListener will get updated settings automatically since it references this.settings
    } catch (error) {
      console.error('Task Sync: Failed to save settings:', error);
      throw error;
    }
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

    // Validate template settings - these are MANDATORY and cannot be empty
    const templateFields = ['defaultTaskTemplate', 'defaultProjectTemplate', 'defaultAreaTemplate', 'defaultParentTaskTemplate'];
    templateFields.forEach(field => {
      const templateName = this.settings[field as keyof TaskSyncSettings] as string;

      if (!templateName || typeof templateName !== 'string' || templateName.trim() === '') {
        console.warn(`Task Sync: Template setting ${field} is empty or invalid, using default`);
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
   * Initialize context tracking system
   */
  private initializeContextTracking(): void {
    // Update context when active file changes
    this.registerEvent(
      this.app.workspace.on('active-leaf-change', () => {
        this.updateCurrentContext();
      })
    );

    // Update context when file is opened
    this.registerEvent(
      this.app.workspace.on('file-open', () => {
        this.updateCurrentContext();
      })
    );

    // Set initial context
    this.updateCurrentContext();
  }

  /**
   * Update the current context based on active file
   */
  private updateCurrentContext(): void {
    const newContext = this.detectCurrentFileContext();

    // Only update if context actually changed
    if (this.currentContext.type !== newContext.type ||
      this.currentContext.name !== newContext.name) {
      this.currentContext = newContext;
      console.log('🔄 Context updated:', this.currentContext);
    }
  }

  /**
   * Get the current context
   */
  getCurrentContext(): FileContext {
    return { ...this.currentContext };
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
   * Find all child todos of a parent todo by looking at lines below
   * Returns todos that are indented more than the parent
   */
  private findChildTodos(parentTodo: TodoItem): TodoItem[] {
    const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!markdownView) {
      return [];
    }

    const editor = markdownView.editor;
    const parentIndentLevel = parentTodo.indentation.length;
    const childTodos: TodoItem[] = [];
    const totalLines = editor.lineCount();

    // Look forward from parent line to find child todos
    for (let lineNum = parentTodo.lineNumber + 1; lineNum < totalLines; lineNum++) {
      const line = editor.getLine(lineNum);

      // Skip empty lines
      if (line.trim() === '') {
        continue;
      }

      const todoRegex = /^(\s*)([-*])\s*\[([xX\s])\]\s*(.+)$/;
      const match = line.match(todoRegex);

      if (match) {
        const [, indentation, listMarker, checkboxState, text] = match;
        const indentLevel = indentation.length;

        // If indentation is greater than parent, it's a child
        if (indentLevel > parentIndentLevel) {
          childTodos.push({
            text: text.trim(),
            completed: checkboxState.toLowerCase() === 'x',
            indentation,
            listMarker,
            lineNumber: lineNum
          });
        } else {
          // If we hit a todo with same or less indentation, we've reached the end of children
          break;
        }
      } else {
        // If we hit a non-todo line with same or less indentation, we've reached the end of children
        const lineIndentLevel = line.match(/^(\s*)/)?.[1]?.length || 0;
        if (lineIndentLevel <= parentIndentLevel) {
          break;
        }
      }
    }

    return childTodos;
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

      // Check if the current todo has children (is a parent todo)
      const childTodos = this.findChildTodos(todoWithParent);
      const isParentTodo = childTodos.length > 0;

      let parentTaskName: string | undefined;

      // If this todo has a parent, create the parent task first
      if (todoWithParent.parentTodo) {
        const parentTaskData = {
          name: todoWithParent.parentTodo.text,
          category: this.settings.taskTypes[0]?.name || 'Task',
          done: todoWithParent.parentTodo.completed,
          status: todoWithParent.parentTodo.completed ? 'Done' : 'Backlog',
          tags: [] as string[],
          // Include the child task in sub-tasks field from the start
          subTasks: [todoWithParent.text],
          // Set context-specific fields
          ...(context.type === 'project' && context.name ? { project: context.name } : {}),
          ...(context.type === 'area' && context.name ? { areas: [context.name] } : {})
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

      // Prepare task data (could be parent or child task)
      console.log(`Creating task data for: ${todoWithParent.text}, childTodos.length: ${childTodos.length}`);
      if (childTodos.length > 0) {
        console.log(`Child todos: ${JSON.stringify(childTodos.map(child => child.text))}`);
      }

      const taskData = {
        name: todoWithParent.text,
        category: this.settings.taskTypes[0]?.name || 'Task',
        done: todoWithParent.completed,
        status: todoWithParent.completed ? 'Done' : 'Backlog',
        tags: [] as string[],
        // Set parent task if exists (FrontMatterGenerator will handle link formatting)
        ...(parentTaskName ? { parentTask: parentTaskName } : {}),
        // If this todo has children, include them as sub-tasks (use sanitized names that will be used for files)
        ...(childTodos.length > 0 ? { subTasks: childTodos.map(child => sanitizeFileName(child.text)) } : {}),
        // Set context-specific fields
        ...(context.type === 'project' && context.name ? { project: context.name } : {}),
        ...(context.type === 'area' && context.name ? { areas: [context.name] } : {})
      };

      console.log(`Task data created: ${JSON.stringify(taskData)}`);

      // Create the main task
      await this.createTask(taskData);

      // If this todo has children, promote them as individual tasks
      if (childTodos.length > 0) {
        for (const childTodo of childTodos) {
          const childTaskData = {
            name: childTodo.text,
            category: this.settings.taskTypes[0]?.name || 'Task',
            done: childTodo.completed,
            status: childTodo.completed ? 'Done' : 'Backlog',
            tags: [] as string[],
            // Set the current todo as parent (TaskFileManager will handle link formatting)
            parentTask: todoWithParent.text,
            // Set context-specific fields
            ...(context.type === 'project' && context.name ? { project: context.name } : {}),
            ...(context.type === 'area' && context.name ? { areas: [context.name] } : {})
          };

          await this.createTask(childTaskData);
        }

        // Create base for parent task to show its sub-tasks
        try {
          await this.baseManager.createOrUpdateParentTaskBase(todoWithParent.text);
        } catch (error) {
          console.error('Failed to create parent task base:', error);
        }
      }

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
        // Check for checkboxes but exclude lines that already contain links
        const hasCheckbox = parentLine.includes('[ ]') || parentLine.includes('[x]') || parentLine.includes('[X]');
        const hasLink = parentLine.includes('[[') && parentLine.includes(']]');
        if (hasCheckbox && !hasLink) {
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

      // Also replace child todo lines if they exist
      if (childTodos.length > 0) {
        for (const childTodo of childTodos) {
          const childLine = editor.getLine(childTodo.lineNumber);
          // Only replace if it's still a todo (not already a link)
          const hasCheckbox = childLine.includes('[ ]') || childLine.includes('[x]') || childLine.includes('[X]');
          const hasLink = childLine.includes('[[') && childLine.includes(']]');
          if (hasCheckbox && !hasLink) {
            const originalChildLine = childLine;
            let childReplacementLine: string;
            if (childTodo.completed) {
              childReplacementLine = `${childTodo.indentation}${childTodo.listMarker} [x] [[${childTodo.text}]]`;
            } else {
              childReplacementLine = `${childTodo.indentation}${childTodo.listMarker} [ ] [[${childTodo.text}]]`;
            }
            editor.setLine(childTodo.lineNumber, childReplacementLine);

            // Track the child todo promotion as well
            const childTaskPath = `${this.settings.tasksFolder}/${createSafeFileName(childTodo.text)}`;
            await this.storageService.trackPromotedTodo(
              childTodo.text,
              originalChildLine,
              activeFile.path,
              childTodo.lineNumber,
              childTodo.text,
              childTaskPath,
              {
                text: todoWithParent.text,
                lineNumber: todoWithParent.lineNumber,
                taskName: todoWithParent.text
              }
            );
          }
        }
      }

      const message = childTodos.length > 0
        ? `Todo promoted to task with ${childTodos.length} sub-tasks: ${todoWithParent.text}`
        : parentTaskName
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
      // Convert old taskData format to TaskCreationData format
      const taskCreationData = this.mapToTaskCreationData(taskData);

      // Determine content based on parent task status
      const isParentTask = taskData.subTasks && taskData.subTasks.length > 0;
      let content = '';

      if (isParentTask) {
        // For parent tasks, generate content with sub-tasks base using {{tasks}} variable
        content = [
          '',
          '',
          '## Sub-tasks',
          '',
          '{{tasks}}',
          ''
        ].join('\n');
      }
      // For regular tasks, leave content empty (no {{description}} handling)

      // Use TaskFileManager to create the task file (it will process {{tasks}} variable)
      const taskPath = await this.taskFileManager.createTaskFile(taskCreationData, content);
      console.log('Task created successfully:', taskPath);
    } catch (error) {
      console.error('Failed to create task:', error);
      throw error;
    }
  }

  /**
   * Map old taskData format to TaskCreationData format for TaskFileManager
   */
  private mapToTaskCreationData(taskData: any): any {
    return {
      title: taskData.name,
      // Handle both 'category' and 'type' fields for backward compatibility
      // 'type' is used by legacy tests, 'category' is the new field
      category: taskData.category || taskData.type,
      priority: taskData.priority,
      areas: taskData.areas,
      project: taskData.project,
      done: taskData.done,
      status: taskData.status,
      parentTask: taskData.parentTask,
      subTasks: taskData.subTasks,
      tags: taskData.tags
    };
  }

  /**
   * Create a new area
   */
  private async createArea(areaData: AreaCreateData): Promise<void> {
    try {
      const areaFileName = createSafeFileName(areaData.name);
      const areaPath = `${this.settings.areasFolder}/${areaFileName}`;

      // Generate area content using the existing method
      const areaContent = await this.generateAreaContent(areaData);

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

      // Generate project content using the existing method
      const projectContent = await this.generateProjectContent(projectData);

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
  private async generateAreaContent(areaData: AreaCreateData): Promise<string> {
    // Try to read template first
    const templateContent = await this.templateManager.readTemplate('area');

    let content: string;
    if (templateContent) {
      // Use template content as-is, only process {{tasks}} variable
      content = templateContent;
    } else {
      // Generate basic area content with {{tasks}} variable
      content = [
        '---',
        `Name: ${areaData.name}`,
        'Type: Area',
        '---',
        '',
        '## Notes',
        '',
        areaData.description || '',
        '',
        '## Tasks',
        '',
        '{{tasks}}',
        ''
      ].join('\n');
    }

    // Process {{tasks}} variable using TaskFileManager
    const processedContent = this.taskFileManager.processTasksVariable(content, areaData.name);

    return processedContent;
  }

  /**
   * Generate default project content
   */
  private async generateProjectContent(projectData: ProjectCreateData): Promise<string> {
    // Try to read template first
    const templateContent = await this.templateManager.readTemplate('project');

    let content: string;
    if (templateContent) {
      // Use template content as-is, only process {{tasks}} variable
      content = templateContent;
    } else {
      // Format areas as YAML array
      const areasArray = Array.isArray(projectData.areas) ? projectData.areas :
        (projectData.areas ? projectData.areas.split(',').map(s => s.trim()) : []);
      const areasYaml = areasArray.length > 0 ?
        areasArray.map(area => `  - ${area}`).join('\n') : '  []';

      // Generate basic project content with {{tasks}} variable
      content = [
        '---',
        `Name: ${projectData.name}`,
        `Areas:`,
        areasYaml,
        'Type: Project',
        '---',
        '',
        '## Notes',
        '',
        projectData.description || '',
        '',
        '## Tasks',
        '',
        '{{tasks}}',
        ''
      ].join('\n');
    }

    // Process {{tasks}} variable using TaskFileManager
    const processedContent = this.taskFileManager.processTasksVariable(content, projectData.name);

    return processedContent;
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

      // 2. Update task/project/area file properties
      await this.updateFileProperties(results);

      // 3. Update template files to match current property order
      await this.updateTemplateFiles(results);

      // 4. Regenerate all base files (existing functionality)
      await this.regenerateBases();
      results.basesRegenerated = 1;

      // 5. Provide feedback
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

      // Update task files using TaskFileManager
      await this.updateTaskFiles(results);

      // Update project files using ProjectFileManager
      await this.updateProjectFiles(results);

      // Update area files using AreaFileManager
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
        try {
          const updateResult = await this.taskFileManager.updateTaskFileProperties(filePath);
          if (updateResult.hasChanges) {
            results.filesUpdated++;
            results.propertiesUpdated += updateResult.propertiesChanged;
            console.log(`Task Sync: Updated ${updateResult.propertiesChanged} properties in ${filePath}`);
          } else {
            console.log(`Task Sync: No changes needed for ${filePath}`);
          }
        } catch (error) {
          console.error(`Task Sync: Failed to update task file ${filePath}:`, error);
          results.errors.push(`Failed to update ${filePath}: ${error.message}`);
        }
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
        try {
          const updateResult = await this.projectFileManager.updateFileProperties(filePath);
          if (updateResult.hasChanges) {
            results.filesUpdated++;
            results.propertiesUpdated += updateResult.propertiesChanged;
            console.log(`Task Sync: Updated ${updateResult.propertiesChanged} properties in ${filePath}`);
          } else {
            console.log(`Task Sync: No changes needed for ${filePath}`);
          }
        } catch (error) {
          console.error(`Task Sync: Failed to update project file ${filePath}:`, error);
          results.errors.push(`Failed to update ${filePath}: ${error.message}`);
        }
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
        try {
          const updateResult = await this.areaFileManager.updateFileProperties(filePath);
          if (updateResult.hasChanges) {
            results.filesUpdated++;
            results.propertiesUpdated += updateResult.propertiesChanged;
            console.log(`Task Sync: Updated ${updateResult.propertiesChanged} properties in ${filePath}`);
          } else {
            console.log(`Task Sync: No changes needed for ${filePath}`);
          }
        } catch (error) {
          console.error(`Task Sync: Failed to update area file ${filePath}:`, error);
          results.errors.push(`Failed to update ${filePath}: ${error.message}`);
        }
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

      // Update each template type using explicit paths from settings
      await this.updateSpecificTemplateFiles(results);

      console.log(`Task Sync: Updated ${results.templatesUpdated} template files`);
    } catch (error) {
      console.error('Task Sync: Failed to update template files:', error);
      results.errors.push(`Failed to update template files: ${error.message}`);
    }
  }

  /**
   * Update specific template files using explicit paths from settings
   */
  private async updateSpecificTemplateFiles(results: any): Promise<void> {
    try {
      // Update Task template
      await this.updateOrCreateTaskTemplate(results);

      // Update Area template (create only, don't modify existing)
      await this.updateOrCreateAreaTemplate(results);

      // Update Project template (create only, don't modify existing)
      await this.updateOrCreateProjectTemplate(results);

      // Update Parent Task template
      await this.updateOrCreateParentTaskTemplate(results);

    } catch (error) {
      console.error('Task Sync: Failed to update specific template files:', error);
      results.errors.push(`Failed to update specific template files: ${error.message}`);
    }
  }

  /**
   * Update or create Task template
   */
  private async updateOrCreateTaskTemplate(results: any): Promise<void> {
    const templatePath = `${this.settings.templateFolder}/${this.settings.defaultTaskTemplate}`;
    const file = this.app.vault.getAbstractFileByPath(templatePath);

    if (file && file instanceof TFile) {
      // Update existing task template with property reordering
      const content = await this.app.vault.read(file);
      const updatedContent = await this.taskFileManager.reorderTaskTemplateProperties(content);
      if (updatedContent !== content) {
        await this.app.vault.modify(file, updatedContent);
        results.templatesUpdated++;
        console.log(`Task Sync: Updated task template ${templatePath}`);
      }
    } else {
      // Create missing task template
      await this.templateManager.createTaskTemplate();
      results.templatesUpdated++;
      console.log(`Task Sync: Created missing task template ${templatePath}`);
    }
  }

  /**
   * Update or create Area template (create only, don't modify existing)
   */
  private async updateOrCreateAreaTemplate(results: any): Promise<void> {
    const templatePath = `${this.settings.templateFolder}/${this.settings.defaultAreaTemplate}`;
    const file = this.app.vault.getAbstractFileByPath(templatePath);

    if (!file) {
      // Create missing area template
      await this.templateManager.createAreaTemplate();
      results.templatesUpdated++;
      console.log(`Task Sync: Created missing area template ${templatePath}`);
    }
    // Don't modify existing area templates to preserve their structure
  }

  /**
   * Update or create Project template (create only, don't modify existing)
   */
  private async updateOrCreateProjectTemplate(results: any): Promise<void> {
    const templatePath = `${this.settings.templateFolder}/${this.settings.defaultProjectTemplate}`;
    const file = this.app.vault.getAbstractFileByPath(templatePath);

    if (!file) {
      // Create missing project template
      await this.templateManager.createProjectTemplate();
      results.templatesUpdated++;
      console.log(`Task Sync: Created missing project template ${templatePath}`);
    }
    // Don't modify existing project templates to preserve their structure
  }

  /**
   * Update or create Parent Task template
   */
  private async updateOrCreateParentTaskTemplate(results: any): Promise<void> {
    const templatePath = `${this.settings.templateFolder}/${this.settings.defaultParentTaskTemplate}`;
    const file = this.app.vault.getAbstractFileByPath(templatePath);

    if (file && file instanceof TFile) {
      // Update existing parent task template with property reordering
      const content = await this.app.vault.read(file);
      const updatedContent = await this.taskFileManager.reorderTaskTemplateProperties(content);
      if (updatedContent !== content) {
        await this.app.vault.modify(file, updatedContent);
        results.templatesUpdated++;
        console.log(`Task Sync: Updated parent task template ${templatePath}`);
      }
    } else {
      // Create missing parent task template
      await this.templateManager.createParentTaskTemplate();
      results.templatesUpdated++;
      console.log(`Task Sync: Created missing parent task template ${templatePath}`);
    }
  }





  // ============================================================================
  // REMOVED COMPLEX PROPERTY ORDERING METHODS - MOVED TO FILE MANAGERS
  // ============================================================================
  // The following methods have been moved to dedicated file managers for better
  // separation of concerns and to use Obsidian's native API for property ordering:
  //
  // - getFrontMatterSchema() -> moved to individual file managers
  // - extractFrontMatterData() -> moved to base FileManager class as protected method
  // - extractPropertyOrder() -> moved to base FileManager class as protected method
  // - isPropertyOrderCorrect() -> moved to base FileManager class as protected method
  // - updateSingleFile() -> replaced by AreaFileManager.updateFileProperties() and ProjectFileManager.updateFileProperties()
  //
  // This simplification allows each file manager to handle its own property ordering
  // logic while using Obsidian's native processFrontMatter API for better integration.
  // ============================================================================

  // REMOVED: updateSingleFile method - functionality moved to dedicated file managers

  // ============================================================================
  // REMOVED COMPLEX PROPERTY ORDERING METHODS
  // These methods have been moved to dedicated file managers:
  // - updateSingleFile -> AreaFileManager.updateFileProperties / ProjectFileManager.updateFileProperties
  // - getFrontMatterSchema -> moved to individual file managers
  // - extractPropertyOrder -> moved to base FileManager class
  // - isPropertyOrderCorrect -> moved to base FileManager class
  // - extractFrontMatterData -> moved to base FileManager class
  // ============================================================================

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
   * Import a single GitHub issue as a task
   */
  private async importGitHubIssue(): Promise<void> {
    if (!this.githubService.isEnabled()) {
      new Notice('GitHub integration is not enabled or configured');
      return;
    }

    try {
      // For now, show a simple prompt for issue URL
      // In a full implementation, this could be a modal with repository selection
      const issueUrl = await this.promptForIssueUrl();
      if (!issueUrl) {
        return;
      }

      const issue = await this.fetchIssueFromUrl(issueUrl);
      if (!issue) {
        new Notice('Failed to fetch GitHub issue');
        return;
      }

      // Use default import configuration
      const config = this.getDefaultImportConfig();

      const result = await this.githubService.importIssueAsTask(issue, config);

      if (result.success) {
        if (result.skipped) {
          new Notice(`Issue already imported: ${result.reason}`);
        } else {
          new Notice(`Successfully imported issue: ${issue.title}`);
        }
      } else {
        new Notice(`Failed to import issue: ${result.error}`);
      }
    } catch (error: any) {
      console.error('Failed to import GitHub issue:', error);
      new Notice(`Error importing issue: ${error.message}`);
    }
  }

  /**
   * Import all GitHub issues from the default repository
   */
  private async importAllGitHubIssues(): Promise<void> {
    if (!this.githubService.isEnabled()) {
      new Notice('GitHub integration is not enabled or configured');
      return;
    }

    try {
      const repository = this.settings.githubIntegration.defaultRepository;
      if (!repository) {
        new Notice('No default repository configured');
        return;
      }

      new Notice('Fetching GitHub issues...');

      const issues = await this.githubService.fetchIssues(repository);
      if (issues.length === 0) {
        new Notice('No issues found in repository');
        return;
      }

      new Notice(`Found ${issues.length} issues. Starting import...`);

      const config = this.getDefaultImportConfig();
      let imported = 0;
      let skipped = 0;
      let failed = 0;

      for (const issue of issues) {
        try {
          const result = await this.githubService.importIssueAsTask(issue, config);

          if (result.success) {
            if (result.skipped) {
              skipped++;
            } else {
              imported++;
            }
          } else {
            failed++;
            console.error(`Failed to import issue ${issue.number}:`, result.error);
          }
        } catch (error: any) {
          failed++;
          console.error(`Error importing issue ${issue.number}:`, error);
        }
      }

      new Notice(`Import complete: ${imported} imported, ${skipped} skipped, ${failed} failed`);
    } catch (error: any) {
      console.error('Failed to import GitHub issues:', error);
      new Notice(`Error importing issues: ${error.message}`);
    }
  }

  /**
   * Prompt user for GitHub issue URL
   */
  private async promptForIssueUrl(): Promise<string | null> {
    return new Promise((resolve) => {
      const modal = new (class extends Modal {
        result: string | null = null;

        constructor(app: App) {
          super(app);
        }

        onOpen() {
          const { contentEl } = this;
          contentEl.createEl('h2', { text: 'Import GitHub Issue' });

          const inputEl = contentEl.createEl('input', {
            type: 'text',
            placeholder: 'https://github.com/owner/repo/issues/123'
          });
          inputEl.style.width = '100%';
          inputEl.style.marginBottom = '10px';

          const buttonContainer = contentEl.createDiv();
          buttonContainer.style.textAlign = 'right';

          const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
          cancelBtn.style.marginRight = '10px';
          cancelBtn.onclick = () => {
            this.result = null;
            this.close();
          };

          const importBtn = buttonContainer.createEl('button', { text: 'Import' });
          importBtn.onclick = () => {
            this.result = inputEl.value.trim();
            this.close();
          };

          inputEl.focus();
          inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
              this.result = inputEl.value.trim();
              this.close();
            }
          });
        }

        onClose() {
          resolve(this.result);
        }
      })(this.app);

      modal.open();
    });
  }

  /**
   * Fetch GitHub issue from URL
   */
  private async fetchIssueFromUrl(url: string): Promise<any | null> {
    try {
      // Parse GitHub issue URL
      const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)\/issues\/(\d+)/);
      if (!match) {
        new Notice('Invalid GitHub issue URL format');
        return null;
      }

      const [, owner, repo, issueNumber] = match;
      const repository = `${owner}/${repo}`;

      // Fetch all issues and find the specific one
      // In a full implementation, you'd want to fetch the specific issue directly
      const issues = await this.githubService.fetchIssues(repository);
      const issue = issues.find(i => i.number === parseInt(issueNumber));

      if (!issue) {
        new Notice(`Issue #${issueNumber} not found in ${repository}`);
        return null;
      }

      return issue;
    } catch (error: any) {
      console.error('Error fetching issue from URL:', error);
      return null;
    }
  }

  /**
   * Get default import configuration with context awareness
   */
  getDefaultImportConfig(): TaskImportConfig {
    // Use the global context instead of detecting again
    const context = this.getCurrentContext();

    const config: TaskImportConfig = {
      // Don't set taskType here - let label mapping handle it
      importLabelsAsTags: true,
      preserveAssignee: true
    };

    // Apply context-specific configuration
    if (context.type === 'project' && context.name) {
      config.targetProject = context.name;
    } else if (context.type === 'area' && context.name) {
      config.targetArea = context.name;
    }

    return config;
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



