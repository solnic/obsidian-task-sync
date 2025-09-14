/**
 * Task creation modal for the Task Sync plugin
 * Provides a Linear-inspired interface for creating new tasks with all required fields
 */

import {
  App,
  Modal,
  TextAreaComponent,
  TextComponent,
  TFile,
  Setting,
} from "obsidian";
import TaskSyncPlugin, { FileContext } from "../../main";
import { createTypeBadge } from "../ui/TypeBadge";
import { createPriorityBadge } from "../ui/PriorityBadge";
import { createStatusBadge } from "../ui/StatusBadge";
import { TaskType, TaskPriority, TaskStatus } from "../ui/settings/types";

export interface TaskCreateData {
  title: string;
  category?: string;
  areas?: string[]; // Array as per BaseConfiguration
  parentTask?: string;
  tags: string[];
  project?: string;
  done: boolean;
  status: string;
  priority?: string;
  content?: string; // Changed from description to content
  dueDate?: string;
}

export class TaskCreateModal extends Modal {
  private plugin: TaskSyncPlugin;
  private context: FileContext;
  private onSubmitCallback?: (taskData: TaskCreateData) => Promise<void>;
  private formData: Partial<TaskCreateData> = {};

  // UI Components
  private titleInput: TextComponent;
  private contentEditor: TextAreaComponent;
  private categoryBadge: HTMLElement;
  private priorityBadge: HTMLElement;
  private statusBadge: HTMLElement;
  private projectInput: TextComponent;
  private areasInput: TextComponent;

  constructor(
    app: App,
    plugin: TaskSyncPlugin,
    context: FileContext = { type: "none" }
  ) {
    super(app);
    this.plugin = plugin;
    this.context = context;
    this.modalEl.addClass("task-sync-create-task");
    this.modalEl.addClass("task-sync-modal");
  }

  onOpen(): void {
    const title = this.getContextualTitle();
    this.titleEl.setText(title);
    this.initializeFormData();
    this.createContent();
  }

  private getContextualTitle(): string {
    switch (this.context.type) {
      case "project":
        return `Create Task for Project: ${this.context.name}`;
      case "area":
        return `Create Task for Area: ${this.context.name}`;
      default:
        return "Create New Task";
    }
  }

  private initializeFormData(): void {
    // Pre-fill form data based on context
    this.formData = {
      title: "",
      category: this.plugin.settings.taskTypes[0]?.name || "Task", // Use first configured task type
      done: false,
      status: this.plugin.settings.taskStatuses[0]?.name || "Backlog", // Use first configured task status
      tags: [],
    };

    // Context-specific prefilling
    if (this.context.type === "project" && this.context.name) {
      this.formData.project = this.context.name;
    } else if (this.context.type === "area" && this.context.name) {
      this.formData.areas = [this.context.name];
    }
  }

  private createContent(): void {
    this.contentEl.empty();

    // Create main container with Linear-like layout
    const container = this.contentEl.createDiv("task-sync-linear-container");

    // Create header with title input
    this.createTitleSection(container);

    // Create content editor section
    this.createContentSection(container);

    // Create toolbar with badges and controls
    this.createToolbarSection(container);

    // Create action buttons
    this.createActionButtons(container);
  }

  private createTitleSection(container: HTMLElement): void {
    const titleSection = container.createDiv("task-sync-title-section");

    // Add context info if available
    if (this.context.type !== "none") {
      const contextInfo = titleSection.createDiv("task-sync-context-info");
      const contextType = this.context.type === "project" ? "Project" : "Area";
      contextInfo.createEl("span", {
        text: `${contextType}: ${this.context.name}`,
        cls: "task-sync-context-badge",
      });
    }

    // Create title input
    const titleContainer = titleSection.createDiv("task-sync-title-container");
    this.titleInput = new TextComponent(titleContainer);
    this.titleInput
      .setPlaceholder("Task title")
      .setValue(this.formData.title || "")
      .onChange((value) => {
        this.formData.title = value;
      });
    this.titleInput.inputEl.addClass("task-sync-title-input");
  }

  private createContentSection(container: HTMLElement): void {
    const contentSection = container.createDiv("task-sync-content-section");

    // Create content editor using Obsidian's TextAreaComponent
    this.contentEditor = new TextAreaComponent(contentSection);
    this.contentEditor
      .setPlaceholder("Add description...")
      .setValue(this.formData.content || "")
      .onChange((value) => {
        this.formData.content = value;
      });
    this.contentEditor.inputEl.addClass("task-sync-content-editor");
    this.contentEditor.inputEl.rows = 6;
  }

