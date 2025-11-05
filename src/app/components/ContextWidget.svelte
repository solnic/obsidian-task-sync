<script lang="ts">
  /**
   * ContextWidget - Linear-style properties panel
   * Shows interactive property controls for the current context entity
   */

  import type { Task, Project, Area } from "../core/entities";
  import type { FileContext } from "../types/context";
  import type { Host } from "../core/host";
  import Dropdown from "./Dropdown.svelte";
  import { projectStore } from "../stores/projectStore";
  import { areaStore } from "../stores/areaStore";
  import { taskStore } from "../stores/taskStore";
  import { Tasks } from "../entities/Tasks";
  import { Projects } from "../entities/Projects";

  interface Props {
    context: FileContext;
    settings?: any; // TaskSyncSettings for colors and options
    host: Host;
  }

  let { context, settings, host }: Props = $props();

  // Get projects and areas from stores
  let allProjects = $state<Project[]>([]);
  let allAreas = $state<Area[]>([]);
  let allTasks = $state<Task[]>([]);

  $effect(() => {
    const unsubProjects = projectStore.subscribe((state) => {
      allProjects = [...state.projects];
    });
    const unsubAreas = areaStore.subscribe((state) => {
      allAreas = [...state.areas];
    });
    const unsubTasks = taskStore.subscribe((state) => {
      allTasks = [...state.tasks];
    });
    return () => {
      unsubProjects();
      unsubAreas();
      unsubTasks();
    };
  });

  // Get current entity from context (resolved by ContextService)
  // If it's a task, get the latest version from the task store
  let currentEntity = $derived.by(() => {
    const contextEntity = context?.entity || null;
    if (!contextEntity) return null;

    // If it's a task, get the latest version from the store
    if (isTask(contextEntity)) {
      const latestTask = allTasks.find((t) => t.id === contextEntity.id);
      return latestTask || contextEntity;
    }

    return contextEntity;
  });

  // Type guards for entity types
  function isTask(entity: Task | Project | Area): entity is Task {
    return "title" in entity;
  }

  function isProject(entity: Task | Project | Area): entity is Project {
    return "name" in entity && !("title" in entity);
  }

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

  // Project and area options from stores
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

  // Handlers for property changes
  function handleStatusClick() {
    showStatusDropdown = true;
  }

  function handlePriorityClick() {
    showPriorityDropdown = true;
  }

  function handleCategoryClick() {
    showCategoryDropdown = true;
  }

  function handleProjectClick() {
    showProjectDropdown = true;
  }

  function handleAreasClick() {
    showAreasDropdown = true;
  }

  async function handleStatusSelect(value: string) {
    if (!currentEntity || !isTask(currentEntity)) return;

    const taskOps = new Tasks.Operations(settings);
    await taskOps.update({
      ...currentEntity,
      status: value,
      done: value === "Done",
    });

    showStatusDropdown = false;
  }

  async function handlePrioritySelect(value: string) {
    if (!currentEntity || !isTask(currentEntity)) return;

    const taskOps = new Tasks.Operations(settings);
    await taskOps.update({
      ...currentEntity,
      priority: value,
    });

    showPriorityDropdown = false;
  }

  async function handleCategorySelect(value: string) {
    if (!currentEntity || !isTask(currentEntity)) return;

    const taskOps = new Tasks.Operations(settings);
    await taskOps.update({
      ...currentEntity,
      category: value,
    });

    showCategoryDropdown = false;
  }

  async function handleProjectSelect(value: string) {
    if (!currentEntity || !isTask(currentEntity)) return;

    const taskOps = new Tasks.Operations(settings);
    await taskOps.update({
      ...currentEntity,
      project: value || "",
    });

    showProjectDropdown = false;
  }

  async function handleAreasSelect(value: string) {
    if (!currentEntity) return;

    if (isTask(currentEntity)) {
      const taskOps = new Tasks.Operations(settings);
      const currentAreas = currentEntity.areas || [];

      // Toggle area - add if not present, remove if present
      const newAreas = currentAreas.includes(value)
        ? currentAreas.filter((a) => a !== value)
        : [...currentAreas, value];

      await taskOps.update({
        ...currentEntity,
        areas: newAreas,
      });
    } else if (isProject(currentEntity)) {
      const projectOps = new Projects.Operations(settings);
      const currentAreas = currentEntity.areas || [];

      // Toggle area - add if not present, remove if present
      const newAreas = currentAreas.includes(value)
        ? currentAreas.filter((a) => a !== value)
        : [...currentAreas, value];

      await projectOps.update({
        ...currentEntity,
        areas: newAreas,
      });
    }

    showAreasDropdown = false;
  }

  // Update button content with color dots
  function updateStatusButton() {
    if (!statusButtonEl || !currentEntity || !isTask(currentEntity)) return;
    statusButtonEl.innerHTML = "";

    const status = currentEntity.status;
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
    if (!priorityButtonEl || !currentEntity || !isTask(currentEntity)) return;
    priorityButtonEl.innerHTML = "";

    const priority = currentEntity.priority;
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
    if (!categoryButtonEl || !currentEntity || !isTask(currentEntity)) return;
    categoryButtonEl.innerHTML = "";

    const category = currentEntity.category;
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
    if (!projectButtonEl || !currentEntity || !isTask(currentEntity)) return;
    projectButtonEl.innerHTML = "";

    const project = currentEntity.project;
    const label = document.createElement("span");
    label.textContent = project || "Add to project";
    if (!project) {
      label.style.color = "var(--text-muted)";
    }
    projectButtonEl.appendChild(label);
  }

  function updateAreasButton() {
    if (!areasButtonEl || !currentEntity) return;
    areasButtonEl.innerHTML = "";

    const areas = isTask(currentEntity)
      ? currentEntity.areas
      : isProject(currentEntity)
        ? currentEntity.areas
        : [];

    const label = document.createElement("span");
    label.textContent =
      areas && areas.length > 0 ? areas.join(", ") : "Add to area";
    if (!areas || areas.length === 0) {
      label.style.color = "var(--text-muted)";
    }
    areasButtonEl.appendChild(label);
  }

  // Update buttons when entity changes
  $effect(() => {
    if (currentEntity && isTask(currentEntity)) {
      updateStatusButton();
      updatePriorityButton();
      updateCategoryButton();
      updateProjectButton();
      updateAreasButton();
    } else if (currentEntity && isProject(currentEntity)) {
      updateAreasButton();
    }
  });
