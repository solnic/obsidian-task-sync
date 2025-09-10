/**
 * Project creation modal for the Task Sync plugin
 * Provides a simple form interface for creating new projects
 */

import { App, Modal, Setting } from "obsidian";
import TaskSyncPlugin from "../../main";

export interface ProjectCreateData {
  name: string;
  areas?: string;
  description?: string;
}

export class ProjectCreateModal extends Modal {
  private plugin: TaskSyncPlugin;
  private onSubmitCallback?: (projectData: ProjectCreateData) => Promise<void>;
  private formData: Partial<ProjectCreateData> = {};

  constructor(app: App, plugin: TaskSyncPlugin) {
    super(app);
    this.plugin = plugin;
    this.modalEl.addClass("task-sync-create-project");
    this.modalEl.addClass("task-sync-modal");
  }

  onOpen(): void {
    this.titleEl.setText("Create New Project");
    this.createContent();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  onSubmit(callback: (projectData: ProjectCreateData) => Promise<void>): void {
    this.onSubmitCallback = callback;
  }

  private createContent(): void {
    const container = this.contentEl.createDiv("task-sync-modal-content");

    // Description
    const description = container.createDiv("task-sync-modal-description");
    description.createEl("p", {
      text: "Create a new project with specific goals and outcomes. Projects have a defined start and end.",
    });

    // Form fields
    this.createFormFields(container);

    // Action buttons
    this.createActionButtons(container);
  }

  private createFormFields(container: HTMLElement): void {
    // Project name (required)
    new Setting(container)
      .setName("Project Name")
      .setDesc("Enter a descriptive name for the project")
      .addText((text) => {
        text
          .setPlaceholder("e.g., Website Redesign, Learn Spanish")
          .setValue(this.formData.name || "")
          .onChange((value) => {
            this.formData.name = value;
          });
        text.inputEl.addClass("task-sync-required-field");

        // Focus on the input
        setTimeout(() => text.inputEl.focus(), 100);
      });

    // Areas (optional)
    new Setting(container)
      .setName("Related Areas")
      .setDesc("Areas this project belongs to (comma-separated)")
      .addText((text) => {
        text
          .setPlaceholder("e.g., Work, Learning")
          .setValue(this.formData.areas || "")
          .onChange((value) => {
            this.formData.areas = value;
          });
      });

    // Description (optional)
    new Setting(container)
      .setName("Description")
      .setDesc("Optional description for the project")
      .addTextArea((text) => {
        text
          .setPlaceholder("Brief description of this project...")
          .setValue(this.formData.description || "")
          .onChange((value) => {
            this.formData.description = value;
          });
        text.inputEl.rows = 3;
      });
  }

  private createActionButtons(container: HTMLElement): void {
    const buttonContainer = container.createDiv("task-sync-modal-buttons");

    // Cancel button
    const cancelButton = buttonContainer.createEl("button", {
      text: "Cancel",
      cls: "mod-cancel",
    });
    cancelButton.addEventListener("click", () => {
      this.close();
    });

    // Create button
    const createButton = buttonContainer.createEl("button", {
      text: "Create Project",
      cls: "mod-cta",
    });
    createButton.addEventListener("click", async () => {
      await this.handleSubmit();
    });

    // Handle Enter key
    this.modalEl.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        this.handleSubmit();
      } else if (event.key === "Escape") {
        event.preventDefault();
        this.close();
      }
    });
  }

  private async handleSubmit(): Promise<void> {
    // Validate required fields
    if (!this.formData.name?.trim()) {
      this.showError("Project name is required");
      return;
    }

    // Prepare project data
    const projectData: ProjectCreateData = {
      name: this.formData.name.trim(),
      areas: this.formData.areas?.trim() || undefined,
      description: this.formData.description?.trim() || undefined,
    };

    try {
      if (this.onSubmitCallback) {
        await this.onSubmitCallback(projectData);
      }
      this.close();
    } catch (error) {
      console.error("Failed to create project:", error);
      this.showError("Failed to create project. Please try again.");
    }
  }

  private showError(message: string): void {
    // Remove existing error messages
    this.contentEl
      .querySelectorAll(".task-sync-error")
      .forEach((el) => el.remove());

    // Add new error message
    const errorEl = this.contentEl.createDiv("task-sync-error");
    errorEl.setText(message);
    errorEl.style.color = "var(--text-error)";
    errorEl.style.marginTop = "10px";
    errorEl.style.textAlign = "center";

    // Auto-remove after 5 seconds
    setTimeout(() => {
      errorEl.remove();
    }, 5000);
  }
}
