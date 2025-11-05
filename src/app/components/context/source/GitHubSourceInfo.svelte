<script lang="ts">
  /**
   * GitHubSourceInfo - Displays GitHub-specific source information
   */

  import type { Task } from "../../../core/entities";

  interface Props {
    task: Task;
  }

  let { task }: Props = $props();

  // Extract GitHub URL from source keys
  const githubUrl = $derived(task.source.keys.github || "");

  // Extract repository and issue/PR number from URL
  const urlParts = $derived(() => {
    if (!githubUrl) return null;
    
    // URL format: https://github.com/owner/repo/issues/123 or /pull/123
    const match = githubUrl.match(/github\.com\/([^/]+)\/([^/]+)\/(issues|pull)\/(\d+)/);
    if (!match) return null;
    
    return {
      owner: match[1],
      repo: match[2],
      type: match[3] === "pull" ? "PR" : "Issue",
      number: match[4],
    };
  });

  // Extract useful info from source.data if available
  const sourceData = $derived(task.source.data);
  const state = $derived(sourceData?.state || "");
  const merged = $derived(sourceData?.merged_at ? true : false);

  // Determine status badge
  const statusInfo = $derived(() => {
    if (!state) return null;
    
    if (merged) {
      return { label: "Merged", color: "purple" };
    }
    
    if (state === "closed") {
      return { label: "Closed", color: "red" };
    }
    
    if (state === "open") {
      return { label: "Open", color: "green" };
    }
    
    return { label: state, color: "gray" };
  });
</script>

<div class="github-source-info">
  {#if urlParts()}
    <div class="source-header">
      <span class="source-icon">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
        </svg>
      </span>
      <span class="source-label">GitHub</span>
      {#if statusInfo()}
        <span class="status-badge status-{statusInfo()?.color}">
          {statusInfo()?.label}
        </span>
      {/if}
    </div>
    
    <div class="source-details">
      <div class="detail-row">
        <span class="detail-label">{urlParts()?.type}:</span>
        <span class="detail-value">
          {urlParts()?.owner}/{urlParts()?.repo}#{urlParts()?.number}
        </span>
      </div>
      
      {#if githubUrl}
        <a 
          href={githubUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          class="github-link"
        >
          View on GitHub →
        </a>
      {/if}
    </div>
  {:else}
    <div class="source-header">
      <span class="source-label">GitHub</span>
    </div>
    <div class="source-details">
      <span class="detail-value">No GitHub URL available</span>
    </div>
  {/if}
</div>

<style>
  .github-source-info {
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

  .status-badge {
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  .status-badge.status-green {
    background: rgba(46, 160, 67, 0.15);
    color: rgb(46, 160, 67);
  }

  .status-badge.status-red {
    background: rgba(218, 54, 51, 0.15);
    color: rgb(218, 54, 51);
  }

  .status-badge.status-purple {
    background: rgba(137, 87, 229, 0.15);
    color: rgb(137, 87, 229);
  }

  .status-badge.status-gray {
    background: var(--background-modifier-border);
    color: var(--text-muted);
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
  }

  .detail-value {
    color: var(--text-normal);
    font-family: var(--font-monospace);
  }

  .github-link {
    font-size: 12px;
    color: var(--interactive-accent);
    text-decoration: none;
    transition: color 0.2s;
  }

  .github-link:hover {
    color: var(--interactive-accent-hover);
    text-decoration: underline;
  }
</style>

