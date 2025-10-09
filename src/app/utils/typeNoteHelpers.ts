/**
 * TypeNote Helper Utilities
 * Provides utilities to extract task types, priorities, and statuses from TypeNote system
 * instead of relying on obsolete settings properties
 */

import type { TypeNote } from "../core/type-note/TypeNote";

// Task category interface with color support
export interface TaskType {
  name: string;
  color: string; // Hex color code (e.g., "#3b82f6")
}

// Task priority interface with color support
export interface TaskPriority {
  name: string;
  color: string; // Hex color code (e.g., "#ef4444")
}

// Task status interface with color support
export interface TaskStatus {
  name: string;
  color: string; // Hex color code (e.g., "#10b981")
  isDone: boolean; // Indicates if this status represents a completed/done state
  isInProgress: boolean; // Indicates if this status represents an active/in-progress state
}

/**
 * Extract task categories from the Task note type
 */
export function getTaskCategoriesFromTypeNote(typeNote: TypeNote): TaskType[] {
  try {
    const taskNoteType = typeNote.registry.get("task");
    if (!taskNoteType) {
      return getDefaultTaskCategories();
    }

    const categoryProperty = taskNoteType.properties.category;
    if (!categoryProperty || !categoryProperty.selectOptions) {
      return getDefaultTaskCategories();
    }

    return categoryProperty.selectOptions.map((option: any) => ({
      name: option.value,
      color: option.color || "#3b82f6",
    }));
  } catch (error) {
    console.warn("Failed to get task categories from TypeNote:", error);
    return getDefaultTaskCategories();
  }
}

/**
 * Extract task priorities from the Task note type
 */
export function getTaskPrioritiesFromTypeNote(
  typeNote: TypeNote
): TaskPriority[] {
  try {
    const taskNoteType = typeNote.registry.get("task");
    if (!taskNoteType) {
      return getDefaultTaskPriorities();
    }

    const priorityProperty = taskNoteType.properties.priority;
    if (!priorityProperty || !priorityProperty.selectOptions) {
      return getDefaultTaskPriorities();
    }

    return priorityProperty.selectOptions.map((option: any) => ({
      name: option.value,
      color: option.color || "#f59e0b",
    }));
  } catch (error) {
    console.warn("Failed to get task priorities from TypeNote:", error);
    return getDefaultTaskPriorities();
  }
}

/**
 * Extract task statuses from the Task note type
 */
export function getTaskStatusesFromTypeNote(typeNote: TypeNote): TaskStatus[] {
  try {
    const taskNoteType = typeNote.registry.get("task");
    if (!taskNoteType) {
      return getDefaultTaskStatuses();
    }

    const statusProperty = taskNoteType.properties.status;
    if (!statusProperty || !statusProperty.selectOptions) {
      return getDefaultTaskStatuses();
    }

    return statusProperty.selectOptions.map((option: any) => ({
      name: option.value,
      color: option.color || "#10b981",
      isDone: option.isDone || false,
      isInProgress: option.isInProgress || false,
    }));
  } catch (error) {
    console.warn("Failed to get task statuses from TypeNote:", error);
    return getDefaultTaskStatuses();
  }
}

/**
 * Default task categories (fallback)
 */
function getDefaultTaskCategories(): TaskType[] {
  return [
    { name: "Task", color: "#3b82f6" },
    { name: "Bug", color: "#ef4444" },
    { name: "Feature", color: "#10b981" },
    { name: "Improvement", color: "#8b5cf6" },
    { name: "Chore", color: "#6b7280" },
  ];
}

/**
 * Default task priorities (fallback)
 */
function getDefaultTaskPriorities(): TaskPriority[] {
  return [
    { name: "Low", color: "#6b7280" },
    { name: "Medium", color: "#f59e0b" },
    { name: "High", color: "#ef4444" },
    { name: "Critical", color: "#dc2626" },
  ];
}

/**
 * Default task statuses (fallback)
 */
function getDefaultTaskStatuses(): TaskStatus[] {
  return [
    { name: "Backlog", color: "#6b7280", isDone: false, isInProgress: false },
    {
      name: "In Progress",
      color: "#f59e0b",
      isDone: false,
      isInProgress: true,
    },
    { name: "Done", color: "#10b981", isDone: true, isInProgress: false },
  ];
}

/**
 * Get task category color by name
 */
export function getTaskCategoryColor(
  typeNote: TypeNote,
  categoryName: string
): string {
  const categories = getTaskCategoriesFromTypeNote(typeNote);
  const category = categories.find((c) => c.name === categoryName);
  return category?.color || "#3b82f6";
}

/**
 * Get task priority color by name
 */
export function getTaskPriorityColor(
  typeNote: TypeNote,
  priorityName: string
): string {
  const priorities = getTaskPrioritiesFromTypeNote(typeNote);
  const priority = priorities.find((p) => p.name === priorityName);
  return priority?.color || "#f59e0b";
}

/**
 * Get task status color by name
 */
export function getTaskStatusColor(
  typeNote: TypeNote,
  statusName: string
): string {
  const statuses = getTaskStatusesFromTypeNote(typeNote);
  const status = statuses.find((s) => s.name === statusName);
  return status?.color || "#10b981";
}
