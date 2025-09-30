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
