<script lang="ts">
  /**
   * GitHubIssueItem - Specialized TaskItem for GitHub issues
   */

  import TaskItem from "./TaskItem.svelte";
  import ImportButton from "./ImportButton.svelte";
  import type { GitHubIssue } from "../../services/GitHubService";
  import { getPluginContext } from "./context";
  import { taskStore } from "../../stores/taskStore";
  import type { Task } from "../../types/entities";
  import moment from "moment";

  interface Props {
    issue: GitHubIssue;
    repository?: string; // Repository name in format "owner/repo"
    isHovered?: boolean;
    isImported?: boolean;
    isImporting?: boolean;
    dayPlanningMode?: boolean;
    testId?: string;
    onHover?: (hovered: boolean) => void;
    onImport?: (issue: GitHubIssue) => void;
  }

  let {
    issue,
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

  let subtitle = $derived(`#${issue.number}`);

  let meta = $derived.by(() => {
    const parts: string[] = [];

    if (issue.assignee) {
      parts.push(`Assigned to ${issue.assignee.login}`);
    }

    // Note: Removed redundant state and timestamp as they're shown elsewhere
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

  let footerBadges = $derived.by(() => {
    const badges = [];

    badges.push({ type: "Repo", text: repository });

    return badges;
  });

  function handleImport() {
    onImport?.(issue);
  }

  function handleSeeOnGitHub() {
    window.open(issue.html_url, "_blank");
  }

  async function handleOpenTask() {
    try {
      // Find the imported task file by searching for the GitHub issue URL or number
      const tasks = taskStore.getEntities();
      const matchingTask = tasks.find(
        (task: Task) =>
          task.source?.url === issue.html_url ||
          (task.source?.name === "GitHub" && task.title === issue.title)
      );

      if (matchingTask && matchingTask.file) {
        await plugin.app.workspace.getLeaf().openFile(matchingTask.file);
      } else {
        // Fallback: try to find by title
        const vault = plugin.app.vault;
        const files = vault.getMarkdownFiles();
        const taskFile = files.find((file) => file.basename === issue.title);
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
    <ImportButton
      {isImported}
      {isImporting}
      {dayPlanningMode}
      title={dayPlanningMode ? "Add to today" : "Import this issue as a task"}
      testId={dayPlanningMode
        ? "add-to-today-button"
        : isImported
          ? "imported-indicator"
          : isImporting
            ? "importing-indicator"
            : "issue-import-button"}
      onImport={handleImport}
    />
  </div>
{/snippet}

<TaskItem
  title={issue.title}
  {subtitle}
  {meta}
  {badges}
  {footerBadges}
  {labels}
  createdAt={new Date(issue.created_at)}
  updatedAt={new Date(issue.updated_at)}
  {isHovered}
  {isImported}
  {onHover}
  {testId}
  actionContent={true}
  actions={actionSnippet}
/>

<style>
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
