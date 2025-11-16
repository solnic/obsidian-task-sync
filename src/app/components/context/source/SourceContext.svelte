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
  <span class="source-label">Source:</span>
  
  {#if sourceExtension === "github"}
    <GitHubSourceInfo {task} />
  {:else if sourceExtension === "obsidian"}
    <ObsidianSourceInfo {task} />
  {:else}
    <span class="source-extension">{sourceExtension}</span>
  {/if}
</div>

<style>
  .source-context {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 0;
    font-size: 11px;
  }

  .source-label {
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.3px;
    flex-shrink: 0;
  }

  .source-extension {
    color: var(--text-normal);
    text-transform: capitalize;
  }
</style>

