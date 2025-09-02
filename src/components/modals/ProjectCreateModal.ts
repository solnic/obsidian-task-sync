/**
 * Project creation modal for the Task Sync plugin
 * Provides a form interface for creating new projects with template selection
 */

import { App } from 'obsidian';
import { BaseModal } from '../ui/BaseModal';
import { Form, Validators } from '../ui/BaseComponents';
import { AreaPicker } from '../ui/ProjectAreaPicker';
import { Project, Area, Template } from '../../types/entities';
import TaskSyncPlugin from '../../main';

export interface ProjectCreateData {
  name: string;
  description?: string;
  status: 'active' | 'on-hold' | 'completed' | 'archived';
  areaId?: string;
  tags: string[];
  templateId?: string;
  startDate?: Date;
  endDate?: Date;
  goals?: string[];
}

export class ProjectCreateModal extends BaseModal {
  private plugin: TaskSyncPlugin;
  private areaPicker: AreaPicker;
  private areas: Area[];
  private templates: Template[];
  private onSubmitCallback?: (projectData: ProjectCreateData) => Promise<void>;

  constructor(app: App, plugin: TaskSyncPlugin, areas: Area[], templates: Template[] = []) {
    super(app, {
      title: 'Create New Project',
      width: '650px',
      className: 'task-sync-create-project'
    });
    this.plugin = plugin;
    this.areas = areas;
    this.templates = templates;
  }

  protected createContent(): void {
    this.setupKeyboardHandlers();
    
    // Create header
    this.createHeader(
      'Create New Project',
      'Projects help you organize related tasks and track progress toward larger goals.'
    );

    // Create form
    const form = this.createForm();
    this.setupForm(form);

    // Create footer with buttons
    this.createFormFooter();
  }

  private setupForm(form: Form): void {
    // Project name (required)
    form.addField('name', {
      label: 'Project Name *',
      description: 'A clear, descriptive name for your project',
      placeholder: 'Enter project name...',
      required: true,
      type: 'text'
    })
    .addValidator(Validators.required)
    .addValidator(Validators.minLength(3))
    .addValidator(Validators.maxLength(200));

    // Project description
    form.addField('description', {
      label: 'Description',
      description: 'Detailed description of the project goals and scope',
      placeholder: 'Enter project description...',
      type: 'textarea'
    })
    .addValidator(Validators.maxLength(2000));

    // Status
    form.addField('status', {
      label: 'Status',
      description: 'Current status of the project',
      type: 'select',
      value: 'active',
      options: ['active', 'on-hold', 'completed', 'archived']
    });

    // Template selection
    if (this.templates.length > 0) {
      const templateOptions = ['', ...this.templates.map(t => t.id)];
      const templateLabels = ['No template', ...this.templates.map(t => t.name)];
      
      form.addField('templateId', {
        label: 'Template',
        description: 'Choose a template to pre-populate project structure',
        type: 'select',
        options: templateOptions
      });

      // Update the dropdown to show template names
      const templateField = form.getField('templateId');
      if (templateField) {
        templateField.onChange((templateId) => {
          if (templateId) {
            this.applyTemplate(templateId, form);
          }
        });
      }
    }

    // Start date
    form.addField('startDate', {
      label: 'Start Date',
      description: 'When you plan to start working on this project',
      type: 'date'
    })
    .addValidator(Validators.date);

    // End date
    form.addField('endDate', {
      label: 'End Date',
      description: 'Target completion date for the project',
      type: 'date'
    })
    .addValidator(Validators.date);

    // Goals
    form.addField('goals', {
      label: 'Project Goals',
      description: 'Key objectives and outcomes (one per line)',
      placeholder: 'Enter project goals, one per line...',
      type: 'textarea'
    });

    // Tags
    form.addField('tags', {
      label: 'Tags',
      description: 'Comma-separated tags for organizing projects',
      placeholder: 'work, development, q4...',
      type: 'text'
    });

    // Create area picker section
    this.createAreaSection();

    // Set up form submission
    form.onSubmit(async (data) => {
      await this.handleSubmit(data);
    });
  }

  private createAreaSection(): void {
    const pickerContainer = this.contentEl.createDiv('task-sync-picker-section');
    pickerContainer.createEl('h4', { text: 'Area Assignment' });
    pickerContainer.createEl('p', { 
      text: 'Assign this project to an area for better organization.',
      cls: 'task-sync-section-description'
    });

    this.areaPicker = new AreaPicker(pickerContainer, this.areas, {
      allowEmpty: true,
      showCreateNew: true,
      onCreateNew: () => {
        // TODO: Open area creation modal
        console.log('Create new area');
      }
    });
  }

