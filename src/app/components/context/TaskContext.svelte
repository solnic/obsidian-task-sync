<script lang="ts">
  /**
   * TaskContext - Displays task properties in the context widget
   * Uses semantic HTML with dl/dt/dd for property lists
   */

  import type { Task, Project, Area } from "../../core/entities";
  import type { Host } from "../../core/host";
  import type { SelectOption } from "../../core/note-kit";
  import Dropdown from "../Dropdown.svelte";
  import { Tasks } from "../../entities/Tasks";
  import SourceContext from "./source/SourceContext.svelte";

  interface Props {
    task: Task;
    host: Host;
    settings: any;
    allProjects: Project[];
    allAreas: Area[];
  }

  let { task, host, settings, allProjects, allAreas }: Props = $props();

  // State for dropdowns
  let showStatusDropdown = $state(false);
  let showPriorityDropdown = $state(false);
  let showCategoryDropdown = $state(false);
  let showProjectDropdown = $state(false);
  let showAreasDropdown = $state(false);

  // Button refs for dropdown anchoring
  let statusButtonEl = $state<HTMLButtonElement | null>(null);
  let priorityButtonEl = $state<HTMLButtonElement | null>(null);
  let categoryButtonEl = $state<HTMLButtonElement | null>(null);
  let projectButtonEl = $state<HTMLButtonElement | null>(null);
  let areasButtonEl = $state<HTMLButtonElement | null>(null);

  // Date input refs
  let doDateInputEl = $state<HTMLInputElement | null>(null);
  let dueDateInputEl = $state<HTMLInputElement | null>(null);

  // Get options from registered Task note type
  const statusOptions = $derived.by(() => {
    const obsidianExtension = host.getExtensionById("obsidian") as any;
    if (!obsidianExtension?.typeNote) return [];

    const taskNoteType = obsidianExtension.typeNote.registry.get("task");
    if (!taskNoteType?.properties?.status?.selectOptions) return [];

    return taskNoteType.properties.status.selectOptions.map((s: SelectOption) => ({
      value: s.value,
      label: s.value,
      customContent: `<span class="task-sync-color-dot" style="background-color: ${s.color}"></span><span>${s.value}</span>`,
    }));
  });

  const priorityOptions = $derived.by(() => {
    const obsidianExtension = host.getExtensionById("obsidian") as any;
    if (!obsidianExtension?.typeNote) return [];

    const taskNoteType = obsidianExtension.typeNote.registry.get("task");
    if (!taskNoteType?.properties?.priority?.selectOptions) return [];

    return taskNoteType.properties.priority.selectOptions.map((p: SelectOption) => ({
      value: p.value,
      label: p.value,
      customContent: `<span class="task-sync-color-dot" style="background-color: ${p.color}"></span><span>${p.value}</span>`,
    }));
  });

  const categoryOptions = $derived.by(() => {
    const obsidianExtension = host.getExtensionById("obsidian") as any;
    if (!obsidianExtension?.typeNote) return [];

    const taskNoteType = obsidianExtension.typeNote.registry.get("task");
    if (!taskNoteType?.properties?.category?.selectOptions) return [];

    return taskNoteType.properties.category.selectOptions.map((c: SelectOption) => ({
      value: c.value,
      label: c.value,
      customContent: `<span class="task-sync-color-dot" style="background-color: ${c.color}"></span><span>${c.value}</span>`,
    }));
  });

  const projectOptions = $derived.by(() => [
    { value: "", label: "No project" },
    ...allProjects.map((p) => ({
      value: p.name,
      label: p.name,
    })),
  ]);

  const areaOptions = $derived.by(() =>
    allAreas.map((a) => ({
      value: a.name,
      label: a.name,
    }))
  );

  // Handlers
  async function handleStatusSelect(value: string) {
    const taskOps = new Tasks.Operations(settings);
    await taskOps.update({
      ...task,
      status: value,
      done: value === "Done",
    });
    showStatusDropdown = false;
  }

  async function handlePrioritySelect(value: string) {
    const taskOps = new Tasks.Operations(settings);
    await taskOps.update({
      ...task,
      priority: value,
    });
    showPriorityDropdown = false;
  }

  async function handleCategorySelect(value: string) {
    const taskOps = new Tasks.Operations(settings);
    await taskOps.update({
      ...task,
      category: value,
    });
    showCategoryDropdown = false;
  }

  async function handleProjectSelect(value: string) {
    const taskOps = new Tasks.Operations(settings);
    await taskOps.update({
      ...task,
      project: value || "",
    });
    showProjectDropdown = false;
  }

  async function handleAreasSelect(value: string) {
    const taskOps = new Tasks.Operations(settings);
    const currentAreas = task.areas || [];
    const newAreas = currentAreas.includes(value)
      ? currentAreas.filter((a) => a !== value)
      : [...currentAreas, value];

    await taskOps.update({
      ...task,
      areas: newAreas,
    });
    // Don't close dropdown - allow multi-select
  }

  async function handleRemoveArea(areaToRemove: string) {
    const taskOps = new Tasks.Operations(settings);
    const currentAreas = task.areas || [];
    const newAreas = currentAreas.filter((a) => a !== areaToRemove);

    await taskOps.update({
      ...task,
      areas: newAreas,
    });
  }

  // Date formatting and handling
  function formatDate(date: Date | undefined): string {
    if (!date) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function parseDate(dateString: string): Date | undefined {
    if (!dateString) return undefined;
    // Parse YYYY-MM-DD in local timezone
    const [year, month, day] = dateString.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return isNaN(date.getTime()) ? undefined : date;
  }

  async function handleDoDateChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const newDate = parseDate(target.value);
    const taskOps = new Tasks.Operations(settings);
    await taskOps.update({
      ...task,
      doDate: newDate,
    });
  }

  async function handleDueDateChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const newDate = parseDate(target.value);
    const taskOps = new Tasks.Operations(settings);
    await taskOps.update({
      ...task,
      dueDate: newDate,
    });
  }

  // Update button content with color dots
  function updateStatusButton() {
    if (!statusButtonEl) return;
    statusButtonEl.innerHTML = "";

    const status = task.status;
    if (status) {
      const statusConfig = settings?.taskStatuses?.find(
        (s: any) => s.name === status
      );
      if (statusConfig) {
        const dot = document.createElement("span");
        dot.className = "task-sync-color-dot";
        dot.style.backgroundColor = statusConfig.color;

        const label = document.createElement("span");
        label.textContent = status;

        statusButtonEl.appendChild(dot);
        statusButtonEl.appendChild(label);
      }
    } else {
      const label = document.createElement("span");
      label.textContent = "Set status";
      label.style.color = "var(--text-muted)";
      statusButtonEl.appendChild(label);
    }
  }

  function updatePriorityButton() {
    if (!priorityButtonEl) return;
    priorityButtonEl.innerHTML = "";

    const priority = task.priority;
    if (priority) {
      const priorityConfig = settings?.taskPriorities?.find(
        (p: any) => p.name === priority
      );
      if (priorityConfig) {
        const dot = document.createElement("span");
        dot.className = "task-sync-color-dot";
        dot.style.backgroundColor = priorityConfig.color;

        const label = document.createElement("span");
        label.textContent = priority;

        priorityButtonEl.appendChild(dot);
        priorityButtonEl.appendChild(label);
      }
    } else {
      const label = document.createElement("span");
      label.textContent = "Set priority";
      label.style.color = "var(--text-muted)";
      priorityButtonEl.appendChild(label);
    }
  }

  function updateCategoryButton() {
    if (!categoryButtonEl) return;
    categoryButtonEl.innerHTML = "";

    const category = task.category;
    if (category) {
      const categoryConfig = settings?.taskCategories?.find(
        (t: any) => t.name === category
      );
      if (categoryConfig) {
        const dot = document.createElement("span");
        dot.className = "task-sync-color-dot";
        dot.style.backgroundColor = categoryConfig.color;

        const label = document.createElement("span");
        label.textContent = category;

        categoryButtonEl.appendChild(dot);
        categoryButtonEl.appendChild(label);
      }
    } else {
      const label = document.createElement("span");
      label.textContent = "Set category";
      label.style.color = "var(--text-muted)";
      categoryButtonEl.appendChild(label);
    }
  }

  function updateProjectButton() {
    if (!projectButtonEl) return;
    projectButtonEl.innerHTML = "";

    const project = task.project;
    const label = document.createElement("span");
    label.textContent = project || "Add to project";
    if (!project) {
      label.style.color = "var(--text-muted)";
    }
    projectButtonEl.appendChild(label);
  }

  function updateAreasButton() {
    if (!areasButtonEl) return;
    areasButtonEl.innerHTML = "";

    const areas = task.areas || [];

    if (areas.length === 0) {
      const label = document.createElement("span");
      label.textContent = "Add to area";
      label.style.color = "var(--text-muted)";
      areasButtonEl.appendChild(label);
    } else {
      // Create container for badges
      const container = document.createElement("div");
      container.style.display = "flex";
      container.style.flexWrap = "wrap";
      container.style.gap = "4px";
      container.style.alignItems = "center";

      areas.forEach((area) => {
        // Create badge
        const badge = document.createElement("span");
        badge.className = "task-sync-text-badge";
        badge.style.display = "inline-flex";
        badge.style.alignItems = "center";
        badge.style.gap = "4px";
        badge.style.paddingRight = "4px";

        // Area name
        const areaName = document.createElement("span");
        areaName.textContent = area;
        badge.appendChild(areaName);

        // Remove button
        const removeBtn = document.createElement("span");
        removeBtn.textContent = "×";
        removeBtn.style.cursor = "pointer";
        removeBtn.style.fontSize = "14px";
        removeBtn.style.fontWeight = "bold";
        removeBtn.style.opacity = "0.7";
        removeBtn.style.transition = "opacity 0.2s";
        removeBtn.title = `Remove ${area}`;

        removeBtn.onmouseenter = () => {
          removeBtn.style.opacity = "1";
        };
        removeBtn.onmouseleave = () => {
          removeBtn.style.opacity = "0.7";
        };

        removeBtn.onclick = async (e) => {
          e.stopPropagation();
          await handleRemoveArea(area);
        };

        badge.appendChild(removeBtn);
        container.appendChild(badge);
      });

      areasButtonEl.appendChild(container);
    }
  }

  // Update buttons when task changes
  $effect(() => {
    updateStatusButton();
    updatePriorityButton();
    updateCategoryButton();
    updateProjectButton();
    updateAreasButton();
  });
