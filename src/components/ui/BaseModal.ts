/**
 * Base modal component for the Task Sync plugin
 * Provides a consistent modal interface with common functionality
 */

import { App, Modal } from 'obsidian';
import { Form } from './BaseComponents';

export interface ModalOptions {
  title: string;
  width?: string;
  height?: string;
  className?: string;
}

/**
 * Base modal class that provides common modal functionality
 */
export abstract class BaseModal extends Modal {
  protected options: ModalOptions;
  protected form?: Form;

  constructor(app: App, options: ModalOptions) {
    super(app);
    this.options = options;
    this.setupModal();
  }

  private setupModal(): void {
    // Set modal title
    this.titleEl.setText(this.options.title);

    // Add custom CSS classes
    this.modalEl.addClass('task-sync-modal');
    if (this.options.className) {
      this.modalEl.addClass(this.options.className);
    }

    // Set dimensions if specified
    if (this.options.width) {
      this.modalEl.style.width = this.options.width;
    }
    if (this.options.height) {
      this.modalEl.style.height = this.options.height;
    }


  }

  public onOpen(): void {
    this.contentEl.empty();
    this.createContent();
  }

  public onClose(): void {
    this.cleanup();
  }

  /**
   * Abstract method to be implemented by subclasses
   * This is where the modal content should be created
   */
  protected abstract createContent(): void;

  /**
   * Optional cleanup method for subclasses
   */
  protected cleanup(): void {
    // Override in subclasses if needed
  }

  /**
   * Create a form within the modal
   */
  protected createForm(): Form {
    const formContainer = this.contentEl.createDiv('task-sync-modal-form');
    this.form = new Form(formContainer);
    return this.form;
  }

  /**
   * Add a header section to the modal
   */
  protected createHeader(text: string, description?: string): HTMLElement {
    const header = this.contentEl.createDiv('task-sync-modal-header');
    header.createEl('h3', { text });

    if (description) {
      header.createEl('p', {
        text: description,
        cls: 'task-sync-modal-description'
      });
    }

    return header;
  }

  /**
   * Add a footer section to the modal
   */
  protected createFooter(): HTMLElement {
    const footer = this.contentEl.createDiv('task-sync-modal-footer');
    return footer;
  }

  /**
   * Show loading state
   */
  protected showLoading(message: string = 'Loading...'): void {
    this.contentEl.empty();
    const loadingContainer = this.contentEl.createDiv('task-sync-modal-loading');
    loadingContainer.createEl('div', { cls: 'task-sync-spinner' });
    loadingContainer.createEl('p', { text: message });
  }

  /**
   * Show error state
   */
  protected showError(message: string, retry?: () => void): void {
    this.contentEl.empty();
    const errorContainer = this.contentEl.createDiv('task-sync-modal-error');
    errorContainer.createEl('div', {
      cls: 'task-sync-error-icon',
      text: '⚠️'
    });
    errorContainer.createEl('p', { text: message });

    if (retry) {
      const retryButton = errorContainer.createEl('button', {
        text: 'Retry',
        cls: 'mod-cta'
      });
      retryButton.addEventListener('click', retry);
    }
  }

  /**
   * Show success message
   */
  protected showSuccess(message: string, autoClose: boolean = true): void {
    const successContainer = this.contentEl.createDiv('task-sync-modal-success');
    successContainer.createEl('div', {
      cls: 'task-sync-success-icon',
      text: '✅'
    });
    successContainer.createEl('p', { text: message });

    if (autoClose) {
      setTimeout(() => {
        this.close();
      }, 2000);
    }
  }

  /**
   * Create a tabbed interface within the modal
   */
  protected createTabs(tabs: { id: string; label: string; content: () => void }[]): void {
    const tabContainer = this.contentEl.createDiv('task-sync-modal-tabs');
    const tabHeaders = tabContainer.createDiv('task-sync-tab-headers');
    const tabContent = tabContainer.createDiv('task-sync-tab-content');

    let activeTab = tabs[0]?.id;

    tabs.forEach((tab, index) => {
      const tabHeader = tabHeaders.createEl('button', {
        text: tab.label,
        cls: `task-sync-tab-header ${index === 0 ? 'active' : ''}`
      });

      tabHeader.addEventListener('click', () => {
        // Update active tab
        tabHeaders.querySelectorAll('.task-sync-tab-header').forEach(h => h.removeClass('active'));
        tabHeader.addClass('active');
        activeTab = tab.id;

        // Update content
        tabContent.empty();
        tab.content();
      });
    });

    // Initialize with first tab
    if (tabs.length > 0) {
      tabs[0].content();
    }
  }

  /**
   * Utility method to create a button with consistent styling
   */
  protected createButton(
    container: HTMLElement,
    text: string,
    onClick: () => void,
    variant: 'primary' | 'secondary' | 'danger' = 'primary'
  ): HTMLButtonElement {
    const button = container.createEl('button', { text });

    switch (variant) {
      case 'primary':
        button.addClass('mod-cta');
        break;
      case 'secondary':
        button.addClass('mod-secondary');
        break;
      case 'danger':
        button.addClass('mod-warning');
        break;
    }

    button.addEventListener('click', onClick);
    return button;
  }

  /**
   * Utility method to create a divider
   */
  protected createDivider(): HTMLElement {
    return this.contentEl.createEl('hr', { cls: 'task-sync-divider' });
  }

  /**
   * Utility method to create an info box
   */
  protected createInfoBox(message: string, type: 'info' | 'warning' | 'error' = 'info'): HTMLElement {
    const infoBox = this.contentEl.createDiv(`task-sync-info-box task-sync-info-${type}`);
    infoBox.createEl('p', { text: message });
    return infoBox;
  }

  /**
   * Handle keyboard shortcuts
   */
  protected handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.close();
    } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      // Ctrl/Cmd + Enter to submit form if available
      if (this.form) {
        const submitButton = this.contentEl.querySelector('button.mod-cta') as HTMLButtonElement;
        if (submitButton) {
          submitButton.click();
        }
      }
    }
  }

  /**
   * Set up keyboard event listeners
   */
  protected setupKeyboardHandlers(): void {
    this.modalEl.addEventListener('keydown', this.handleKeydown.bind(this));
  }

  /**
   * Validate form if present
   */
  protected validateForm(): boolean {
    if (!this.form) return true;

    const validation = this.form.validate();
    return validation.isValid;
  }

  /**
   * Get form data if form is present
   */
  protected getFormData(): Record<string, any> | null {
    if (!this.form) return null;
    return this.form.getFormData();
  }

  /**
   * Reset form if present
   */
  protected resetForm(): void {
    if (this.form) {
      this.form.reset();
    }
  }
}