  private createToolbarSection(container: HTMLElement): void {
    const toolbar = container.createDiv("task-sync-toolbar");

    // Create badge selectors
    this.createCategoryBadgeSelector(toolbar);
    this.createPriorityBadgeSelector(toolbar);
    this.createStatusBadgeSelector(toolbar);

    // Create project and areas inputs with autocomplete
    this.createProjectInput(toolbar);
    this.createAreasInput(toolbar);

    // Create other fields
    this.createParentTaskInput(toolbar);
    this.createTagsInput(toolbar);
  }

  private createCategoryBadgeSelector(container: HTMLElement): void {
    const selectedType =
      this.plugin.settings.taskTypes.find(
        (t) => t.name === this.formData.category
      ) || this.plugin.settings.taskTypes[0];

    this.categoryBadge = createTypeBadge(
      selectedType,
      "task-sync-clickable-badge"
    );
    container.appendChild(this.categoryBadge);

    this.categoryBadge.addEventListener("click", () => {
      this.showTypeSelector(this.categoryBadge, (type: TaskType) => {
        this.formData.category = type.name;
        this.updateCategoryBadge();
      });
    });
  }

  private createPriorityBadgeSelector(container: HTMLElement): void {
    const selectedPriority = this.plugin.settings.taskPriorities.find(
      (p) => p.name === this.formData.priority
    );

    if (selectedPriority) {
      this.priorityBadge = createPriorityBadge(
        selectedPriority,
        "task-sync-clickable-badge"
      );
    } else {
      this.priorityBadge = container.createEl("span", {
        text: "Set priority",
        cls: "task-sync-placeholder-badge task-sync-clickable-badge",
      });
    }

    container.appendChild(this.priorityBadge);

    this.priorityBadge.addEventListener("click", () => {
      this.showPrioritySelector(
        this.priorityBadge,
        (priority: TaskPriority) => {
          this.formData.priority = priority.name;
          this.updatePriorityBadge();
        }
      );
    });
  }

  private createStatusBadgeSelector(container: HTMLElement): void {
    const selectedStatus =
      this.plugin.settings.taskStatuses.find(
        (s) => s.name === this.formData.status
      ) || this.plugin.settings.taskStatuses[0];

    this.statusBadge = createStatusBadge(
      selectedStatus,
      "task-sync-clickable-badge"
    );
    container.appendChild(this.statusBadge);

    this.statusBadge.addEventListener("click", () => {
      this.showStatusSelector(this.statusBadge, (status: TaskStatus) => {
        this.formData.status = status.name;
        this.updateStatusBadge();
      });
    });
  }

  private createProjectInput(container: HTMLElement): void {
    this.projectInput = new TextComponent(container);
    this.projectInput
      .setPlaceholder("Project")
      .setValue(this.formData.project || "")
      .onChange((value) => {
        this.formData.project = value;
      });

    // Disable if context is project
    if (this.context.type === "project") {
      this.projectInput.setDisabled(true);
    }

    this.projectInput.inputEl.addClass("task-sync-toolbar-input");
    this.setupProjectAutocomplete();
  }

  private createAreasInput(container: HTMLElement): void {
    this.areasInput = new TextComponent(container);
    this.areasInput
      .setPlaceholder("Areas")
      .setValue(this.formData.areas?.join(", ") || "")
      .onChange((value) => {
        this.formData.areas = value
          .split(",")
          .map((a) => a.trim())
          .filter((a) => a);
      });

    // Disable if context is area
    if (this.context.type === "area") {
      this.areasInput.setDisabled(true);
    }

    this.areasInput.inputEl.addClass("task-sync-toolbar-input");
    this.setupAreasAutocomplete();
  }

  private createParentTaskInput(container: HTMLElement): void {
    const parentInput = new TextComponent(container);
    parentInput
      .setPlaceholder("Parent task (optional)")
      .setValue(this.formData.parentTask || "")
      .onChange((value) => {
        this.formData.parentTask = value;
      });
    parentInput.inputEl.addClass("task-sync-toolbar-input");
  }

  private createTagsInput(container: HTMLElement): void {
    const tagsInput = new TextComponent(container);
    tagsInput
      .setPlaceholder("tag1, tag2, tag3")
      .setValue(this.formData.tags?.join(", ") || "")
      .onChange((value) => {
        this.formData.tags = this.parseTags(value);
      });
    tagsInput.inputEl.addClass("task-sync-toolbar-input");
  }

  private createActionButtons(container: HTMLElement): void {
    const actionsContainer = container.createDiv("task-sync-action-buttons");

    const cancelButton = actionsContainer.createEl("button", {
      text: "Cancel",
      type: "button",
      cls: "task-sync-cancel-button",
    });
    cancelButton.addEventListener("click", () => this.close());

    const submitButton = actionsContainer.createEl("button", {
      text: "Create task",
      type: "button",
      cls: "task-sync-submit-button mod-cta",
    });
    submitButton.addEventListener("click", () => this.handleSubmit());
  }

