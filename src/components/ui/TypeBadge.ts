/**
 * TypeBadge UI component for displaying task category badges consistently
 * across the Task Sync plugin interface
 */

import { TaskType } from '../../main';

/**
 * Creates a task category badge element with appropriate styling
 * @param taskType The task category configuration with name and color
 * @param className Optional additional CSS class names
 * @returns HTMLElement representing the badge
 */
export function createTypeBadge(taskType: TaskType, className?: string): HTMLElement {
  const badge = document.createElement('span');
  badge.className = `task-type-badge task-type-${taskType.color}`;

  if (className) {
    badge.className += ` ${className}`;
  }

  badge.textContent = taskType.name;

  return badge;
}

/**
 * Creates a category badge and appends it to a container element
 * @param container The container element to append the badge to
 * @param taskType The task category configuration
 * @param className Optional additional CSS class names
 * @returns The created badge element
 */
export function appendTypeBadge(container: HTMLElement, taskType: TaskType, className?: string): HTMLElement {
  const badge = createTypeBadge(taskType, className);
  container.appendChild(badge);
  return badge;
}

/**
 * Creates a category badge with a wrapper div for better layout control
 * @param taskType The task category configuration
 * @param wrapperClassName Optional CSS class for the wrapper div
 * @param badgeClassName Optional CSS class for the badge itself
 * @returns HTMLElement representing the wrapper containing the badge
 */
export function createTypeBadgeWrapper(
  taskType: TaskType,
  wrapperClassName?: string,
  badgeClassName?: string
): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = wrapperClassName || 'task-type-preview';

  const badge = createTypeBadge(taskType, badgeClassName);
  wrapper.appendChild(badge);

  return wrapper;
}

/**
 * Updates an existing badge element with new task category information
 * @param badgeElement The existing badge element to update
 * @param taskType The new task category configuration
 */
export function updateTypeBadge(badgeElement: HTMLElement, taskType: TaskType): void {
  // Remove old color classes
  badgeElement.className = badgeElement.className.replace(/task-type-\w+/g, '');

  // Add new color class and ensure base class is present
  badgeElement.className = `task-type-badge task-type-${taskType.color} ${badgeElement.className}`.trim();

  // Update text content
  badgeElement.textContent = taskType.name;
}

/**
 * Creates multiple type badges for a list of task types
 * @param taskTypes Array of task type configurations
 * @param containerClassName Optional CSS class for the container
 * @param badgeClassName Optional CSS class for individual badges
 * @returns HTMLElement containing all the badges
 */
export function createTypeBadgeList(
  taskTypes: TaskType[],
  containerClassName?: string,
  badgeClassName?: string
): HTMLElement {
  const container = document.createElement('div');
  container.className = containerClassName || 'task-type-badge-list';

  taskTypes.forEach(taskType => {
    const badge = createTypeBadge(taskType, badgeClassName);
    container.appendChild(badge);
  });

  return container;
}

/**
 * Namespace object containing all TypeBadge functions for easier importing
 */
export const TypeBadge = {
  create: createTypeBadge,
  append: appendTypeBadge,
  createWrapper: createTypeBadgeWrapper,
  update: updateTypeBadge,
  createList: createTypeBadgeList
};