</script>

<div class="task-context">
  <!-- Primary properties - inline badges -->
  <div class="context-badges-row">
    <button
      bind:this={statusButtonEl}
      type="button"
      onclick={() => (showStatusDropdown = true)}
      class="task-sync-property-button mod-minimal mod-compact"
      data-testid="context-status-button"
      aria-label="Change status"
    ></button>
    <button
      bind:this={categoryButtonEl}
      type="button"
      onclick={() => (showCategoryDropdown = true)}
      class="task-sync-property-button mod-minimal mod-compact"
      data-testid="context-category-button"
      aria-label="Change category"
    ></button>
    <button
      bind:this={priorityButtonEl}
      type="button"
      onclick={() => (showPriorityDropdown = true)}
      class="task-sync-property-button mod-minimal mod-compact"
      data-testid="context-priority-button"
      aria-label="Change priority"
    ></button>
  </div>

  <!-- Project & Areas - inline -->
  <div class="context-meta-row">
    <div class="context-meta-item">
      <span class="context-meta-label">Project</span>
      <button
        bind:this={projectButtonEl}
        type="button"
        onclick={() => (showProjectDropdown = true)}
        class="task-sync-property-button mod-minimal mod-inline"
        data-testid="context-project-button"
        aria-label="Change project"
      ></button>
    </div>
    <div class="context-meta-item">
      <span class="context-meta-label">Area</span>
      <button
        bind:this={areasButtonEl}
        type="button"
        onclick={() => (showAreasDropdown = true)}
        class="task-sync-property-button mod-minimal mod-inline"
        data-testid="context-areas-button"
        aria-label="Change areas"
      ></button>
    </div>
  </div>

  <!-- Dates - inline on same row -->
  <div class="context-dates-row">
    <div class="context-date-item">
      <span class="context-date-label">Do</span>
      <input
        bind:this={doDateInputEl}
        type="date"
        value={formatDate(task.doDate)}
        onchange={handleDoDateChange}
        class="task-sync-date-input mod-compact"
        data-testid="context-dodate-input"
        aria-label="Change do date"
      />
    </div>
    <div class="context-date-item">
      <span class="context-date-label">Due</span>
      <input
        bind:this={dueDateInputEl}
        type="date"
        value={formatDate(task.dueDate)}
        onchange={handleDueDateChange}
        class="task-sync-date-input mod-compact"
        data-testid="context-duedate-input"
        aria-label="Change due date"
      />
    </div>
  </div>

  <!-- Source information -->
  <SourceContext {task} />

  <!-- Dropdowns -->
  {#if showStatusDropdown && statusButtonEl}
    <Dropdown
      anchor={statusButtonEl}
      items={statusOptions}
      selectedValue={task.status}
      onSelect={handleStatusSelect}
      onClose={() => (showStatusDropdown = false)}
      testId="context-status-dropdown"
    />
  {/if}

  {#if showPriorityDropdown && priorityButtonEl}
    <Dropdown
      anchor={priorityButtonEl}
      items={priorityOptions}
      selectedValue={task.priority}
      onSelect={handlePrioritySelect}
      onClose={() => (showPriorityDropdown = false)}
      testId="context-priority-dropdown"
    />
  {/if}

  {#if showCategoryDropdown && categoryButtonEl}
    <Dropdown
      anchor={categoryButtonEl}
      items={categoryOptions}
      selectedValue={task.category}
      onSelect={handleCategorySelect}
      onClose={() => (showCategoryDropdown = false)}
      testId="context-category-dropdown"
    />
  {/if}

  {#if showProjectDropdown && projectButtonEl}
    <Dropdown
      anchor={projectButtonEl}
      items={projectOptions}
      selectedValue={task.project}
      onSelect={handleProjectSelect}
      onClose={() => (showProjectDropdown = false)}
      searchable={true}
      searchPlaceholder="Search projects..."
      testId="context-project-dropdown"
    />
  {/if}

  {#if showAreasDropdown && areasButtonEl}
    <Dropdown
      anchor={areasButtonEl}
      items={areaOptions}
      selectedValues={task.areas || []}
      onSelect={handleAreasSelect}
      onClose={() => (showAreasDropdown = false)}
      searchable={true}
      searchPlaceholder="Search areas..."
      keepOpenOnSelect={true}
      testId="context-areas-dropdown"
    />
  {/if}
</div>

<style>
  .task-context {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  /* Compact badges row - horizontal layout */
  .context-badges-row {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    align-items: center;
    padding: 6px 0;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  /* Meta row for project/area - horizontal inline */
  .context-meta-row {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;
    padding: 6px 0;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .context-meta-item {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
    min-width: 0;
  }

  .context-meta-label {
    font-size: 10px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.3px;
    flex-shrink: 0;
  }

  /* Dates row - horizontal inline */
  .context-dates-row {
    display: flex;
    gap: 12px;
    align-items: center;
    padding: 6px 0;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .context-date-item {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
    min-width: 0;
  }

  .context-date-label {
    font-size: 10px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.3px;
    flex-shrink: 0;
  }

  /* Compact property buttons */
  :global(.task-sync-property-button.mod-compact) {
    padding: 4px 8px !important;
    font-size: 12px !important;
    min-height: 24px !important;
  }

  :global(.task-sync-property-button.mod-inline) {
    padding: 2px 6px !important;
    font-size: 11px !important;
    flex: 1;
    min-width: 0;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Compact date inputs */
  .task-sync-date-input.mod-compact {
    flex: 1;
    padding: 4px 6px;
    border: 1px solid transparent;
    border-radius: 4px;
    background: transparent;
    color: var(--text-normal);
    font-family: inherit;
    font-size: 11px;
    transition: all 0.2s ease;
    cursor: pointer;
    min-width: 0;
  }

  .task-sync-date-input.mod-compact:hover {
    background: var(--background-modifier-hover);
    border-color: var(--background-modifier-border);
  }

  .task-sync-date-input.mod-compact:focus {
    outline: none;
    background: var(--background-primary);
    border-color: var(--interactive-accent);
    box-shadow: 0 0 0 1px var(--interactive-accent-hover);
  }

  .task-sync-date-input.mod-compact::-webkit-calendar-picker-indicator {
    cursor: pointer;
    opacity: 0.5;
    transition: opacity 0.2s;
    width: 12px;
    height: 12px;
  }

  .task-sync-date-input.mod-compact::-webkit-calendar-picker-indicator:hover {
    opacity: 1;
  }
</style>
