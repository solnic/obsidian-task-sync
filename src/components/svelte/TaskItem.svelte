<script lang="ts">
  /**
   * Generic TaskItem component that provides a unified structure for task items
   * across different services (Local Tasks, GitHub Issues, etc.)
   */

  import type { Snippet } from "svelte";

  interface Props {
    // Core item data
    title: string;
    subtitle?: string; // e.g., issue number, task ID
    meta?: string; // e.g., assignee, dates, status
    labels?: Array<{ name: string; color?: string }>; // tags, labels, categories
    badges?: Array<{
      text: string;
      type: "category" | "status" | "priority" | "project" | "area";
    }>; // standardized badges

    // State
    isHovered?: boolean;
    isImported?: boolean;
    isSelected?: boolean;

    // Behavior
    onHover?: (hovered: boolean) => void;

    // Test attributes
    testId?: string;

    // Custom content slots
    customContent?: boolean; // Allow custom content in slot
    actionContent?: boolean; // Allow custom action overlay
    children?: Snippet;
    actions?: Snippet<[]>;
  }

  let {
    title,
    subtitle,
    meta,
    labels = [],
    badges = [],
    isHovered = false,
    isImported = false,
    isSelected = false,
    onHover,
    testId,
    customContent = false,
    actionContent = false,
    children,
    actions,
  }: Props = $props();

  function handleMouseEnter() {
    onHover?.(true);
  }

  function handleMouseLeave() {
    onHover?.(false);
  }

  // Badge type to CSS class mapping
  function getBadgeClass(type: string): string {
    switch (type) {
      case "category":
        return "task-sync-category-badge";
      case "status":
        return "task-sync-status-badge";
      case "priority":
        return "task-sync-priority-badge";
      case "project":
        return "task-sync-project-badge";
      case "area":
        return "task-sync-area-badge";
      default:
        return "task-sync-generic-badge";
    }
  }
</script>

<!-- Unified TaskItem - always renders as div with consistent structure -->
<div
  class="task-sync-task-list-item {isHovered ? 'hovered' : ''} {isImported
    ? 'imported'
    : ''} {isSelected ? 'selected' : ''}"
  onmouseenter={handleMouseEnter}
  onmouseleave={handleMouseLeave}
  data-testid={testId}
  role="listitem"
>
  <div class="task-sync-task-list-item-content">
    {#if customContent && children}
      <!-- Allow custom content via snippet -->
      {@render children()}
    {:else}
      <!-- Standard content structure -->
      <div class="task-sync-item-header">
        <div class="task-sync-item-title">{title}</div>
        {#if subtitle}
          <div class="task-sync-item-subtitle">{subtitle}</div>
        {/if}
      </div>

      {#if meta}
        <div class="task-sync-item-meta">{meta}</div>
      {/if}

      {#if badges.length > 0}
        <div class="task-sync-item-badges">
          {#each badges as badge}
            <span class={getBadgeClass(badge.type)}>{badge.text}</span>
          {/each}
        </div>
      {/if}

      {#if labels.length > 0}
        <div class="task-sync-item-labels">
          {#each labels as label}
            <span
              class="task-sync-item-label"
              style={label.color ? `background-color: ${label.color}` : ""}
            >
              {label.name}
            </span>
          {/each}
        </div>
      {/if}
    {/if}
  </div>

  <!-- Action overlay snippet -->
  {#if actionContent && isHovered && actions}
    <div class="task-sync-action-overlay">
      {@render actions()}
    </div>
  {/if}
</div>

<style>
  .task-sync-item-header {
    margin-bottom: 0.25rem;
  }

  .task-sync-item-title {
    font-weight: 600;
    font-size: 13px;
    color: var(--text-normal);
    line-height: 1.3;
    margin-bottom: 2px;
  }

  .task-sync-item-subtitle {
    font-size: 11px;
    color: var(--text-muted);
    font-family: var(--font-monospace);
  }

  .task-sync-item-meta {
    font-size: 11px;
    color: var(--text-muted);
    margin-bottom: 6px;
    line-height: 1.2;
  }

  .task-sync-item-badges {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-bottom: 0.5rem;
  }

  .task-sync-item-labels {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .task-sync-item-label {
    padding: 2px 6px;
    border-radius: 12px;
    background: var(--background-modifier-border);
    color: var(--text-muted);
    font-size: 10px;
    font-weight: 500;
  }

  /* Badge styles */
  .task-sync-category-badge,
  .task-sync-status-badge,
  .task-sync-priority-badge,
  .task-sync-project-badge,
  .task-sync-area-badge,
  .task-sync-generic-badge {
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 0.75em;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: white;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
    min-width: 60px;
    text-align: center;
  }

  .task-sync-project-badge {
    background-color: #3b82f6;
  }

  .task-sync-area-badge {
    background-color: #10b981;
  }

  .task-sync-generic-badge {
    background-color: var(--background-modifier-border);
    color: var(--text-muted);
    text-shadow: none;
  }

  .task-sync-action-overlay {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    background: rgba(var(--background-primary-rgb), 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    opacity: 1;
    transition: opacity 0.2s ease;
    z-index: 10;
  }
</style>
