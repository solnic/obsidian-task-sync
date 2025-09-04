/**
 * StatusBadge UI component for displaying task status badges consistently
 * across the Task Sync plugin interface
 */

import { TaskStatus } from './settings/types';

/**
 * Creates a task status badge element with appropriate styling
 * @param taskStatus The task status configuration with name and color
 * @param className Optional additional CSS class names
 * @returns HTMLElement representing the badge
 */
export function createStatusBadge(taskStatus: TaskStatus, className?: string): HTMLElement {
  const badge = document.createElement('span');
  badge.className = `task-status-badge task-status-${taskStatus.color}`;
  
  if (className) {
    badge.className += ` ${className}`;
  }
  
  badge.textContent = taskStatus.name;
  
  return badge;
}

/**
 * Creates a status badge and appends it to a container element
 * @param container The container element to append the badge to
 * @param taskStatus The task status configuration
 * @param className Optional additional CSS class names
 * @returns The created badge element
 */
export function appendStatusBadge(container: HTMLElement, taskStatus: TaskStatus, className?: string): HTMLElement {
  const badge = createStatusBadge(taskStatus, className);
  container.appendChild(badge);
  return badge;
}

/**
 * Creates a status badge with a wrapper div for better layout control
 * @param taskStatus The task status configuration
 * @param wrapperClassName Optional CSS class for the wrapper div
 * @param badgeClassName Optional CSS class for the badge itself
 * @returns HTMLElement representing the wrapper containing the badge
 */
export function createStatusBadgeWrapper(
  taskStatus: TaskStatus, 
  wrapperClassName?: string, 
  badgeClassName?: string
): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = wrapperClassName || 'task-status-preview';
  
  const badge = createStatusBadge(taskStatus, badgeClassName);
  wrapper.appendChild(badge);
  
  return wrapper;
}

/**
 * Updates an existing badge element with new task status information
 * @param badgeElement The existing badge element to update
 * @param taskStatus The new task status configuration
 */
export function updateStatusBadge(badgeElement: HTMLElement, taskStatus: TaskStatus): void {
  // Remove old color classes
  badgeElement.className = badgeElement.className.replace(/task-status-\w+/g, '');
  
  // Add new color class and ensure base class is present
  badgeElement.className = `task-status-badge task-status-${taskStatus.color} ${badgeElement.className}`.trim();
  
  // Update text content
  badgeElement.textContent = taskStatus.name;
}
