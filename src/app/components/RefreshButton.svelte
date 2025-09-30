<script lang="ts">
  /**
   * Standalone RefreshButton component
   * Extracted from SearchInput to be rendered separately
   */

  interface Props {
    onRefresh: () => void;
    disabled?: boolean;
    testId?: string;
    title?: string;
  }

  let {
    onRefresh,
    disabled = false,
    testId = "refresh-button",
    title = "Refresh",
  }: Props = $props();

  function handleRefresh() {
    onRefresh();
  }
</script>

<button
  class="refresh-button"
  {title}
  onclick={handleRefresh}
  {disabled}
  data-testid={testId}
>
  <span class="refresh-icon">↻</span>
  <span class="refresh-text">Refresh</span>
</button>

<style>
  .refresh-button {
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

  .refresh-text {
    font-size: 13px;
    font-weight: 500;
  }
</style>
