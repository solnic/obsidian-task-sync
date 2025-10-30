<script lang="ts">
  /**
   * Reusable SearchInput component for task searching
   * Can be used by both Local and GitHub task views
   */

  interface Props {
    value: string;
    placeholder?: string;
    onInput: (value: string) => void;
    onRefresh?: () => void;
    disabled?: boolean;
    service: string;
    showRefreshButton?: boolean;
  }

  let {
    value = $bindable(),
    placeholder = "Search...",
    onInput,
    onRefresh,
    disabled = false,
    service,
    showRefreshButton = true,
  }: Props = $props();

  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement;
    value = target.value;
    onInput(target.value);
  }

  function handleRefresh() {
    if (onRefresh) {
      // Fire and forget to allow UI to flip to loading immediately without waiting
      Promise.resolve(onRefresh()).catch((err) => {
        console.error("Refresh failed:", err);
      });
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    // Allow Escape to clear the search
    if (event.key === "Escape") {
      value = "";
      onInput("");
      event.preventDefault();
    }
  }
</script>

<div
  class="task-sync-search-input-container"
  data-testid="task-sync-search-container"
>
  <div class="task-sync-search-input-wrapper">
    <input
      type="text"
      class="task-sync-search-input"
      {placeholder}
      {value}
      {disabled}
      oninput={handleInput}
      onkeydown={handleKeydown}
      data-testid="task-sync-search-input"
    />

    {#if showRefreshButton && onRefresh}
      <button
        class="task-sync-refresh-button"
        title="Refresh"
        onclick={handleRefresh}
        {disabled}
        data-testid="task-sync-{service}-refresh-button"
      >
        <span class="task-sync-refresh-icon">↻</span>
        <span class="task-sync-refresh-text">Refresh</span>
      </button>
    {/if}
  </div>
</div>

<style>
  .task-sync-search-input-container {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .task-sync-search-input-wrapper {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .task-sync-search-input {
    flex: 1;
    padding: 8px 12px 8px 30px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: 13px;
    height: 32px;
    box-sizing: border-box;
    transition: border-color 0.2s ease;
  }

  .task-sync-search-input:focus {
    outline: none;
    border-color: var(--interactive-accent);
  }

  .task-sync-search-input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .task-sync-refresh-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 32px;
    padding: 0 12px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    background: var(--background-primary);
    color: var(--text-normal);
    cursor: pointer;
    transition: all 0.2s ease;
    flex-shrink: 0;
    white-space: nowrap;
  }

  .task-sync-refresh-button:hover:not(:disabled) {
    background: var(--background-modifier-hover);
    border-color: var(--background-modifier-border-hover);
  }

  .task-sync-refresh-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .task-sync-refresh-icon {
    font-size: 14px;
    line-height: 1;
  }

  .task-sync-refresh-text {
    font-size: 13px;
    font-weight: 500;
  }
</style>
