<script lang="ts">
  /**
   * TaskContext - Displays task properties in the context widget
   * Uses semantic HTML with dl/dt/dd for property lists
   */

  import type { Task, Project, Area } from "../../core/entities";
  import Dropdown from "../Dropdown.svelte";
  import { Tasks } from "../../entities/Tasks";

  interface Props {
    task: Task;
    settings: any;
    allProjects: Project[];
    allAreas: Area[];
  }

  let { task, settings, allProjects, allAreas }: Props = $props();

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

  // Get options from settings
  const statusOptions = $derived(
    settings?.taskStatuses?.map((s: any) => ({
      value: s.name,
      label: s.name,
      customContent: `<span class="task-sync-color-dot" style="background-color: ${s.color}"></span><span>${s.name}</span>`,
    })) || []
  );

  const priorityOptions = $derived(
    settings?.taskPriorities?.map((p: any) => ({
      value: p.name,
      label: p.name,
      customContent: `<span class="task-sync-color-dot" style="background-color: ${p.color}"></span><span>${p.name}</span>`,
    })) || []
  );

  const categoryOptions = $derived(
    settings?.taskTypes?.map((t: any) => ({
      value: t.name,
      label: t.name,
      customContent: `<span class="task-sync-color-dot" style="background-color: ${t.color}"></span><span>${t.name}</span>`,
    })) || []
  );

  const projectOptions = $derived([
    { value: "", label: "No project" },
    ...allProjects.map((p) => ({
      value: p.name,
      label: p.name,
    })),
  ]);

  const areaOptions = $derived(
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
    showAreasDropdown = false;
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
      const categoryConfig = settings?.taskTypes?.find(
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
      label.textContent = "Set type";
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
    const label = document.createElement("span");
    label.textContent = areas.length > 0 ? areas.join(", ") : "Add to area";
    if (areas.length === 0) {
      label.style.color = "var(--text-muted)";
    }
    areasButtonEl.appendChild(label);
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
  <!-- Primary properties group -->
  <ul class="property-group">
    <li>
      <button
        bind:this={statusButtonEl}
        type="button"
        onclick={() => (showStatusDropdown = true)}
        class="task-sync-property-button mod-minimal"
        data-testid="context-status-button"
        aria-label="Change status"
      ></button>
    </li>
    <li>
      <button
        bind:this={categoryButtonEl}
        type="button"
        onclick={() => (showCategoryDropdown = true)}
        class="task-sync-property-button mod-minimal"
        data-testid="context-category-button"
        aria-label="Change type"
      ></button>
    </li>
    <li>
      <button
        bind:this={priorityButtonEl}
        type="button"
        onclick={() => (showPriorityDropdown = true)}
        class="task-sync-property-button mod-minimal"
        data-testid="context-priority-button"
        aria-label="Change priority"
      ></button>
    </li>
  </ul>

  <!-- Project property -->
  <ul class="property-group">
    <li>
      <div class="property-label">Project</div>
      <button
        bind:this={projectButtonEl}
        type="button"
        onclick={() => (showProjectDropdown = true)}
        class="task-sync-property-button mod-minimal task-sync-property-button-full"
        data-testid="context-project-button"
        aria-label="Change project"
      ></button>
    </li>
  </ul>

  <!-- Areas property -->
  <ul class="property-group">
    <li>
      <div class="property-label">Areas</div>
      <button
        bind:this={areasButtonEl}
        type="button"
        onclick={() => (showAreasDropdown = true)}
        class="task-sync-property-button mod-minimal task-sync-property-button-full"
        data-testid="context-areas-button"
        aria-label="Change areas"
      ></button>
    </li>
  </ul>

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
      selectedValue={task.areas?.[0]}
      onSelect={handleAreasSelect}
      onClose={() => (showAreasDropdown = false)}
      searchable={true}
      searchPlaceholder="Search areas..."
      testId="context-areas-dropdown"
    />
  {/if}
</div>

<style>
  .task-context {
    display: flex;
    flex-direction: column;
  }

  .property-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 12px 0;
    border-bottom: 1px solid var(--background-modifier-border);
    list-style: none;
    margin: 0;
    padding: 12px 0;
  }

  .property-group:first-child {
    padding-top: 0;
  }

  .property-group:last-child {
    border-bottom: none;
  }

  .property-group li {
    list-style: none;
  }

  .property-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
  }

  :global(.task-sync-property-button-full) {
    width: 100%;
    justify-content: flex-start;
  }
</style>
