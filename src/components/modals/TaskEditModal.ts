/**
 * Task editing modal for the Task Sync plugin
 * Provides a form interface for editing existing tasks with pre-populated fields
 */

import { App } from 'obsidian';
import { BaseModal } from '../ui/BaseModal';
import { Form, Validators } from '../ui/BaseComponents';
import { ProjectAreaPicker, PickerData } from '../ui/ProjectAreaPicker';
import { Task, TaskStatus, TaskPriority } from '../../types/entities';
import TaskSyncPlugin from '../../main';

export interface TaskUpdateData {
  id: string;
  name: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  deadline?: Date;
  scheduledDate?: Date;
  completedAt?: Date;
  projectId?: string;
  areaId?: string;
  tags: string[];
  estimatedDuration?: number;
  actualDuration?: number;
}

export class TaskEditModal extends BaseModal {
  private plugin: TaskSyncPlugin;
  private task: Task;
  private projectAreaPicker: ProjectAreaPicker;
  private pickerData: PickerData;
  private onSubmitCallback?: (taskData: TaskUpdateData) => Promise<void>;
  private onDeleteCallback?: (taskId: string) => Promise<void>;

  constructor(app: App, plugin: TaskSyncPlugin, task: Task, pickerData: PickerData) {
    super(app, {
      title: 'Edit Task',
      width: '650px',
      className: 'task-sync-edit-task'
    });
    this.plugin = plugin;
    this.task = task;
    this.pickerData = pickerData;
  }

  protected createContent(): void {
    this.setupKeyboardHandlers();
    
    // Create header
    this.createHeader(
      'Edit Task',
      `Modify the details of "${this.task.name}". Changes will be saved when you click Update.`
    );

    // Create form
    const form = this.createForm();
    this.setupForm(form);

    // Create footer with buttons
    this.createFormFooter();
  }

  private setupForm(form: Form): void {
    // Task name (required)
    form.addField('name', {
      label: 'Task Name *',
      description: 'A clear, descriptive name for your task',
      placeholder: 'Enter task name...',
      required: true,
      type: 'text',
      value: this.task.name
    })
    .addValidator(Validators.required)
    .addValidator(Validators.minLength(3))
    .addValidator(Validators.maxLength(200));

    // Task description
    form.addField('description', {
      label: 'Description',
      description: 'Optional detailed description of the task',
      placeholder: 'Enter task description...',
      type: 'textarea',
      value: this.task.description || ''
    })
    .addValidator(Validators.maxLength(1000));

    // Status
    form.addField('status', {
      label: 'Status',
      description: 'Current status of the task',
      type: 'select',
      value: this.task.status,
      options: Object.values(TaskStatus)
    });

    // Priority
    form.addField('priority', {
      label: 'Priority',
      description: 'Priority level for this task',
      type: 'select',
      value: this.task.priority,
      options: Object.values(TaskPriority)
    });

    // Deadline
    form.addField('deadline', {
      label: 'Deadline',
      description: 'Optional deadline for task completion',
      type: 'date',
      value: this.task.deadline ? this.task.deadline.toISOString().split('T')[0] : ''
    })
    .addValidator(Validators.date);

    // Scheduled date
    form.addField('scheduledDate', {
      label: 'Scheduled Date',
      description: 'When you plan to work on this task',
      type: 'date',
      value: this.task.scheduledDate ? this.task.scheduledDate.toISOString().split('T')[0] : ''
    })
    .addValidator(Validators.date);

    // Completed date (read-only if task is completed)
    if (this.task.status === TaskStatus.DONE && this.task.completedAt) {
      form.addField('completedAt', {
        label: 'Completed Date',
        description: 'When this task was completed',
        type: 'date',
        value: this.task.completedAt.toISOString().split('T')[0]
      });
    }

    // Tags
    form.addField('tags', {
      label: 'Tags',
      description: 'Comma-separated tags for organizing tasks',
      placeholder: 'work, urgent, review...',
      type: 'text',
      value: this.task.tags.join(', ')
    });

    // Estimated duration
    form.addField('estimatedDuration', {
      label: 'Estimated Duration (minutes)',
      description: 'How long you expect this task to take',
      placeholder: '60',
      type: 'text',
      value: this.task.estimatedDuration?.toString() || ''
    })
    .addValidator((value: string) => {
      if (value && (isNaN(Number(value)) || Number(value) < 0)) {
        return 'Please enter a valid number of minutes';
      }
      return null;
    });

    // Actual duration (if task is completed)
    if (this.task.status === TaskStatus.DONE) {
      form.addField('actualDuration', {
        label: 'Actual Duration (minutes)',
        description: 'How long this task actually took',
        placeholder: '60',
        type: 'text',
        value: this.task.actualDuration?.toString() || ''
      })
      .addValidator((value: string) => {
        if (value && (isNaN(Number(value)) || Number(value) < 0)) {
          return 'Please enter a valid number of minutes';
        }
        return null;
      });
    }

    // Create project/area picker section
    this.createProjectAreaSection();

    // Set up form submission
    form.onSubmit(async (data) => {
      await this.handleSubmit(data);
    });

    // Add status change handler to show/hide completed date field
    const statusField = form.getField('status');
    statusField?.onChange((status) => {
      if (status === TaskStatus.DONE && !this.task.completedAt) {
        // Auto-set completed date to now when marking as done
        const completedField = form.getField('completedAt');
        if (!completedField) {
          // Add completed date field dynamically
          this.addCompletedDateField(form);
        }
      }
    });
  }

  private addCompletedDateField(form: Form): void {
    // This would require extending the Form class to support dynamic field addition
    // For now, we'll handle this in the submit logic
  }

