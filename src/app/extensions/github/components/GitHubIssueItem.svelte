<script lang="ts">
  /**
   * GitHubIssueItem - Specialized TaskItem for GitHub issues
   */

  import TaskItem from "../../../components/TaskItem.svelte";
  import ImportButton from "../../../components/ImportButton.svelte";
  import SeeOnServiceButton from "../../../components/SeeOnServiceButton.svelte";
  import type { GitHubIssue } from "../cache/schemas/github";
  import type { Host } from "../core/host";
  import type { Task } from "../core/entities";
  import type { TaskSyncSettings } from "../types/settings";

  interface Props {
    task: Task; // Task object with GitHub issue data in source.data
    repository?: string; // Repository name in format "owner/repo"
    isHovered?: boolean;
    isImported?: boolean;
    isImporting?: boolean;
    isScheduled?: boolean;
    scheduledDate?: Date;
    dayPlanningMode?: boolean;
    dailyPlanningWizardMode?: boolean;
    testId?: string;
    onHover?: (hovered: boolean) => void;
    onImport?: (task: Task) => void;
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

  // Extract GitHub issue data from task.source.data
  let issue = $derived(task.source?.data as GitHubIssue | undefined);

  // Guard against missing issue data
  let subtitle = $derived(issue ? `#${issue.number}` : "");

  let meta = $derived.by(() => {
    if (!issue) return "";

    const parts: string[] = [];

    if (issue.assignee) {
      parts.push(`Assigned to ${issue.assignee.login}`);
    }

    // Note: Removed redundant state and timestamp as they're shown elsewhere
    return parts.join(" • ");
  });

  // Convert GitHub labels to TaskItem format
  let labels = $derived(
    issue?.labels?.map((label) => ({
      name: label.name,
      color: label.color ? `#${label.color}` : undefined,
    })) || []
  );

  // Create badges for issue state
  let badges = $derived.by(() => {
    const result: Array<{
      text: string;
      type: "category" | "status" | "priority" | "project" | "area";
    }> = [];

    // Add state badge
    if (issue?.state) {
      result.push({
        text: issue.state,
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
  {#if dailyPlanningWizardMode && !isScheduled}
    <ImportButton
      isImported={false}
      {isImporting}
      {dayPlanningMode}
      {dailyPlanningWizardMode}
      testId="schedule-for-today-button"
      onImport={handleImport}
    />
  {:else if isImported}
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
      testId={dayPlanningMode
        ? "add-to-today-button"
        : isImporting
          ? "importing-indicator"
          : "issue-import-button"}
      onImport={handleImport}
    />
  {/if}
  {#if issue}
    <SeeOnServiceButton
      serviceName="GitHub"
      url={issue.html_url}
      testId="see-on-github-button"
    />
  {/if}
{/snippet}

{#if issue}
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
    {isScheduled}
    {scheduledDate}
    {onHover}
    {settings}
    {testId}
    actionContent={true}
    actions={actionSnippet}
  />
{:else}
  <div class="error-message">
    Error: Missing GitHub issue data for task {task.id}
  </div>
{/if}

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