</script>

<div class="context-widget-properties" data-testid="context-widget">
  {#if context.type === "none"}
    <div class="no-context-message">
      <span class="no-context">No context</span>
    </div>
  {:else if context.type === "task" && currentEntity && isTask(currentEntity)}
    <!-- Task Properties -->
    <div class="properties-list">
      <!-- Status -->
      <button
        bind:this={statusButtonEl}
        type="button"
        onclick={handleStatusClick}
        class="task-sync-property-button mod-minimal"
        data-testid="context-status-button"
        aria-label="Change status"
      ></button>

      <!-- Priority -->
      <button
        bind:this={priorityButtonEl}
        type="button"
        onclick={handlePriorityClick}
        class="task-sync-property-button mod-minimal"
        data-testid="context-priority-button"
        aria-label="Change priority"
      ></button>

      <!-- Category/Type -->
      <button
        bind:this={categoryButtonEl}
        type="button"
        onclick={handleCategoryClick}
        class="task-sync-property-button mod-minimal"
        data-testid="context-category-button"
        aria-label="Change type"
      ></button>

      <!-- Project -->
      <div class="property-section">
        <div class="property-label">Project</div>
        <button
          bind:this={projectButtonEl}
          type="button"
          onclick={handleProjectClick}
          class="task-sync-property-button mod-minimal task-sync-property-button-full"
          data-testid="context-project-button"
          aria-label="Change project"
        ></button>
      </div>

      <!-- Areas -->
      <div class="property-section">
        <div class="property-label">Areas</div>
        <button
          bind:this={areasButtonEl}
          type="button"
          onclick={handleAreasClick}
          class="task-sync-property-button mod-minimal task-sync-property-button-full"
          data-testid="context-areas-button"
          aria-label="Change areas"
        ></button>
      </div>
    </div>

    <!-- Dropdowns -->
    {#if showStatusDropdown && statusButtonEl}
      <Dropdown
        anchor={statusButtonEl}
        items={statusOptions}
        selectedValue={currentEntity.status}
        onSelect={handleStatusSelect}
        onClose={() => (showStatusDropdown = false)}
        testId="context-status-dropdown"
      />
    {/if}

    {#if showPriorityDropdown && priorityButtonEl}
      <Dropdown
        anchor={priorityButtonEl}
        items={priorityOptions}
        selectedValue={currentEntity.priority}
        onSelect={handlePrioritySelect}
        onClose={() => (showPriorityDropdown = false)}
        testId="context-priority-dropdown"
      />
    {/if}

    {#if showCategoryDropdown && categoryButtonEl}
      <Dropdown
        anchor={categoryButtonEl}
        items={categoryOptions}
        selectedValue={currentEntity.category}
        onSelect={handleCategorySelect}
        onClose={() => (showCategoryDropdown = false)}
        testId="context-category-dropdown"
      />
    {/if}

    {#if showProjectDropdown && projectButtonEl}
      <Dropdown
        anchor={projectButtonEl}
        items={projectOptions}
        selectedValue={currentEntity.project}
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
        selectedValue={currentEntity.areas?.[0]}
        onSelect={handleAreasSelect}
        onClose={() => (showAreasDropdown = false)}
        searchable={true}
        searchPlaceholder="Search areas..."
        testId="context-areas-dropdown"
      />
    {/if}
  {:else if context.type === "project" && currentEntity && isProject(currentEntity)}
    <!-- Project Properties -->
    <div class="properties-list">
      <!-- Areas -->
      <div class="property-section">
        <div class="property-label">Areas</div>
        <button
          bind:this={areasButtonEl}
          type="button"
          onclick={handleAreasClick}
          class="task-sync-property-button mod-minimal task-sync-property-button-full"
          data-testid="context-areas-button"
          aria-label="Change areas"
        ></button>
      </div>
    </div>

    {#if showAreasDropdown && areasButtonEl}
      <Dropdown
        anchor={areasButtonEl}
        items={areaOptions}
        selectedValue={currentEntity.areas?.[0]}
        onSelect={handleAreasSelect}
        onClose={() => (showAreasDropdown = false)}
        searchable={true}
        searchPlaceholder="Search areas..."
        testId="context-areas-dropdown"
      />
    {/if}
  {:else if context.type === "area" && currentEntity}
    <!-- Area has no editable properties yet -->
    <div class="no-context-message">
      <span class="no-context">No editable properties</span>
    </div>
  {:else if context.type === "daily"}
    <!-- Daily Note has no editable properties -->
    <div class="no-context-message">
      <span class="no-context">No editable properties</span>
    </div>
  {:else}
    <div class="no-context-message">
      <span class="no-context">Entity details not available</span>
    </div>
  {/if}
</div>

<style>
  .context-widget-properties {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .properties-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .property-section {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 12px;
  }

  .property-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 0 8px 4px 8px;
  }

  .no-context-message {
    padding: 20px;
    text-align: center;
  }

  .no-context {
    color: var(--text-muted);
    font-style: italic;
    font-size: 14px;
  }

  /* Full-width property buttons */
  :global(.task-sync-property-button-full) {
    width: 100%;
    justify-content: flex-start;
  }
</style>
