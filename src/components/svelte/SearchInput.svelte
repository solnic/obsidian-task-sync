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
    testId?: string;
    showRefreshButton?: boolean;
  }

  let {
    value = $bindable(),
    placeholder = "Search...",
    onInput,
    onRefresh,
    disabled = false,
    testId,
    showRefreshButton = true,
  }: Props = $props();

  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement;
    value = target.value;
    onInput(target.value);
  }

  function handleRefresh() {
    if (onRefresh) {
      onRefresh();
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

<div class="search-input-container" data-testid="{testId}-container">
  <div class="search-input-wrapper">
    <input
      type="text"
      class="search-input"
      {placeholder}
      {value}
      {disabled}
      oninput={handleInput}
      onkeydown={handleKeydown}
      data-testid={testId}
    />

    {#if showRefreshButton && onRefresh}
      <button
        class="refresh-button"
        title="Refresh"
        onclick={handleRefresh}
        {disabled}
        data-testid="{testId}-refresh"
      >
        <span class="refresh-icon">↻</span>
      </button>
    {/if}
  </div>
</div>

<style>
  .search-input-container {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .search-input-wrapper {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .search-input {
    flex: 1;
    padding: 8px 12px 8px 30px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: 13px;
    transition: border-color 0.2s ease;
  }

  .search-input:focus {
    outline: none;
    border-color: var(--interactive-accent);
  }

  .search-input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .refresh-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    background: var(--background-primary);
    color: var(--text-normal);
    cursor: pointer;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }

  .refresh-button:hover:not(:disabled) {
    background: var(--background-modifier-hover);
    border-color: var(--background-modifier-border-hover);
  }

  .refresh-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .refresh-icon {
    font-size: 14px;
    line-height: 1;
  }
</style>
