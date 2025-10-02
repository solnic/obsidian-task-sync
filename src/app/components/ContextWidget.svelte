<script lang="ts">
  /**
   * ContextWidget - Displays current file context and service information
   * Ported from old-stuff/components/svelte/ContextWidget.svelte for new architecture
   */

  import { getContextStore } from "../stores/contextStore";
  import type { FileContext } from "../types/context";
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

  // Reactive context value
  let context = $state<FileContext>({ type: "none" });

  // Subscribe to context changes
  $effect(() => {
    const unsubscribe = contextStore.subscribe((value) => {
      context = value;
    });

    return unsubscribe;
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
</script>

<div class={contextClass} data-testid="context-widget">
  <!-- Action Icon -->
  {#if showActionIcon}
    <div class="context-action-icon" title={actionTooltip}>
      <span bind:this={actionIconElement} class="context-icon"></span>
    </div>
  {/if}

  <div class="context-content">
    <!-- First row: Service name -->
    <div class="context-row context-row-primary">
      {#if serviceName}
        <span class="service-name">{serviceName}</span>
      {/if}
    </div>

    <!-- Second row: Context information -->
    <div class="context-row context-row-secondary">
      {#if context.type !== "none"}
        <span class="context-type">{contextTypeLabel}</span>
        {#if context.name}
          <span class="context-separator">•</span>
          <span class="context-name">{context.name}</span>
        {/if}
      {:else}
        <span class="no-context">No context</span>
      {/if}
    </div>
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
