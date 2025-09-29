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
        <span class="refresh-text">Refresh</span>
      </button>
    {/if}
  </div>
</div>