  // Badge selector methods
  private showTypeSelector(
    badgeEl: HTMLElement,
    onSelect: (type: TaskType) => void
  ): void {
    const menu = this.createSelectorMenu(badgeEl);

    this.plugin.settings.taskTypes.forEach((type) => {
      const item = menu.createDiv("task-sync-selector-item");
      const badge = createTypeBadge(type);
      item.appendChild(badge);

      item.addEventListener("click", () => {
        onSelect(type);
        menu.remove();
      });
    });
  }

  private showPrioritySelector(
    badgeEl: HTMLElement,
    onSelect: (priority: TaskPriority) => void
  ): void {
    const menu = this.createSelectorMenu(badgeEl);

    // Add "No priority" option
    const noPriorityItem = menu.createDiv("task-sync-selector-item");
    noPriorityItem.createEl("span", {
      text: "No priority",
      cls: "task-sync-no-priority",
    });
    noPriorityItem.addEventListener("click", () => {
      this.formData.priority = undefined;
      this.updatePriorityBadge();
      menu.remove();
    });

    this.plugin.settings.taskPriorities.forEach((priority) => {
      const item = menu.createDiv("task-sync-selector-item");
      const badge = createPriorityBadge(priority);
      item.appendChild(badge);

      item.addEventListener("click", () => {
        onSelect(priority);
        menu.remove();
      });
    });
  }

  private showStatusSelector(
    badgeEl: HTMLElement,
    onSelect: (status: TaskStatus) => void
  ): void {
    const menu = this.createSelectorMenu(badgeEl);

    this.plugin.settings.taskStatuses.forEach((status) => {
      const item = menu.createDiv("task-sync-selector-item");
      const badge = createStatusBadge(status);
      item.appendChild(badge);

      item.addEventListener("click", () => {
        onSelect(status);
        menu.remove();
      });
    });
  }

  private createSelectorMenu(anchorEl: HTMLElement): HTMLElement {
    const menu = document.createElement("div");
    menu.className = "task-sync-selector-menu";

    // Position the menu below the anchor element
    const rect = anchorEl.getBoundingClientRect();
    menu.style.position = "absolute";
    menu.style.top = `${rect.bottom + 5}px`;
    menu.style.left = `${rect.left}px`;
    menu.style.zIndex = "1000";

    document.body.appendChild(menu);

    // Close menu when clicking outside
    const closeMenu = (e: MouseEvent) => {
      if (!menu.contains(e.target as Node)) {
        menu.remove();
        document.removeEventListener("click", closeMenu);
      }
    };
    setTimeout(() => document.addEventListener("click", closeMenu), 0);

    return menu;
  }

  // Badge update methods
  private updateCategoryBadge(): void {
    const selectedType = this.plugin.settings.taskTypes.find(
      (t) => t.name === this.formData.category
    );
    if (selectedType && this.categoryBadge) {
      const newBadge = createTypeBadge(
        selectedType,
        "task-sync-clickable-badge"
      );
      this.categoryBadge.replaceWith(newBadge);
      this.categoryBadge = newBadge;

      // Re-attach click listener
      this.categoryBadge.addEventListener("click", () => {
        this.showTypeSelector(this.categoryBadge, (type: TaskType) => {
          this.formData.category = type.name;
          this.updateCategoryBadge();
        });
      });
    }
  }

  private updatePriorityBadge(): void {
    const selectedPriority = this.plugin.settings.taskPriorities.find(
      (p) => p.name === this.formData.priority
    );

    let newBadge: HTMLElement;
    if (selectedPriority) {
      newBadge = createPriorityBadge(
        selectedPriority,
        "task-sync-clickable-badge"
      );
    } else {
      newBadge = document.createElement("span");
      newBadge.textContent = "Set priority";
      newBadge.className =
        "task-sync-placeholder-badge task-sync-clickable-badge";
    }

    if (this.priorityBadge) {
      this.priorityBadge.replaceWith(newBadge);
      this.priorityBadge = newBadge;

      // Re-attach click listener
      this.priorityBadge.addEventListener("click", () => {
        this.showPrioritySelector(
          this.priorityBadge,
          (priority: TaskPriority) => {
            this.formData.priority = priority.name;
            this.updatePriorityBadge();
          }
        );
      });
    }
  }

