<script lang="ts">
  import { onMount } from "svelte";
  import { getPluginContext } from "./context";
  import type { TaskCreateData } from "../modals/TaskCreateModal";
  import type { FileContext } from "../../main";
  import type {
    TaskType,
    TaskPriority,
    TaskStatus,
  } from "../ui/settings/types";
  import { createTypeBadge } from "../ui/TypeBadge";
  import { createPriorityBadge } from "../ui/PriorityBadge";
  import { createStatusBadge } from "../ui/StatusBadge";

  interface Props {
    context: FileContext;
    initialData?: Partial<TaskCreateData>;
    onsubmit?: (data: TaskCreateData) => void;
    oncancel?: () => void;
  }

  let { context, initialData = {}, onsubmit, oncancel }: Props = $props();

  const { plugin } = getPluginContext();

  // Form data
  let formData = $state<TaskCreateData>({
    title: "",
    content: "",
    category: plugin.settings.taskTypes[0]?.name || "Task",
    priority: "",
    status: plugin.settings.taskStatuses[0]?.name || "Backlog",
    project: "",
    areas: [],
    parentTask: "",
    tags: [],
    done: false,
    ...initialData,
  });

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
  let projectInput: HTMLInputElement;
  let areasInput: HTMLInputElement;

  // Autocomplete suggestions
  let projectSuggestions: string[] = [];
  let areaSuggestions: string[] = [];

  onMount(() => {
    // Focus title input
    titleInput?.focus();

    // Setup autocomplete data
    projectSuggestions = plugin.app.vault
      .getMarkdownFiles()
      .filter((file) =>
        file.path.startsWith(plugin.settings.projectsFolder + "/")
      )
      .map((file) => file.basename);

    areaSuggestions = plugin.app.vault
      .getMarkdownFiles()
      .filter((file) => file.path.startsWith(plugin.settings.areasFolder + "/"))
      .map((file) => file.basename);

    // Create initial badges
    updateCategoryBadge();
    updatePriorityBadge();
    updateStatusBadge();
  });

  function updateCategoryBadge() {
    if (!categoryBadgeEl) return;
    const selectedType =
      plugin.settings.taskTypes.find((t) => t.name === formData.category) ||
      plugin.settings.taskTypes[0];

    categoryBadgeEl.innerHTML = "";
    const badge = createTypeBadge(selectedType, "task-sync-clickable-badge");
    categoryBadgeEl.appendChild(badge);
  }

  function updatePriorityBadge() {
    if (!priorityBadgeEl) return;
    const selectedPriority = plugin.settings.taskPriorities.find(
      (p) => p.name === formData.priority
    );

    priorityBadgeEl.innerHTML = "";
    if (selectedPriority) {
      const badge = createPriorityBadge(
        selectedPriority,
        "task-sync-clickable-badge"
      );
      priorityBadgeEl.appendChild(badge);
    } else {
      const placeholder = document.createElement("span");
      placeholder.textContent = "Set priority";
      placeholder.className = "task-sync-placeholder-badge";
      priorityBadgeEl.appendChild(placeholder);
    }
  }

  function updateStatusBadge() {
    if (!statusBadgeEl) return;
    const selectedStatus =
      plugin.settings.taskStatuses.find((s) => s.name === formData.status) ||
      plugin.settings.taskStatuses[0];

    statusBadgeEl.innerHTML = "";
    const badge = createStatusBadge(
      selectedStatus,
      "task-sync-clickable-badge"
    );
    statusBadgeEl.appendChild(badge);
  }

  function handleCategoryClick() {
    // Create dropdown menu for category selection
    showTypeSelector();
  }

  function handlePriorityClick() {
    // Create dropdown menu for priority selection
    showPrioritySelector();
  }

  function handleStatusClick() {
    // Create dropdown menu for status selection
    showStatusSelector();
  }

  function showTypeSelector() {
    // Simple implementation - could be enhanced with a proper dropdown
    const typeNames = plugin.settings.taskTypes.map((t) => t.name);
    const selected = prompt("Select type:", typeNames.join(", "));
    if (selected && typeNames.includes(selected)) {
      formData.category = selected;
      updateCategoryBadge();
    }
  }

  function showPrioritySelector() {
    const priorityNames = plugin.settings.taskPriorities.map((p) => p.name);
    const selected = prompt("Select priority:", priorityNames.join(", "));
    if (selected && priorityNames.includes(selected)) {
      formData.priority = selected;
      updatePriorityBadge();
    }
  }

  function showStatusSelector() {
    const statusNames = plugin.settings.taskStatuses.map((s) => s.name);
    const selected = prompt("Select status:", statusNames.join(", "));
    if (selected && statusNames.includes(selected)) {
      formData.status = selected;
      updateStatusBadge();
    }
  }

  function handleSubmit() {
    if (!formData.title.trim()) {
      titleInput?.focus();
      return;
    }

    onsubmit?.(formData);
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

  // Modal title based on context
  const modalTitle = $derived(
    context.type === "project"
      ? `Create Task for Project: ${context.name}`
      : context.type === "area"
        ? `Create Task for Area: ${context.name}`
        : "Create New Task"
  );
</script>

<div class="task-sync-create-task">
  <div class="task-sync-linear-container">
    <!-- Title Section -->
    <div class="task-sync-title-section">
      {#if context.type !== "none"}
        <div class="task-sync-context-info">
          <span class="task-sync-context-label">
            {context.type === "project" ? "Project:" : "Area:"}
          </span>
          <span class="task-sync-context-value">{context.name}</span>
        </div>
      {/if}

      <input
        bind:this={titleInput}
        bind:value={formData.title}
        type="text"
        placeholder="Task title"
        class="task-sync-title-input"
      />
    </div>

    <!-- Content Section -->
    <div class="task-sync-content-section">
      <textarea
        bind:this={contentTextarea}
        bind:value={formData.content}
        placeholder="Add description..."
        class="task-sync-content-editor"
        rows="8"
      ></textarea>
    </div>

    <!-- Toolbar Section -->
    <div class="task-sync-toolbar">
      <!-- Type Badge -->
      <div
        bind:this={categoryBadgeEl}
        onclick={handleCategoryClick}
        role="button"
        tabindex="0"
        onkeydown={(e) => e.key === "Enter" && handleCategoryClick()}
      ></div>

      <!-- Priority Badge -->
      <div
        bind:this={priorityBadgeEl}
        onclick={handlePriorityClick}
        role="button"
        tabindex="0"
        onkeydown={(e) => e.key === "Enter" && handlePriorityClick()}
      ></div>

      <!-- Status Badge -->
      <div
        bind:this={statusBadgeEl}
        onclick={handleStatusClick}
        role="button"
        tabindex="0"
        onkeydown={(e) => e.key === "Enter" && handleStatusClick()}
      ></div>

      <!-- Project Input -->
      <input
        bind:this={projectInput}
        bind:value={formData.project}
        type="text"
        placeholder="Project"
        class="task-sync-toolbar-input"
        disabled={context.type === "project"}
      />

      <!-- Areas Input -->
      <input
        bind:this={areasInput}
        value={formData.areas.join(", ")}
        oninput={handleAreasChange}
        type="text"
        placeholder="Areas"
        class="task-sync-toolbar-input"
        disabled={context.type === "area"}
      />

      <!-- Parent Task Input -->
      <input
        bind:value={formData.parentTask}
        type="text"
        placeholder="Parent task (optional)"
        class="task-sync-toolbar-input"
      />

      <!-- Tags Input -->
      <input
        value={formData.tags.join(", ")}
        oninput={handleTagsChange}
        type="text"
        placeholder="tag1, tag2, tag3"
        class="task-sync-toolbar-input"
      />
    </div>

    <!-- Action Buttons -->
    <div class="task-sync-action-buttons">
      <button type="button" class="mod-cancel" onclick={handleCancel}>
        Cancel
      </button>
      <button type="button" class="mod-cta" onclick={handleSubmit}>
        Create task
      </button>
    </div>
  </div>
</div>

<style>
  /* Component-specific styles can go here if needed */
  /* Most styles are in the global styles.css */
</style>
