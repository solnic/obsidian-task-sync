<script lang="ts">
  /**
   * GitHubPullRequestItem - Specialized TaskItem for GitHub pull requests
   */

  import TaskItem from "./TaskItem.svelte";
  import type { GitHubPullRequest } from "../../services/GitHubService";

  interface Props {
    pullRequest: GitHubPullRequest;
    isHovered?: boolean;
    isImported?: boolean;
    isImporting?: boolean;
    onHover?: (hovered: boolean) => void;
    onImport?: (pr: GitHubPullRequest) => void;
    dayPlanningMode?: boolean;
    testId?: string;
  }

  let {
    pullRequest,
    isHovered = false,
    isImported = false,
    isImporting = false,
    onHover,
    onImport,
    dayPlanningMode = false,
    testId,
  }: Props = $props();

  // Convert pull request data to TaskItem format
  let subtitle = $derived(`#${pullRequest.number}`);

  let meta = $derived.by(() => {
    const parts: string[] = [];

    if (pullRequest.assignee) {
      parts.push(`Assigned to ${pullRequest.assignee.login}`);
    }

    let stateText = pullRequest.state;
    if (pullRequest.merged_at) {
      stateText += " (merged)";
    } else if (pullRequest.draft) {
      stateText += " (draft)";
    }
    parts.push(stateText);

    parts.push(new Date(pullRequest.created_at).toLocaleDateString());
    parts.push(`${pullRequest.head.ref} → ${pullRequest.base.ref}`);

    return parts.join(" • ");
  });

  let badges = $derived.by(() => {
    const result: Array<{
      text: string;
      type: "category" | "status" | "priority" | "project" | "area";
    }> = [];

    // Add status badge
    let statusText = pullRequest.state === "open" ? "Open" : "Closed";
    if (pullRequest.merged_at) {
      statusText = "Merged";
    } else if (pullRequest.draft) {
      statusText = "Draft";
    }

    result.push({
      text: statusText,
      type: "status",
    });

    return result;
  });

  let labels = $derived.by(() => {
    return pullRequest.labels.map((label) => ({
      name: label.name,
      color: label.color ? `#${label.color}` : undefined,
    }));
  });

  function handleImport() {
    onImport?.(pullRequest);
  }
</script>

{#snippet actionSnippet()}
  <div class="import-actions">
    {#if isImported}
      <span class="import-status imported" data-testid="imported-indicator">
        ✓ Imported
      </span>
    {:else if isImporting}
      <span class="import-status importing" data-testid="importing-indicator">
        ⏳ Importing...
      </span>
    {:else}
      <button
        class="import-button"
        title={dayPlanningMode
          ? "Add to today"
          : "Import this pull request as a task"}
        onclick={handleImport}
        data-testid={dayPlanningMode
          ? "add-to-today-button"
          : "pr-import-button"}
      >
        {dayPlanningMode ? "Add to today" : "Import"}
      </button>
    {/if}
  </div>
{/snippet}

<TaskItem
  title={pullRequest.title}
  {subtitle}
  {meta}
  {badges}
  {labels}
  {isHovered}
  {isImported}
  {onHover}
  {testId}
  actionContent={true}
  actions={actionSnippet}
/>

<style>
  .import-actions {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 8px 16px;
  }

  .import-button {
    padding: 8px 16px;
    border: 1px solid var(--interactive-accent);
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
    transition: all 0.2s ease;
  }

  .import-button:hover {
    background: var(--interactive-accent-hover);
    border-color: var(--interactive-accent-hover);
  }

  .import-status {
    padding: 8px 16px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
  }

  .import-status.imported {
    background: var(--color-green);
    color: white;
  }

  .import-status.importing {
    background: var(--color-yellow);
    color: var(--text-normal);
  }
</style>