  private updateStatusBadge(): void {
    const selectedStatus = this.plugin.settings.taskStatuses.find(
      (s) => s.name === this.formData.status
    );
    if (selectedStatus && this.statusBadge) {
      const newBadge = createStatusBadge(
        selectedStatus,
        "task-sync-clickable-badge"
      );
      this.statusBadge.replaceWith(newBadge);
      this.statusBadge = newBadge;

      // Re-attach click listener
      this.statusBadge.addEventListener("click", () => {
        this.showStatusSelector(this.statusBadge, (status: TaskStatus) => {
          this.formData.status = status.name;
          this.updateStatusBadge();
        });
      });
    }
  }

  // Autocomplete setup methods
  private setupProjectAutocomplete(): void {
    // Get project files from the projects folder
    const projectFiles = this.app.vault
      .getMarkdownFiles()
      .filter((file) =>
        file.path.startsWith(this.plugin.settings.projectsFolder + "/")
      )
      .map((file) => file.basename);

    this.setupAutocomplete(this.projectInput.inputEl, projectFiles);
  }

  private setupAreasAutocomplete(): void {
    // Get area files from the areas folder
    const areaFiles = this.app.vault
      .getMarkdownFiles()
      .filter((file) =>
        file.path.startsWith(this.plugin.settings.areasFolder + "/")
      )
      .map((file) => file.basename);

    this.setupAutocomplete(this.areasInput.inputEl, areaFiles);
  }

  private setupAutocomplete(
    inputEl: HTMLInputElement,
    suggestions: string[]
  ): void {
    let suggestEl: HTMLElement | null = null;

    const showSuggestions = (query: string) => {
      const filtered = suggestions
        .filter((item) => item.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 10);

      if (filtered.length === 0) {
        hideSuggestions();
        return;
      }

      if (!suggestEl) {
        suggestEl = document.createElement("div");
        suggestEl.className = "suggestion-container task-sync-autocomplete";
        inputEl.parentElement?.appendChild(suggestEl);
      }

      suggestEl.innerHTML = "";
      filtered.forEach((item) => {
        const suggestionItem = document.createElement("div");
        suggestionItem.className = "suggestion-item";
        suggestionItem.textContent = item;
        suggestionItem.addEventListener("click", () => {
          inputEl.value = item;
          inputEl.dispatchEvent(new Event("input"));
          hideSuggestions();
        });
        suggestEl!.appendChild(suggestionItem);
      });
    };

    const hideSuggestions = () => {
      if (suggestEl) {
        suggestEl.remove();
        suggestEl = null;
      }
    };

    inputEl.addEventListener("input", (e) => {
      const query = (e.target as HTMLInputElement).value;
      if (query.length > 0) {
        showSuggestions(query);
      } else {
        hideSuggestions();
      }
    });

    inputEl.addEventListener("blur", () => {
      // Delay hiding to allow click on suggestions
      setTimeout(hideSuggestions, 150);
    });

    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        hideSuggestions();
      }
    });
  }

  private async handleSubmit(): Promise<void> {
    // Validate required fields
    if (!this.formData.title?.trim()) {
      this.showError("Task name is required");
      return;
    }

    // Prepare task data
    const taskData: TaskCreateData = {
      title: this.formData.title.trim(),
      category: this.formData.category || undefined,
      areas: this.formData.areas || undefined,
      parentTask: this.formData.parentTask || undefined,
      tags: this.formData.tags || [],
      project: this.formData.project || undefined,
      done: false,
      status:
        this.formData.status ||
        this.plugin.settings.taskStatuses[0]?.name ||
        "Backlog",
      priority: this.formData.priority || undefined,
      content: this.formData.content || undefined,
    };

    try {
      if (this.onSubmitCallback) {
        await this.onSubmitCallback(taskData);
      }
      this.close();
    } catch (error) {
      console.error("Failed to create task:", error);
      this.showError("Failed to create task. Please try again.");
    }
  }

  private showError(message: string): void {
    // Find or create error container
    let errorContainer = this.contentEl.querySelector(
      ".task-sync-error"
    ) as HTMLElement;
    if (!errorContainer) {
      errorContainer = this.contentEl.createDiv("task-sync-error");
      errorContainer.style.color = "var(--text-error)";
      errorContainer.style.marginBottom = "1rem";
      errorContainer.style.padding = "0.5rem";
      errorContainer.style.backgroundColor = "var(--background-modifier-error)";
      errorContainer.style.borderRadius = "4px";
    }
    errorContainer.textContent = message;

    // Auto-hide after 5 seconds
    setTimeout(() => {
      if (errorContainer) {
        errorContainer.remove();
      }
    }, 5000);
  }

  private parseTags(tagsString: string): string[] {
    return tagsString
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
  }

  public onSubmit(callback: (taskData: TaskCreateData) => Promise<void>): void {
    this.onSubmitCallback = callback;
  }

  onClose(): void {
    // Cleanup if needed
  }
}
