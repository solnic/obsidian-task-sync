/**
 * NoteKit Helper Utilities
 * Provides utilities to extract task types, priorities, and statuses from NoteKit system
 * instead of relying on obsolete settings properties
 */

import type { NoteKit } from "../core/note-kit/NoteKit";

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
export function getTaskCategoriesFromTypeNote(typeNote: NoteKit): TaskType[] {
  const taskNoteType = typeNote.registry.get("task");
  if (!taskNoteType) {
    throw new Error("Task note type not registered");
  }

  return taskNoteType.properties.category.selectOptions!.map((option) => ({
    name: option.value,
    color: option.color!,
  }));
}

/**
 * Extract task priorities from the Task note type
 */
export function getTaskPrioritiesFromTypeNote(
  typeNote: NoteKit
): TaskPriority[] {
  const taskNoteType = typeNote.registry.get("task");
  if (!taskNoteType) {
    throw new Error("Task note type not registered");
  }

  return taskNoteType.properties.priority.selectOptions!.map((option) => ({
    name: option.value,
    color: option.color!,
  }));
}

/**
 * Extract task statuses from the Task note type
 */
export function getTaskStatusesFromTypeNote(typeNote: NoteKit): TaskStatus[] {
  const taskNoteType = typeNote.registry.get("task");
  if (!taskNoteType) {
    throw new Error("Task note type not registered");
  }

  return taskNoteType.properties.status.selectOptions!.map((option) => ({
    name: option.value,
    color: option.color!,
    isDone: option.isDone!,
    isInProgress: option.isInProgress!,
  }));
}

/**
 * Get task category color by name
 */
export function getTaskCategoryColor(
  typeNote: NoteKit,
  categoryName: string
): string {
  const categories = getTaskCategoriesFromTypeNote(typeNote);
  const category = categories.find((c) => c.name === categoryName);
  if (!category) {
    throw new Error(`Category ${categoryName} not found in task note type configuration`);
  }
  return category.color;
}

/**
 * Get task priority color by name
 */
export function getTaskPriorityColor(
  typeNote: NoteKit,
  priorityName: string
): string {
  const priorities = getTaskPrioritiesFromTypeNote(typeNote);
  const priority = priorities.find((p) => p.name === priorityName);
  if (!priority) {
    throw new Error(`Priority ${priorityName} not found in task note type configuration`);
  }
  return priority.color;
}

/**
 * Get task status color by name
 */
export function getTaskStatusColor(
  typeNote: NoteKit,
  statusName: string
): string {
  const statuses = getTaskStatusesFromTypeNote(typeNote);
  const status = statuses.find((s) => s.name === statusName);
  if (!status) {
    throw new Error(`Status ${statusName} not found in task note type configuration`);
  }
  return status.color;
}
