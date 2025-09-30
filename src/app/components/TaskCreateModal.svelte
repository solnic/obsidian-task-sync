<script lang="ts">
  import { onMount } from "svelte";
  import { Notice } from "obsidian";
  import { taskOperations } from "../entities/Tasks";
  import type { Task } from "../core/entities";
  import {
    createTypeBadge,
    createPriorityBadge,
    createStatusBadge,
    DEFAULT_TASK_TYPES,
    DEFAULT_TASK_PRIORITIES,
    DEFAULT_TASK_STATUSES,
    type BadgeConfig,
  } from "../utils/badges";
  import { AbstractInputSuggest } from "obsidian";

  // Autocomplete classes
  class ProjectSuggest extends AbstractInputSuggest<string> {
    projectFiles: string[];

    constructor(app: any, inputEl: HTMLInputElement, projectFiles: string[]) {
      super(app, inputEl);
      this.projectFiles = projectFiles;
    }

    getSuggestions(query: string): string[] {
      return this.projectFiles
        .filter((project) =>
          project.toLowerCase().includes(query.toLowerCase())
        )
        .slice(0, 10);
    }

    renderSuggestion(value: string, el: HTMLElement): void {
      el.createEl("div", { text: value });
    }

    selectSuggestion(value: string): void {
      this.setValue(value);
      this.close();
    }
  }

  class AreaSuggest extends AbstractInputSuggest<string> {
    areaFiles: string[];

    constructor(app: any, inputEl: HTMLInputElement, areaFiles: string[]) {
      super(app, inputEl);
      this.areaFiles = areaFiles;
    }

    getSuggestions(query: string): string[] {
      return this.areaFiles
        .filter((area) => area.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 10);
    }

    renderSuggestion(value: string, el: HTMLElement): void {
      el.createEl("div", { text: value });
    }

    selectSuggestion(value: string): void {
      this.setValue(value);
      this.close();
    }
  }

  interface FileContext {
    type: "project" | "area" | "task" | "none";
    name?: string;
  }

  interface Props {
    obsidianApp: any;
    context?: FileContext;
    onsubmit?: (task: Task) => void;
    oncancel?: () => void;
  }

  let {
    obsidianApp,
    context = { type: "none" },
    onsubmit,
    oncancel,
  }: Props = $props();

  // Form data matching new Task entity
  let formData = $state({
    title: "",
    description: "",
    category: DEFAULT_TASK_TYPES[0].name,
    priority: "",
    status: DEFAULT_TASK_STATUSES[0].name,
    project: "",
    areas: [] as string[],
    parentTask: "",
    tags: [] as string[],
    done: false,
  });

  // UI state
  let showExtraFields = $state(false);

  // Error state for input styling
  let hasTitleError = $state<boolean>(false);

  // Context-aware pre-filling
  $effect(() => {
    if (context.type === "project" && context.name) {
      formData.project = context.name;
    }
    if (context.type === "area" && context.name) {
      formData.areas = [context.name];
    }
  });

  // Badge elements
  let categoryBadgeEl: HTMLElement;
  let priorityBadgeEl: HTMLElement;
  let statusBadgeEl: HTMLElement;

  // Input elements
  let titleInput: HTMLInputElement;
  let contentTextarea: HTMLTextAreaElement;
  let projectInput = $state<HTMLInputElement>();
  let areasInput = $state<HTMLInputElement>();

  // Autocomplete suggestions
  let projectSuggestions: string[] = [];
  let areaSuggestions: string[] = [];

  // Autocomplete instances
  let projectSuggest: ProjectSuggest;
  let areaSuggest: AreaSuggest;

  onMount(() => {
    // Focus title input
    titleInput?.focus();

    // Setup autocomplete data - get from obsidian app if available
    if (obsidianApp?.vault) {
      projectSuggestions = obsidianApp.vault
        .getMarkdownFiles()
        .filter((file: any) => file.path.startsWith("Projects/"))
        .map((file: any) => file.basename);

      areaSuggestions = obsidianApp.vault
        .getMarkdownFiles()
        .filter((file: any) => file.path.startsWith("Areas/"))
        .map((file: any) => file.basename);

      // Setup autocomplete
      if (projectInput) {
        projectSuggest = new ProjectSuggest(
          obsidianApp,
          projectInput,
          projectSuggestions
        );
      }
      if (areasInput) {
        areaSuggest = new AreaSuggest(obsidianApp, areasInput, areaSuggestions);
      }
    }

    // Create initial badges
    updateCategoryBadge();
    updatePriorityBadge();
    updateStatusBadge();
  });

  function updateCategoryBadge() {
    if (!categoryBadgeEl) return;
    const selectedType =
      DEFAULT_TASK_TYPES.find((t) => t.name === formData.category) ||
      DEFAULT_TASK_TYPES[0];

    categoryBadgeEl.innerHTML = "";

    // Create color dot
    const dot = document.createElement("span");
    dot.className = "task-sync-color-dot";
    dot.style.backgroundColor = selectedType.color;

    // Create label
    const label = document.createElement("span");
    label.textContent = selectedType.name;

    categoryBadgeEl.appendChild(dot);
    categoryBadgeEl.appendChild(label);
  }

  function updatePriorityBadge() {
    if (!priorityBadgeEl) return;
    const selectedPriority = DEFAULT_TASK_PRIORITIES.find(
      (p) => p.name === formData.priority
    );

    priorityBadgeEl.innerHTML = "";
    if (selectedPriority) {
      // Create color dot
      const dot = document.createElement("span");
      dot.className = "task-sync-color-dot";
      dot.style.backgroundColor = selectedPriority.color;

      // Create label
      const label = document.createElement("span");
      label.textContent = selectedPriority.name;

      priorityBadgeEl.appendChild(dot);
      priorityBadgeEl.appendChild(label);
    } else {
      const label = document.createElement("span");
      label.textContent = "Priority";
      priorityBadgeEl.appendChild(label);
    }
  }

  function toggleExtraFields() {
    showExtraFields = !showExtraFields;
  }

  function updateStatusBadge() {
    if (!statusBadgeEl) return;
    const selectedStatus =
      DEFAULT_TASK_STATUSES.find((s) => s.name === formData.status) ||
      DEFAULT_TASK_STATUSES[0];

    statusBadgeEl.innerHTML = "";

    // Create color dot
    const dot = document.createElement("span");
    dot.className = "task-sync-color-dot";
    dot.style.backgroundColor = selectedStatus.color;

    // Create label
    const label = document.createElement("span");
    label.textContent = selectedStatus.name;

    statusBadgeEl.appendChild(dot);
    statusBadgeEl.appendChild(label);
  }

  function handleCategoryClick() {
    showTypeSelector();
  }

  function handlePriorityClick() {
    showPrioritySelector();
  }

  function handleProjectClick() {
    showProjectSelector();
  }

  function showProjectSelector() {
    if (!projectSuggestions.length) return;

    const projectButton = document.querySelector(
      ".task-sync-text-button"
    ) as HTMLElement;
    if (!projectButton) return;

    const menu = createSelectorMenu(projectButton);

    projectSuggestions.forEach((projectName) => {
      const item = menu.createDiv("task-sync-selector-item");
      item.textContent = projectName;
      item.addEventListener("click", () => {
        formData.project = projectName;
        menu.remove();
      });
    });
  }

  function handleStatusClick() {
    showStatusSelector();
  }

  function showTypeSelector() {
    const menu = createSelectorMenu(categoryBadgeEl);

    DEFAULT_TASK_TYPES.forEach((type) => {
      const item = menu.createDiv("task-sync-selector-item");
      const badge = createTypeBadge(type);
      item.appendChild(badge);

      item.addEventListener("click", () => {
        formData.category = type.name;
        updateCategoryBadge();
        menu.remove();
      });
    });
  }

  function showPrioritySelector() {
    const menu = createSelectorMenu(priorityBadgeEl);

    // Add "No priority" option
    const noPriorityItem = menu.createDiv("task-sync-selector-item");
    noPriorityItem.createEl("span", {
      text: "No priority",
      cls: "task-sync-no-priority",
    });
    noPriorityItem.addEventListener("click", () => {
      formData.priority = "";
      updatePriorityBadge();
      menu.remove();
    });

    DEFAULT_TASK_PRIORITIES.forEach((priority) => {
      const item = menu.createDiv("task-sync-selector-item");
      const badge = createPriorityBadge(priority);
      item.appendChild(badge);

      item.addEventListener("click", () => {
        formData.priority = priority.name;
        updatePriorityBadge();
        menu.remove();
      });
    });
  }

  function showStatusSelector() {
    const menu = createSelectorMenu(statusBadgeEl);

    DEFAULT_TASK_STATUSES.forEach((status) => {
      const item = menu.createDiv("task-sync-selector-item");
      const badge = createStatusBadge(status);
      item.appendChild(badge);

      item.addEventListener("click", () => {
        formData.status = status.name;
        updateStatusBadge();
        menu.remove();
      });
    });
  }

  function createSelectorMenu(anchorEl: HTMLElement): HTMLElement {
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

  async function handleSubmit() {
    // Clear previous errors
    hasTitleError = false;

    // Validate required fields
    if (!formData.title?.trim()) {
      hasTitleError = true;
      new Notice("Task title is required");
      titleInput?.focus();
      return;
    }

    try {
      // Prepare task data for new entities system
      const taskTitle = formData.title.trim();
      const taskData: Omit<Task, "id" | "createdAt" | "updatedAt"> = {
        title: taskTitle,
        description: formData.description?.trim() || undefined,
        status: formData.status,
        done: formData.done,
        category: formData.category,
        priority: formData.priority || undefined,
        parentTask: formData.parentTask || undefined,
        project: formData.project || undefined,
        areas: formData.areas,
        tags: formData.tags,
        source: {
          extension: "obsidian",
          filePath: `Tasks/${taskTitle}.md`,
        },
      };

      // Create task using new entities system
      const createdTask = await taskOperations.create(taskData);

      new Notice(`Task "${createdTask.title}" created successfully`);

      // Call onsubmit if provided
      if (onsubmit) {
        onsubmit(createdTask);
      } else {
        // Close modal directly if no handler
        oncancel();
      }
    } catch (error) {
      console.error("Failed to create task:", error);
      new Notice(`Failed to create task: ${error.message}`);
    }
  }

  function handleCancel() {
    oncancel?.();
  }

  function handleAreasChange(event: Event) {
    const target = event.target as HTMLInputElement;
    formData.areas = target.value
      .split(",")
      .map((a) => a.trim())
      .filter((a) => a);
  }

  function handleTagsChange(event: Event) {
    const target = event.target as HTMLInputElement;
    formData.tags = target.value
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t);
  }
