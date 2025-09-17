/**
 * Main settings tab component for the Task Sync plugin
 */

import { App, PluginSettingTab, Setting } from "obsidian";
import TaskSyncPlugin from "../../../main";
import {
  TaskSyncSettings,
  ValidationResult,
  TASK_TYPE_COLORS,
  TaskTypeColor,
  TASK_PRIORITY_COLORS,
  TaskPriorityColor,
  TASK_STATUS_COLORS,
  TaskStatusColor,
  FileSuggestOptions,
  GitHubOrgRepoMapping,
} from "./types";
import { DEFAULT_SETTINGS } from "./defaults";
import {
  validateFolderPath,
  validateFileName,
  validateBaseFileName,
  validateTemplateFileName,
  validateGitHubToken,
} from "./validation";
import { FolderSuggestComponent, FileSuggestComponent } from "./suggest";
import { createTypeBadge } from "../TypeBadge";
import { createPriorityBadge } from "../PriorityBadge";
import { createStatusBadge } from "../StatusBadge";
import { SortablePropertyList } from "./SortablePropertyList";
import { SortableGitHubMappingList } from "./SortableGitHubMappingList";

export class TaskSyncSettingTab extends PluginSettingTab {
  plugin: TaskSyncPlugin;
  private validationErrors: Map<string, string> = new Map();
  private suggestComponents: (FolderSuggestComponent | FileSuggestComponent)[] =
    [];

  constructor(app: App, plugin: TaskSyncPlugin) {
    super(app, plugin);
    this.plugin = plugin;
    this.loadStyles();
  }

  private loadStyles(): void {
    // Add CSS styles for the settings interface
    const styleId = "task-sync-settings-styles";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
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
    containerEl.addClass("task-sync-settings");

    // Header
    this.createHeader(containerEl);

    // Create section-based interface
    this.createSectionInterface(containerEl);
  }

  private createHeader(container: HTMLElement): void {
    const header = container.createDiv("task-sync-settings-header");
    header.createEl("h2", { text: "Task Sync Settings" });
    header.createEl("p", {
      text: "Configure your task management system. Changes are saved automatically.",
      cls: "task-sync-settings-description",
    });
  }

  private createSectionInterface(container: HTMLElement): void {
    const sectionsContainer = container.createDiv(
      "task-sync-settings-sections"
    );

    // Create all sections in order
    this.createGeneralSection(sectionsContainer);
    this.createTemplatesSection(sectionsContainer);
    this.createBasesSection(sectionsContainer);
    this.createTaskPropertyOrderSection(sectionsContainer);
    this.createTaskCategoriesSection(sectionsContainer);
    this.createTaskPrioritiesSection(sectionsContainer);
    this.createTaskStatusesSection(sectionsContainer);
    this.createIntegrationsSection(sectionsContainer);
  }

  private createGeneralSection(container: HTMLElement): void {
    const section = container.createDiv("task-sync-settings-section");

    // Section header
    section.createEl("h2", {
      text: "General",
      cls: "task-sync-section-header",
    });

    this.createFolderSetting(
      section,
      "tasksFolder",
      "Tasks Folder",
      "Folder where task files will be stored"
    );

    this.createFolderSetting(
      section,
      "projectsFolder",
      "Projects Folder",
      "Folder where project files will be stored"
    );

    this.createFolderSetting(
      section,
      "areasFolder",
      "Areas Folder",
      "Folder where area files will be stored"
    );
  }

  private createTemplatesSection(container: HTMLElement): void {
    const section = container.createDiv("task-sync-settings-section");

    // Section header
    section.createEl("h2", {
      text: "Templates",
      cls: "task-sync-section-header",
    });

    this.createFolderSetting(
      section,
      "templateFolder",
      "Template Folder",
      "Folder where templates are stored"
    );

    new Setting(section)
      .setName("Use Templater Plugin")
      .setDesc(
        "Enable integration with Templater plugin for advanced templates"
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.useTemplater)
          .onChange(async (value) => {
            this.plugin.settings.useTemplater = value;
            await this.plugin.saveSettings();
          })
      );

    // Default template settings with file suggestions
    this.createFileSetting(
      section,
      "defaultTaskTemplate",
      "Default Task Template",
      "Default template to use when creating new tasks",
      [".md"]
    );

    this.createFileSetting(
      section,
      "defaultProjectTemplate",
      "Default Project Template",
      "Default template to use when creating new projects",
      [".md"]
    );

    this.createFileSetting(
      section,
      "defaultAreaTemplate",
      "Default Area Template",
      "Default template to use when creating new areas",
      [".md"]
    );

    this.createFileSetting(
      section,
      "defaultParentTaskTemplate",
      "Default Parent Task Template",
      "Default template to use when creating new parent tasks",
      [".md"]
    );

