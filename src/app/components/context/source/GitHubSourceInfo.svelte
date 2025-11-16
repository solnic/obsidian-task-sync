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

<span class="github-source-info">
  {#if urlParts()}
    <span class="source-ref">
      {urlParts()?.owner}/{urlParts()?.repo}#{urlParts()?.number}
    </span>
    {#if statusInfo()}
      <span class="status-badge status-{statusInfo()?.color}">
        {statusInfo()?.label}
      </span>
    {/if}
    {#if githubUrl}
      <a 
        href={githubUrl} 
        target="_blank" 
        rel="noopener noreferrer"
        class="github-link"
        title="View on GitHub"
      >
        →
      </a>
    {/if}
  {:else}
    <span class="source-no-url">No GitHub URL</span>
  {/if}
</span>

<style>
  .github-source-info {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    font-size: 11px;
  }

  .source-ref {
    color: var(--text-normal);
    font-family: var(--font-monospace);
    font-weight: 500;
  }

  .status-badge {
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 9px;
    font-weight: 600;
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

  .github-link {
    color: var(--interactive-accent);
    text-decoration: none;
    transition: color 0.2s;
    font-size: 12px;
  }

  .github-link:hover {
    color: var(--interactive-accent-hover);
  }

  .source-no-url {
    color: var(--text-muted);
    font-style: italic;
  }
</style>

