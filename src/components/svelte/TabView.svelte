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
    showImportIndicator?: boolean;
    children: Snippet;
  }

  let {
    className = "",
    testId,
    showContextWidget = true,
    showImportIndicator = false,
    children,
  }: Props = $props();
</script>

<div class="task-sync-tab-view {className}" data-testid={testId}>
  <!-- Context Widget Header -->
  {#if showContextWidget}
    <div class="task-sync-tab-header">
      <ContextWidget {showImportIndicator} />
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
    background: var(--background-primary);
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
