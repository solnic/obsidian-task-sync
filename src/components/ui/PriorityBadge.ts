/**
 * PriorityBadge UI component for displaying task priority badges consistently
 * across the Task Sync plugin interface
 */

import { TaskPriority } from './settings/types';

/**
 * Creates a task priority badge element with appropriate styling
 * @param taskPriority The task priority configuration with name and color
 * @param className Optional additional CSS class names
 * @returns HTMLElement representing the badge
 */
export function createPriorityBadge(taskPriority: TaskPriority, className?: string): HTMLElement {
  const badge = document.createElement('span');
  badge.className = `task-priority-badge task-priority-${taskPriority.color}`;
  
  if (className) {
    badge.className += ` ${className}`;
  }
  
  badge.textContent = taskPriority.name;
  
  return badge;
}

/**
 * Creates a priority badge and appends it to a container element
 * @param container The container element to append the badge to
 * @param taskPriority The task priority configuration
 * @param className Optional additional CSS class names
 * @returns The created badge element
 */
export function appendPriorityBadge(container: HTMLElement, taskPriority: TaskPriority, className?: string): HTMLElement {
  const badge = createPriorityBadge(taskPriority, className);
  container.appendChild(badge);
  return badge;
}

/**
 * Creates a priority badge with a wrapper div for better layout control
 * @param taskPriority The task priority configuration
 * @param wrapperClassName Optional CSS class for the wrapper div
 * @param badgeClassName Optional CSS class for the badge itself
 * @returns HTMLElement representing the wrapper containing the badge
 */
export function createPriorityBadgeWrapper(
  taskPriority: TaskPriority, 
  wrapperClassName?: string, 
  badgeClassName?: string
): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = wrapperClassName || 'task-priority-preview';
  
  const badge = createPriorityBadge(taskPriority, badgeClassName);
  wrapper.appendChild(badge);
  
  return wrapper;
}

/**
 * Updates an existing badge element with new task priority information
 * @param badgeElement The existing badge element to update
 * @param taskPriority The new task priority configuration
 */
export function updatePriorityBadge(badgeElement: HTMLElement, taskPriority: TaskPriority): void {
  // Remove old color classes
  badgeElement.className = badgeElement.className.replace(/task-priority-\w+/g, '');
  
  // Add new color class and ensure base class is present
  badgeElement.className = `task-priority-badge task-priority-${taskPriority.color} ${badgeElement.className}`.trim();
  
  // Update text content
  badgeElement.textContent = taskPriority.name;
}

/**
 * Creates multiple priority badges for a list of task priorities
 * @param taskPriorities Array of task priority configurations
 * @param containerClassName Optional CSS class for the container
 * @param badgeClassName Optional CSS class for individual badges
 * @returns HTMLElement containing all the badges
 */
export function createPriorityBadgeList(
  taskPriorities: TaskPriority[], 
  containerClassName?: string, 
  badgeClassName?: string
): HTMLElement {
  const container = document.createElement('div');
  container.className = containerClassName || 'task-priority-badge-list';
  
  taskPriorities.forEach(taskPriority => {
    const badge = createPriorityBadge(taskPriority, badgeClassName);
    container.appendChild(badge);
  });
  
  return container;
}

/**
 * Namespace object containing all PriorityBadge functions for easier importing
 */
export const PriorityBadge = {
  create: createPriorityBadge,
  append: appendPriorityBadge,
  createWrapper: createPriorityBadgeWrapper,
  update: updatePriorityBadge,
  createList: createPriorityBadgeList
};
