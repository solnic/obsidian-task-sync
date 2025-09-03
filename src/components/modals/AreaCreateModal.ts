/**
 * Area creation modal for the Task Sync plugin
 * Provides a simple form interface for creating new areas
 */

import { App, Modal, Setting } from 'obsidian';
import TaskSyncPlugin from '../../main';

export interface AreaCreateData {
  name: string;
  description?: string;
}

export class AreaCreateModal extends Modal {
  private plugin: TaskSyncPlugin;
  private onSubmitCallback?: (areaData: AreaCreateData) => Promise<void>;
  private formData: Partial<AreaCreateData> = {};

  constructor(app: App, plugin: TaskSyncPlugin) {
    super(app);
    this.plugin = plugin;
    this.modalEl.addClass('task-sync-create-area');
    this.modalEl.addClass('task-sync-modal');
  }

  onOpen(): void {
    this.titleEl.setText('Create New Area');
    this.createContent();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  onSubmit(callback: (areaData: AreaCreateData) => Promise<void>): void {
    this.onSubmitCallback = callback;
  }

  private createContent(): void {
    const container = this.contentEl.createDiv('task-sync-modal-content');

    // Description
    const description = container.createDiv('task-sync-modal-description');
    description.createEl('p', {
      text: 'Create a new area to organize your projects and tasks. Areas represent ongoing responsibilities or life domains.'
    });

    // Form fields
    this.createFormFields(container);

    // Action buttons
    this.createActionButtons(container);
  }

  private createFormFields(container: HTMLElement): void {
    // Area name (required)
    new Setting(container)
      .setName('Area Name')
      .setDesc('Enter a descriptive name for the area')
      .addText(text => {
        text.setPlaceholder('e.g., Health, Finance, Learning')
          .setValue(this.formData.name || '')
          .onChange(value => {
            this.formData.name = value;
          });
        text.inputEl.addClass('task-sync-required-field');
        
        // Focus on the input
        setTimeout(() => text.inputEl.focus(), 100);
      });

    // Description (optional)
    new Setting(container)
      .setName('Description')
      .setDesc('Optional description for the area')
      .addTextArea(text => {
        text.setPlaceholder('Brief description of this area...')
          .setValue(this.formData.description || '')
          .onChange(value => {
            this.formData.description = value;
          });
        text.inputEl.rows = 3;
      });
  }

  private createActionButtons(container: HTMLElement): void {
    const buttonContainer = container.createDiv('task-sync-modal-buttons');

    // Cancel button
    const cancelButton = buttonContainer.createEl('button', {
      text: 'Cancel',
      cls: 'mod-cancel'
    });
    cancelButton.addEventListener('click', () => {
      this.close();
    });

    // Create button
    const createButton = buttonContainer.createEl('button', {
      text: 'Create Area',
      cls: 'mod-cta'
    });
    createButton.addEventListener('click', async () => {
      await this.handleSubmit();
    });

    // Handle Enter key
    this.modalEl.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        this.handleSubmit();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        this.close();
      }
    });
  }

  private async handleSubmit(): Promise<void> {
    // Validate required fields
    if (!this.formData.name?.trim()) {
      this.showError('Area name is required');
      return;
    }

    // Prepare area data
    const areaData: AreaCreateData = {
      name: this.formData.name.trim(),
      description: this.formData.description?.trim() || undefined
    };

    try {
      if (this.onSubmitCallback) {
        await this.onSubmitCallback(areaData);
      }
      this.close();
    } catch (error) {
      console.error('Failed to create area:', error);
      this.showError('Failed to create area. Please try again.');
    }
  }

  private showError(message: string): void {
    // Remove existing error messages
    this.contentEl.querySelectorAll('.task-sync-error').forEach(el => el.remove());

    // Add new error message
    const errorEl = this.contentEl.createDiv('task-sync-error');
    errorEl.setText(message);
    errorEl.style.color = 'var(--text-error)';
    errorEl.style.marginTop = '10px';
    errorEl.style.textAlign = 'center';

    // Auto-remove after 5 seconds
    setTimeout(() => {
      errorEl.remove();
    }, 5000);
  }
}