  private applyTemplate(templateId: string, form: Form): void {
    const template = this.templates.find(t => t.id === templateId);
    if (!template) return;

    // Apply template content to form fields
    // This is a simplified implementation - in a real scenario,
    // you'd parse template variables and apply them appropriately
    
    if (template.content.includes('{{description}}')) {
      const descriptionField = form.getField('description');
      if (descriptionField && !descriptionField.getValue()) {
        descriptionField.setValue(template.content.replace('{{description}}', ''));
      }
    }

    // Apply template metadata if available
    if (template.metadata) {
      if (template.metadata.defaultTags) {
        const tagsField = form.getField('tags');
        if (tagsField && !tagsField.getValue()) {
          tagsField.setValue(template.metadata.defaultTags.join(', '));
        }
      }

      if (template.metadata.defaultGoals) {
        const goalsField = form.getField('goals');
        if (goalsField && !goalsField.getValue()) {
          goalsField.setValue(template.metadata.defaultGoals.join('\n'));
        }
      }
    }
  }

  private createFormFooter(): void {
    const footer = this.createFooter();
    
    this.createButton(footer, 'Cancel', () => {
      this.close();
    }, 'secondary');

    this.createButton(footer, 'Create Project', async () => {
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
      this.showLoading('Creating project...');

      // Parse form data into ProjectCreateData
      const projectData: ProjectCreateData = {
        name: formData.name,
        description: formData.description || undefined,
        status: formData.status as any,
        areaId: this.areaPicker.getValue() || undefined,
        tags: this.parseTags(formData.tags),
        templateId: formData.templateId || undefined,
        startDate: formData.startDate ? new Date(formData.startDate) : undefined,
        endDate: formData.endDate ? new Date(formData.endDate) : undefined,
        goals: this.parseGoals(formData.goals)
      };

      // Validate dates
      if (projectData.startDate && projectData.endDate && projectData.startDate > projectData.endDate) {
        this.showError('Start date cannot be after the end date.');
        return;
      }

      // Call the submit callback if provided
      if (this.onSubmitCallback) {
        await this.onSubmitCallback(projectData);
      } else {
        // Default behavior: create project using plugin services
        await this.createProject(projectData);
      }

      this.showSuccess('Project created successfully!');
      
    } catch (error) {
      console.error('Failed to create project:', error);
      this.showError('Failed to create project. Please try again.');
    }
  }

  private async createProject(projectData: ProjectCreateData): Promise<void> {
    // TODO: Implement actual project creation using plugin services
    // For now, just log the project data
    console.log('Creating project:', projectData);
    
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

  private parseGoals(goalsString: string): string[] {
    if (!goalsString) return [];
    
    return goalsString
      .split('\n')
      .map(goal => goal.trim())
      .filter(goal => goal.length > 0);
  }

  public onSubmit(callback: (projectData: ProjectCreateData) => Promise<void>): ProjectCreateModal {
    this.onSubmitCallback = callback;
    return this;
  }

  public setInitialValues(values: Partial<ProjectCreateData>): ProjectCreateModal {
    // Set form field values
    if (values.name) this.form?.setFieldValue('name', values.name);
    if (values.description) this.form?.setFieldValue('description', values.description);
    if (values.status) this.form?.setFieldValue('status', values.status);
    if (values.startDate) this.form?.setFieldValue('startDate', values.startDate.toISOString().split('T')[0]);
    if (values.endDate) this.form?.setFieldValue('endDate', values.endDate.toISOString().split('T')[0]);
    if (values.tags) this.form?.setFieldValue('tags', values.tags.join(', '));
    if (values.goals) this.form?.setFieldValue('goals', values.goals.join('\n'));
    if (values.templateId) this.form?.setFieldValue('templateId', values.templateId);

    // Set area picker value
    if (this.areaPicker && values.areaId) {
      this.areaPicker.setValue(values.areaId);
    }

    return this;
  }

  public updateAreas(areas: Area[]): void {
    this.areas = areas;
    if (this.areaPicker) {
      this.areaPicker.updateAreas(areas);
    }
  }

  public updateTemplates(templates: Template[]): void {
    this.templates = templates;
    // Would need to recreate the template field - for now just store the new templates
  }

  protected cleanup(): void {
    // Clean up any resources if needed
    super.cleanup();
  }
}

/**
 * Utility function to open a project creation modal
 */
export async function openProjectCreateModal(
  app: App, 
  plugin: TaskSyncPlugin, 
  areas: Area[],
  templates: Template[] = [],
  initialValues?: Partial<ProjectCreateData>
): Promise<ProjectCreateData | null> {
  return new Promise((resolve) => {
    const modal = new ProjectCreateModal(app, plugin, areas, templates);
    
    if (initialValues) {
      modal.setInitialValues(initialValues);
    }
    
    modal.onSubmit(async (projectData) => {
      resolve(projectData);
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