</script>

<div class="task-sync-modal-container">
  <!-- Main content area -->
  <div class="task-sync-main-content">
    <!-- Title input -->
    <input
      bind:this={titleInput}
      bind:value={formData.title}
      oninput={() => (hasTitleError = false)}
      type="text"
      placeholder="Task title"
      class="task-sync-title-input"
      class:task-sync-input-error={hasTitleError}
      data-testid="title-input"
    />

    <!-- Description textarea -->
    <textarea
      bind:this={contentTextarea}
      bind:value={formData.description}
      placeholder="Add description..."
      class="task-sync-description-input"
      data-testid="description-input"
      rows="8"
    ></textarea>
  </div>

  <!-- Properties toolbar -->
  <div class="task-sync-properties-toolbar">
    <!-- Main property controls row -->
    <div class="task-sync-property-controls">
      <!-- Status Button -->
      <button
        type="button"
        bind:this={statusBadgeEl}
        onclick={handleStatusClick}
        class="task-sync-property-button"
        data-testid="status-badge"
        aria-label="Select status"
      ></button>

      <!-- Type Button -->
      <button
        type="button"
        bind:this={categoryBadgeEl}
        onclick={handleCategoryClick}
        class="task-sync-property-button"
        data-testid="type-badge"
        aria-label="Select type"
      ></button>

      <!-- Priority Button -->
      <button
        type="button"
        bind:this={priorityBadgeEl}
        onclick={handlePriorityClick}
        class="task-sync-property-button"
        data-testid="priority-badge"
        aria-label="Select priority"
      ></button>

      <!-- Project Button (only if not in project context) -->
      {#if context.type !== "project"}
        <button
          type="button"
          onclick={handleProjectClick}
          class="task-sync-property-button task-sync-text-button"
          data-testid="project-button"
        >
          <span class="task-sync-button-label">
            {formData.project || "Project"}
          </span>
        </button>
      {/if}

      <!-- More options button -->
      <button
        type="button"
        onclick={toggleExtraFields}
        class="task-sync-property-button task-sync-more-button"
        data-testid="more-options-button"
        title="More options"
      >
        <span class="task-sync-more-dots">⋯</span>
      </button>
    </div>

    <!-- Extra fields (collapsible) -->
    {#if showExtraFields}
      <div class="task-sync-extra-fields">
        <!-- Areas Input (only if not in area context) -->
        {#if context.type !== "area"}
          <div class="task-sync-field-group">
            <label class="task-sync-field-label" for="areas-input">Areas</label>
            <input
              id="areas-input"
              bind:this={areasInput}
              value={formData.areas.join(", ")}
              oninput={handleAreasChange}
              type="text"
              placeholder="Enter areas..."
              class="task-sync-field-input"
              data-testid="areas-input"
            />
          </div>
        {/if}

        <!-- Parent Task Input -->
        <div class="task-sync-field-group">
          <label class="task-sync-field-label" for="parent-task-input"
            >Parent Task</label
          >
          <input
            id="parent-task-input"
            bind:value={formData.parentTask}
            type="text"
            placeholder="Link to parent task..."
            class="task-sync-field-input"
          />
        </div>

        <!-- Tags Input -->
        <div class="task-sync-field-group">
          <label class="task-sync-field-label" for="tags-input">Tags</label>
          <input
            id="tags-input"
            value={formData.tags.join(", ")}
            oninput={handleTagsChange}
            type="text"
            placeholder="Enter tags..."
            class="task-sync-field-input"
          />
        </div>
      </div>
    {/if}
  </div>

  <!-- Footer with action buttons -->
  <div class="task-sync-modal-footer">
    <div class="task-sync-footer-actions">
      <button
        type="button"
        class="task-sync-cancel-button"
        data-testid="cancel-button"
        onclick={handleCancel}
      >
        Cancel
      </button>
      <button
        type="button"
        class="task-sync-create-button mod-cta"
        data-testid="create-button"
        onclick={handleSubmit}
      >
        Create task
      </button>
    </div>
  </div>
</div>
