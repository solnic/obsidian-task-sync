<script lang="ts">
  /**
   * SourceContext - Displays source information for a task
   * Dynamically renders source-specific components based on the task's source extension
   */

  import type { Task } from "../../../core/entities";
  import GitHubSourceInfo from "./GitHubSourceInfo.svelte";
  import ObsidianSourceInfo from "./ObsidianSourceInfo.svelte";

  interface Props {
    task: Task;
  }

  let { task }: Props = $props();

  // Determine which source component to render
  const sourceExtension = $derived(task.source.extension);
</script>

<div class="source-context">
  <div class="property-label">Source</div>
  
  {#if sourceExtension === "github"}
    <GitHubSourceInfo {task} />
  {:else if sourceExtension === "obsidian"}
    <ObsidianSourceInfo {task} />
  {:else}
    <div class="source-info-generic">
      <span class="source-extension">{sourceExtension}</span>
    </div>
  {/if}
</div>

<style>
  .source-context {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 12px 0;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .property-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
  }

  .source-info-generic {
    padding: 6px 8px;
    border-radius: 6px;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
  }

  .source-extension {
    font-size: 13px;
    color: var(--text-normal);
    text-transform: capitalize;
  }
</style>

