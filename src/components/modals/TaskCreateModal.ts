/**
 * Task creation modal for the Task Sync plugin
 * Provides a form interface for creating new tasks with all required fields
 */

import { App, Modal, Setting } from 'obsidian';
import TaskSyncPlugin, { FileContext } from '../../main';

export interface TaskCreateData {
  name: string;
  type?: string;
  areas?: string;
  parentTask?: string;
  subTasks?: string;
  tags: string[];
  project?: string;
  done: boolean;
  status: string;
  priority?: string;
  description?: string;
}

export class TaskCreateModal extends Modal {
  private plugin: TaskSyncPlugin;
  private context: FileContext;
  private onSubmitCallback?: (taskData: TaskCreateData) => Promise<void>;
  private formData: Partial<TaskCreateData> = {};

  constructor(app: App, plugin: TaskSyncPlugin, context: FileContext = { type: 'none' }) {
    super(app);
    this.plugin = plugin;
    this.context = context;
    this.modalEl.addClass('task-sync-create-task');
    this.modalEl.addClass('task-sync-modal');
  }

  onOpen(): void {
    const title = this.getContextualTitle();
    this.titleEl.setText(title);
    this.initializeFormData();
    this.createContent();
  }

  private getContextualTitle(): string {
    switch (this.context.type) {
      case 'project':
        return `Create Task for Project: ${this.context.name}`;
      case 'area':
        return `Create Task for Area: ${this.context.name}`;
      default:
        return 'Create New Task';
    }
  }

  private initializeFormData(): void {
    // Pre-fill form data based on context
    this.formData = {
      name: '',
      type: this.plugin.settings.taskTypes[0] || 'Task', // Use first configured task type
      done: false,
      status: 'Backlog',
      tags: []
    };

    // Context-specific prefilling
    if (this.context.type === 'project' && this.context.name) {
      this.formData.project = this.context.name;
    } else if (this.context.type === 'area' && this.context.name) {
      this.formData.areas = this.context.name;
    }
  }

  private createContent(): void {
    this.contentEl.empty();

    // Create main container
    const container = this.contentEl.createDiv('task-sync-modal-content');

    // Add context info if available
    if (this.context.type !== 'none') {
      this.createContextInfo(container);
    }

    // Create form using Setting components
    this.createFormFields(container);
    this.createFormActions(container);
  }

  private createContextInfo(container: HTMLElement): void {
    const contextDiv = container.createDiv('task-sync-context-info');
    const contextType = this.context.type === 'project' ? 'Project' : 'Area';
    contextDiv.createEl('p', {
      text: `Creating task for ${contextType}: ${this.context.name}`,
      cls: 'task-sync-context-text'
    });
  }

