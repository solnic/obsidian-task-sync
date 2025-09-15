<script lang="ts">
  /**
   * Generic TaskItem component that provides a unified structure for task items
   * across different services (Local Tasks, GitHub Issues, etc.)
   */

  import type { Snippet } from "svelte";
  import { getPluginContext } from "./context";
  import CategoryBadge from "./badges/CategoryBadge.svelte";
  import StatusBadge from "./badges/StatusBadge.svelte";
  import PriorityBadge from "./badges/PriorityBadge.svelte";
  import ProjectBadge from "./badges/ProjectBadge.svelte";
  import AreaBadge from "./badges/AreaBadge.svelte";
  import LabelBadge from "./badges/LabelBadge.svelte";

  import { getOptimalTextColor } from "../../utils/colorUtils";
  import moment from "moment";

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
    footerBadges?: Array<{ type: string; text: string }>; // Footer badges (project, area, source)
    createdAt?: Date; // Creation date for footer display
    updatedAt?: Date; // Updated date for footer display

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
    footerBadges = [],
    createdAt,
    updatedAt,
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

  const { plugin } = getPluginContext();

  function handleMouseEnter() {
    onHover?.(true);
  }

  function handleMouseLeave() {
    onHover?.(false);
  }

  // Get color for badge types that have configurable colors
  function getBadgeColor(type: string, text: string): string | undefined {
    switch (type) {
      case "category":
        return plugin.settings.taskTypes.find((t) => t.name === text)?.color;
      case "status":
        return plugin.settings.taskStatuses.find((s) => s.name === text)?.color;
      case "priority":
        return plugin.settings.taskPriorities.find((p) => p.name === text)
          ?.color;
      default:
        return undefined;
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
  data-imported={isImported ? "true" : "false"}
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
            {#if badge.type === "category"}
              <CategoryBadge
                category={badge.text}
                color={getBadgeColor(badge.type, badge.text)}
                size="small"
              />
            {:else if badge.type === "status"}
              <StatusBadge
                status={badge.text}
                color={getBadgeColor(badge.type, badge.text)}
                size="small"
              />
            {:else if badge.type === "priority"}
              <PriorityBadge
                priority={badge.text}
                color={getBadgeColor(badge.type, badge.text)}
                size="small"
              />
            {:else}
              <span class="task-sync-generic-badge">{badge.text}</span>
            {/if}
          {/each}
        </div>
      {/if}

      {#if labels.length > 0}
        <div class="task-sync-item-labels">
          {#each labels as label}
            <span
              class="task-sync-item-label"
              style={label.color
                ? `background-color: ${label.color}; color: ${getOptimalTextColor(label.color)}`
                : ""}
            >
              {label.name}
            </span>
          {/each}
        </div>
      {/if}
    {/if}

    <!-- Footer with badges and timestamp info -->
    {#if footerBadges.length > 0 || createdAt || updatedAt}
      <div class="task-sync-item-footer">
        <div class="task-sync-footer-left">
          {#each footerBadges as badge}
            <LabelBadge label={badge.type} value={badge.text} size="medium" />
          {/each}
        </div>
        <div class="task-sync-footer-right">
          {#if updatedAt}
            <span
              class="task-sync-timestamp"
              title="Last updated: {moment(updatedAt).format(
                'MMMM Do YYYY, h:mm:ss a'
              )}"
            >
              Updated {moment(updatedAt).fromNow()}
            </span>
          {/if}
          {#if createdAt}
            <span
              class="task-sync-timestamp"
              title="Created: {moment(createdAt).format(
                'MMMM Do YYYY, h:mm:ss a'
              )}"
            >
              {#if updatedAt}
                &nbsp;•&nbsp;
              {/if}
              Created {moment(createdAt).fromNow()}
            </span>
          {/if}
        </div>
      </div>
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
  .task-sync-task-list-item {
    position: relative;
    padding: 12px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    background: var(--background-primary);
    margin-bottom: 8px;
    transition: all 0.2s ease;
    cursor: pointer;
  }

  .task-sync-task-list-item:hover {
    border-color: var(--interactive-accent);
    background: var(--background-primary-alt);
  }

  .task-sync-task-list-item.hovered {
    border-color: var(--interactive-accent);
    background: var(--background-primary-alt);
  }

  .task-sync-task-list-item.imported {
    border-left: 3px solid var(--interactive-accent);
  }

  .task-sync-task-list-item.selected {
    border-color: var(--interactive-accent);
    background: var(--background-modifier-hover);
  }

  .task-sync-item-header {
    margin-bottom: 0.5rem;
  }

  .task-sync-item-title {
    font-weight: 600;
    font-size: 14px;
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

  /* Generic badge fallback style */
  .task-sync-generic-badge {
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 0.75em;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    background-color: var(--background-modifier-border);
    color: var(--text-muted);
    text-shadow: none;
    min-width: 60px;
    text-align: center;
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
