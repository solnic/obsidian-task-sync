<script lang="ts">
  /**
   * TabView - Layout component for the new architecture
   * Provides unified layout with optional header and context widget support
   * Now includes actual ContextWidget integration
   */

  import type { Snippet } from "svelte";
  import ContextWidget from "./ContextWidget.svelte";

  interface Props {
    className?: string;
    testId?: string;
    showHeader?: boolean;
    headerTitle?: string;
    // Context widget support
    showContextWidget?: boolean;
    serviceName?: string;
    isNonLocalService?: boolean;
    dayPlanningMode?: boolean;
    children: Snippet;
  }

  let {
    className = "",
    testId,
    showHeader = false,
    headerTitle,
    showContextWidget = false,
    serviceName,
    isNonLocalService = false,
    dayPlanningMode = false,
    children,
  }: Props = $props();
</script>

<div class="task-sync-tab-view {className}" data-testid={testId}>
  <!-- Header with Context Widget Support -->
  {#if showHeader || showContextWidget}
    <div class="task-sync-tab-header">
      {#if showContextWidget}
        <!-- Context Widget -->
        <ContextWidget {serviceName} {isNonLocalService} {dayPlanningMode} />
      {:else if headerTitle}
        <!-- Simple header title (fallback) -->
        <h2 class="tab-title">{headerTitle}</h2>
      {/if}
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

  .tab-title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--text-normal);
  }

  .task-sync-tab-content {
    flex: 1;
    overflow-y: auto;
  }
</style>
