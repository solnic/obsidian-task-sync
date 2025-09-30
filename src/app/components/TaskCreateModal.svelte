<script lang="ts">
  import { onMount } from "svelte";
  import { Notice } from "obsidian";
  import { taskOperations } from "../entities/Tasks";
  import type { Task } from "../core/entities";
  import {
    createTypeBadge,
    createPriorityBadge,
    createStatusBadge,
  } from "../utils/badges";
  import type { TaskSyncSettings } from "../types/settings";
  import Dropdown from "./Dropdown.svelte";
  import Autocomplete from "./Autocomplete.svelte";

  interface FileContext {
    type: "project" | "area" | "task" | "none";
    name?: string;
  }

  interface Props {
    obsidianApp: any;
    settings: TaskSyncSettings;
    context?: FileContext;
    onsubmit?: (task: Task) => void;
    oncancel?: () => void;
  }

  let {
    obsidianApp,
    settings,
    context = { type: "none" },
    onsubmit,
    oncancel,
  }: Props = $props();

  // Form data matching new Task entity
  let formData = $state({
    title: "",
    description: "",
    category: settings.taskTypes[0]?.name || "",
    priority: "",
    status: settings.taskStatuses[0]?.name || "",
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

  // Dropdown state
  let showCategoryDropdown = $state(false);
  let showPriorityDropdown = $state(false);
  let showStatusDropdown = $state(false);

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
  let categoryBadgeEl = $state<HTMLElement | null>(null);
  let priorityBadgeEl = $state<HTMLElement | null>(null);
  let statusBadgeEl = $state<HTMLElement | null>(null);

  // Input elements
  let titleInput: HTMLInputElement;
  let contentTextarea: HTMLTextAreaElement;

  // Autocomplete suggestions and values
  let projectSuggestions = $state<string[]>([]);
  let areaSuggestions = $state<string[]>([]);
  let areasInputValue = $state("");

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
    }

    // Create initial badges
    updateCategoryBadge();
    updatePriorityBadge();
    updateStatusBadge();
  });

  function updateCategoryBadge() {
    if (!categoryBadgeEl) return;
    const selectedType =
      settings.taskTypes.find((t) => t.name === formData.category) ||
      settings.taskTypes[0];

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
    const selectedPriority = settings.taskPriorities.find(
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
      settings.taskStatuses.find((s) => s.name === formData.status) ||
      settings.taskStatuses[0];

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

  // Dropdown handlers
  function handleCategoryClick() {
    showCategoryDropdown = true;
  }

  function handlePriorityClick() {
    showPriorityDropdown = true;
  }

  function handleStatusClick() {
    showStatusDropdown = true;
  }

  function handleCategorySelect(categoryName: string) {
    formData.category = categoryName;
    updateCategoryBadge();
    showCategoryDropdown = false;
  }

  function handlePrioritySelect(priorityName: string) {
    formData.priority = priorityName;
    updatePriorityBadge();
    showPriorityDropdown = false;
  }

  function handleStatusSelect(statusName: string) {
    formData.status = statusName;
    updateStatusBadge();
    showStatusDropdown = false;
  }

  // Convert settings to dropdown items
  let categoryItems = $derived(
    settings.taskTypes.map((type) => ({
      value: type.name,
      label: type.name,
      customContent: createTypeBadge(type).outerHTML,
    }))
  );

  let priorityItems = $derived([
    { value: "", label: "No priority" },
    ...settings.taskPriorities.map((priority) => ({
      value: priority.name,
      label: priority.name,
      customContent: createPriorityBadge(priority).outerHTML,
    })),
  ]);

  let statusItems = $derived(
    settings.taskStatuses.map((status) => ({
      value: status.name,
      label: status.name,
      customContent: createStatusBadge(status).outerHTML,
    }))
  );

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

  function handleAreasInput(value: string) {
    // Parse comma-separated areas
    formData.areas = value
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

      <!-- Project field moved to extra fields section -->

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
        <!-- Project Input (only if not in project context) -->
        {#if context.type !== "project"}
          <div class="task-sync-field-group">
            <label class="task-sync-field-label" for="project-input"
              >Project</label
            >
            <Autocomplete
              bind:value={formData.project}
              suggestions={projectSuggestions}
              placeholder="Type to search projects..."
              onInput={(value) => (formData.project = value)}
              testId="project-input"
            />
          </div>
        {/if}

        <!-- Areas Input (only if not in area context) -->
        {#if context.type !== "area"}
          <div class="task-sync-field-group">
            <label class="task-sync-field-label" for="areas-input">Areas</label>
            <Autocomplete
              bind:value={areasInputValue}
              suggestions={areaSuggestions}
              placeholder="Type to search areas..."
              onInput={handleAreasInput}
              testId="areas-input"
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

  <!-- Dropdowns -->
  {#if showCategoryDropdown && categoryBadgeEl}
    <Dropdown
      anchor={categoryBadgeEl}
      items={categoryItems}
      selectedValue={formData.category}
      onSelect={handleCategorySelect}
      onClose={() => (showCategoryDropdown = false)}
      testId="category-dropdown"
    />
  {/if}

  {#if showPriorityDropdown && priorityBadgeEl}
    <Dropdown
      anchor={priorityBadgeEl}
      items={priorityItems}
      selectedValue={formData.priority}
      onSelect={handlePrioritySelect}
      onClose={() => (showPriorityDropdown = false)}
      testId="priority-dropdown"
    />
  {/if}

  {#if showStatusDropdown && statusBadgeEl}
    <Dropdown
      anchor={statusBadgeEl}
      items={statusItems}
      selectedValue={formData.status}
      onSelect={handleStatusSelect}
      onClose={() => (showStatusDropdown = false)}
      testId="status-dropdown"
    />
  {/if}
</div>
