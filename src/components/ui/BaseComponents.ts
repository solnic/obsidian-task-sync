/**
 * Base UI components for the Task Sync plugin
 * Provides reusable components with consistent styling and behavior
 */

import { Setting } from 'obsidian';

export interface FormFieldOptions {
  label: string;
  description?: string;
  placeholder?: string;
  required?: boolean;
  value?: any;
  options?: string[];
  type?: 'text' | 'textarea' | 'select' | 'date' | 'toggle';
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Base form field component
 */
export class FormField {
  private containerEl: HTMLElement;
  private setting: Setting;
  private options: FormFieldOptions;
  private value: any;
  private onChangeCallback?: (value: any) => void;
  private validators: ((value: any) => string | null)[] = [];

  constructor(containerEl: HTMLElement, options: FormFieldOptions) {
    this.containerEl = containerEl;
    this.options = options;
    this.value = options.value || '';
    this.createField();
  }

  private createField(): void {
    this.setting = new Setting(this.containerEl)
      .setName(this.options.label);

    if (this.options.description) {
      this.setting.setDesc(this.options.description);
    }

    switch (this.options.type) {
      case 'textarea':
        this.createTextArea();
        break;
      case 'select':
        this.createSelect();
        break;
      case 'date':
        this.createDateInput();
        break;
      case 'toggle':
        this.createToggle();
        break;
      default:
        this.createTextInput();
    }
  }

  private createTextInput(): void {
    this.setting.addText(text => {
      text.setPlaceholder(this.options.placeholder || '')
        .setValue(this.value)
        .onChange((value) => {
          this.value = value;
          this.onChangeCallback?.(value);
        });
    });
  }

  private createTextArea(): void {
    this.setting.addTextArea(textarea => {
      textarea.setPlaceholder(this.options.placeholder || '')
        .setValue(this.value)
        .onChange((value) => {
          this.value = value;
          this.onChangeCallback?.(value);
        });
    });
  }

  private createSelect(): void {
    this.setting.addDropdown(dropdown => {
      if (this.options.options) {
        this.options.options.forEach(option => {
          dropdown.addOption(option, option);
        });
      }
      dropdown.setValue(this.value)
        .onChange((value) => {
          this.value = value;
          this.onChangeCallback?.(value);
        });
    });
  }

  private createDateInput(): void {
    this.setting.addText(text => {
      text.setPlaceholder('YYYY-MM-DD')
        .setValue(this.value)
        .onChange((value) => {
          this.value = value;
          this.onChangeCallback?.(value);
        });

      // Add date input type
      text.inputEl.type = 'date';
    });
  }

  private createToggle(): void {
    this.setting.addToggle(toggle => {
      toggle.setValue(this.value || false)
        .onChange((value) => {
          this.value = value;
          this.onChangeCallback?.(value);
        });
    });
  }

  public onChange(callback: (value: any) => void): FormField {
    this.onChangeCallback = callback;
    return this;
  }

  public addValidator(validator: (value: any) => string | null): FormField {
    this.validators.push(validator);
    return this;
  }

