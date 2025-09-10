<script lang="ts">
  import { getContextStore } from "./context";
  import type { FileContext } from "../../main";

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
  let displayText = $derived.by(() => {
    switch (context.type) {
      case "project":
        return `Project: ${context.name}`;
      case "area":
        return `Area: ${context.name}`;
      case "task":
        return `Task: ${context.name}`;
      case "daily":
        return `Daily Note: ${context.name}`;
      case "none":
        return "No context";
      default:
        return "Unknown context";
    }
  });

  let iconClass = $derived.by(() => {
    switch (context.type) {
      case "project":
        return "context-icon-project";
      case "area":
        return "context-icon-area";
      case "none":
        return "context-icon-none";
      default:
        return "context-icon-unknown";
    }
  });

  let contextClass = $derived.by(() => {
    return `context-widget context-type-${context.type}`;
  });
</script>

<div class={contextClass} data-testid="context-widget">
  <div class="context-icon {iconClass}"></div>
  <div class="context-text" data-testid="context-text">
    {displayText}
  </div>
  {#if context.type !== "none"}
    <div class="context-path" data-testid="context-path" title={context.path}>
      {context.path}
    </div>
  {/if}
</div>

<style>
  .context-widget {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    font-size: 13px;
    color: var(--text-muted);
    margin-bottom: 12px;
  }

  .context-widget.context-type-project {
    border-left: 3px solid var(--color-blue);
  }

  .context-widget.context-type-area {
    border-left: 3px solid var(--color-green);
  }

  .context-widget.context-type-none {
    border-left: 3px solid var(--background-modifier-border);
    opacity: 0.7;
  }

  .context-icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    background-size: contain;
    background-repeat: no-repeat;
    background-position: center;
  }

  .context-icon-project::before {
    content: "📁";
    font-size: 14px;
  }

  .context-icon-area::before {
    content: "🏷️";
    font-size: 14px;
  }

  .context-icon-none::before {
    content: "📄";
    font-size: 14px;
    opacity: 0.5;
  }

  .context-text {
    font-weight: 500;
    color: var(--text-normal);
    flex-grow: 1;
  }

  .context-path {
    font-size: 11px;
    color: var(--text-faint);
    font-family: var(--font-monospace);
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .context-widget:hover .context-path {
    max-width: none;
    white-space: normal;
    word-break: break-all;
  }
</style>
