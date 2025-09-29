/**
 * Badge utilities for creating task property badges
 * Compatible with the new entities system
 */

export interface BadgeConfig {
  name: string;
  color: string;
}

/**
 * Creates a badge element with appropriate styling
 */
export function createBadge(
  config: BadgeConfig,
  type: "type" | "priority" | "status",
  className?: string
): HTMLElement {
  const badge = document.createElement("span");
  badge.className = `task-${type}-badge`;

  if (className) {
    badge.className += ` ${className}`;
  }

  // Create color dot
  const dot = document.createElement("span");
  dot.className = "task-sync-color-dot";
  dot.style.backgroundColor = config.color;

  // Create label
  const label = document.createElement("span");
  label.textContent = config.name;

  badge.appendChild(dot);
  badge.appendChild(label);

  return badge;
}

/**
 * Creates a type badge
 */
export function createTypeBadge(
  config: BadgeConfig,
  className?: string
): HTMLElement {
  return createBadge(config, "type", className);
}

/**
 * Creates a priority badge
 */
export function createPriorityBadge(
  config: BadgeConfig,
  className?: string
): HTMLElement {
  return createBadge(config, "priority", className);
}

/**
 * Creates a status badge
 */
export function createStatusBadge(
  config: BadgeConfig,
  className?: string
): HTMLElement {
  return createBadge(config, "status", className);
}

/**
 * Default task types - simplified for new architecture
 */
export const DEFAULT_TASK_TYPES: BadgeConfig[] = [
  { name: "Task", color: "#3b82f6" },
  { name: "Feature", color: "#10b981" },
  { name: "Bug", color: "#ef4444" },
  { name: "Research", color: "#f59e0b" },
];

// Import centralized defaults
import {
  DEFAULT_TASK_PRIORITIES as CENTRALIZED_PRIORITIES,
  DEFAULT_TASK_STATUSES as CENTRALIZED_STATUSES,
} from "../constants/defaults";

/**
 * Default task priorities (imported from centralized constants)
 */
export const DEFAULT_TASK_PRIORITIES: BadgeConfig[] =
  CENTRALIZED_PRIORITIES.map((p) => ({
    name: p.name,
    color: p.color,
  }));

/**
 * Default task statuses (imported from centralized constants)
 */
export const DEFAULT_TASK_STATUSES: BadgeConfig[] = CENTRALIZED_STATUSES.map(
  (s) => ({
    name: s.name,
    color: s.color,
  })
);
