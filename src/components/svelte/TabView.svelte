<script lang="ts">
  /**
   * TabView - Abstract component for TasksView and ContextTabView
   * Provides unified layout with ContextWidget in header and standardized content container
   */

  import ContextWidget from "./ContextWidget.svelte";
  import type { Snippet } from "svelte";

  interface Props {
    className?: string;
    testId?: string;
    showContextWidget?: boolean;
    isNonLocalService?: boolean;
    dayPlanningMode?: boolean;
    serviceName?: string;
    children: Snippet;
  }

  let {
    className = "",
    testId,
    showContextWidget = true,
    isNonLocalService = false,
    dayPlanningMode = false,
    serviceName,
    children,
  }: Props = $props();
</script>

<div class="task-sync-tab-view {className}" data-testid={testId}>
  <!-- Context Widget Header -->
  {#if showContextWidget}
    <div class="task-sync-tab-header">
      <ContextWidget {isNonLocalService} {dayPlanningMode} {serviceName} />
    </div>
  {/if}

  <!-- Main Content Area -->
  <div class="task-sync-tab-content">
    {@render children()}
  </div>
</div>

<style>
  .task-sync-tab-view {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .task-sync-tab-header {
    padding: 16px;
    border-bottom: 1px solid var(--background-modifier-border);
    background: var(--background-secondary);
  }

  .task-sync-tab-content {
    flex: 1;
    overflow-y: auto;
  }
</style>
