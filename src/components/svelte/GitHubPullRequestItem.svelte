<script lang="ts">
  /**
   * GitHubPullRequestItem - Specialized TaskItem for GitHub pull requests
   */

  import TaskItem from "./TaskItem.svelte";
  import type { GitHubPullRequest } from "../../services/GitHubService";
  import { getPluginContext } from "./context";
  import { taskStore } from "../../stores/taskStore";
  import type { Task } from "../../types/entities";

  interface Props {
    pullRequest: GitHubPullRequest;
    repository?: string;
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
    repository,
    isHovered = false,
    isImported = false,
    isImporting = false,
    onHover,
    onImport,
    dayPlanningMode = false,
    testId,
  }: Props = $props();

  const { plugin } = getPluginContext();

  // Convert pull request data to TaskItem format
  let subtitle = $derived(`#${pullRequest.number}`);

  let meta = $derived.by(() => {
    const parts: string[] = [];

    if (pullRequest.assignee) {
      parts.push(`Assigned to ${pullRequest.assignee.login}`);
    }

    // Keep branch information as it's useful and not shown elsewhere
    parts.push(`${pullRequest.head.ref} → ${pullRequest.base.ref}`);

    // Note: Removed redundant state and timestamp as they're shown elsewhere
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

  // Location for footer (repository name)
  let location = $derived(repository ? `Repository: ${repository}` : undefined);

  let labels = $derived.by(() => {
    return pullRequest.labels.map((label) => ({
      name: label.name,
      // Pull request labels don't have color in the current type definition
      color: undefined as string | undefined,
    }));
  });

  function handleImport() {
    onImport?.(pullRequest);
  }

  function handleSeeOnGitHub() {
    window.open(pullRequest.html_url, "_blank");
  }

  async function handleOpenTask() {
    try {
      // Find the imported task file by searching for the GitHub PR URL or number
      const tasks = taskStore.getEntities();
      const matchingTask = tasks.find(
        (task: Task) =>
          task.source?.url === pullRequest.html_url ||
          (task.source?.name === "GitHub" && task.title === pullRequest.title)
      );

      if (matchingTask && matchingTask.file) {
        await plugin.app.workspace.getLeaf().openFile(matchingTask.file);
      } else {
        // Fallback: try to find by title
        const vault = plugin.app.vault;
        const files = vault.getMarkdownFiles();
        const taskFile = files.find(
          (file) => file.basename === pullRequest.title
        );
        if (taskFile) {
          await plugin.app.workspace.getLeaf().openFile(taskFile);
        }
      }
    } catch (error) {
      console.error("Failed to open task:", error);
    }
  }
</script>

{#snippet actionSnippet()}
  <div class="import-actions">
    {#if isImported}
      <button
        class="open-task-button"
        title="Open task"
        onclick={handleOpenTask}
        data-testid="open-task-button"
      >
        Open
      </button>
    {/if}
    <button
      class="github-link-button"
      title="See on GitHub"
      onclick={handleSeeOnGitHub}
      data-testid="see-on-github-button"
    >
      See on GitHub
    </button>
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
  {location}
  createdAt={new Date(pullRequest.created_at)}
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

  .github-link-button {
    padding: 8px 16px;
    border: 1px solid var(--interactive-normal);
    background: var(--background-primary);
    color: var(--text-normal);
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
    transition: all 0.2s ease;
  }

  .github-link-button:hover {
    background: var(--background-modifier-hover);
    border-color: var(--interactive-hover);
  }

  .open-task-button {
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

  .open-task-button:hover {
    background: var(--interactive-accent-hover);
    border-color: var(--interactive-accent-hover);
  }
</style>