  public validate(): ValidationResult {
    const errors: string[] = [];

    // Required field validation
    if (this.options.required && (!this.value || this.value.toString().trim() === '')) {
      errors.push(`${this.options.label} is required`);
    }

    // Custom validators
    for (const validator of this.validators) {
      const error = validator(this.value);
      if (error) {
        errors.push(error);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  public getValue(): any {
    return this.value;
  }

  public setValue(value: any): void {
    this.value = value;
    // Update the UI element
    this.setting.components.forEach(component => {
      if ('setValue' in component) {
        (component as any).setValue(value);
      }
    });
  }

  public setError(error: string): void {
    this.setting.setDesc(`${this.options.description || ''} ${error ? `⚠️ ${error}` : ''}`);
  }

  public clearError(): void {
    this.setting.setDesc(this.options.description || '');
  }
}

/**
 * Form container component
 */
export class Form {
  private containerEl: HTMLElement;
  private fields: Map<string, FormField> = new Map();
  private submitCallback?: (data: Record<string, any>) => void;

  constructor(containerEl: HTMLElement) {
    this.containerEl = containerEl;
    this.containerEl.addClass('task-sync-form');
  }

  public addField(name: string, options: FormFieldOptions): FormField {
    const fieldContainer = this.containerEl.createDiv('task-sync-form-group');
    const field = new FormField(fieldContainer, options);
    this.fields.set(name, field);
    return field;
  }

  public addSubmitButton(text: string = 'Submit'): HTMLButtonElement {
    const buttonContainer = this.containerEl.createDiv('task-sync-form-actions');
    const button = buttonContainer.createEl('button', {
      text,
      cls: 'mod-cta'
    });

    button.addEventListener('click', () => {
      this.handleSubmit();
    });

    return button;
  }

  public addCancelButton(text: string = 'Cancel', callback?: () => void): HTMLButtonElement {
    const buttonContainer = this.containerEl.querySelector('.task-sync-form-actions') ||
      this.containerEl.createDiv('task-sync-form-actions');
    const button = buttonContainer.createEl('button', {
      text,
      cls: 'mod-secondary'
    });

    button.addEventListener('click', () => {
      callback?.();
    });

    return button;
  }

  public onSubmit(callback: (data: Record<string, any>) => void): Form {
    this.submitCallback = callback;
    return this;
  }

  private handleSubmit(): void {
    const validation = this.validate();

    if (!validation.isValid) {
      this.showErrors(validation.errors);
      return;
    }

    const data: Record<string, any> = {};
    this.fields.forEach((field, name) => {
      data[name] = field.getValue();
    });

    this.submitCallback?.(data);
  }

  public validate(): ValidationResult {
    const allErrors: string[] = [];
    let isValid = true;

    this.fields.forEach((field, name) => {
      const result = field.validate();
      if (!result.isValid) {
        isValid = false;
        allErrors.push(...result.errors);
        field.setError(result.errors[0]);
      } else {
        field.clearError();
      }
    });

    return {
      isValid,
      errors: allErrors
    };
  }

  private showErrors(errors: string[]): void {
    // Remove existing error display
    const existingError = this.containerEl.querySelector('.task-sync-form-errors');
    if (existingError) {
      existingError.remove();
    }

    if (errors.length > 0) {
      const errorContainer = this.containerEl.createDiv('task-sync-form-errors');
      errors.forEach(error => {
        errorContainer.createDiv('task-sync-form-error').setText(error);
      });
    }
  }

  public getField(name: string): FormField | undefined {
    return this.fields.get(name);
  }

  public setFieldValue(name: string, value: any): void {
    const field = this.fields.get(name);
    if (field) {
      field.setValue(value);
    }
  }

  public getFormData(): Record<string, any> {
    const data: Record<string, any> = {};
    this.fields.forEach((field, name) => {
      data[name] = field.getValue();
    });
    return data;
  }

  public reset(): void {
    this.fields.forEach(field => {
      field.setValue('');
      field.clearError();
    });

    const errorContainer = this.containerEl.querySelector('.task-sync-form-errors');
    if (errorContainer) {
      errorContainer.remove();
    }
  }
}

/**
 * Common validators
 */
export const Validators = {
  required: (value: any): string | null => {
    if (!value || value.toString().trim() === '') {
      return 'This field is required';
    }
    return null;
  },

  minLength: (min: number) => (value: string): string | null => {
    if (value && value.length < min) {
      return `Must be at least ${min} characters`;
    }
    return null;
  },

  maxLength: (max: number) => (value: string): string | null => {
    if (value && value.length > max) {
      return `Must be no more than ${max} characters`;
    }
    return null;
  },

  date: (value: string): string | null => {
    if (value && !Date.parse(value)) {
      return 'Please enter a valid date';
    }
    return null;
  },

  folderPath: (value: string): string | null => {
    if (value && (value.includes('..') || value.startsWith('/'))) {
      return 'Invalid folder path';
    }
    return null;
  }
};
