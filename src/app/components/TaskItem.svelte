<script lang="ts">
  /**
   * Generic TaskItem component that provides a unified structure for task items
   * across different services (Local Tasks, GitHub Issues, etc.)
   */

  import type { Snippet } from "svelte";
  import CategoryBadge from "./badges/CategoryBadge.svelte";
  import StatusBadge from "./badges/StatusBadge.svelte";
  import PriorityBadge from "./badges/PriorityBadge.svelte";
  import LabelBadge from "./badges/LabelBadge.svelte";

  import { getOptimalTextColor } from "../utils/colorUtils";
  import moment from "moment";
  import type { TaskSyncSettings } from "../types/settings";

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
    isScheduled?: boolean; // Whether the task is scheduled
    scheduledDate?: Date; // The date when the task is scheduled (Do Date)

    // Behavior
    onHover?: (hovered: boolean) => void;

    // Settings for badge colors
    settings?: TaskSyncSettings;

    // Test attributes
    testId?: string;

    // Custom content slots
    customContent?: boolean; // Allow custom content in slot
    actionContent?: boolean; // Allow custom action overlay
    children?: Snippet;
    actions?: Snippet<[]>;
    secondaryActions?: Snippet<[]>; // Secondary actions that appear at bottom on hover
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
    isScheduled = false,
    scheduledDate,
    onHover,
    settings,
    testId,
    customContent = false,
    actionContent = false,
    children,
    actions,
    secondaryActions,
  }: Props = $props();

  function handleMouseEnter() {
    onHover?.(true);
  }

  function handleMouseLeave() {
    onHover?.(false);
  }

  // Get color for badge types that have configurable colors
  function getBadgeColor(type: string, text: string): string | undefined {
    if (!settings) return undefined;

    switch (type) {
      case "category":
        return settings.taskTypes.find((t) => t.name === text)?.color;
      case "status":
        return settings.taskStatuses.find((s) => s.name === text)?.color;
      case "priority":
        return settings.taskPriorities.find((p) => p.name === text)?.color;
      default:
        return undefined;
    }
  }
</script>

<!-- Unified TaskItem - always renders as div with consistent structure -->
<div
  class="task-sync-task-list-item {isHovered ? 'hovered' : ''} {isImported
    ? 'imported'
    : ''} {isSelected ? 'selected' : ''} {isScheduled
    ? 'scheduled'
    : ''} {isScheduled && isImported ? 'scheduled-and-imported' : ''}"
  onmouseenter={handleMouseEnter}
  onmouseleave={handleMouseLeave}
  data-testid={testId}
  data-imported={isImported ? "true" : "false"}
  data-state={isScheduled ? "scheduled" : ""}
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
    {#if footerBadges.length > 0}
      <div class="task-sync-item-footer">
        <div class="task-sync-footer-left">
          {#each footerBadges as badge}
            <LabelBadge label={badge.type} value={badge.text} size="medium" />
          {/each}
        </div>
        <div class="task-sync-footer-right">
          <!-- placeholder -->
        </div>
      </div>
    {/if}
  </div>

  <!-- Scheduled badge - shows at top with full width -->
  {#if isScheduled && scheduledDate}
    {@const friendlyDate = moment(scheduledDate).calendar(null, {
      sameDay: "[today]",
      nextDay: "[tomorrow]",
      nextWeek: "dddd",
      lastDay: "[yesterday]",
      lastWeek: "[last] dddd",
      sameElse: "MMMM Do",
    })}
    <div
      class="scheduled-badge"
      title="This item is scheduled for {moment(scheduledDate).format('LL')}"
    >
      ✓ Scheduled for {friendlyDate}
    </div>
  {/if}

  <!-- Imported badge - shows at bottom with full width -->
  {#if isImported}
    <div
      class="imported-badge"
      title="This item was imported from an external source"
    >
      ✓ imported
    </div>
  {/if}

  <!-- Action overlay snippet -->
  {#if actionContent && isHovered && (actions || secondaryActions)}
    <div class="task-sync-action-overlay">
      <div class="task-sync-actions-container">
        {#if actions}
          <div class="task-sync-primary-actions">
            {@render actions()}
          </div>
        {/if}
        {#if secondaryActions}
          <div class="task-sync-secondary-actions">
            {@render secondaryActions()}
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>
