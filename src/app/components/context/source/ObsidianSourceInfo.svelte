<script lang="ts">
  /**
   * ObsidianSourceInfo - Displays Obsidian-specific source information
   */

  import type { Task } from "../../../core/entities";

  interface Props {
    task: Task;
  }

  let { task }: Props = $props();

  // Extract Obsidian file path from source keys
  const filePath = $derived(task.source.keys.obsidian || "");

  // Extract folder and filename
  const pathParts = $derived(() => {
    if (!filePath) return null;
    
    const lastSlash = filePath.lastIndexOf("/");
    if (lastSlash === -1) {
      return { folder: "", filename: filePath };
    }
    
    return {
      folder: filePath.substring(0, lastSlash),
      filename: filePath.substring(lastSlash + 1),
    };
  });

  // Extract source data if available (for tasks promoted from todos)
  const sourceData = $derived(task.source.data);
  const sourceFile = $derived(sourceData?.sourceFile);
  const lineNumber = $derived(sourceData?.lineNumber);
</script>

<span class="obsidian-source-info">
  {#if pathParts()}
    <span class="source-filename">{pathParts()?.filename}</span>
    {#if pathParts()?.folder}
      <span class="source-folder">in {pathParts()?.folder}</span>
    {/if}
  {:else}
    <span class="source-no-path">No file path</span>
  {/if}
  
  {#if sourceFile && sourceFile !== filePath}
    <span class="source-promoted">
      (from {sourceFile}{#if lineNumber}:{lineNumber}{/if})
    </span>
  {/if}
</span>

<style>
  .obsidian-source-info {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 4px;
    align-items: center;
    font-size: 11px;
  }

  .source-filename {
    color: var(--text-normal);
    font-family: var(--font-monospace);
    font-weight: 500;
  }

  .source-folder {
    color: var(--text-muted);
    font-size: 10px;
  }

  .source-no-path {
    color: var(--text-muted);
    font-style: italic;
  }

  .source-promoted {
    color: var(--text-muted);
    font-size: 10px;
    font-style: italic;
  }
</style>