  private createProjectAreaSection(): void {
    const pickerContainer = this.contentEl.createDiv('task-sync-picker-section');
    pickerContainer.createEl('h4', { text: 'Organization' });
    pickerContainer.createEl('p', { 
      text: 'Assign this task to a project and/or area for better organization.',
      cls: 'task-sync-section-description'
    });

    this.projectAreaPicker = new ProjectAreaPicker(pickerContainer, this.pickerData, {
      allowEmpty: true,
      showCreateNew: true,
      onCreateNew: () => {
        // TODO: Open project/area creation modal
        console.log('Create new project/area');
      }
    });

    // Set initial values
    this.projectAreaPicker.setValues({
      projectId: this.task.projectId,
      areaId: this.task.areaId
    });
  }

  private createFormFooter(): void {
    const footer = this.createFooter();
    
    // Delete button (danger)
    this.createButton(footer, 'Delete', async () => {
      if (confirm(`Are you sure you want to delete the task "${this.task.name}"? This action cannot be undone.`)) {
        await this.handleDelete();
      }
    }, 'danger');

    // Cancel button
    this.createButton(footer, 'Cancel', () => {
      this.close();
    }, 'secondary');

    // Update button (primary)
    this.createButton(footer, 'Update Task', async () => {
      if (this.validateForm()) {
        const formData = this.getFormData();
        if (formData) {
          await this.handleSubmit(formData);
        }
      }
    }, 'primary');
  }

  private async handleSubmit(formData: Record<string, any>): Promise<void> {
    try {
      this.showLoading('Updating task...');

      // Parse form data into TaskUpdateData
      const taskData: TaskUpdateData = {
        id: this.task.id,
        name: formData.name,
        description: formData.description || undefined,
        status: formData.status as TaskStatus,
        priority: formData.priority as TaskPriority,
        deadline: formData.deadline ? new Date(formData.deadline) : undefined,
        scheduledDate: formData.scheduledDate ? new Date(formData.scheduledDate) : undefined,
        projectId: this.projectAreaPicker.getProjectValue() || undefined,
        areaId: this.projectAreaPicker.getAreaValue() || undefined,
        tags: this.parseTags(formData.tags),
        estimatedDuration: formData.estimatedDuration ? Number(formData.estimatedDuration) : undefined,
        actualDuration: formData.actualDuration ? Number(formData.actualDuration) : undefined
      };

      // Set completed date if status is done and not already set
      if (taskData.status === TaskStatus.DONE && !this.task.completedAt) {
        taskData.completedAt = new Date();
      } else if (taskData.status !== TaskStatus.DONE) {
        taskData.completedAt = undefined;
      } else {
        taskData.completedAt = this.task.completedAt;
      }

      // Validate dates
      if (taskData.deadline && taskData.scheduledDate && taskData.deadline < taskData.scheduledDate) {
        this.showError('Deadline cannot be before the scheduled date.');
        return;
      }

      // Call the submit callback if provided
      if (this.onSubmitCallback) {
        await this.onSubmitCallback(taskData);
      } else {
        // Default behavior: update task using plugin services
        await this.updateTask(taskData);
      }

      this.showSuccess('Task updated successfully!');
      
    } catch (error) {
      console.error('Failed to update task:', error);
      this.showError('Failed to update task. Please try again.');
    }
  }

  private async handleDelete(): Promise<void> {
    try {
      this.showLoading('Deleting task...');

      // Call the delete callback if provided
      if (this.onDeleteCallback) {
        await this.onDeleteCallback(this.task.id);
      } else {
        // Default behavior: delete task using plugin services
        await this.deleteTask(this.task.id);
      }

      this.showSuccess('Task deleted successfully!');
      
    } catch (error) {
      console.error('Failed to delete task:', error);
      this.showError('Failed to delete task. Please try again.');
    }
  }

  private async updateTask(taskData: TaskUpdateData): Promise<void> {
    // TODO: Implement actual task update using plugin services
    // For now, just log the task data
    console.log('Updating task:', taskData);
    
    // Simulate async operation
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  private async deleteTask(taskId: string): Promise<void> {
    // TODO: Implement actual task deletion using plugin services
    // For now, just log the task ID
    console.log('Deleting task:', taskId);
    
    // Simulate async operation
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  private parseTags(tagsString: string): string[] {
    if (!tagsString) return [];
    
    return tagsString
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0)
      .map(tag => tag.toLowerCase());
  }

  public onSubmit(callback: (taskData: TaskUpdateData) => Promise<void>): TaskEditModal {
    this.onSubmitCallback = callback;
    return this;
  }

  public onDelete(callback: (taskId: string) => Promise<void>): TaskEditModal {
    this.onDeleteCallback = callback;
    return this;
  }

  public updatePickerData(data: PickerData): void {
    this.pickerData = data;
    if (this.projectAreaPicker) {
      this.projectAreaPicker.updateData(data);
    }
  }

  protected cleanup(): void {
    // Clean up any resources if needed
    super.cleanup();
  }
}

/**
 * Utility function to open a task editing modal
 */
export async function openTaskEditModal(
  app: App, 
  plugin: TaskSyncPlugin, 
  task: Task,
  pickerData: PickerData
): Promise<TaskUpdateData | null> {
  return new Promise((resolve) => {
    const modal = new TaskEditModal(app, plugin, task, pickerData);
    
    modal.onSubmit(async (taskData) => {
      resolve(taskData);
      modal.close();
    });
    
    modal.onDelete(async (taskId) => {
      resolve(null); // Indicate deletion
      modal.close();
    });
    
    // Handle modal close without submission
    const originalClose = modal.close.bind(modal);
    modal.close = () => {
      resolve(null);
      originalClose();
    };
    
    modal.open();
  });
}
