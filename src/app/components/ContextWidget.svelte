<script lang="ts">
  /**
   * Enhanced ContextWidget - Displays detailed entity information
   * Shows rich information about tasks, projects, and areas based on current context
   */

  import type { Task, Project, Area } from "../core/entities";
  import type { FileContext } from "../types/context";
  import { setIcon } from "obsidian";

  interface Props {
    context: FileContext;
    dayPlanningMode?: boolean;
    serviceName?: string; // For consistent header format across services
    isNonLocalService?: boolean; // Whether this is a non-local service (GitHub, Apple Reminders, etc.)
  }

  let {
    context,
    dayPlanningMode = false,
    serviceName,
    isNonLocalService = false,
  }: Props = $props();

  // Get current entity from context (resolved by ContextService)
  let currentEntity = $derived(context?.entity || null);

  // Debug logging
  $effect(() => {
    console.log("ContextWidget - Context received:", {
      type: context?.type,
      name: context?.name,
      path: context?.path,
      hasEntity: !!context?.entity,
      entityId: context?.entity?.id,
      currentEntity: currentEntity
        ? {
            id: currentEntity.id,
            name:
              "title" in currentEntity
                ? currentEntity.title
                : currentEntity.name,
          }
        : null,
    });
  });

  // Debug: Log when currentEntity changes
  $effect(() => {
    console.log("ContextWidget - currentEntity changed:", {
      hasEntity: !!currentEntity,
      entityId: currentEntity?.id,
      entityName:
        currentEntity && "title" in currentEntity
          ? currentEntity.title
          : currentEntity && "name" in currentEntity
            ? currentEntity.name
            : "unknown",
    });
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
          {#if context.type === "task" && isTask(currentEntity)}
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
          {:else if context.type === "project" && isProject(currentEntity)}
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
    align-items: center;
    gap: 12px;
    padding: 0;
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
    gap: 4px;
    flex: 1;
  }

  .context-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .context-row-primary {
    font-size: 16px;
    font-weight: 600;
  }

  .context-row-secondary {
    font-size: 14px;
    color: var(--text-muted);
  }

  .service-name {
    color: var(--text-normal);
  }

  .context-type {
    color: var(--text-muted);
  }

  .context-separator {
    color: var(--text-muted);
    font-weight: normal;
  }

  .context-name {
    color: var(--text-normal);
    font-weight: 500;
  }

  .no-context {
    color: var(--text-muted);
    font-style: italic;
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
</style>
