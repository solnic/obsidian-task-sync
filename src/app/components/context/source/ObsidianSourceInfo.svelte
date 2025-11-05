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

<div class="obsidian-source-info">
  <div class="source-header">
    <span class="source-icon">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 0L0 3v10l8 3 8-3V3L8 0zm0 1.5L14.5 4 8 6.5 1.5 4 8 1.5zM1 4.8l6.5 2.4v7.3L1 12.2V4.8zm7.5 9.7V7.2L15 4.8v7.4l-6.5 2.3z"/>
      </svg>
    </span>
    <span class="source-label">Obsidian</span>
  </div>
  
  <div class="source-details">
    {#if pathParts()}
      <div class="detail-row">
        <span class="detail-label">File:</span>
        <span class="detail-value">{pathParts()?.filename}</span>
      </div>
      
      {#if pathParts()?.folder}
        <div class="detail-row">
          <span class="detail-label">Folder:</span>
          <span class="detail-value">{pathParts()?.folder}</span>
        </div>
      {/if}
    {:else}
      <span class="detail-value">No file path available</span>
    {/if}
    
    {#if sourceFile && sourceFile !== filePath}
      <div class="detail-row promoted-from">
        <span class="detail-label">Promoted from:</span>
        <span class="detail-value">
          {sourceFile}
          {#if lineNumber}
            <span class="line-number">:{lineNumber}</span>
          {/if}
        </span>
      </div>
    {/if}
  </div>
</div>

<style>
  .obsidian-source-info {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px;
    border-radius: 6px;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
  }

  .source-header {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .source-icon {
    display: flex;
    align-items: center;
    color: var(--text-muted);
  }

  .source-label {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-normal);
  }

  .source-details {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .detail-row {
    display: flex;
    gap: 6px;
    font-size: 12px;
  }

  .detail-label {
    color: var(--text-muted);
    font-weight: 500;
    min-width: 60px;
  }

  .detail-value {
    color: var(--text-normal);
    font-family: var(--font-monospace);
    word-break: break-all;
  }

  .promoted-from {
    margin-top: 4px;
    padding-top: 6px;
    border-top: 1px solid var(--background-modifier-border);
  }

  .line-number {
    color: var(--text-muted);
  }
</style>

