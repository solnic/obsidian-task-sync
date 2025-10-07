<script lang="ts">
  import { onMount } from "svelte";
  import type { Snippet } from "svelte";

  interface Props {
    title?: string;
    description?: string;
    onsubmit?: (data: any) => void;
    oncancel?: () => void;
    submitLabel?: string;
    cancelLabel?: string;
    submitDisabled?: boolean;
    showHeader?: boolean;
    showFooter?: boolean;
    content?: Snippet<[{ firstInput: HTMLElement | undefined }]>;
    properties?: Snippet;
  }

  let {
    title = "",
    description = "",
    onsubmit,
    oncancel,
    submitLabel = "Create",
    cancelLabel = "Cancel",
    submitDisabled = false,
    showHeader = true,
    showFooter = true,
    content,
    properties,
  }: Props = $props();

  // UI references for focus management
  let firstInput: HTMLElement | undefined = $state();

  onMount(() => {
    // Focus first input if available
    firstInput?.focus();
  });

  function handleSubmit() {
    onsubmit?.();
  }

  function handleCancel() {
    oncancel?.();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      if (!submitDisabled) {
        handleSubmit();
      }
    }
    if (event.key === "Escape") {
      event.preventDefault();
      handleCancel();
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="task-sync-modal-container">
  <!-- Header -->
  {#if showHeader && (title || description)}
    <div class="task-sync-modal-header">
      {#if title}
        <h2>{title}</h2>
      {/if}
      {#if description}
        <p class="task-sync-modal-description">{description}</p>
      {/if}
    </div>
  {/if}

  <!-- Main content area -->
  <div class="task-sync-main-content">
    {#if content}
      {@render content({ firstInput })}
    {/if}
  </div>

  <!-- Properties toolbar (optional) -->
  {#if properties}
    {@render properties()}
  {/if}

  <!-- Footer with action buttons -->
  {#if showFooter}
    <div class="task-sync-modal-footer">
      <div class="task-sync-footer-actions">
        <button
          type="button"
          class="task-sync-cancel-button"
          data-testid="cancel-button"
          onclick={handleCancel}
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          class="task-sync-create-button mod-cta"
          data-testid="submit-button"
          onclick={handleSubmit}
          disabled={submitDisabled}
        >
          {submitLabel}
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .task-sync-modal-header {
    margin-bottom: 1.5rem;
  }

  .task-sync-modal-header h2 {
    margin: 0 0 0.5rem 0;
    font-size: 1.25rem;
    font-weight: 600;
  }

  .task-sync-modal-description {
    margin: 0;
    color: var(--text-muted);
    font-size: 0.9rem;
    line-height: 1.4;
  }

  .task-sync-modal-footer {
    margin-top: 2rem;
    padding-top: 1rem;
    border-top: 1px solid var(--background-modifier-border);
  }

  .task-sync-footer-actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
  }

  .task-sync-cancel-button,
  .task-sync-create-button {
    padding: 0.5rem 1rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    background: var(--background-primary);
    color: var(--text-normal);
    cursor: pointer;
    font-size: 0.9rem;
  }

  .task-sync-create-button {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-color: var(--interactive-accent);
  }

  .task-sync-cancel-button:hover {
    background: var(--background-modifier-hover);
  }

  .task-sync-create-button:hover:not(:disabled) {
    background: var(--interactive-accent-hover);
  }

  .task-sync-create-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>
