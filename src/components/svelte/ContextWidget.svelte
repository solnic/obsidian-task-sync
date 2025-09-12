<script lang="ts">
  import { getContextStore } from "./context";
  import type { FileContext } from "../../main";

  interface Props {
    showImportIndicator?: boolean;
  }

  let { showImportIndicator = false }: Props = $props();

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
        return `${context.name}`;
      case "area":
        return `${context.name}`;
      case "task":
        return `${context.name}`;
      case "daily":
        return `${context.name}`;
      case "none":
        return "No context";
      default:
        return "Unknown context";
    }
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
        return "";
      default:
        return "Unknown";
    }
  });

  let contextClass = $derived.by(() => {
    return `context-widget context-type-${context.type}`;
  });
</script>

{#if context.type !== "none"}
  <div class={contextClass} data-testid="context-widget">
    <div class="context-type-indicator"></div>
    <div class="context-content">
      <span class="context-type-label">{contextTypeLabel}</span>
      <span class="context-name">{displayText}</span>
    </div>
    {#if showImportIndicator}
      <div
        class="import-indicator"
        title="Import context - tasks will be imported here"
      >
        <span class="import-icon">⬇</span>
      </div>
    {/if}
  </div>
{/if}

<style>
  .context-widget {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    background: var(--background-primary);
    border-radius: 4px;
    font-size: 12px;
    margin-bottom: 8px;
    border: none;
  }

  .context-type-indicator {
    width: 3px;
    height: 16px;
    border-radius: 2px;
    flex-shrink: 0;
  }

  .context-widget.context-type-project .context-type-indicator {
    background: var(--color-blue);
  }

  .context-widget.context-type-area .context-type-indicator {
    background: var(--color-green);
  }

  .context-widget.context-type-task .context-type-indicator {
    background: var(--color-orange);
  }

  .context-widget.context-type-daily .context-type-indicator {
    background: var(--color-purple);
  }

  .context-content {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-grow: 1;
  }

  .context-type-label {
    font-size: 11px;
    color: var(--text-muted);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .context-name {
    color: var(--text-normal);
    font-weight: 500;
  }

  .import-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    background: var(--interactive-accent);
    border-radius: 3px;
    flex-shrink: 0;
  }

  .import-icon {
    color: var(--text-on-accent);
    font-size: 10px;
    font-weight: bold;
  }
</style>
