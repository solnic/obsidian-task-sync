/**
 * Task creation modal for the Task Sync plugin
 * Provides a form interface for creating new tasks with all required fields
 */

import { App, Modal } from 'obsidian';
import TaskSyncPlugin from '../../main';

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
  private onSubmitCallback?: (taskData: TaskCreateData) => Promise<void>;

  constructor(app: App, plugin: TaskSyncPlugin) {
    super(app);
    this.plugin = plugin;
    this.modalEl.addClass('task-sync-create-task');
  }

  onOpen(): void {
    this.titleEl.setText('Create New Task');
    this.createContent();
  }

  private createContent(): void {
    this.contentEl.empty();

    // Create form
    const form = this.contentEl.createEl('form');
    form.addClass('task-sync-create-task-form');

    // Task name (required)
    this.createField(form, 'name', 'Task Name *', 'text', 'Enter task name...', true);

    // Type
    this.createField(form, 'type', 'Type', 'text', 'Task type (optional)');

    // Areas
    this.createField(form, 'areas', 'Areas', 'text', 'Related areas (optional)');

    // Parent task
    this.createField(form, 'parentTask', 'Parent Task', 'text', 'Parent task (optional)');

    // Sub-tasks
    this.createField(form, 'subTasks', 'Sub-tasks', 'text', 'Sub-tasks (optional)');

    // Tags
    this.createField(form, 'tags', 'Tags', 'text', 'Comma-separated tags');

    // Project
    this.createField(form, 'project', 'Project', 'text', 'Related project (optional)');

    // Status
    this.createSelectField(form, 'status', 'Status', ['Backlog', 'Todo', 'In Progress', 'Done'], 'Backlog');

    // Priority
    this.createSelectField(form, 'priority', 'Priority', ['Low', 'Medium', 'High', 'Urgent'], '');

    // Description
    this.createTextareaField(form, 'description', 'Description', 'Task description...');

    this.createFormActions(form);
  }

  private createField(form: HTMLFormElement, name: string, label: string, type: string, placeholder: string, required = false): void {
    const fieldContainer = form.createDiv('task-sync-field');
    fieldContainer.createEl('label', { text: label, attr: { for: name } });
    const input = fieldContainer.createEl('input', {
      attr: {
        type,
        name,
        placeholder,
        ...(required && { required: 'true' })
      }
    });
  }

  private createSelectField(form: HTMLFormElement, name: string, label: string, options: string[], defaultValue: string): void {
    const fieldContainer = form.createDiv('task-sync-field');
    fieldContainer.createEl('label', { text: label, attr: { for: name } });
    const select = fieldContainer.createEl('select', { attr: { name } });

    if (!defaultValue) {
      select.createEl('option', { text: 'Select...', attr: { value: '' } });
    }

    options.forEach(option => {
      const optionEl = select.createEl('option', { text: option, attr: { value: option } });
      if (option === defaultValue) {
        optionEl.selected = true;
      }
    });
  }

  private createTextareaField(form: HTMLFormElement, name: string, label: string, placeholder: string): void {
    const fieldContainer = form.createDiv('task-sync-field');
    fieldContainer.createEl('label', { text: label, attr: { for: name } });
    fieldContainer.createEl('textarea', {
      attr: {
        name,
        placeholder,
        rows: '3'
      }
    });
  }

  private createFormActions(form: HTMLFormElement): void {
    const actionsContainer = form.createDiv('task-sync-form-actions');

    const cancelButton = actionsContainer.createEl('button', {
      text: 'Cancel',
      type: 'button',
      cls: 'mod-cancel'
    });
    cancelButton.addEventListener('click', () => this.close());

    const submitButton = actionsContainer.createEl('button', {
      text: 'Create Task',
      type: 'submit',
      cls: 'mod-cta'
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSubmit(form);
    });
  }

  private async handleSubmit(form: HTMLFormElement): Promise<void> {
    const formData = new FormData(form);

    const taskData: TaskCreateData = {
      name: formData.get('name') as string,
      type: formData.get('type') as string || undefined,
      areas: formData.get('areas') as string || undefined,
      parentTask: formData.get('parentTask') as string || undefined,
      subTasks: formData.get('subTasks') as string || undefined,
      tags: this.parseTags(formData.get('tags') as string || ''),
      project: formData.get('project') as string || undefined,
      done: false,
      status: formData.get('status') as string || 'Backlog',
      priority: formData.get('priority') as string || undefined,
      description: formData.get('description') as string || undefined
    };

    if (!taskData.name?.trim()) {
      // Show error
      return;
    }

    try {
      if (this.onSubmitCallback) {
        await this.onSubmitCallback(taskData);
      }
      this.close();
    } catch (error) {
      console.error('Failed to create task:', error);
    }
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
