/**
 * Main settings tab component for the Task Sync plugin
 */

import { App, PluginSettingTab, Setting } from 'obsidian';
import TaskSyncPlugin from '../../../main';
import { TaskSyncSettings, ValidationResult, SettingsSection, TaskType, TASK_TYPE_COLORS, TaskTypeColor, TaskPriority, TASK_PRIORITY_COLORS, TaskPriorityColor } from './types';
import { DEFAULT_SETTINGS } from './defaults';
import { validateFolderPath, validateFileName, validateBaseFileName, validateTemplateFileName } from './validation';
import { FolderSuggestComponent, FileSuggestComponent } from './suggest';
import { createTypeBadge } from '../TypeBadge';
import { createPriorityBadge } from '../PriorityBadge';

export class TaskSyncSettingTab extends PluginSettingTab {
  plugin: TaskSyncPlugin;
  private validationErrors: Map<string, string> = new Map();
  private suggestComponents: (FolderSuggestComponent | FileSuggestComponent)[] = [];

  constructor(app: App, plugin: TaskSyncPlugin) {
    super(app, plugin);
    this.plugin = plugin;
    this.loadStyles();
  }

  private loadStyles(): void {
    // Add CSS styles for the settings interface
    const styleId = 'task-sync-settings-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        /* Task Sync Settings Styles */
        .task-sync-settings {
          padding: 20px;
          max-width: 800px;
          margin: 0 auto;
        }

        .task-sync-settings-header {
          margin-bottom: 30px;
          text-align: center;
        }

        .task-sync-settings-header h2 {
          margin-bottom: 10px;
          color: var(--text-normal);
        }

        .task-sync-settings-description {
          color: var(--text-muted);
          font-size: 14px;
          margin: 0;
        }

        .task-sync-settings-sections {
          display: flex;
          flex-direction: column;
          gap: 30px;
        }

        .task-sync-settings-section {
          background: var(--background-secondary);
          border-radius: 8px;
          padding: 20px;
          border: 1px solid var(--background-modifier-border);
        }

        .task-sync-section-header {
          margin: 0 0 15px 0;
          color: var(--text-normal);
          font-size: 18px;
          font-weight: 600;
          border-bottom: 1px solid var(--background-modifier-border);
          padding-bottom: 8px;
        }

        .task-sync-settings-section-desc {
          color: var(--text-muted);
          font-size: 13px;
          margin: 0 0 20px 0;
          line-height: 1.4;
        }

        .task-sync-setting-error {
          border-left: 3px solid var(--text-error);
          padding-left: 15px;
          background: var(--background-modifier-error);
        }

        .task-sync-validation-error {
          color: var(--text-error);
          font-size: 12px;
          margin-top: 5px;
          font-weight: 500;
        }

        .task-sync-settings-actions {
          margin-top: 20px;
          display: flex;
          gap: 10px;
          justify-content: flex-end;
        }

        .task-type-preview {
          margin-right: 10px;
          display: inline-block;
        }

        .suggestion-container {
          background: var(--background-primary);
          border: 1px solid var(--background-modifier-border);
          border-radius: 4px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          z-index: 1000;
        }

        .suggestion-item {
          padding: 8px 12px;
          cursor: pointer;
          color: var(--text-normal);
          border-bottom: 1px solid var(--background-modifier-border-hover);
          transition: background-color 0.1s ease;
        }

        .suggestion-item:last-child {
          border-bottom: none;
        }

        .suggestion-item:hover,
        .suggestion-item.is-selected {
          background: var(--background-modifier-hover);
        }
      `;
      document.head.appendChild(style);
    }
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();
    containerEl.addClass('task-sync-settings');

    // Header
    this.createHeader(containerEl);

    // Create section-based interface
    this.createSectionInterface(containerEl);
  }

  private createHeader(container: HTMLElement): void {
    const header = container.createDiv('task-sync-settings-header');
    header.createEl('h2', { text: 'Task Sync Settings' });
    header.createEl('p', {
      text: 'Configure your task management system. Changes are saved automatically.',
      cls: 'task-sync-settings-description'
    });
  }

  private createSectionInterface(container: HTMLElement): void {
    const sectionsContainer = container.createDiv('task-sync-settings-sections');

    // Create all sections in order
    this.createGeneralSection(sectionsContainer);
    this.createTemplatesSection(sectionsContainer);
    this.createBasesSection(sectionsContainer);
    this.createTaskTypesSection(sectionsContainer);
    this.createTaskPrioritiesSection(sectionsContainer);
  }

  private createGeneralSection(container: HTMLElement): void {
    const section = container.createDiv('task-sync-settings-section');

    // Section header
    section.createEl('h2', { text: 'General', cls: 'task-sync-section-header' });

    this.createFolderSetting(section, 'tasksFolder', 'Tasks Folder',
      'Folder where task files will be stored');

    this.createFolderSetting(section, 'projectsFolder', 'Projects Folder',
      'Folder where project files will be stored');

    this.createFolderSetting(section, 'areasFolder', 'Areas Folder',
      'Folder where area files will be stored');
  }

  private createTemplatesSection(container: HTMLElement): void {
    const section = container.createDiv('task-sync-settings-section');

    // Section header
    section.createEl('h2', { text: 'Templates', cls: 'task-sync-section-header' });

    this.createFolderSetting(section, 'templateFolder', 'Template Folder',
      'Folder where templates are stored');

    new Setting(section)
      .setName('Use Templater Plugin')
      .setDesc('Enable integration with Templater plugin for advanced templates')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.useTemplater)
        .onChange(async (value) => {
          this.plugin.settings.useTemplater = value;
          await this.plugin.saveSettings();
        }));

    // Default template settings with file suggestions
    this.createFileSetting(section, 'defaultTaskTemplate', 'Default Task Template',
      'Default template to use when creating new tasks', ['.md']);

    this.createFileSetting(section, 'defaultProjectTemplate', 'Default Project Template',
      'Default template to use when creating new projects', ['.md']);

    this.createFileSetting(section, 'defaultAreaTemplate', 'Default Area Template',
      'Default template to use when creating new areas', ['.md']);
  }

  private createBasesSection(container: HTMLElement): void {
    const section = container.createDiv('task-sync-settings-section');

    // Section header
    section.createEl('h2', { text: 'Bases Integration', cls: 'task-sync-section-header' });

    this.createFolderSetting(section, 'basesFolder', 'Bases Folder',
      'Folder where .base files are stored');

    this.createFileSetting(section, 'tasksBaseFile', 'Tasks Base File',
      'Name of the main tasks base file', ['.base']);

    new Setting(section)
      .setName('Auto Generate Bases')
      .setDesc('Automatically generate base files when needed')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.autoGenerateBases)
        .onChange(async (value) => {
          this.plugin.settings.autoGenerateBases = value;
          await this.plugin.saveSettings();
        }));

    new Setting(section)
      .setName('Auto Update Base Views')
      .setDesc('Automatically update base views when tasks change')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.autoUpdateBaseViews)
        .onChange(async (value) => {
          this.plugin.settings.autoUpdateBaseViews = value;
          await this.plugin.saveSettings();
        }));

    new Setting(section)
      .setName('Enable Area Bases')
      .setDesc('Create individual base files for each area with filtered views')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.areaBasesEnabled)
        .onChange(async (value) => {
          this.plugin.settings.areaBasesEnabled = value;
          await this.plugin.saveSettings();
        }));

    new Setting(section)
      .setName('Enable Project Bases')
      .setDesc('Create individual base files for each project with filtered views')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.projectBasesEnabled)
        .onChange(async (value) => {
          this.plugin.settings.projectBasesEnabled = value;
          await this.plugin.saveSettings();
        }));

    new Setting(section)
      .setName('Auto-Sync Area/Project Bases')
      .setDesc('Automatically update area and project bases when settings change')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.autoSyncAreaProjectBases)
        .onChange(async (value) => {
          this.plugin.settings.autoSyncAreaProjectBases = value;
          await this.plugin.saveSettings();
        }));

    // Action buttons
    this.createActionButtons(section);
  }

  private createTaskTypesSection(container: HTMLElement): void {
    const section = container.createDiv('task-sync-settings-section');

    // Section header
    section.createEl('h2', { text: 'Task Types', cls: 'task-sync-section-header' });
    section.createEl('p', {
      text: 'Configure the available task types and their colors.',
      cls: 'task-sync-settings-section-desc'
    });

    // Create a setting for each task type
    this.plugin.settings.taskTypes.forEach((taskType, index) => {
      const setting = new Setting(section)
        .setName(taskType.name)
        .setDesc(`Configure the "${taskType.name}" task type`);

      // Add type badge preview
      const badgeContainer = setting.controlEl.createDiv('task-type-preview');
      const badge = createTypeBadge(taskType);
      badgeContainer.appendChild(badge);

      // Add name input
      setting.addText(text => {
        text.setValue(taskType.name)
          .setPlaceholder('Task type name')
          .onChange(async (value) => {
            if (value.trim()) {
              this.plugin.settings.taskTypes[index].name = value.trim();
              await this.plugin.saveSettings();

              // Update the setting name and badge
              setting.setName(value.trim());
              badge.textContent = value.trim();

              // Trigger base sync if enabled
              if (this.plugin.settings.autoSyncAreaProjectBases) {
                await this.plugin.syncAreaProjectBases();
              }
            }
          });
      });

      // Add color dropdown
      setting.addDropdown(dropdown => {
        TASK_TYPE_COLORS.forEach(color => {
          dropdown.addOption(color, color.charAt(0).toUpperCase() + color.slice(1));
        });

        dropdown.setValue(taskType.color)
          .onChange(async (value: TaskTypeColor) => {
            this.plugin.settings.taskTypes[index].color = value;
            await this.plugin.saveSettings();

            // Update badge color
            badge.className = `task-type-badge task-type-${value}`;

            // Trigger base sync if enabled
            if (this.plugin.settings.autoSyncAreaProjectBases) {
              await this.plugin.syncAreaProjectBases();
            }
          });
      });

      // Add delete button (don't allow deleting if it's the last type)
      if (this.plugin.settings.taskTypes.length > 1) {
        setting.addButton(button => {
          button.setButtonText('Delete')
            .setWarning()
            .onClick(async () => {
              this.plugin.settings.taskTypes.splice(index, 1);
              await this.plugin.saveSettings();

              // Refresh only the task types section, not the entire container
              section.empty();
              this.recreateTaskTypesSection(section);

              // Trigger base sync if enabled
              if (this.plugin.settings.autoSyncAreaProjectBases) {
                await this.plugin.syncAreaProjectBases();
              }
            });
        });
      }
    });

    // Add new task type section
    this.createAddTaskTypeSection(section);
  }

  private recreateTaskTypesSection(section: HTMLElement): void {
    // Section header
    section.createEl('h2', { text: 'Task Types', cls: 'task-sync-section-header' });
    section.createEl('p', {
      text: 'Configure the available task types and their colors.',
      cls: 'task-sync-settings-section-desc'
    });

    // Create a setting for each task type
    this.plugin.settings.taskTypes.forEach((taskType, index) => {
      const setting = new Setting(section)
        .setName(taskType.name)
        .setDesc(`Configure the "${taskType.name}" task type`);

      // Add type badge preview
      const badgeContainer = setting.controlEl.createDiv('task-type-preview');
      const badge = createTypeBadge(taskType);
      badgeContainer.appendChild(badge);

      // Add name input
      setting.addText(text => {
        text.setValue(taskType.name)
          .setPlaceholder('Task type name')
          .onChange(async (value) => {
            if (value.trim()) {
              this.plugin.settings.taskTypes[index].name = value.trim();
              await this.plugin.saveSettings();

              // Update the setting name and badge
              setting.setName(value.trim());
              badge.textContent = value.trim();

              // Trigger base sync if enabled
              if (this.plugin.settings.autoSyncAreaProjectBases) {
                await this.plugin.syncAreaProjectBases();
              }
            }
          });
      });

      // Add color dropdown
      setting.addDropdown(dropdown => {
        TASK_TYPE_COLORS.forEach(color => {
          dropdown.addOption(color, color.charAt(0).toUpperCase() + color.slice(1));
        });

        dropdown.setValue(taskType.color)
          .onChange(async (value: TaskTypeColor) => {
            this.plugin.settings.taskTypes[index].color = value;
            await this.plugin.saveSettings();

            // Update badge color
            badge.className = `task-type-badge task-type-${value}`;

            // Trigger base sync if enabled
            if (this.plugin.settings.autoSyncAreaProjectBases) {
              await this.plugin.syncAreaProjectBases();
            }
          });
      });

      // Add delete button (don't allow deleting if it's the last type)
      if (this.plugin.settings.taskTypes.length > 1) {
        setting.addButton(button => {
          button.setButtonText('Delete')
            .setWarning()
            .onClick(async () => {
              this.plugin.settings.taskTypes.splice(index, 1);
              await this.plugin.saveSettings();

              // Refresh only the task types section, not the entire container
              section.empty();
              this.recreateTaskTypesSection(section);

              // Trigger base sync if enabled
              if (this.plugin.settings.autoSyncAreaProjectBases) {
                await this.plugin.syncAreaProjectBases();
              }
            });
        });
      }
    });

    // Add new task type section
    this.createAddTaskTypeSection(section);
  }

  private createAddTaskTypeSection(container: HTMLElement): void {
    let newTypeName = '';
    let newTypeColor: TaskTypeColor = 'blue';

    new Setting(container)
      .setName('Add New Task Type')
      .setDesc('Create a new task type for your workflow')
      .addText(text => {
        text.setPlaceholder('e.g., Epic, Story, Research')
          .onChange((value) => {
            newTypeName = value.trim();
          });
      })
      .addDropdown(dropdown => {
        TASK_TYPE_COLORS.forEach(color => {
          dropdown.addOption(color, color.charAt(0).toUpperCase() + color.slice(1));
        });

        dropdown.setValue(newTypeColor)
          .onChange((value: TaskTypeColor) => {
            newTypeColor = value;
          });
      })
      .addButton(button => {
        button.setButtonText('Add Task Type')
          .setCta()
          .onClick(async () => {
            if (newTypeName && !this.plugin.settings.taskTypes.some(t => t.name === newTypeName)) {
              this.plugin.settings.taskTypes.push({ name: newTypeName, color: newTypeColor });
              await this.plugin.saveSettings();

              // Find the task types section and refresh it
              const taskTypesSection = container.closest('.task-sync-settings-section');
              if (taskTypesSection) {
                taskTypesSection.empty();
                this.recreateTaskTypesSection(taskTypesSection as HTMLElement);
              }

              // Trigger base sync if enabled
              if (this.plugin.settings.autoSyncAreaProjectBases) {
                await this.plugin.syncAreaProjectBases();
              }
            }
          });
      });
  }

  private createTaskPrioritiesSection(container: HTMLElement): void {
    const section = container.createDiv('task-sync-settings-section');

    // Section header
    section.createEl('h2', { text: 'Task Priorities', cls: 'task-sync-section-header' });
    section.createEl('p', {
      text: 'Configure the available task priorities and their colors.',
      cls: 'task-sync-settings-section-desc'
    });

    // Create a setting for each task priority
    this.plugin.settings.taskPriorities.forEach((taskPriority, index) => {
      const setting = new Setting(section)
        .setName(taskPriority.name)
        .setDesc(`Configure the "${taskPriority.name}" task priority`);

      // Add priority badge preview
      const badgeContainer = setting.controlEl.createDiv('task-priority-preview');
      const badge = createPriorityBadge(taskPriority);
      badgeContainer.appendChild(badge);

      // Add name input
      setting.addText(text => {
        text.setValue(taskPriority.name)
          .setPlaceholder('Priority name')
          .onChange(async (value) => {
            if (value.trim()) {
              this.plugin.settings.taskPriorities[index].name = value.trim();
              await this.plugin.saveSettings();

              // Update the setting name and badge
              setting.setName(value.trim());
              badge.textContent = value.trim();

              // Trigger base sync if enabled
              if (this.plugin.settings.autoSyncAreaProjectBases) {
                await this.plugin.syncAreaProjectBases();
              }
            }
          });
      });

      // Add color dropdown
      setting.addDropdown(dropdown => {
        TASK_PRIORITY_COLORS.forEach(color => {
          dropdown.addOption(color, color.charAt(0).toUpperCase() + color.slice(1));
        });

        dropdown.setValue(taskPriority.color)
          .onChange(async (value: TaskPriorityColor) => {
            this.plugin.settings.taskPriorities[index].color = value;
            await this.plugin.saveSettings();

            // Update badge color
            badge.className = `task-priority-badge task-priority-${value}`;

            // Trigger base sync if enabled
            if (this.plugin.settings.autoSyncAreaProjectBases) {
              await this.plugin.syncAreaProjectBases();
            }
          });
      });

      // Add delete button (don't allow deleting if it's the last priority)
      if (this.plugin.settings.taskPriorities.length > 1) {
        setting.addButton(button => {
          button.setButtonText('Delete')
            .setWarning()
            .onClick(async () => {
              this.plugin.settings.taskPriorities.splice(index, 1);
              await this.plugin.saveSettings();

              // Refresh only the task priorities section, not the entire container
              section.empty();
              this.recreateTaskPrioritiesSection(section);

              // Trigger base sync if enabled
              if (this.plugin.settings.autoSyncAreaProjectBases) {
                await this.plugin.syncAreaProjectBases();
              }
            });
        });
      }
    });

    // Add new task priority section
    this.createAddTaskPrioritySection(section);
  }

  private recreateTaskPrioritiesSection(section: HTMLElement): void {
    // Section header
    section.createEl('h2', { text: 'Task Priorities', cls: 'task-sync-section-header' });
    section.createEl('p', {
      text: 'Configure the available task priorities and their colors.',
      cls: 'task-sync-settings-section-desc'
    });

    // Create a setting for each task priority
    this.plugin.settings.taskPriorities.forEach((taskPriority, index) => {
      const setting = new Setting(section)
        .setName(taskPriority.name)
        .setDesc(`Configure the "${taskPriority.name}" task priority`);

      // Add priority badge preview
      const badgeContainer = setting.controlEl.createDiv('task-priority-preview');
      const badge = createPriorityBadge(taskPriority);
      badgeContainer.appendChild(badge);

      // Add name input
      setting.addText(text => {
        text.setValue(taskPriority.name)
          .setPlaceholder('Priority name')
          .onChange(async (value) => {
            if (value.trim()) {
              this.plugin.settings.taskPriorities[index].name = value.trim();
              await this.plugin.saveSettings();

              // Update the setting name and badge
              setting.setName(value.trim());
              badge.textContent = value.trim();

              // Trigger base sync if enabled
              if (this.plugin.settings.autoSyncAreaProjectBases) {
                await this.plugin.syncAreaProjectBases();
              }
            }
          });
      });

      // Add color dropdown
      setting.addDropdown(dropdown => {
        TASK_PRIORITY_COLORS.forEach(color => {
          dropdown.addOption(color, color.charAt(0).toUpperCase() + color.slice(1));
        });

        dropdown.setValue(taskPriority.color)
          .onChange(async (value: TaskPriorityColor) => {
            this.plugin.settings.taskPriorities[index].color = value;
            await this.plugin.saveSettings();

            // Update badge color
            badge.className = `task-priority-badge task-priority-${value}`;

            // Trigger base sync if enabled
            if (this.plugin.settings.autoSyncAreaProjectBases) {
              await this.plugin.syncAreaProjectBases();
            }
          });
      });

      // Add delete button (don't allow deleting if it's the last priority)
      if (this.plugin.settings.taskPriorities.length > 1) {
        setting.addButton(button => {
          button.setButtonText('Delete')
            .setWarning()
            .onClick(async () => {
              this.plugin.settings.taskPriorities.splice(index, 1);
              await this.plugin.saveSettings();

              // Refresh only the task priorities section, not the entire container
              section.empty();
              this.recreateTaskPrioritiesSection(section);

              // Trigger base sync if enabled
              if (this.plugin.settings.autoSyncAreaProjectBases) {
                await this.plugin.syncAreaProjectBases();
              }
            });
        });
      }
    });

    // Add new task priority section
    this.createAddTaskPrioritySection(section);
  }

  private createAddTaskPrioritySection(container: HTMLElement): void {
    let newPriorityName = '';
    let newPriorityColor: TaskPriorityColor = 'blue';

    new Setting(container)
      .setName('Add New Task Priority')
      .setDesc('Create a new task priority for your workflow')
      .addText(text => {
        text.setPlaceholder('e.g., Critical, Normal, Minor')
          .onChange((value) => {
            newPriorityName = value.trim();
          });
      })
      .addDropdown(dropdown => {
        TASK_PRIORITY_COLORS.forEach(color => {
          dropdown.addOption(color, color.charAt(0).toUpperCase() + color.slice(1));
        });

        dropdown.setValue(newPriorityColor)
          .onChange((value: TaskPriorityColor) => {
            newPriorityColor = value;
          });
      })
      .addButton(button => {
        button.setButtonText('Add Priority')
          .setCta()
          .onClick(async () => {
            if (newPriorityName && !this.plugin.settings.taskPriorities.some(p => p.name === newPriorityName)) {
              this.plugin.settings.taskPriorities.push({ name: newPriorityName, color: newPriorityColor });
              await this.plugin.saveSettings();

              // Find the task priorities section and refresh it
              const taskPrioritiesSection = container.closest('.task-sync-settings-section');
              if (taskPrioritiesSection) {
                taskPrioritiesSection.empty();
                this.recreateTaskPrioritiesSection(taskPrioritiesSection as HTMLElement);
              }

              // Trigger base sync if enabled
              if (this.plugin.settings.autoSyncAreaProjectBases) {
                await this.plugin.syncAreaProjectBases();
              }
            }
          });
      });
  }

  private createActionButtons(container: HTMLElement): void {
    const actionsContainer = container.createDiv('task-sync-settings-actions');

    const refreshButton = actionsContainer.createEl('button', {
      text: 'Refresh',
      cls: 'mod-cta'
    });
    refreshButton.addEventListener('click', async () => {
      refreshButton.disabled = true;
      refreshButton.setText('Refreshing...');
      try {
        await this.plugin.refresh();
        refreshButton.setText('✓ Refreshed');
        setTimeout(() => {
          refreshButton.disabled = false;
          refreshButton.setText('Refresh');
        }, 2000);
      } catch (error) {
        refreshButton.setText('✗ Failed');
        console.error('Failed to refresh:', error);
        setTimeout(() => {
          refreshButton.disabled = false;
          refreshButton.setText('Refresh');
        }, 2000);
      }
    });
  }

  private createFolderSetting(container: HTMLElement, key: keyof TaskSyncSettings, name: string, desc: string): void {
    const setting = new Setting(container)
      .setName(name)
      .setDesc(desc)
      .addText(text => {
        const defaultValue = DEFAULT_SETTINGS[key] as string;
        text.setPlaceholder(defaultValue)
          .setValue(this.plugin.settings[key] as string)
          .onChange(async (value) => {
            const validation = validateFolderPath(value);
            if (validation.isValid) {
              this.clearValidationError(key);
              (this.plugin.settings[key] as any) = value;
              await this.plugin.saveSettings();
            } else {
              this.setValidationError(key, validation.error!);
            }
            this.updateSettingValidation(setting, key);
          });

        // Add folder suggestion
        const folderSuggest = new FolderSuggestComponent(this.app, text.inputEl);
        folderSuggest.onChange(async (value) => {
          const validation = validateFolderPath(value);
          if (validation.isValid) {
            this.clearValidationError(key);
            (this.plugin.settings[key] as any) = value;
            await this.plugin.saveSettings();
          } else {
            this.setValidationError(key, validation.error!);
          }
          this.updateSettingValidation(setting, key);
        });
        this.suggestComponents.push(folderSuggest);
      });

    this.updateSettingValidation(setting, key);
  }

  private createFileSetting(container: HTMLElement, key: keyof TaskSyncSettings, name: string, desc: string, extensions?: string[]): void {
    const setting = new Setting(container)
      .setName(name)
      .setDesc(desc)
      .addText(text => {
        const defaultValue = DEFAULT_SETTINGS[key] as string;
        text.setPlaceholder(defaultValue)
          .setValue(this.plugin.settings[key] as string)
          .onChange(async (value) => {
            let validation: ValidationResult;
            if (key === 'tasksBaseFile') {
              validation = validateBaseFileName(value);
            } else if (key.includes('Template')) {
              validation = validateTemplateFileName(value);
            } else {
              validation = validateFileName(value);
            }

            if (validation.isValid) {
              this.clearValidationError(key);
              (this.plugin.settings[key] as any) = value;
              await this.plugin.saveSettings();
            } else {
              this.setValidationError(key, validation.error!);
            }
            this.updateSettingValidation(setting, key);
          });

        // Add file suggestion
        const fileSuggest = new FileSuggestComponent(this.app, text.inputEl, {
          fileExtensions: extensions
        });
        fileSuggest.onChange(async (value) => {
          let validation: ValidationResult;
          if (key === 'tasksBaseFile') {
            validation = validateBaseFileName(value);
          } else if (key.includes('Template')) {
            validation = validateTemplateFileName(value);
          } else {
            validation = validateFileName(value);
          }

          if (validation.isValid) {
            this.clearValidationError(key);
            (this.plugin.settings[key] as any) = value;
            await this.plugin.saveSettings();
          } else {
            this.setValidationError(key, validation.error!);
          }
          this.updateSettingValidation(setting, key);
        });
        this.suggestComponents.push(fileSuggest);
      });

    this.updateSettingValidation(setting, key);
  }

  private setValidationError(key: string, error: string): void {
    this.validationErrors.set(key, error);
  }

  private clearValidationError(key: string): void {
    this.validationErrors.delete(key);
  }

  private updateSettingValidation(setting: Setting, key: string): void {
    const error = this.validationErrors.get(key);
    const settingEl = setting.settingEl;

    // Remove existing error styling
    settingEl.removeClass('task-sync-setting-error');
    const existingError = settingEl.querySelector('.task-sync-validation-error');
    if (existingError) {
      existingError.remove();
    }

    if (error) {
      // Add error styling
      settingEl.addClass('task-sync-setting-error');
      const errorEl = settingEl.createDiv('task-sync-validation-error');
      errorEl.textContent = error;
    }
  }

  hide(): void {
    // Clean up suggest components
    this.suggestComponents.forEach(component => component.destroy());
    this.suggestComponents = [];
  }
}
