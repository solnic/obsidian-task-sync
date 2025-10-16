<script lang="ts">
  /**
   * GitHubPullRequestItem - Specialized TaskItem for GitHub pull requests
   */

  import TaskItem from "../../../components/TaskItem.svelte";
  import ImportButton from "../../../components/ImportButton.svelte";
  import SeeOnServiceButton from "../../../components/SeeOnServiceButton.svelte";
  import type { GitHubPullRequest } from "../cache/schemas/github";
  import type { Host } from "../core/host";
  import type { Task } from "../core/entities";
  import type { TaskSyncSettings } from "../types/settings";

  interface Props {
    task: Task; // Task object with GitHub PR data in source.data
    repository?: string;
    isHovered?: boolean;
    isImported?: boolean;
    isImporting?: boolean;
    isScheduled?: boolean;
    scheduledDate?: Date;
    onHover?: (hovered: boolean) => void;
    onImport?: (task: Task) => void;
    dayPlanningMode?: boolean;
    dailyPlanningWizardMode?: boolean;
    testId?: string;
    host: Host;
    settings?: TaskSyncSettings;
  }

  let {
    task,
    repository,
    isHovered = false,
    isImported = false,
    isImporting = false,
    isScheduled = false,
    scheduledDate,
    onHover,
    onImport,
    dayPlanningMode = false,
    dailyPlanningWizardMode = false,
    testId,
    host,
    settings,
  }: Props = $props();

  // Extract GitHub PR data from task.source.data
  let pullRequest = $derived(task.source?.data as GitHubPullRequest);

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

  // Convert GitHub labels to TaskItem format
  let labels = $derived(
    pullRequest.labels.map((label) => ({
      name: label.name,
      color: label.color ? `#${label.color}` : undefined,
    }))
  );

  // Create badges for PR state
  let badges = $derived.by(() => {
    const result: Array<{
      text: string;
      type: "category" | "status" | "priority" | "project" | "area";
    }> = [];

    // Add state badge
    if (pullRequest.state) {
      result.push({
        text: pullRequest.state,
        type: "status",
      });
    }

    return result;
  });

  // Footer badges (repository info)
  let footerBadges = $derived.by(() => {
    const badges = [];

    if (repository) {
      badges.push({ type: "Repository", text: repository });
    }

    return badges;
  });

  function handleImport() {
    onImport?.(task);
  }

  async function handleOpenTask() {
    try {
      // The task is already the imported task, just open it
      if (isImported) {
        await host.openFile(task);
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
    {:else}
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
    {/if}
    <SeeOnServiceButton
      serviceName="GitHub"
      url={pullRequest.html_url}
      testId="see-on-github-button"
    />
  </div>
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
  {isScheduled}
  {scheduledDate}
  {onHover}
  {settings}
  actionContent={true}
  actions={actionSnippet}
  {testId}
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
