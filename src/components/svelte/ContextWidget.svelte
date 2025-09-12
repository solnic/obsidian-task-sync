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
        return `Import context: Project / ${context.name}`;
      case "area":
        return `Import context: Area / ${context.name}`;
      case "task":
        return `Import context: Task / ${context.name}`;
      case "daily":
        return `Import context: Daily Note / ${context.name}`;
      case "none":
        return "Import context: No context";
      default:
        return "Import context: Unknown context";
    }
  });

  let contextClass = $derived.by(() => {
    return `context-widget context-type-${context.type}`;
  });
</script>

<div class={contextClass} data-testid="context-widget">
  <div class="context-type-indicator"></div>
  <div class="context-content">
    <span class="context-text">{displayText}</span>
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

  .context-type-indicator {
    width: 4px;
    height: 20px;
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
    gap: 8px;
    flex-grow: 1;
  }

  .context-text {
    color: var(--text-normal);
    font-weight: 500;
  }

  .context-type-label {
    font-size: 12px;
    color: var(--text-muted);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .context-name {
    color: var(--text-normal);
    font-weight: 600;
    font-size: 16px;
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