    // Template creation button
    this.createTemplateCreationButton(section);
  }

  private createBasesSection(container: HTMLElement): void {
    const section = container.createDiv("task-sync-settings-section");

    // Section header
    section.createEl("h2", {
      text: "Bases Integration",
      cls: "task-sync-section-header",
    });

    this.createFolderSetting(
      section,
      "basesFolder",
      "Bases Folder",
      "Folder where .base files are stored"
    );

    this.createFileSetting(
      section,
      "tasksBaseFile",
      "Tasks Base File",
      "Name of the main tasks base file",
      [".base"]
    );

    new Setting(section)
      .setName("Auto Generate Bases")
      .setDesc("Automatically generate base files when needed")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autoGenerateBases)
          .onChange(async (value) => {
            this.plugin.settings.autoGenerateBases = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(section)
      .setName("Auto Update Base Views")
      .setDesc("Automatically update base views when tasks change")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autoUpdateBaseViews)
          .onChange(async (value) => {
            this.plugin.settings.autoUpdateBaseViews = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(section)
      .setName("Enable Area Bases")
      .setDesc("Create individual base files for each area with filtered views")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.areaBasesEnabled)
          .onChange(async (value) => {
            this.plugin.settings.areaBasesEnabled = value;
            await this.plugin.saveSettings();

            // Trigger base sync if enabled
            if (this.plugin.settings.autoSyncAreaProjectBases) {
              await this.plugin.syncAreaProjectBases();
            }
          })
      );

    new Setting(section)
      .setName("Enable Project Bases")
      .setDesc(
        "Create individual base files for each project with filtered views"
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.projectBasesEnabled)
          .onChange(async (value) => {
            this.plugin.settings.projectBasesEnabled = value;
            await this.plugin.saveSettings();

            // Trigger base sync if enabled
            if (this.plugin.settings.autoSyncAreaProjectBases) {
              await this.plugin.syncAreaProjectBases();
            }
          })
      );

    new Setting(section)
      .setName("Auto-Sync Area/Project Bases")
      .setDesc(
        "Automatically update area and project bases when settings change"
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autoSyncAreaProjectBases)
          .onChange(async (value) => {
            this.plugin.settings.autoSyncAreaProjectBases = value;
            await this.plugin.saveSettings();
          })
      );

    // Action buttons
    this.createActionButtons(section);
  }

  private createTaskPropertyOrderSection(container: HTMLElement): void {
    const section = container.createDiv("task-sync-settings-section");

    // Section header
    section.createEl("h2", {
      text: "Task Property Order",
      cls: "task-sync-section-header",
    });
    section.createEl("p", {
      text: "Drag and drop to reorder how properties appear in task front-matter.",
      cls: "task-sync-settings-section-desc",
    });

    // Create sortable property list
    const propertyOrder =
      this.plugin.settings.taskPropertyOrder ||
      DEFAULT_SETTINGS.taskPropertyOrder;

    new SortablePropertyList({
      container: section,
      properties: propertyOrder,
      onReorder: async (newOrder: string[]) => {
        this.plugin.settings.taskPropertyOrder = newOrder;
        await this.plugin.saveSettings();

        // Trigger refresh to update existing files with new property order
        await this.plugin.refresh();
      },
      onReset: async () => {
        this.plugin.settings.taskPropertyOrder = [
          ...DEFAULT_SETTINGS.taskPropertyOrder,
        ];
        await this.plugin.saveSettings();

        // Refresh the section
        section.empty();
        this.createTaskPropertyOrderSection(section.parentElement!);

        // Trigger refresh to update existing files with new property order
        await this.plugin.refresh();
      },
    });
  }

  private createTaskCategoriesSection(container: HTMLElement): void {
    const section = container.createDiv("task-sync-settings-section");

    // Section header
    section.createEl("h2", {
      text: "Task Categories",
      cls: "task-sync-section-header",
    });
    section.createEl("p", {
      text: "Configure the available task categories and their colors.",
      cls: "task-sync-settings-section-desc",
    });

    // Create a setting for each task type
    this.plugin.settings.taskTypes.forEach((taskType, index) => {
      const setting = new Setting(section)
        .setName(taskType.name)
        .setDesc(`Configure the "${taskType.name}" task category`);

      // Add type badge preview
      const badgeContainer = setting.controlEl.createDiv("task-type-preview");
      const badge = createTypeBadge(taskType);
      badgeContainer.appendChild(badge);

      // Add name input
      setting.addText((text) => {
        text
          .setValue(taskType.name)
          .setPlaceholder("Task category name")
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
      setting.addDropdown((dropdown) => {
        TASK_TYPE_COLORS.forEach((color) => {
          dropdown.addOption(
            color,
            color.charAt(0).toUpperCase() + color.slice(1)
          );
        });

        dropdown
          .setValue(taskType.color)
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
        setting.addButton((button) => {
          button
            .setButtonText("Delete")
            .setWarning()
            .onClick(async () => {
              this.plugin.settings.taskTypes.splice(index, 1);
              await this.plugin.saveSettings();

              // Refresh only the task categories section, not the entire container
              section.empty();
              this.recreateTaskCategoriesSection(section);

              // Trigger base sync if enabled
              if (this.plugin.settings.autoSyncAreaProjectBases) {
                await this.plugin.syncAreaProjectBases();
              }
            });
        });
      }
    });

    // Add new task category section
    this.createAddTaskCategorySection(section);
  }

  private recreateTaskCategoriesSection(section: HTMLElement): void {
    // Section header
    section.createEl("h2", {
      text: "Task Categories",
      cls: "task-sync-section-header",
    });
    section.createEl("p", {
      text: "Configure the available task categories and their colors.",
      cls: "task-sync-settings-section-desc",
    });

    // Create a setting for each task category
    this.plugin.settings.taskTypes.forEach((taskType, index) => {
      const setting = new Setting(section)
        .setName(taskType.name)
        .setDesc(`Configure the "${taskType.name}" task category`);

      // Add type badge preview
      const badgeContainer = setting.controlEl.createDiv("task-type-preview");
      const badge = createTypeBadge(taskType);
      badgeContainer.appendChild(badge);

      // Add name input
      setting.addText((text) => {
        text
          .setValue(taskType.name)
          .setPlaceholder("Task category name")
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
      setting.addDropdown((dropdown) => {
        TASK_TYPE_COLORS.forEach((color) => {
          dropdown.addOption(
            color,
            color.charAt(0).toUpperCase() + color.slice(1)
          );
        });

        dropdown
          .setValue(taskType.color)
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
        setting.addButton((button) => {
          button
            .setButtonText("Delete")
            .setWarning()
            .onClick(async () => {
              this.plugin.settings.taskTypes.splice(index, 1);
              await this.plugin.saveSettings();

              // Refresh only the task categories section, not the entire container
              section.empty();
              this.recreateTaskCategoriesSection(section);

              // Trigger base sync if enabled
              if (this.plugin.settings.autoSyncAreaProjectBases) {
                await this.plugin.syncAreaProjectBases();
              }
            });
        });
      }
    });

    // Add new task category section
    this.createAddTaskCategorySection(section);
  }

  private createAddTaskCategorySection(container: HTMLElement): void {
    let newTypeName = "";
    let newTypeColor: TaskTypeColor = "blue";

    new Setting(container)
      .setName("Add New Task Category")
      .setDesc("Create a new task category for your workflow")
      .addText((text) => {
        text.setPlaceholder("e.g., Epic, Story, Research").onChange((value) => {
          newTypeName = value.trim();
        });
      })
      .addDropdown((dropdown) => {
        TASK_TYPE_COLORS.forEach((color) => {
          dropdown.addOption(
            color,
            color.charAt(0).toUpperCase() + color.slice(1)
          );
        });

        dropdown.setValue(newTypeColor).onChange((value: TaskTypeColor) => {
          newTypeColor = value;
        });
      })
      .addButton((button) => {
        button
          .setButtonText("Add Task Category")
          .setCta()
          .onClick(async () => {
            if (
              newTypeName &&
              !this.plugin.settings.taskTypes.some(
                (t) => t.name === newTypeName
              )
            ) {
              this.plugin.settings.taskTypes.push({
                name: newTypeName,
                color: newTypeColor,
              });
              await this.plugin.saveSettings();

              // Find the task categories section and refresh it
              const taskCategoriesSection = container.closest(
                ".task-sync-settings-section"
              );
              if (taskCategoriesSection) {
                taskCategoriesSection.empty();
                this.recreateTaskCategoriesSection(
                  taskCategoriesSection as HTMLElement
                );
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
    const section = container.createDiv("task-sync-settings-section");

    // Section header
    section.createEl("h2", {
      text: "Task Priorities",
      cls: "task-sync-section-header",
    });
    section.createEl("p", {
      text: "Configure the available task priorities and their colors.",
      cls: "task-sync-settings-section-desc",
    });

    // Create a setting for each task priority
    this.plugin.settings.taskPriorities.forEach((taskPriority, index) => {
      const setting = new Setting(section)
        .setName(taskPriority.name)
        .setDesc(`Configure the "${taskPriority.name}" task priority`);

      // Add priority badge preview
      const badgeContainer = setting.controlEl.createDiv(
        "task-priority-preview"
      );
      const badge = createPriorityBadge(taskPriority);
      badgeContainer.appendChild(badge);

      // Add name input
      setting.addText((text) => {
        text
          .setValue(taskPriority.name)
          .setPlaceholder("Priority name")
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
      setting.addDropdown((dropdown) => {
        TASK_PRIORITY_COLORS.forEach((color) => {
          dropdown.addOption(
            color,
            color.charAt(0).toUpperCase() + color.slice(1)
          );
        });

        dropdown
          .setValue(taskPriority.color)
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
        setting.addButton((button) => {
          button
            .setButtonText("Delete")
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
    section.createEl("h2", {
      text: "Task Priorities",
      cls: "task-sync-section-header",
    });
    section.createEl("p", {
      text: "Configure the available task priorities and their colors.",
      cls: "task-sync-settings-section-desc",
    });

    // Create a setting for each task priority
    this.plugin.settings.taskPriorities.forEach((taskPriority, index) => {
      const setting = new Setting(section)
        .setName(taskPriority.name)
        .setDesc(`Configure the "${taskPriority.name}" task priority`);

      // Add priority badge preview
      const badgeContainer = setting.controlEl.createDiv(
        "task-priority-preview"
      );
      const badge = createPriorityBadge(taskPriority);
      badgeContainer.appendChild(badge);

      // Add name input
      setting.addText((text) => {
        text
          .setValue(taskPriority.name)
          .setPlaceholder("Priority name")
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
      setting.addDropdown((dropdown) => {
        TASK_PRIORITY_COLORS.forEach((color) => {
          dropdown.addOption(
            color,
            color.charAt(0).toUpperCase() + color.slice(1)
          );
        });

        dropdown
          .setValue(taskPriority.color)
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
        setting.addButton((button) => {
          button
            .setButtonText("Delete")
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
    let newPriorityName = "";
    let newPriorityColor: TaskPriorityColor = "blue";

    new Setting(container)
      .setName("Add New Task Priority")
      .setDesc("Create a new task priority for your workflow")
      .addText((text) => {
        text
          .setPlaceholder("e.g., Critical, Normal, Minor")
          .onChange((value) => {
            newPriorityName = value.trim();
          });
      })
      .addDropdown((dropdown) => {
        TASK_PRIORITY_COLORS.forEach((color) => {
          dropdown.addOption(
            color,
            color.charAt(0).toUpperCase() + color.slice(1)
          );
        });

        dropdown
          .setValue(newPriorityColor)
          .onChange((value: TaskPriorityColor) => {
            newPriorityColor = value;
          });
      })
      .addButton((button) => {
        button
          .setButtonText("Add Priority")
          .setCta()
          .onClick(async () => {
            if (
              newPriorityName &&
              !this.plugin.settings.taskPriorities.some(
                (p) => p.name === newPriorityName
              )
            ) {
              this.plugin.settings.taskPriorities.push({
                name: newPriorityName,
                color: newPriorityColor,
              });
              await this.plugin.saveSettings();

              // Find the task priorities section and refresh it
              const taskPrioritiesSection = container.closest(
                ".task-sync-settings-section"
              );
              if (taskPrioritiesSection) {
                taskPrioritiesSection.empty();
                this.recreateTaskPrioritiesSection(
                  taskPrioritiesSection as HTMLElement
                );
              }

              // Trigger base sync if enabled
              if (this.plugin.settings.autoSyncAreaProjectBases) {
                await this.plugin.syncAreaProjectBases();
              }
            }
          });
      });
  }

  private createTaskStatusesSection(container: HTMLElement): void {
    const section = container.createDiv("task-sync-settings-section");

    // Section header
    section.createEl("h2", {
      text: "Task Statuses",
      cls: "task-sync-section-header",
    });
    section.createEl("p", {
      text: "Configure the available task statuses, their colors, and which statuses represent completed or in-progress tasks.",
      cls: "task-sync-settings-section-desc",
    });

    // Create a setting for each task status
    this.plugin.settings.taskStatuses.forEach((taskStatus, index) => {
      const setting = new Setting(section)
        .setName(taskStatus.name)
        .setDesc(`Configure the "${taskStatus.name}" task status`);

      // Add status badge preview
      const badgeContainer = setting.controlEl.createDiv("task-status-preview");
      const badge = createStatusBadge(taskStatus);
      badgeContainer.appendChild(badge);

      // Add name input
      setting.addText((text) => {
        text
          .setValue(taskStatus.name)
          .setPlaceholder("Status name")
          .onChange(async (value) => {
            if (value.trim()) {
              this.plugin.settings.taskStatuses[index].name = value.trim();
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
      setting.addDropdown((dropdown) => {
        TASK_STATUS_COLORS.forEach((color) => {
          dropdown.addOption(
            color,
            color.charAt(0).toUpperCase() + color.slice(1)
          );
        });

        dropdown
          .setValue(taskStatus.color)
          .onChange(async (value: TaskStatusColor) => {
            this.plugin.settings.taskStatuses[index].color = value;
            await this.plugin.saveSettings();

            // Update badge color
            badge.className = `task-status-badge task-status-${value}`;

            // Trigger base sync if enabled
            if (this.plugin.settings.autoSyncAreaProjectBases) {
              await this.plugin.syncAreaProjectBases();
            }
          });
      });

      // Add isDone toggle
      setting.addToggle((toggle) => {
        toggle
          .setValue(taskStatus.isDone || false)
          .setTooltip("Mark this status as representing a completed/done state")
          .onChange(async (value) => {
            this.plugin.settings.taskStatuses[index].isDone = value;
            await this.plugin.saveSettings();

            // Trigger base sync if enabled
            if (this.plugin.settings.autoSyncAreaProjectBases) {
              await this.plugin.syncAreaProjectBases();
            }
          });
      });

      // Add isInProgress toggle
      setting.addToggle((toggle) => {
        toggle
          .setValue(taskStatus.isInProgress || false)
          .setTooltip(
            "Mark this status as representing an active/in-progress state"
          )
          .onChange(async (value) => {
            this.plugin.settings.taskStatuses[index].isInProgress = value;
            await this.plugin.saveSettings();

            // Trigger base sync if enabled
            if (this.plugin.settings.autoSyncAreaProjectBases) {
              await this.plugin.syncAreaProjectBases();
            }
          });
      });

      // Add delete button (don't allow deleting if it's the last status)
      if (this.plugin.settings.taskStatuses.length > 1) {
        setting.addButton((button) => {
          button
            .setButtonText("Delete")
            .setWarning()
            .onClick(async () => {
              this.plugin.settings.taskStatuses.splice(index, 1);
              await this.plugin.saveSettings();

              // Refresh only the task statuses section, not the entire container
              section.empty();
              this.recreateTaskStatusesSection(section);

              // Trigger base sync if enabled
              if (this.plugin.settings.autoSyncAreaProjectBases) {
                await this.plugin.syncAreaProjectBases();
              }
            });
        });
      }
    });

    // Add new task status section
    this.createAddTaskStatusSection(section);
  }

  private recreateTaskStatusesSection(section: HTMLElement): void {
    // Section header
    section.createEl("h2", {
      text: "Task Statuses",
      cls: "task-sync-section-header",
    });
    section.createEl("p", {
      text: "Configure the available task statuses, their colors, and which statuses represent completed or in-progress tasks.",
      cls: "task-sync-settings-section-desc",
    });

    // Create a setting for each task status
    this.plugin.settings.taskStatuses.forEach((taskStatus, index) => {
      const setting = new Setting(section)
        .setName(taskStatus.name)
        .setDesc(`Configure the "${taskStatus.name}" task status`);

      // Add status badge preview
      const badgeContainer = setting.controlEl.createDiv("task-status-preview");
      const badge = createStatusBadge(taskStatus);
      badgeContainer.appendChild(badge);

      // Add name input
      setting.addText((text) => {
        text
          .setValue(taskStatus.name)
          .setPlaceholder("Status name")
          .onChange(async (value) => {
            if (value.trim()) {
              this.plugin.settings.taskStatuses[index].name = value.trim();
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
      setting.addDropdown((dropdown) => {
        TASK_STATUS_COLORS.forEach((color) => {
          dropdown.addOption(
            color,
            color.charAt(0).toUpperCase() + color.slice(1)
          );
        });

        dropdown
          .setValue(taskStatus.color)
          .onChange(async (value: TaskStatusColor) => {
            this.plugin.settings.taskStatuses[index].color = value;
            await this.plugin.saveSettings();

            // Update badge color
            badge.className = `task-status-badge task-status-${value}`;

            // Trigger base sync if enabled
            if (this.plugin.settings.autoSyncAreaProjectBases) {
              await this.plugin.syncAreaProjectBases();
            }
          });
      });

      // Add isDone toggle
      setting.addToggle((toggle) => {
        toggle
          .setValue(taskStatus.isDone || false)
          .setTooltip("Mark this status as representing a completed/done state")
          .onChange(async (value) => {
            this.plugin.settings.taskStatuses[index].isDone = value;
            await this.plugin.saveSettings();

            // Trigger base sync if enabled
            if (this.plugin.settings.autoSyncAreaProjectBases) {
              await this.plugin.syncAreaProjectBases();
            }
          });
      });

      // Add isInProgress toggle
      setting.addToggle((toggle) => {
        toggle
          .setValue(taskStatus.isInProgress || false)
          .setTooltip(
            "Mark this status as representing an active/in-progress state"
          )
          .onChange(async (value) => {
            this.plugin.settings.taskStatuses[index].isInProgress = value;
            await this.plugin.saveSettings();

            // Trigger base sync if enabled
            if (this.plugin.settings.autoSyncAreaProjectBases) {
              await this.plugin.syncAreaProjectBases();
            }
          });
      });

      // Add delete button (don't allow deleting if it's the last status)
      if (this.plugin.settings.taskStatuses.length > 1) {
        setting.addButton((button) => {
          button
            .setButtonText("Delete")
            .setWarning()
            .onClick(async () => {
              this.plugin.settings.taskStatuses.splice(index, 1);
              await this.plugin.saveSettings();

              // Refresh only the task statuses section, not the entire container
              section.empty();
              this.recreateTaskStatusesSection(section);

              // Trigger base sync if enabled
              if (this.plugin.settings.autoSyncAreaProjectBases) {
                await this.plugin.syncAreaProjectBases();
              }
            });
        });
      }
    });

    // Add new task status section
    this.createAddTaskStatusSection(section);
  }

  private createAddTaskStatusSection(container: HTMLElement): void {
    let newStatusName = "";
    let newStatusColor: TaskStatusColor = "blue";

    new Setting(container)
      .setName("Add New Task Status")
      .setDesc("Create a new task status for your workflow")
      .addText((text) => {
        text
          .setPlaceholder("e.g., Review, Testing, Blocked")
          .onChange((value) => {
            newStatusName = value.trim();
          });
      })
      .addDropdown((dropdown) => {
        TASK_STATUS_COLORS.forEach((color) => {
          dropdown.addOption(
            color,
            color.charAt(0).toUpperCase() + color.slice(1)
          );
        });

        dropdown.setValue(newStatusColor).onChange((value: TaskStatusColor) => {
          newStatusColor = value;
        });
      })
      .addButton((button) => {
        button
          .setButtonText("Add Status")
          .setCta()
          .onClick(async () => {
            if (
              newStatusName &&
              !this.plugin.settings.taskStatuses.some(
                (s) => s.name === newStatusName
              )
            ) {
              this.plugin.settings.taskStatuses.push({
                name: newStatusName,
                color: newStatusColor,
                isDone: false,
                isInProgress: false,
              });
              await this.plugin.saveSettings();

              // Find the task statuses section and refresh it
              const taskStatusesSection = container.closest(
                ".task-sync-settings-section"
              );
              if (taskStatusesSection) {
                taskStatusesSection.empty();
                this.recreateTaskStatusesSection(
                  taskStatusesSection as HTMLElement
                );
              }

              // Trigger base sync if enabled
              if (this.plugin.settings.autoSyncAreaProjectBases) {
                await this.plugin.syncAreaProjectBases();
              }
            }
          });
      });
  }

  private createTemplateCreationButton(container: HTMLElement): void {
    // Task template creation
    new Setting(container)
      .setName("Create Default Task Template")
      .setDesc("Create the default task template file if it doesn't exist")
      .addButton((button) => {
        button
          .setButtonText("Create Template")
          .setCta()
          .onClick(async () => {
            button.setDisabled(true);
            button.setButtonText("Creating...");
            try {
              await this.plugin.templateManager.createTaskTemplate();
              button.setButtonText("✓ Created");
              setTimeout(() => {
                button.setDisabled(false);
                button.setButtonText("Create Template");
              }, 2000);
            } catch (error) {
              button.setButtonText("✗ Failed");
              console.error("Failed to create template:", error);
              setTimeout(() => {
                button.setDisabled(false);
                button.setButtonText("Create Template");
              }, 2000);
            }
          });
      });

    // Project template creation
    new Setting(container)
      .setName("Create Default Project Template")
      .setDesc("Create the default project template file if it doesn't exist")
      .addButton((button) => {
        button
          .setButtonText("Create Template")
          .setCta()
          .onClick(async () => {
            button.setDisabled(true);
            button.setButtonText("Creating...");
            try {
              await this.plugin.templateManager.createProjectTemplate();
              button.setButtonText("✓ Created");
              setTimeout(() => {
                button.setDisabled(false);
                button.setButtonText("Create Template");
              }, 2000);
            } catch (error) {
              button.setButtonText("✗ Failed");
              console.error("Failed to create template:", error);
              setTimeout(() => {
                button.setDisabled(false);
                button.setButtonText("Create Template");
              }, 2000);
            }
          });
      });

    // Area template creation
    new Setting(container)
      .setName("Create Default Area Template")
      .setDesc("Create the default area template file if it doesn't exist")
      .addButton((button) => {
        button
          .setButtonText("Create Template")
          .setCta()
          .onClick(async () => {
            button.setDisabled(true);
            button.setButtonText("Creating...");
            try {
              await this.plugin.templateManager.createAreaTemplate();
              button.setButtonText("✓ Created");
              setTimeout(() => {
                button.setDisabled(false);
                button.setButtonText("Create Template");
              }, 2000);
            } catch (error) {
              button.setButtonText("✗ Failed");
              console.error("Failed to create template:", error);
              setTimeout(() => {
                button.setDisabled(false);
                button.setButtonText("Create Template");
              }, 2000);
            }
          });
      });
  }

  private createActionButtons(container: HTMLElement): void {
    const actionsContainer = container.createDiv("task-sync-settings-actions");

    const refreshButton = actionsContainer.createEl("button", {
      text: "Refresh",
      cls: "mod-cta",
    });
    refreshButton.addEventListener("click", async () => {
      refreshButton.disabled = true;
      refreshButton.setText("Refreshing...");
      try {
        await this.plugin.refresh();
        refreshButton.setText("✓ Refreshed");
        setTimeout(() => {
          refreshButton.disabled = false;
          refreshButton.setText("Refresh");
        }, 2000);
      } catch (error) {
        refreshButton.setText("✗ Failed");
        console.error("Failed to refresh:", error);
        setTimeout(() => {
          refreshButton.disabled = false;
          refreshButton.setText("Refresh");
        }, 2000);
      }
    });
  }

  private createFolderSetting(
    container: HTMLElement,
    key: keyof TaskSyncSettings,
    name: string,
    desc: string
  ): void {
    const setting = new Setting(container)
      .setName(name)
      .setDesc(desc)
      .addText((text) => {
        const defaultValue = DEFAULT_SETTINGS[key] as string;
        text
          .setPlaceholder(defaultValue)
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
        const folderSuggest = new FolderSuggestComponent(
          this.app,
          text.inputEl
        );
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

  private createFileSetting(
    container: HTMLElement,
    key: keyof TaskSyncSettings,
    name: string,
    desc: string,
    extensions?: string[]
  ): void {
    const setting = new Setting(container)
      .setName(name)
      .setDesc(desc)
      .addText((text) => {
        const defaultValue = DEFAULT_SETTINGS[key] as string;
        text
          .setPlaceholder(defaultValue)
          .setValue(this.plugin.settings[key] as string)
          .onChange(async (value) => {
            let validation: ValidationResult;
            if (key === "tasksBaseFile") {
              validation = validateBaseFileName(value);
            } else if (key.includes("Template")) {
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
        const fileSuggestOptions: FileSuggestOptions = {
          fileExtensions: extensions,
        };

        // For template settings, limit suggestions to template folder
        if (key.includes("Template")) {
          fileSuggestOptions.folderPath = this.plugin.settings.templateFolder;
        }

        const fileSuggest = new FileSuggestComponent(
          this.app,
          text.inputEl,
          fileSuggestOptions
        );
        fileSuggest.onChange(async (value) => {
          let validation: ValidationResult;
          if (key === "tasksBaseFile") {
            validation = validateBaseFileName(value);
          } else if (key.includes("Template")) {
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
    settingEl.removeClass("task-sync-setting-error");
    const existingError = settingEl.querySelector(
      ".task-sync-validation-error"
    );
    if (existingError) {
      existingError.remove();
    }

    if (error) {
      // Add error styling
      settingEl.addClass("task-sync-setting-error");
      const errorEl = settingEl.createDiv("task-sync-validation-error");
      errorEl.textContent = error;
    }
  }

  private createIntegrationsSection(container: HTMLElement): void {
    const section = container.createDiv("task-sync-settings-section");

    // Section header
    section.createEl("h2", {
      text: "Integrations",
      cls: "task-sync-section-header",
    });

    // GitHub integration toggle
    new Setting(section)
      .setName("Enable GitHub Integration")
      .setDesc("Connect to GitHub to browse and import issues as tasks")
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.githubIntegration.enabled)
          .onChange(async (value) => {
            this.plugin.settings.githubIntegration.enabled = value;
            await this.plugin.saveSettings();

            // Refresh the section to show/hide additional settings
            section.empty();
            this.createIntegrationsSection(container);
          });
      });

    // Personal Access Token
    new Setting(section)
      .setName("GitHub Personal Access Token")
      .setDesc(
        "Your GitHub PAT for API access. Create one at github.com/settings/tokens"
      )
      .addText((text) => {
        text
          .setPlaceholder("ghp_...")
          .setValue(this.plugin.settings.githubIntegration.personalAccessToken)
          .onChange(async (value) => {
            const validation = validateGitHubToken(value);
            if (validation.isValid) {
              this.plugin.settings.githubIntegration.personalAccessToken =
                value;
              await this.plugin.saveSettings();
              this.clearValidationError("github-token");
            } else {
              this.setValidationError(
                "github-token",
                validation.error || "Invalid token"
              );
            }
          });

        // Set input type to password for security
        text.inputEl.type = "password";
        text.inputEl.style.fontFamily = "monospace";
      });

    // Default repository
    new Setting(section)
      .setName("Default Repository")
      .setDesc("Default repository to load issues from (format: owner/repo)")
      .addText((text) => {
        text
          .setPlaceholder("owner/repository")
          .setValue(this.plugin.settings.githubIntegration.defaultRepository)
          .onChange(async (value) => {
            this.plugin.settings.githubIntegration.defaultRepository = value;
            await this.plugin.saveSettings();
          });
      });

    // Issue filters
    new Setting(section)
      .setName("Default Issue State")
      .setDesc("Default state filter for GitHub issues")
      .addDropdown((dropdown) => {
        dropdown
          .addOption("open", "Open")
          .addOption("closed", "Closed")
          .addOption("all", "All")
          .setValue(this.plugin.settings.githubIntegration.issueFilters.state)
          .onChange(async (value: "open" | "closed" | "all") => {
            this.plugin.settings.githubIntegration.issueFilters.state = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(section)
      .setName("Default Assignee Filter")
      .setDesc(
        'Default assignee filter (leave empty for all, "me" for your issues)'
      )
      .addText((text) => {
        text
          .setPlaceholder("me, username, or empty")
          .setValue(
            this.plugin.settings.githubIntegration.issueFilters.assignee
          )
          .onChange(async (value) => {
            this.plugin.settings.githubIntegration.issueFilters.assignee =
              value;
            await this.plugin.saveSettings();
          });
      });

    // Organization/Repository Mappings
    this.createGitHubOrgRepoMappingsSection(section);

    // Apple Reminders Integration Section
    section.createEl("h3", {
      text: "Apple Reminders",
      cls: "task-sync-subsection-header",
    });

    // Platform check
    const isPlatformSupported = process.platform === "darwin";
    if (!isPlatformSupported) {
      section.createDiv({
        text: "Apple Reminders integration is only available on macOS",
        cls: "task-sync-platform-warning",
      });
    }

    // Apple Reminders integration toggle
    new Setting(section)
      .setName("Enable Apple Reminders Integration")
      .setDesc(
        isPlatformSupported
          ? "Connect to Apple Reminders to import reminders as tasks"
          : "Apple Reminders integration (macOS only)"
      )
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.appleRemindersIntegration.enabled)
          .setDisabled(!isPlatformSupported)
          .onChange(async (value) => {
            this.plugin.settings.appleRemindersIntegration.enabled = value;
            await this.plugin.saveSettings();

            // Refresh the section to show/hide additional settings
            section.empty();
            this.createIntegrationsSection(container);
          });
      });

    // Only show additional settings if Apple Reminders integration is enabled and platform is supported
    if (
      this.plugin.settings.appleRemindersIntegration.enabled &&
      isPlatformSupported
    ) {
      // Include completed reminders
      new Setting(section)
        .setName("Include Completed Reminders")
        .setDesc("Import completed reminders along with active ones")
        .addToggle((toggle) => {
          toggle
            .setValue(
              this.plugin.settings.appleRemindersIntegration
                .includeCompletedReminders
            )
            .onChange(async (value) => {
              this.plugin.settings.appleRemindersIntegration.includeCompletedReminders =
                value;
              await this.plugin.saveSettings();
            });
        });

      // Exclude all-day reminders
      new Setting(section)
        .setName("Exclude All-Day Reminders")
        .setDesc("Skip reminders that are set for all day")
        .addToggle((toggle) => {
          toggle
            .setValue(
              this.plugin.settings.appleRemindersIntegration
                .excludeAllDayReminders
            )
            .onChange(async (value) => {
              this.plugin.settings.appleRemindersIntegration.excludeAllDayReminders =
                value;
              await this.plugin.saveSettings();
            });
        });

      // Default task type
      new Setting(section)
        .setName("Default Task Type")
        .setDesc("Default task type for imported reminders")
        .addDropdown((dropdown) => {
          // Add task types from settings
          this.plugin.settings.taskTypes.forEach((taskType) => {
            dropdown.addOption(taskType.name, taskType.name);
          });

          dropdown
            .setValue(
              this.plugin.settings.appleRemindersIntegration.defaultTaskType
            )
            .onChange(async (value) => {
              this.plugin.settings.appleRemindersIntegration.defaultTaskType =
                value;
              await this.plugin.saveSettings();
            });
        });

      // Import notes as description
      new Setting(section)
        .setName("Import Notes as Description")
        .setDesc("Import reminder notes as task descriptions")
        .addToggle((toggle) => {
          toggle
            .setValue(
              this.plugin.settings.appleRemindersIntegration
                .importNotesAsDescription
            )
            .onChange(async (value) => {
              this.plugin.settings.appleRemindersIntegration.importNotesAsDescription =
                value;
              await this.plugin.saveSettings();
            });
        });

      // Preserve priority
      new Setting(section)
        .setName("Preserve Priority")
        .setDesc("Map Apple Reminders priority levels to task priorities")
        .addToggle((toggle) => {
          toggle
            .setValue(
              this.plugin.settings.appleRemindersIntegration.preservePriority
            )
            .onChange(async (value) => {
              this.plugin.settings.appleRemindersIntegration.preservePriority =
                value;
              await this.plugin.saveSettings();
            });
        });

      // Sync interval
      new Setting(section)
        .setName("Sync Interval (minutes)")
        .setDesc("How often to check for new reminders (for future auto-sync)")
        .addText((text) => {
          text
            .setPlaceholder("60")
            .setValue(
              this.plugin.settings.appleRemindersIntegration.syncInterval.toString()
            )
            .onChange(async (value) => {
              const interval = parseInt(value);
              if (!isNaN(interval) && interval > 0) {
                this.plugin.settings.appleRemindersIntegration.syncInterval =
                  interval;
                await this.plugin.saveSettings();
              }
            });
        });
    }

    // Apple Calendar Integration Section
    section.createEl("h3", {
      text: "Apple Calendar",
      cls: "task-sync-subsection-header",
    });

    // Apple Calendar integration toggle
    new Setting(section)
      .setName("Enable Apple Calendar Integration")
      .setDesc(
        "Connect to iCloud Calendar via CalDAV to insert events into daily notes"
      )
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.appleCalendarIntegration.enabled)
          .onChange(async (value) => {
            this.plugin.settings.appleCalendarIntegration.enabled = value;
            await this.plugin.saveSettings();

            // Refresh the section to show/hide additional settings
            section.empty();
            this.createIntegrationsSection(container);
          });
      });

    // Only show additional settings if Apple Calendar integration is enabled
    if (this.plugin.settings.appleCalendarIntegration.enabled) {
      // Apple ID (username)
      new Setting(section)
        .setName("Apple ID")
        .setDesc("Your Apple ID email address for iCloud Calendar access")
        .addText((text) => {
          text
            .setPlaceholder("your-email@icloud.com")
            .setValue(this.plugin.settings.appleCalendarIntegration.username)
            .onChange(async (value) => {
              this.plugin.settings.appleCalendarIntegration.username = value;
              await this.plugin.saveSettings();
            });
        });

      // App-specific password
      new Setting(section)
        .setName("App-Specific Password")
        .setDesc(
          "Generate an app-specific password in your Apple ID settings for CalDAV access"
        )
        .addText((text) => {
          text
            .setPlaceholder("xxxx-xxxx-xxxx-xxxx")
            .setValue(
              this.plugin.settings.appleCalendarIntegration.appSpecificPassword
            )
            .onChange(async (value) => {
              this.plugin.settings.appleCalendarIntegration.appSpecificPassword =
                value;
              await this.plugin.saveSettings();
            });
          // Make it a password field
          text.inputEl.type = "password";
        });

      // Include location
      new Setting(section)
        .setName("Include Location")
        .setDesc("Include event location in the inserted calendar events")
        .addToggle((toggle) => {
          toggle
            .setValue(
              this.plugin.settings.appleCalendarIntegration.includeLocation
            )
            .onChange(async (value) => {
              this.plugin.settings.appleCalendarIntegration.includeLocation =
                value;
              await this.plugin.saveSettings();
            });
        });

      // Include notes
      new Setting(section)
        .setName("Include Notes")
        .setDesc(
          "Include event descriptions/notes in the inserted calendar events"
        )
        .addToggle((toggle) => {
          toggle
            .setValue(
              this.plugin.settings.appleCalendarIntegration.includeNotes
            )
            .onChange(async (value) => {
              this.plugin.settings.appleCalendarIntegration.includeNotes =
                value;
              await this.plugin.saveSettings();
            });
        });

      // Default area for imported events
      new Setting(section)
        .setName("Default Area")
        .setDesc(
          "Default area to assign to imported calendar events (leave empty for no area)"
        )
        .addText((text) => {
          text
            .setPlaceholder("Calendar Events")
            .setValue(this.plugin.settings.appleCalendarIntegration.defaultArea)
            .onChange(async (value) => {
              this.plugin.settings.appleCalendarIntegration.defaultArea = value;
              await this.plugin.saveSettings();
            });
        });

      // Time format
      new Setting(section)
        .setName("Time Format")
        .setDesc("Choose between 12-hour or 24-hour time format")
        .addDropdown((dropdown) => {
          dropdown
            .addOption("12h", "12-hour (AM/PM)")
            .addOption("24h", "24-hour")
            .setValue(this.plugin.settings.appleCalendarIntegration.timeFormat)
            .onChange(async (value: "12h" | "24h") => {
              this.plugin.settings.appleCalendarIntegration.timeFormat = value;
              await this.plugin.saveSettings();
            });
        });

      // Day view configuration section
      section.createEl("h4", {
        text: "Day View Configuration",
        cls: "task-sync-subsection-header",
      });

      // Start hour
      new Setting(section)
        .setName("Start Hour")
        .setDesc("Starting hour for the day view (0-23)")
        .addDropdown((dropdown) => {
          for (let i = 0; i < 24; i++) {
            const hour = i.toString().padStart(2, "0");
            dropdown.addOption(i.toString(), `${hour}:00`);
          }
          dropdown
            .setValue(
              this.plugin.settings.appleCalendarIntegration.startHour.toString()
            )
            .onChange(async (value) => {
              const hour = parseInt(value);
              if (!isNaN(hour) && hour >= 0 && hour < 24) {
                this.plugin.settings.appleCalendarIntegration.startHour = hour;
                await this.plugin.saveSettings();
              }
            });
        });

      // End hour
      new Setting(section)
        .setName("End Hour")
        .setDesc("Ending hour for the day view (1-24)")
        .addDropdown((dropdown) => {
          for (let i = 1; i <= 24; i++) {
            const hour = i === 24 ? "00" : i.toString().padStart(2, "0");
            const label = i === 24 ? "24:00 (Midnight)" : `${hour}:00`;
            dropdown.addOption(i.toString(), label);
          }
          dropdown
            .setValue(
              this.plugin.settings.appleCalendarIntegration.endHour.toString()
            )
            .onChange(async (value) => {
              const hour = parseInt(value);
              if (!isNaN(hour) && hour >= 1 && hour <= 24) {
                this.plugin.settings.appleCalendarIntegration.endHour = hour;
                await this.plugin.saveSettings();
              }
            });
        });

      // Time increment
      new Setting(section)
        .setName("Time Increment")
        .setDesc("Time slot increment in minutes")
        .addDropdown((dropdown) => {
          dropdown
            .addOption("15", "15 minutes")
            .addOption("30", "30 minutes")
            .addOption("60", "60 minutes")
            .setValue(
              this.plugin.settings.appleCalendarIntegration.timeIncrement.toString()
            )
            .onChange(async (value) => {
              const increment = parseInt(value);
              if (!isNaN(increment) && [15, 30, 60].includes(increment)) {
                this.plugin.settings.appleCalendarIntegration.timeIncrement =
                  increment;
                await this.plugin.saveSettings();
              }
            });
        });

      // Task scheduling configuration section
      section.createEl("h4", {
        text: "Task Scheduling",
        cls: "task-sync-subsection-header",
      });

      // Enable task scheduling
      new Setting(section)
        .setName("Enable Task Scheduling")
        .setDesc("Allow scheduling tasks as calendar events")
        .addToggle((toggle) => {
          toggle
            .setValue(
              this.plugin.settings.appleCalendarIntegration.schedulingEnabled
            )
            .onChange(async (value) => {
              this.plugin.settings.appleCalendarIntegration.schedulingEnabled =
                value;
              await this.plugin.saveSettings();

              // Refresh the section to show/hide scheduling settings
              section.empty();
              this.createIntegrationsSection(container);
            });
        });

      // Only show scheduling settings if enabled
      if (this.plugin.settings.appleCalendarIntegration.schedulingEnabled) {
        // Default scheduling calendar
        new Setting(section)
          .setName("Default Scheduling Calendar")
          .setDesc("Default calendar to use when scheduling tasks as events")
          .addText((text) => {
            text
              .setPlaceholder("Calendar name")
              .setValue(
                this.plugin.settings.appleCalendarIntegration
                  .defaultSchedulingCalendar
              )
              .onChange(async (value) => {
                this.plugin.settings.appleCalendarIntegration.defaultSchedulingCalendar =
                  value;
                await this.plugin.saveSettings();
              });
          });

        // Default event duration
        new Setting(section)
          .setName("Default Event Duration")
          .setDesc("Default duration for scheduled events in minutes")
          .addText((text) => {
            text
              .setPlaceholder("60")
              .setValue(
                this.plugin.settings.appleCalendarIntegration.defaultEventDuration.toString()
              )
              .onChange(async (value) => {
                const duration = parseInt(value);
                if (!isNaN(duration) && duration > 0) {
                  this.plugin.settings.appleCalendarIntegration.defaultEventDuration =
                    duration;
                  await this.plugin.saveSettings();
                }
              });
          });

        // Include task details in event
        new Setting(section)
          .setName("Include Task Details")
          .setDesc("Include task details in the event description")
          .addToggle((toggle) => {
            toggle
              .setValue(
                this.plugin.settings.appleCalendarIntegration
                  .includeTaskDetailsInEvent
              )
              .onChange(async (value) => {
                this.plugin.settings.appleCalendarIntegration.includeTaskDetailsInEvent =
                  value;
                await this.plugin.saveSettings();
              });
          });

        // Default reminders
        new Setting(section)
          .setName("Default Reminders")
          .setDesc(
            "Default reminder times in minutes before event (comma-separated)"
          )
          .addText((text) => {
            text
              .setPlaceholder("15, 60")
              .setValue(
                this.plugin.settings.appleCalendarIntegration.defaultReminders.join(
                  ", "
                )
              )
              .onChange(async (value) => {
                try {
                  const reminders = value
                    .split(",")
                    .map((s) => parseInt(s.trim()))
                    .filter((n) => !isNaN(n) && n > 0);
                  this.plugin.settings.appleCalendarIntegration.defaultReminders =
                    reminders;
                  await this.plugin.saveSettings();
                } catch (error) {
                  // Invalid input, ignore
                }
              });
          });
      }
    }
  }

  hide(): void {
    // Clean up suggest components
    this.suggestComponents.forEach((component) => component.destroy());
    this.suggestComponents = [];
  }

  /**
   * Create GitHub Organization/Repository Mappings section
   */
  private createGitHubOrgRepoMappingsSection(container: HTMLElement): void {
    // Ensure orgRepoMappings array exists
    if (!this.plugin.settings.githubIntegration.orgRepoMappings) {
      this.plugin.settings.githubIntegration.orgRepoMappings = [];
    }

    // Sort mappings by priority (highest first) for display
    const sortedMappings = [
      ...this.plugin.settings.githubIntegration.orgRepoMappings,
    ].sort((a, b) => (b.priority || 0) - (a.priority || 0));

    // Create sortable mapping list
    new SortableGitHubMappingList({
      container: container,
      mappings: sortedMappings,
      onReorder: async (newOrder: GitHubOrgRepoMapping[]) => {
        this.plugin.settings.githubIntegration.orgRepoMappings = newOrder;
        await this.plugin.saveSettings();
      },
      onUpdate: async (index: number, mapping: GitHubOrgRepoMapping) => {
        // Find the mapping in the original array and update it
        const originalIndex =
          this.plugin.settings.githubIntegration.orgRepoMappings.findIndex(
            (m) => m === sortedMappings[index]
          );
        if (originalIndex !== -1) {
          this.plugin.settings.githubIntegration.orgRepoMappings[
            originalIndex
          ] = mapping;
          await this.plugin.saveSettings();
        }
      },
      onDelete: async (index: number) => {
        // Find the mapping in the original array and remove it
        const mappingToDelete = sortedMappings[index];
        const originalIndex =
          this.plugin.settings.githubIntegration.orgRepoMappings.findIndex(
            (m) => m === mappingToDelete
          );
        if (originalIndex !== -1) {
          this.plugin.settings.githubIntegration.orgRepoMappings.splice(
            originalIndex,
            1
          );
          await this.plugin.saveSettings();
          // Refresh the section
          container.empty();
          this.createGitHubOrgRepoMappingsSection(container);
        }
      },
      onAdd: async () => {
        const newMapping: GitHubOrgRepoMapping = {
          organization: "",
          repository: "",
          targetArea: "",
          targetProject: "",
          priority:
            (this.plugin.settings.githubIntegration.orgRepoMappings.length ||
              0) + 1,
        };
        this.plugin.settings.githubIntegration.orgRepoMappings.push(newMapping);
        await this.plugin.saveSettings();
        // Refresh the section
        container.empty();
        this.createGitHubOrgRepoMappingsSection(container);
      },
    });
  }
}
