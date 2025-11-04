<script lang="ts">
  /**
   * Enhanced ContextWidget - Displays detailed entity information
   * Shows rich information about tasks, projects, and areas based on current context
   */

  import type { Task, Project, Area } from "../core/entities";
  import type { FileContext } from "../types/context";
  import { setIcon } from "obsidian";
  import StatusBadge from "./badges/StatusBadge.svelte";
  import PriorityBadge from "./badges/PriorityBadge.svelte";
  import CategoryBadge from "./badges/CategoryBadge.svelte";
  import LabelBadge from "./badges/LabelBadge.svelte";

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

        <!-- Badges for key properties -->
        <div class="entity-badges">
          {#if context.type === "task" && isTask(currentEntity)}
            <!-- Task-specific badges -->
            {#if currentEntity.category}
              <CategoryBadge category={currentEntity.category} size="medium" />
            {/if}
            {#if currentEntity.status}
              <StatusBadge status={currentEntity.status} size="medium" />
            {/if}
            {#if currentEntity.priority}
              <PriorityBadge priority={currentEntity.priority} size="medium" />
            {/if}
          {/if}
        </div>

        <!-- Additional properties -->
        <div class="entity-properties">
          {#if context.type === "task" && isTask(currentEntity)}
            <!-- Task-specific properties -->
            {#if currentEntity.project}
              <LabelBadge
                label="Project"
                value={currentEntity.project}
                size="medium"
              />
            {/if}
            {#if currentEntity.areas && currentEntity.areas.length > 0}
              {#each currentEntity.areas as area}
                <LabelBadge label="Area" value={area} size="medium" />
              {/each}
            {/if}
            {#if currentEntity.doDate}
              <LabelBadge
                label="Do Date"
                value={formatDate(currentEntity.doDate)}
                size="medium"
              />
            {/if}
            {#if currentEntity.dueDate}
              <LabelBadge
                label="Due Date"
                value={formatDate(currentEntity.dueDate)}
                size="medium"
              />
            {/if}
          {:else if context.type === "project" && isProject(currentEntity)}
            <!-- Project-specific properties -->
            {#if currentEntity.areas && currentEntity.areas.length > 0}
              {#each currentEntity.areas as area}
                <LabelBadge label="Area" value={area} size="medium" />
              {/each}
            {/if}
          {/if}

          {#if currentEntity.tags && currentEntity.tags.length > 0}
            <div class="entity-tags">
              {#each currentEntity.tags as tag}
                <span class="tag-item">#{tag}</span>
              {/each}
            </div>
          {/if}

          {#if currentEntity.updatedAt}
            <div class="entity-meta">
              <span class="meta-label">Updated:</span>
              <span class="meta-value"
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
    flex-direction: column;
    gap: 16px;
    padding: 20px;
    background: var(--background-primary);
  }

  .context-action-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 6px;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .context-action-icon:hover {
    opacity: 0.9;
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
  }

  .context-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
  }

  .context-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
    flex: 1;
  }

  .context-header {
    margin-bottom: 8px;
  }

  .service-name {
    font-size: 18px;
    font-weight: 600;
    color: var(--text-normal);
  }

  .entity-info {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .entity-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 16px;
  }

  .context-type {
    font-size: 13px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted);
  }

  .context-separator {
    color: var(--text-faint);
    font-weight: normal;
  }

  .context-name {
    font-size: 18px;
    color: var(--text-normal);
    font-weight: 600;
  }

  .entity-description {
    font-size: 14px;
    color: var(--text-muted);
    line-height: 1.5;
    padding: 12px;
    background: var(--background-secondary);
    border-radius: 6px;
    border-left: 3px solid var(--interactive-accent);
  }

  .entity-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }

  .entity-properties {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .entity-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 4px;
  }

  .tag-item {
    font-size: 12px;
    color: var(--text-accent);
    background: var(--background-secondary);
    padding: 4px 8px;
    border-radius: 4px;
    font-weight: 500;
  }

  .entity-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--text-muted);
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--background-modifier-border);
  }

  .meta-label {
    font-weight: 500;
  }

  .meta-value {
    color: var(--text-faint);
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

  .muted {
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
