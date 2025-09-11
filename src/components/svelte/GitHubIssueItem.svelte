<script lang="ts">
  /**
   * GitHubIssueItem - Specialized TaskItem for GitHub issues
   */

  import TaskItem from "./TaskItem.svelte";
  import type { GitHubIssue } from "../../services/GitHubService";

  interface Props {
    issue: GitHubIssue;
    isHovered?: boolean;
    isImported?: boolean;
    isImporting?: boolean;
    onHover?: (hovered: boolean) => void;
    onImport?: (issue: GitHubIssue) => void;
    dayPlanningMode?: boolean;
    testId?: string;
  }

  let {
    issue,
    isHovered = false,
    isImported = false,
    isImporting = false,
    onHover,
    onImport,
    dayPlanningMode = false,
    testId,
  }: Props = $props();

  // Convert issue data to TaskItem format
  let subtitle = $derived(`#${issue.number}`);

  let meta = $derived.by(() => {
    const parts: string[] = [];

    if (issue.assignee) {
      parts.push(`Assigned to ${issue.assignee.login}`);
    }

    parts.push(issue.state);
    parts.push(new Date(issue.created_at).toLocaleDateString());

    return parts.join(" • ");
  });

  let badges = $derived.by(() => {
    const result: Array<{
      text: string;
      type: "category" | "status" | "priority" | "project" | "area";
    }> = [];

    // Add status badge
    result.push({
      text: issue.state === "open" ? "Open" : "Closed",
      type: "status",
    });

    return result;
  });

  let labels = $derived.by(() => {
    return issue.labels.map((label) => ({
      name: label.name,
      color: label.color ? `#${label.color}` : undefined,
    }));
  });

  function handleImport() {
    onImport?.(issue);
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
        title={dayPlanningMode ? "Add to today" : "Import this issue as a task"}
        onclick={handleImport}
        data-testid={dayPlanningMode
          ? "add-to-today-button"
          : "issue-import-button"}
      >
        {dayPlanningMode ? "Add to today" : "Import"}
      </button>
    {/if}
  </div>
{/snippet}

<TaskItem
  title={issue.title}
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
