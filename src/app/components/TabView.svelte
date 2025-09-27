<script lang="ts">
  /**
   * TabView - Simplified layout component for the new architecture
   * Provides unified layout with optional header and standardized content container
   */

  import type { Snippet } from "svelte";

  interface Props {
    className?: string;
    testId?: string;
    showHeader?: boolean;
    headerTitle?: string;
    children: Snippet;
  }

  let {
    className = "",
    testId,
    showHeader = false,
    headerTitle,
    children,
  }: Props = $props();
</script>

<div class="task-sync-tab-view {className}" data-testid={testId}>
  <!-- Optional Header -->
  {#if showHeader}
    <div class="task-sync-tab-header">
      {#if headerTitle}
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
