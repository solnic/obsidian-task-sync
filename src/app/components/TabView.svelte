<script lang="ts">
  /**
   * TabView - Layout component for the new architecture
   * Provides unified layout with optional header and context widget support
   * Prepared for Context system integration
   */

  import type { Snippet } from "svelte";

  interface Props {
    className?: string;
    testId?: string;
    showHeader?: boolean;
    headerTitle?: string;
    // Context widget support (for future Context system integration)
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
        <!-- Context Widget (when Context system is ported) -->
        <div
          class="context-widget-placeholder"
          data-testid="context-widget-placeholder"
        >
          <!-- TODO: Replace with actual ContextWidget when Context system is ported -->
          <div class="context-content">
            <div class="context-row context-row-primary">
              {#if serviceName}
                <span class="service-name">{serviceName}</span>
              {/if}
            </div>
            <div class="context-row context-row-secondary">
              <span class="no-context">Context system not yet ported</span>
            </div>
          </div>
        </div>
      {:else if headerTitle}
        <!-- Simple header title (current implementation) -->
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

  /* Context Widget Placeholder Styles */
  .context-widget-placeholder {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .context-content {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .context-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .context-row-primary {
    font-size: 16px;
    font-weight: 600;
  }

  .context-row-secondary {
    font-size: 14px;
    color: var(--text-muted);
  }

  .service-name {
    color: var(--text-normal);
  }

  .no-context {
    color: var(--text-muted);
    font-style: italic;
  }

  .task-sync-tab-content {
    flex: 1;
    overflow-y: auto;
  }
</style>
