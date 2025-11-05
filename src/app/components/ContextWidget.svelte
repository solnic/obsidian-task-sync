<script lang="ts">
  /**
   * ContextWidget - Linear-style properties panel
   * Shows interactive property controls for the current context entity
   */

  import type { Task, Project, Area } from "../core/entities";
  import type { FileContext } from "../types/context";
  import type { Host } from "../core/host";
  import { projectStore } from "../stores/projectStore";
  import { areaStore } from "../stores/areaStore";
  import { taskStore } from "../stores/taskStore";
  import TaskContext from "./context/TaskContext.svelte";
  import ProjectContext from "./context/ProjectContext.svelte";
  import AreaContext from "./context/AreaContext.svelte";

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

  function isArea(entity: Task | Project | Area): entity is Area {
    return "name" in entity && !("title" in entity) && !("areas" in entity);
  }
</script>

<div class="context-widget-properties" data-testid="context-widget">
  {#if !context || context.type === "none"}
    <div class="no-context-message">
      <span class="no-context">No context</span>
    </div>
  {:else if context.type === "task" && currentEntity && isTask(currentEntity)}
    <TaskContext task={currentEntity} {settings} {allProjects} {allAreas} />
  {:else if context.type === "project" && currentEntity && isProject(currentEntity)}
    <ProjectContext project={currentEntity} {settings} {allAreas} />
  {:else if context.type === "area" && currentEntity && isArea(currentEntity)}
    <AreaContext area={currentEntity} {settings} />
  {:else if context.type === "daily"}
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
    gap: 0;
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
</style>
