<script lang="ts">
  interface Props {
    label?: string;
    value?: string;
    placeholder?: string;
    color?: string;
    icon?: string;
    active?: boolean;
    disabled?: boolean;
    testId?: string;
    ariaLabel?: string;
    title?: string;
    onclick?: () => void;
  }

  let {
    label = "",
    value = "",
    placeholder = "",
    color = "",
    icon = "",
    active = false,
    disabled = false,
    testId = "",
    ariaLabel = "",
    title = "",
    onclick,
  }: Props = $props();

  function handleClick() {
    if (!disabled) {
      onclick?.();
    }
  }

  // Determine display text
  let displayText = $derived(value || label || placeholder);
</script>

<button
  type="button"
  class="task-sync-property-button"
  class:active
  class:disabled
  data-testid={testId}
  aria-label={ariaLabel}
  {title}
  onclick={handleClick}
  {disabled}
>
  <!-- Color dot if provided -->
  {#if color}
    <span class="task-sync-color-dot" style="background-color: {color}"></span>
  {/if}

  <!-- Icon if provided -->
  {#if icon}
    <span class="task-sync-property-icon">{icon}</span>
  {/if}

  <!-- Button text -->
  <span class="task-sync-button-label">{displayText}</span>
</button>

<style>
  .task-sync-property-button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    border: 1px solid var(--background-modifier-border);
    background: var(--background-primary);
    color: var(--text-normal);
  }

  .task-sync-property-button:hover:not(:disabled) {
    background: var(--background-modifier-hover);
    border-color: var(--background-modifier-border-hover);
  }

  .task-sync-property-button:focus {
    outline: none;
    border-color: var(--interactive-accent);
    box-shadow: 0 0 0 1px var(--interactive-accent-hover);
  }

  .task-sync-property-button.active {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-color: var(--interactive-accent);
  }

  .task-sync-property-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .task-sync-color-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .task-sync-property-icon {
    font-size: 14px;
    line-height: 1;
  }

  .task-sync-button-label {
    color: inherit;
  }

  .task-sync-property-button.active .task-sync-button-label {
    color: var(--text-on-accent);
  }
</style>
