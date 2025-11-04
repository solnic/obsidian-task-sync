<script lang="ts">
  /**
   * Enhanced ContextWidget - Displays detailed entity information
   * Shows rich information about tasks, projects, and areas based on current context
   */

  import { getContextStore } from "../stores/contextStore";
  import { projectStore } from "../stores/projectStore";
  import { areaStore } from "../stores/areaStore";
  import { ProjectQueryService } from "../services/ProjectQueryService";
  import { AreaQueryService } from "../services/AreaQueryService";
  import type { Task, Project, Area } from "../core/entities";
  import { setIcon } from "obsidian";

  interface Props {
    dayPlanningMode?: boolean;
    serviceName?: string; // For consistent header format across services
    isNonLocalService?: boolean; // Whether this is a non-local service (GitHub, Apple Reminders, etc.)
  }

  let {
    dayPlanningMode = false,
    serviceName,
    isNonLocalService = false,
  }: Props = $props();

  // Get the reactive context store
  const contextStore = getContextStore();

  // Reactive context value - directly from store using $ prefix
  let context = $derived($contextStore || { type: "none" as const });

  // Get current entity data based on context
  let currentEntity = $derived.by(() => {
    if (!context || context.type === "none" || context.type === "daily") {
      return null;
    }

    // For local entities, try to find by file path first, then by name
    if (context.path) {
      switch (context.type) {
        case "project": {
          const projects = $projectStore.projects;
          return (
            ProjectQueryService.findByFilePath(projects, context.path) ||
            ProjectQueryService.findByName(projects, context.name || "")
          );
        }
        case "area": {
          const areas = $areaStore.areas;
          return (
            AreaQueryService.findByFilePath(areas, context.path) ||
            AreaQueryService.findByName(areas, context.name || "")
          );
        }
        case "task": {
          // For tasks, we'll need to get data from the extension differently
          // For now, return null - we'll implement task lookup later
          return null;
        }
      }
    }

    return null;
  });

  // Computed properties for display
  let actionType = $derived.by(() => {
    return dayPlanningMode && context.type === "daily" ? "planning" : "import";
  });

  let contextTypeLabel = $derived.by(() => {
    switch (context.type) {
      case "project":
        return "Project";
      case "area":
        return "Area";
      case "task":
        return "Task";
      case "daily":
        return "Daily Note";
      case "none":
        return "No context";
      default:
        return "Unknown";
    }
  });

  let contextClass = $derived.by(() => {
    return `context-widget context-type-${context.type} action-type-${actionType}`;
  });

  // Always show action icon (for both local and non-local services)
  let showActionIcon = $derived.by(() => {
    return true; // Always show the icon
  });

  let actionIconName = $derived.by(() => {
    if (actionType === "planning") {
      return "calendar-plus";
    }
    return isNonLocalService ? "download" : "plus";
  });

  let actionTooltip = $derived.by(() => {
    if (actionType === "planning") {
      return "Add to today's plan";
    }
    return isNonLocalService ? "Import to vault" : "Create new task";
  });

  // Icon element for action button
  let actionIconElement = $state<HTMLElement>();

  // Set the icon when the element is mounted or icon name changes
  $effect(() => {
    if (actionIconElement && actionIconName) {
      setIcon(actionIconElement, actionIconName);
    }
  });

  // Type guards for entity types
  function isTask(entity: Task | Project | Area): entity is Task {
    return "title" in entity;
  }

  function isProject(entity: Task | Project | Area): entity is Project {
    return "name" in entity && !("title" in entity);
  }

  // Helper functions for formatting
  function formatDate(date: Date | undefined): string {
    if (!date) return "";
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date);
  }

  function formatTags(tags: string[]): string {
    return tags.map((tag) => `#${tag}`).join(" ");
  }

  function formatAreas(areas: string[]): string {
    return areas.join(", ");
  }

  // Get entity display name
  function getEntityName(entity: Task | Project | Area): string {
    if (isTask(entity)) {
      return entity.title;
    }
    return entity.name;
  }
</script>

