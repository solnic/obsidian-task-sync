<script lang="ts">
  /**
   * GitHubPullRequestItem - Specialized TaskItem for GitHub pull requests
   */

  import TaskItem from "./TaskItem.svelte";
  import ImportButton from "./ImportButton.svelte";
  import SeeOnServiceButton from "./SeeOnServiceButton.svelte";
  import type { GitHubPullRequest } from "../cache/schemas/github";
  import type { Host } from "../core/host";
  import { taskStore } from "../stores/taskStore";
  import type { Task } from "../core/entities";
  import type { TaskSyncSettings } from "../types/settings";

  interface Props {
    pullRequest: GitHubPullRequest;
    repository?: string;
    isHovered?: boolean;
    isImported?: boolean;
    isImporting?: boolean;
    isScheduled?: boolean;
    scheduledDate?: Date;
    onHover?: (hovered: boolean) => void;
    onImport?: (pr: GitHubPullRequest) => void;
    dayPlanningMode?: boolean;
    dailyPlanningWizardMode?: boolean;
    testId?: string;
    host: Host;
    settings?: TaskSyncSettings;
  }

  let {
    pullRequest,
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
    onImport?.(pullRequest);
  }

  // Subscribe to task store to get current tasks
  let tasks = $state<readonly Task[]>([]);
  $effect(() => {
    const unsubscribe = taskStore.subscribe((state) => {
      tasks = state.tasks;
    });
    return unsubscribe;
  });

  async function handleOpenTask() {
    try {
      // Find the imported task file by searching for the GitHub PR URL or number
      const matchingTask = tasks.find(
        (task: Task) =>
          task.source?.url === pullRequest.html_url ||
          (task.source?.extension === "github" &&
            task.title === pullRequest.title)
      );

      if (matchingTask) {
        await host.openFile(matchingTask);
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
  {isScheduled}
  {scheduledDate}
  {onHover}
  {settings}
  actionContent={true}
  actions={actionSnippet}
  secondaryActions={secondaryActionSnippet}
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
