/**
 * Standardized badge components for Task Sync plugin
 *
 * These components provide consistent styling and behavior for
 * displaying categories, statuses, priorities, projects, areas, and tags
 * across all task views and services.
 */

export { default as CategoryBadge } from "./CategoryBadge.svelte";
export { default as StatusBadge } from "./StatusBadge.svelte";
export { default as PriorityBadge } from "./PriorityBadge.svelte";
export { default as ProjectBadge } from "./ProjectBadge.svelte";
export { default as AreaBadge } from "./AreaBadge.svelte";
export { default as TagBadge } from "./TagBadge.svelte";
export { default as LabelBadge } from "./LabelBadge.svelte";

// Badge size type for consistent sizing across components
export type BadgeSize = "small" | "medium" | "large";

// Common badge props interface
export interface BaseBadgeProps {
  size?: BadgeSize;
  className?: string;
  color?: string;
}
