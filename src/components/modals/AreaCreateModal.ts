/**
 * Area creation modal for the Task Sync plugin
 * Provides a form interface for creating new areas with template integration
 */

import { App } from 'obsidian';
import { BaseModal } from '../ui/BaseModal';
import { Form, Validators } from '../ui/BaseComponents';
import { Area, Template } from '../../types/entities';
import TaskSyncPlugin from '../../main';

export interface AreaCreateData {
  name: string;
  description?: string;
  tags: string[];
  templateId?: string;
  color?: string;
  icon?: string;
  isArchived?: boolean;
  goals?: string[];
  reviewFrequency?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
}

export class AreaCreateModal extends BaseModal {
  private plugin: TaskSyncPlugin;
  private templates: Template[];
  private onSubmitCallback?: (areaData: AreaCreateData) => Promise<void>;

  constructor(app: App, plugin: TaskSyncPlugin, templates: Template[] = []) {
    super(app, {
      title: 'Create New Area',
      width: '600px',
      className: 'task-sync-create-area'
    });
    this.plugin = plugin;
    this.templates = templates;
  }

  protected createContent(): void {
    this.setupKeyboardHandlers();
    
    // Create header
    this.createHeader(
      'Create New Area',
      'Areas represent the different spheres of your life and work. They help organize projects and tasks by context.'
    );

    // Create form
    const form = this.createForm();
    this.setupForm(form);

    // Create footer with buttons
    this.createFormFooter();
  }

  private setupForm(form: Form): void {
    // Area name (required)
    form.addField('name', {
      label: 'Area Name *',
      description: 'A clear name for this area of responsibility',
      placeholder: 'e.g., Work, Personal, Health, Finance...',
      required: true,
      type: 'text'
    })
    .addValidator(Validators.required)
    .addValidator(Validators.minLength(2))
    .addValidator(Validators.maxLength(100));

    // Area description
    form.addField('description', {
      label: 'Description',
      description: 'Detailed description of this area and its scope',
      placeholder: 'Enter area description...',
      type: 'textarea'
    })
    .addValidator(Validators.maxLength(1000));

    // Template selection
    if (this.templates.length > 0) {
      const areaTemplates = this.templates.filter(t => t.type === 'area');
      if (areaTemplates.length > 0) {
        const templateOptions = ['', ...areaTemplates.map(t => t.id)];
        
        form.addField('templateId', {
          label: 'Template',
          description: 'Choose a template to pre-populate area structure',
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
    }

    // Icon
    form.addField('icon', {
      label: 'Icon',
      description: 'Optional emoji or icon to represent this area',
      placeholder: '🏢 💼 🏠 💪 📚...',
      type: 'text'
    })
    .addValidator(Validators.maxLength(10));

    // Color
    form.addField('color', {
      label: 'Color',
      description: 'Optional color for visual organization',
      type: 'select',
      options: [
        '',
        'blue',
        'green', 
        'red',
        'yellow',
        'purple',
        'orange',
        'pink',
        'gray'
      ]
    });

    // Review frequency
    form.addField('reviewFrequency', {
      label: 'Review Frequency',
      description: 'How often you want to review this area',
      type: 'select',
      value: 'weekly',
      options: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly']
    });

    // Goals
    form.addField('goals', {
      label: 'Area Goals',
      description: 'Key objectives and outcomes for this area (one per line)',
      placeholder: 'Enter area goals, one per line...',
      type: 'textarea'
    });

    // Tags
    form.addField('tags', {
      label: 'Tags',
      description: 'Comma-separated tags for organizing areas',
      placeholder: 'professional, personal, health...',
      type: 'text'
    });

    // Archive status
    form.addField('isArchived', {
      label: 'Archived',
      description: 'Mark this area as archived (hidden from active views)',
      type: 'toggle',
      value: false
    });

    // Set up form submission
    form.onSubmit(async (data) => {
      await this.handleSubmit(data);
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

      if (template.metadata.defaultIcon) {
        const iconField = form.getField('icon');
        if (iconField && !iconField.getValue()) {
          iconField.setValue(template.metadata.defaultIcon);
        }
      }

      if (template.metadata.defaultColor) {
        const colorField = form.getField('color');
        if (colorField && !colorField.getValue()) {
          colorField.setValue(template.metadata.defaultColor);
        }
      }

      if (template.metadata.defaultReviewFrequency) {
        const reviewField = form.getField('reviewFrequency');
        if (reviewField) {
          reviewField.setValue(template.metadata.defaultReviewFrequency);
        }
      }
    }
  }

  private createFormFooter(): void {
    const footer = this.createFooter();
    
    this.createButton(footer, 'Cancel', () => {
      this.close();
    }, 'secondary');

    this.createButton(footer, 'Create Area', async () => {
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
      this.showLoading('Creating area...');

      // Parse form data into AreaCreateData
      const areaData: AreaCreateData = {
        name: formData.name,
        description: formData.description || undefined,
        tags: this.parseTags(formData.tags),
        templateId: formData.templateId || undefined,
        color: formData.color || undefined,
        icon: formData.icon || undefined,
        isArchived: formData.isArchived || false,
        goals: this.parseGoals(formData.goals),
        reviewFrequency: formData.reviewFrequency as any
      };

      // Call the submit callback if provided
      if (this.onSubmitCallback) {
        await this.onSubmitCallback(areaData);
      } else {
        // Default behavior: create area using plugin services
        await this.createArea(areaData);
      }

      this.showSuccess('Area created successfully!');
      
    } catch (error) {
      console.error('Failed to create area:', error);
      this.showError('Failed to create area. Please try again.');
    }
  }

  private async createArea(areaData: AreaCreateData): Promise<void> {
    // TODO: Implement actual area creation using plugin services
    // For now, just log the area data
    console.log('Creating area:', areaData);
    
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

  public onSubmit(callback: (areaData: AreaCreateData) => Promise<void>): AreaCreateModal {
    this.onSubmitCallback = callback;
    return this;
  }

  public setInitialValues(values: Partial<AreaCreateData>): AreaCreateModal {
    // Set form field values
    if (values.name) this.form?.setFieldValue('name', values.name);
    if (values.description) this.form?.setFieldValue('description', values.description);
    if (values.tags) this.form?.setFieldValue('tags', values.tags.join(', '));
    if (values.templateId) this.form?.setFieldValue('templateId', values.templateId);
    if (values.color) this.form?.setFieldValue('color', values.color);
    if (values.icon) this.form?.setFieldValue('icon', values.icon);
    if (values.isArchived !== undefined) this.form?.setFieldValue('isArchived', values.isArchived);
    if (values.goals) this.form?.setFieldValue('goals', values.goals.join('\n'));
    if (values.reviewFrequency) this.form?.setFieldValue('reviewFrequency', values.reviewFrequency);

    return this;
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
 * Utility function to open an area creation modal
 */
export async function openAreaCreateModal(
  app: App, 
  plugin: TaskSyncPlugin, 
  templates: Template[] = [],
  initialValues?: Partial<AreaCreateData>
): Promise<AreaCreateData | null> {
  return new Promise((resolve) => {
    const modal = new AreaCreateModal(app, plugin, templates);
    
    if (initialValues) {
      modal.setInitialValues(initialValues);
    }
    
    modal.onSubmit(async (areaData) => {
      resolve(areaData);
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