<div class={contextClass} data-testid="context-widget">
  <!-- Action Icon -->
  {#if showActionIcon}
    <div class="context-action-icon" title={actionTooltip}>
      <span bind:this={actionIconElement} class="context-icon"></span>
    </div>
  {/if}

  <div class="context-content">
    <!-- Service name header -->
    {#if serviceName}
      <div class="context-header">
        <span class="service-name">{serviceName}</span>
      </div>
    {/if}

    <!-- Entity information -->
    {#if context.type === "none"}
      <div class="no-context-message">
        <span class="no-context">No context</span>
      </div>
    {:else if context.type === "daily"}
      <div class="entity-info daily-info">
        <div class="entity-title">
          <span class="context-type">{contextTypeLabel}</span>
          {#if context.name}
            <span class="context-separator">•</span>
            <span class="context-name">{context.name}</span>
          {/if}
        </div>
      </div>
    {:else if currentEntity}
      <!-- Rich entity information -->
      <div class="entity-info">
        <div class="entity-title">
          <span class="context-type">{contextTypeLabel}</span>
          <span class="context-separator">•</span>
          <span class="context-name">{getEntityName(currentEntity)}</span>
        </div>

        {#if currentEntity.description}
          <div class="entity-description">
            {currentEntity.description}
          </div>
        {/if}

        <div class="entity-properties">
          {#if isTask(currentEntity)}
            <!-- Task-specific properties -->
            {#if currentEntity.status}
              <div class="property-row">
                <span class="property-label">Status:</span>
                <span
                  class="property-value status-{currentEntity.status.toLowerCase()}"
                  >{currentEntity.status}</span
                >
              </div>
            {/if}
            {#if currentEntity.priority}
              <div class="property-row">
                <span class="property-label">Priority:</span>
                <span
                  class="property-value priority-{currentEntity.priority.toLowerCase()}"
                  >{currentEntity.priority}</span
                >
              </div>
            {/if}
            {#if currentEntity.project}
              <div class="property-row">
                <span class="property-label">Project:</span>
                <span class="property-value">{currentEntity.project}</span>
              </div>
            {/if}
            {#if currentEntity.areas && currentEntity.areas.length > 0}
              <div class="property-row">
                <span class="property-label">Areas:</span>
                <span class="property-value"
                  >{formatAreas(currentEntity.areas)}</span
                >
              </div>
            {/if}
            {#if currentEntity.doDate}
              <div class="property-row">
                <span class="property-label">Do Date:</span>
                <span class="property-value"
                  >{formatDate(currentEntity.doDate)}</span
                >
              </div>
            {/if}
            {#if currentEntity.dueDate}
              <div class="property-row">
                <span class="property-label">Due Date:</span>
                <span class="property-value"
                  >{formatDate(currentEntity.dueDate)}</span
                >
              </div>
            {/if}
          {:else if isProject(currentEntity)}
            <!-- Project-specific properties -->
            {#if currentEntity.areas && currentEntity.areas.length > 0}
              <div class="property-row">
                <span class="property-label">Areas:</span>
                <span class="property-value"
                  >{formatAreas(currentEntity.areas)}</span
                >
              </div>
            {/if}
          {/if}

          {#if currentEntity.tags && currentEntity.tags.length > 0}
            <div class="property-row">
              <span class="property-label">Tags:</span>
              <span class="property-value tags"
                >{formatTags(currentEntity.tags)}</span
              >
            </div>
          {/if}

          {#if currentEntity.updatedAt}
            <div class="property-row">
              <span class="property-label">Updated:</span>
              <span class="property-value"
                >{formatDate(currentEntity.updatedAt)}</span
              >
            </div>
          {/if}
        </div>
      </div>
    {:else}
      <!-- Fallback for when entity data is not available -->
      <div class="entity-info">
        <div class="entity-title">
          <span class="context-type">{contextTypeLabel}</span>
          {#if context.name}
            <span class="context-separator">•</span>
            <span class="context-name">{context.name}</span>
          {/if}
        </div>
        <div class="entity-description muted">Entity details not available</div>
      </div>
    {/if}
  </div>
</div>

<style>
  .context-widget {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 0;
    width: 100%;
  }

  .context-action-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 4px;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    cursor: pointer;
    transition: opacity 0.2s ease;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .context-action-icon:hover {
    opacity: 0.8;
  }

  .context-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
  }

  .context-content {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 1;
    min-width: 0;
  }

  .context-header {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .service-name {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-normal);
  }

  .no-context-message {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .no-context {
    color: var(--text-muted);
    font-style: italic;
    font-size: 14px;
  }

  .entity-info {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .entity-title {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .context-type {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-muted);
  }

  .context-separator {
    color: var(--text-muted);
    font-weight: normal;
    font-size: 14px;
  }

  .context-name {
    font-size: 14px;
    color: var(--text-normal);
    font-weight: 600;
    word-break: break-word;
  }

  .entity-description {
    font-size: 13px;
    color: var(--text-muted);
    line-height: 1.4;
    margin-top: 4px;
    word-break: break-word;
  }

  .entity-description.muted {
    font-style: italic;
  }

  .entity-properties {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 4px;
  }

  .property-row {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-size: 12px;
    line-height: 1.3;
  }

  .property-label {
    color: var(--text-muted);
    font-weight: 500;
    min-width: 60px;
    flex-shrink: 0;
  }

  .property-value {
    color: var(--text-normal);
    word-break: break-word;
    flex: 1;
  }

  .property-value.tags {
    color: var(--text-accent);
  }

  /* Status-specific styling */
  .property-value.status-todo {
    color: var(--text-muted);
  }

  .property-value.status-doing {
    color: var(--color-blue);
  }

  .property-value.status-done {
    color: var(--color-green);
  }

  .property-value.status-blocked {
    color: var(--color-red);
  }

  /* Priority-specific styling */
  .property-value.priority-low {
    color: var(--text-muted);
  }

  .property-value.priority-medium {
    color: var(--color-orange);
  }

  .property-value.priority-high {
    color: var(--color-red);
  }

  .property-value.priority-urgent {
    color: var(--color-red);
    font-weight: 600;
  }

  /* Context type specific styling */
  .context-type-project .context-type {
    color: var(--color-blue);
  }

  .context-type-area .context-type {
    color: var(--color-green);
  }

  .context-type-task .context-type {
    color: var(--color-orange);
  }

  .context-type-daily .context-type {
    color: var(--color-purple);
  }

  /* Action type specific styling */
  .action-type-planning .context-action-icon {
    background: var(--color-purple);
  }

  /* Responsive adjustments */
  @media (max-width: 400px) {
    .context-widget {
      gap: 8px;
    }

    .entity-title {
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
    }

    .property-row {
      flex-direction: column;
      gap: 2px;
    }

    .property-label {
      min-width: auto;
    }
  }
</style>
