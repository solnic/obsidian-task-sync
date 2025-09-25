<script lang="ts">
  import { getContextStore } from "./context";
  import type { FileContext } from "../../main";
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

  // Reference to the action icon element
  let actionIconEl = $state<HTMLElement>();

  // Set Obsidian icons when the element is available and actionType changes
  $effect(() => {
    if (actionIconEl && showActionIcon) {
      let iconName;
      if (actionType === "planning") {
        // For daily planning mode (both local and non-local), show calendar icon
        iconName = "calendar-days";
      } else if (isNonLocalService) {
        // For non-local services in import mode, show download icon
        iconName = "download";
      } else {
        // For local service in normal mode, show file-text icon
        iconName = "file-text";
      }
      setIcon(actionIconEl, iconName);
    }
  });
</script>

<div class={contextClass} data-testid="context-widget">
  <!-- Action icon on the left side -->
  {#if showActionIcon}
    <div
      bind:this={actionIconEl}
      class="action-icon"
      title={actionType === "planning"
        ? "Daily planning mode"
        : isNonLocalService
          ? "Import context - tasks will be imported here"
          : "Local tasks"}
    ></div>
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
    background: transparent;
    border-radius: 0;
    font-size: 14px;
    margin: 0;
    border: none;
    width: 100%;
    height: 100%;
  }

  .context-content {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex-grow: 1;
    min-width: 0;
  }

  .context-row {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 18px;
  }

  .context-row-primary {
    gap: 12px;
  }

  .context-row-secondary {
    gap: 6px;
  }

  .service-name {
    color: var(--text-normal);
    font-weight: 600;
    font-size: 15px;
  }

  .context-type {
    font-weight: 500;
    font-size: 13px;
  }

  /* Colored context type labels */
  .context-widget.context-type-project .context-type {
    color: var(--color-blue);
  }

  .context-widget.context-type-area .context-type {
    color: var(--color-green);
  }

  .context-widget.context-type-task .context-type {
    color: var(--color-orange);
  }

  .context-widget.context-type-daily .context-type {
    color: var(--color-purple);
  }

  .context-widget.context-type-none .context-type {
    color: var(--text-muted);
  }

  .context-separator {
    color: var(--text-muted);
    font-size: 12px;
  }

  .context-name {
    color: var(--text-normal);
    font-weight: 600;
    font-size: 14px;
  }

  .no-context {
    color: var(--text-muted);
    font-style: italic;
    font-size: 13px;
  }

  .action-icon {
    width: 24px;
    height: 24px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
  }

  .action-icon :global(svg) {
    width: 20px;
    height: 20px;
  }

  /* Responsive adjustments */
  @media (max-width: 600px) {
    .service-name {
      font-size: 14px;
    }

    .context-type {
      font-size: 12px;
    }

    .context-name {
      font-size: 13px;
    }
  }
</style>
