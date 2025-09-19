<script lang="ts">
  /**
   * GitHubPullRequestItem - Specialized TaskItem for GitHub pull requests
   */

  import TaskItem from "./TaskItem.svelte";
  import ImportButton from "./ImportButton.svelte";
  import SeeOnServiceButton from "./SeeOnServiceButton.svelte";
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
    dailyPlanningWizardMode?: boolean;
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
    dailyPlanningWizardMode = false,
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

  let footerBadges = $derived.by(() => {
    const badges = [];

    badges.push({ type: "Repo", text: repository });

    return badges;
  });

  function handleImport() {
    onImport?.(pullRequest);
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
    <ImportButton
      {isImported}
      {isImporting}
      {dayPlanningMode}
      {dailyPlanningWizardMode}
      testId={dailyPlanningWizardMode
        ? "schedule-for-today-button"
        : dayPlanningMode
          ? "add-to-today-button"
          : isImported
            ? "imported-indicator"
            : isImporting
              ? "importing-indicator"
              : "pr-import-button"}
      onImport={handleImport}
    />
  </div>
{/snippet}

{#snippet secondaryActionSnippet()}
  <SeeOnServiceButton
    serviceName="GitHub"
    url={pullRequest.html_url}
    testId="see-on-github-button"
  />
{/snippet}

<TaskItem
  title={pullRequest.title}
  {subtitle}
  {meta}
  {badges}
  {labels}
  {footerBadges}
  createdAt={new Date(pullRequest.created_at)}
  updatedAt={new Date(pullRequest.updated_at)}
  {isHovered}
  {isImported}
  {onHover}
  {testId}
  actionContent={true}
  actions={actionSnippet}
  secondaryActions={secondaryActionSnippet}
/>

<style>
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
