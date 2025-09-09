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
  let projectInput = $state<HTMLInputElement>();
  let areasInput = $state<HTMLInputElement>();

  // UI state
  let showMoreProperties = $state(false);

  // Autocomplete suggestions
  let projectSuggestions: string[] = [];
  let areaSuggestions: string[] = [];

  // Autocomplete instances
  let projectSuggest: ProjectSuggest;
  let areaSuggest: AreaSuggest;

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

    // Setup autocomplete
    if (projectInput) {
      projectSuggest = new ProjectSuggest(
        plugin.app,
        projectInput,
        projectSuggestions
      );
    }
    if (areasInput) {
      areaSuggest = new AreaSuggest(plugin.app, areasInput, areaSuggestions);
    }

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
    const menu = createSelectorMenu(categoryBadgeEl);

    plugin.settings.taskTypes.forEach((type) => {
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

    plugin.settings.taskPriorities.forEach((priority) => {
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

    plugin.settings.taskStatuses.forEach((status) => {
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

  function toggleMoreProperties() {
    showMoreProperties = !showMoreProperties;
  }
</script>

<div class="task-sync-modal-container">
  <!-- Header with context and action buttons -->
  <div class="task-sync-modal-header">
    {#if context.type !== "none"}
      <div class="task-sync-context-badge">
        <span class="task-sync-context-icon">
          {context.type === "project" ? "📁" : "🏷️"}
        </span>
        <span class="task-sync-context-name">{context.name}</span>
      </div>
    {/if}

    <div class="task-sync-header-actions">
      <button type="button" class="task-sync-save-draft" onclick={handleCancel}>
        Save as draft
      </button>
      <button
        type="button"
        class="task-sync-create-button"
        onclick={handleSubmit}
      >
        Create issue
      </button>
    </div>
  </div>

  <!-- Main content area -->
  <div class="task-sync-main-content">
    <!-- Title input -->
    <div class="task-sync-title-container">
      <input
        bind:this={titleInput}
        bind:value={formData.title}
        type="text"
        placeholder="Issue title"
        class="task-sync-title-input"
      />
    </div>

    <!-- Description textarea -->
    <div class="task-sync-description-container">
      <textarea
        bind:this={contentTextarea}
        bind:value={formData.content}
        placeholder="Add description..."
        class="task-sync-description-input"
        rows="6"
      ></textarea>
    </div>
  </div>

  <!-- Properties toolbar -->
  <div class="task-sync-properties-toolbar">
    <!-- Property badges row -->
    <div class="task-sync-property-badges">
      <!-- Type Badge -->
      <div
        bind:this={categoryBadgeEl}
        onclick={handleCategoryClick}
        role="button"
        tabindex="0"
        onkeydown={(e) => e.key === "Enter" && handleCategoryClick()}
        class="task-sync-property-badge"
      ></div>

      <!-- Priority Badge -->
      <div
        bind:this={priorityBadgeEl}
        onclick={handlePriorityClick}
        role="button"
        tabindex="0"
        onkeydown={(e) => e.key === "Enter" && handlePriorityClick()}
        class="task-sync-property-badge"
      ></div>

      <!-- Status Badge -->
      <div
        bind:this={statusBadgeEl}
        onclick={handleStatusClick}
        role="button"
        tabindex="0"
        onkeydown={(e) => e.key === "Enter" && handleStatusClick()}
        class="task-sync-property-badge"
      ></div>

      <!-- Project Badge -->
      {#if context.type !== "project"}
        <div class="task-sync-property-badge task-sync-project-badge">
          <span class="task-sync-badge-icon">📁</span>
          <input
            bind:this={projectInput}
            bind:value={formData.project}
            type="text"
            placeholder="Project"
            class="task-sync-badge-input"
          />
        </div>
      {/if}

      <!-- Areas Badge -->
      {#if context.type !== "area"}
        <div class="task-sync-property-badge task-sync-areas-badge">
          <span class="task-sync-badge-icon">🏷️</span>
          <input
            bind:this={areasInput}
            value={formData.areas.join(", ")}
            oninput={handleAreasChange}
            type="text"
            placeholder="Areas"
            class="task-sync-badge-input"
          />
        </div>
      {/if}

      <!-- More properties button -->
      <button class="task-sync-more-properties" onclick={toggleMoreProperties}>
        <span class="task-sync-more-icon">⋯</span>
      </button>
    </div>

    <!-- Additional properties (hidden by default) -->
    {#if showMoreProperties}
      <div class="task-sync-additional-properties">
        <!-- Parent Task Input -->
        <div class="task-sync-property-field">
          <label for="parent-task-input">Parent task</label>
          <input
            id="parent-task-input"
            bind:value={formData.parentTask}
            type="text"
            placeholder="Parent task (optional)"
            class="task-sync-field-input"
          />
        </div>

        <!-- Tags Input -->
        <div class="task-sync-property-field">
          <label for="tags-input">Tags</label>
          <input
            id="tags-input"
            value={formData.tags.join(", ")}
            oninput={handleTagsChange}
            type="text"
            placeholder="tag1, tag2, tag3"
            class="task-sync-field-input"
          />
        </div>
      </div>
    {/if}
  </div>

  <!-- Footer with create more toggle -->
  <div class="task-sync-modal-footer">
    <div class="task-sync-create-more">
      <input type="checkbox" id="create-more" />
      <label for="create-more">Create more</label>
    </div>
  </div>
</div>