  private createFormFields(container: HTMLElement): void {
    // Task name (required)
    new Setting(container)
      .setName('Task Name')
      .setDesc('Enter a descriptive name for the task')
      .addText(text => {
        text.setPlaceholder('Enter task name...')
          .setValue(this.formData.name || '')
          .onChange(value => {
            this.formData.name = value;
          });
        text.inputEl.addClass('task-sync-required-field');
      });

    // Type
    new Setting(container)
      .setName('Type')
      .setDesc('Specify the type of task')
      .addDropdown(dropdown => {
        // Use configured task types from settings
        this.plugin.settings.taskTypes.forEach(taskType => {
          dropdown.addOption(taskType, taskType);
        });

        dropdown.setValue(this.formData.type || this.plugin.settings.taskTypes[0])
          .onChange(value => {
            this.formData.type = value;
          });
      });

    // Project (context-aware)
    new Setting(container)
      .setName('Project')
      .setDesc('Related project for this task')
      .addText(text => {
        text.setPlaceholder('Project name (optional)')
          .setValue(this.formData.project || '')
          .onChange(value => {
            this.formData.project = value;
          });

        // Disable if context is project
        if (this.context.type === 'project') {
          text.setDisabled(true);
        }
      });

    // Areas (context-aware)
    new Setting(container)
      .setName('Areas')
      .setDesc('Related areas for this task')
      .addText(text => {
        text.setPlaceholder('Area names (optional)')
          .setValue(this.formData.areas || '')
          .onChange(value => {
            this.formData.areas = value;
          });

        // Disable if context is area
        if (this.context.type === 'area') {
          text.setDisabled(true);
        }
      });

    // Parent Task
    new Setting(container)
      .setName('Parent Task')
      .setDesc('Parent task if this is a subtask')
      .addText(text => {
        text.setPlaceholder('Parent task name (optional)')
          .setValue(this.formData.parentTask || '')
          .onChange(value => {
            this.formData.parentTask = value;
          });
      });

    // Sub-tasks
    new Setting(container)
      .setName('Sub-tasks')
      .setDesc('Comma-separated list of subtasks')
      .addText(text => {
        text.setPlaceholder('Subtask names (optional)')
          .setValue(this.formData.subTasks || '')
          .onChange(value => {
            this.formData.subTasks = value;
          });
      });

    // Tags
    new Setting(container)
      .setName('Tags')
      .setDesc('Comma-separated tags for organization')
      .addText(text => {
        text.setPlaceholder('tag1, tag2, tag3')
          .setValue(this.formData.tags?.join(', ') || '')
          .onChange(value => {
            this.formData.tags = this.parseTags(value);
          });
      });

    // Status
    new Setting(container)
      .setName('Status')
      .setDesc('Current status of the task')
      .addDropdown(dropdown => {
        dropdown.addOption('Backlog', 'Backlog')
          .addOption('Todo', 'Todo')
          .addOption('In Progress', 'In Progress')
          .addOption('Done', 'Done')
          .setValue(this.formData.status || 'Backlog')
          .onChange(value => {
            this.formData.status = value;
          });
      });

    // Priority
    new Setting(container)
      .setName('Priority')
      .setDesc('Task priority level')
      .addDropdown(dropdown => {
        dropdown.addOption('', 'Select priority...')
          .addOption('Low', 'Low')
          .addOption('Medium', 'Medium')
          .addOption('High', 'High')
          .addOption('Urgent', 'Urgent')
          .setValue(this.formData.priority || '')
          .onChange(value => {
            this.formData.priority = value;
          });
      });

    // Description
    new Setting(container)
      .setName('Description')
      .setDesc('Detailed description of the task')
      .addTextArea(text => {
        text.setPlaceholder('Task description...')
          .setValue(this.formData.description || '')
          .onChange(value => {
            this.formData.description = value;
          });
        text.inputEl.rows = 4;
      });
  }

  private createFormActions(container: HTMLElement): void {
    const actionsContainer = container.createDiv('task-sync-form-actions');

    const cancelButton = actionsContainer.createEl('button', {
      text: 'Cancel',
      type: 'button',
      cls: 'mod-cancel'
    });
    cancelButton.addEventListener('click', () => this.close());

    const submitButton = actionsContainer.createEl('button', {
      text: 'Create Task',
      type: 'button',
      cls: 'mod-cta'
    });
    submitButton.addEventListener('click', () => this.handleSubmit());
  }

  private async handleSubmit(): Promise<void> {
    // Validate required fields
    if (!this.formData.name?.trim()) {
      this.showError('Task name is required');
      return;
    }

    // Prepare task data
    const taskData: TaskCreateData = {
      name: this.formData.name.trim(),
      type: this.formData.type || undefined,
      areas: this.formData.areas || undefined,
      parentTask: this.formData.parentTask || undefined,
      subTasks: this.formData.subTasks || undefined,
      tags: this.formData.tags || [],
      project: this.formData.project || undefined,
      done: false,
      status: this.formData.status || 'Backlog',
      priority: this.formData.priority || undefined,
      description: this.formData.description || undefined
    };

    try {
      if (this.onSubmitCallback) {
        await this.onSubmitCallback(taskData);
      }
      this.close();
    } catch (error) {
      console.error('Failed to create task:', error);
      this.showError('Failed to create task. Please try again.');
    }
  }

  private showError(message: string): void {
    // Find or create error container
    let errorContainer = this.contentEl.querySelector('.task-sync-error') as HTMLElement;
    if (!errorContainer) {
      errorContainer = this.contentEl.createDiv('task-sync-error');
      errorContainer.style.color = 'var(--text-error)';
      errorContainer.style.marginBottom = '1rem';
      errorContainer.style.padding = '0.5rem';
      errorContainer.style.backgroundColor = 'var(--background-modifier-error)';
      errorContainer.style.borderRadius = '4px';
    }
    errorContainer.textContent = message;

    // Auto-hide after 5 seconds
    setTimeout(() => {
      if (errorContainer) {
        errorContainer.remove();
      }
    }, 5000);
  }

  private parseTags(tagsString: string): string[] {
    return tagsString
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);
  }

  public onSubmit(callback: (taskData: TaskCreateData) => Promise<void>): void {
    this.onSubmitCallback = callback;
  }

  onClose(): void {
    // Cleanup if needed
  }
}
