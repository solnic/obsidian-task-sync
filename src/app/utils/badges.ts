/**
 * Badge utilities for creating task property badges
 * Compatible with the new entities system
 */

export interface BadgeConfig {
  name: string;
  color: string;
}

/**
 * Creates a pill-style badge element (entire badge has background color)
 * Used in settings UI for category/priority/status configuration
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

  // Set background color directly on the badge (pill style)
  badge.style.backgroundColor = config.color;
  badge.textContent = config.name;

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
