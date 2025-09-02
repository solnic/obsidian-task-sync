/**
 * Task creation modal for the Task Sync plugin
 * Provides a form interface for creating new tasks with all required fields
 */

import { App } from 'obsidian';
import { BaseModal } from '../ui/BaseModal';
import { Form, Validators } from '../ui/BaseComponents';
import { ProjectAreaPicker, PickerData } from '../ui/ProjectAreaPicker';
import { Task, TaskStatus, TaskPriority, Project, Area } from '../../types/entities';
import TaskSyncPlugin from '../../main';

export interface TaskCreateData {
  name: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  deadline?: Date;
  scheduledDate?: Date;
  projectId?: string;
  areaId?: string;
  tags: string[];
  estimatedDuration?: number;
}

export class TaskCreateModal extends BaseModal {
  private plugin: TaskSyncPlugin;
  private projectAreaPicker: ProjectAreaPicker;
  private pickerData: PickerData;
  private onSubmitCallback?: (taskData: TaskCreateData) => Promise<void>;

  constructor(app: App, plugin: TaskSyncPlugin, pickerData: PickerData) {
    super(app, {
      title: 'Create New Task',
      width: '600px',
      className: 'task-sync-create-task'
    });
    this.plugin = plugin;
    this.pickerData = pickerData;
  }

  protected createContent(): void {
    this.setupKeyboardHandlers();
    
    // Create header
    this.createHeader(
      'Create New Task',
      'Fill in the details below to create a new task. Required fields are marked with *'
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
      type: 'text'
    })
    .addValidator(Validators.required)
    .addValidator(Validators.minLength(3))
    .addValidator(Validators.maxLength(200));

    // Task description
    form.addField('description', {
      label: 'Description',
      description: 'Optional detailed description of the task',
      placeholder: 'Enter task description...',
      type: 'textarea'
    })
    .addValidator(Validators.maxLength(1000));

    // Status
    form.addField('status', {
      label: 'Status',
      description: 'Current status of the task',
      type: 'select',
      value: TaskStatus.TODO,
      options: Object.values(TaskStatus)
    });

    // Priority
    form.addField('priority', {
      label: 'Priority',
      description: 'Priority level for this task',
      type: 'select',
      value: TaskPriority.MEDIUM,
      options: Object.values(TaskPriority)
    });

    // Deadline
    form.addField('deadline', {
      label: 'Deadline',
      description: 'Optional deadline for task completion',
      type: 'date'
    })
    .addValidator(Validators.date);

    // Scheduled date
    form.addField('scheduledDate', {
      label: 'Scheduled Date',
      description: 'When you plan to work on this task',
      type: 'date'
    })
    .addValidator(Validators.date);

    // Tags
    form.addField('tags', {
      label: 'Tags',
      description: 'Comma-separated tags for organizing tasks',
      placeholder: 'work, urgent, review...',
      type: 'text'
    });

    // Estimated duration
    form.addField('estimatedDuration', {
      label: 'Estimated Duration (minutes)',
      description: 'How long you expect this task to take',
      placeholder: '60',
      type: 'text'
    })
    .addValidator((value: string) => {
      if (value && (isNaN(Number(value)) || Number(value) < 0)) {
        return 'Please enter a valid number of minutes';
      }
      return null;
    });

    // Create project/area picker section
    this.createProjectAreaSection();

    // Set up form submission
    form.onSubmit(async (data) => {
      await this.handleSubmit(data);
    });
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
  }

  private createFormFooter(): void {
    const footer = this.createFooter();
    
    this.createButton(footer, 'Cancel', () => {
      this.close();
    }, 'secondary');

    this.createButton(footer, 'Create Task', async () => {
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
      this.showLoading('Creating task...');

      // Parse form data into TaskCreateData
      const taskData: TaskCreateData = {
        name: formData.name,
        description: formData.description || undefined,
        status: formData.status as TaskStatus,
        priority: formData.priority as TaskPriority,
        deadline: formData.deadline ? new Date(formData.deadline) : undefined,
        scheduledDate: formData.scheduledDate ? new Date(formData.scheduledDate) : undefined,
        projectId: this.projectAreaPicker.getProjectValue() || undefined,
        areaId: this.projectAreaPicker.getAreaValue() || undefined,
        tags: this.parseTags(formData.tags),
        estimatedDuration: formData.estimatedDuration ? Number(formData.estimatedDuration) : undefined
      };

      // Validate dates
      if (taskData.deadline && taskData.scheduledDate && taskData.deadline < taskData.scheduledDate) {
        this.showError('Deadline cannot be before the scheduled date.');
        return;
      }

      // Call the submit callback if provided
      if (this.onSubmitCallback) {
        await this.onSubmitCallback(taskData);
      } else {
        // Default behavior: create task using plugin services
        await this.createTask(taskData);
      }

      this.showSuccess('Task created successfully!');
      
    } catch (error) {
      console.error('Failed to create task:', error);
      this.showError('Failed to create task. Please try again.');
    }
  }

  private async createTask(taskData: TaskCreateData): Promise<void> {
    // TODO: Implement actual task creation using plugin services
    // For now, just log the task data
    console.log('Creating task:', taskData);
    
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

  public onSubmit(callback: (taskData: TaskCreateData) => Promise<void>): TaskCreateModal {
    this.onSubmitCallback = callback;
    return this;
  }

  public setInitialValues(values: Partial<TaskCreateData>): TaskCreateModal {
    // Set form field values
    if (values.name) this.form?.setFieldValue('name', values.name);
    if (values.description) this.form?.setFieldValue('description', values.description);
    if (values.status) this.form?.setFieldValue('status', values.status);
    if (values.priority) this.form?.setFieldValue('priority', values.priority);
    if (values.deadline) this.form?.setFieldValue('deadline', values.deadline.toISOString().split('T')[0]);
    if (values.scheduledDate) this.form?.setFieldValue('scheduledDate', values.scheduledDate.toISOString().split('T')[0]);
    if (values.tags) this.form?.setFieldValue('tags', values.tags.join(', '));
    if (values.estimatedDuration) this.form?.setFieldValue('estimatedDuration', values.estimatedDuration.toString());

    // Set project/area picker values
    if (this.projectAreaPicker) {
      this.projectAreaPicker.setValues({
        projectId: values.projectId,
        areaId: values.areaId
      });
    }

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
 * Utility function to open a task creation modal
 */
export async function openTaskCreateModal(
  app: App, 
  plugin: TaskSyncPlugin, 
  pickerData: PickerData,
  initialValues?: Partial<TaskCreateData>
): Promise<TaskCreateData | null> {
  return new Promise((resolve) => {
    const modal = new TaskCreateModal(app, plugin, pickerData);
    
    if (initialValues) {
      modal.setInitialValues(initialValues);
    }
    
    modal.onSubmit(async (taskData) => {
      resolve(taskData);
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
