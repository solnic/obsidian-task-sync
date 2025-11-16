<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    label?: string;
    required?: boolean;
    description?: string;
    error?: boolean;
    htmlFor?: string;
    children?: Snippet;
  }

  let {
    label = "",
    required = false,
    description = "",
    error = false,
    htmlFor = "",
    children,
  }: Props = $props();
</script>

<div class="task-sync-field-group">
  {#if label}
    <label class="task-sync-field-label" for={htmlFor}>
      {label}{required ? " *" : ""}
    </label>
  {/if}

  {#if children}
    {@render children()}
  {/if}

  {#if description}
    <div class="task-sync-field-description" class:error>
      {description}
    </div>
  {/if}
</div>

<style>
  .task-sync-field-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .task-sync-field-label {
    font-weight: 500;
    font-size: 0.9rem;
    color: var(--text-normal);
  }

  .task-sync-field-description {
    font-size: 0.8rem;
    color: var(--text-muted);
    line-height: 1.3;
  }

  .task-sync-field-description.error {
    color: var(--text-error);
  }
</style>
