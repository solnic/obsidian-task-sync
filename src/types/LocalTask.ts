/**
 * LocalTask view object for Local Tasks Service
 * Provides a sortable interface that exposes the correct timestamps
 * based on whether the task has source data or uses file system timestamps
 */

import type { Task } from "./entities";
import { ExternalTaskSourceFactory } from "./ExternalTaskSource";
import {
  LocalTaskValidator,
  type ValidatedLocalTask,
} from "./LocalTaskValidation";

export interface LocalTask {
  /** Original task entity */
  task: Task;

  /** Sortable attributes that expose the correct values for sorting */
  sortable: {
    /** Creation timestamp - uses source data if available, otherwise file system */
    createdAt: Date | null;

    /** Update timestamp - uses source data if available, otherwise file system */
    updatedAt: Date | null;

    /** Title for sorting */
    title: string;

    /** Priority for sorting */
    priority: string;

    /** Status for sorting */
    status: string;

    /** Category for sorting */
    category: string;

    /** Project for sorting */
    project: string;

    /** Areas for sorting (first area) */
    areas: string;
  };
}

/**
 * Create a validated LocalTask view object from a Task entity
 * This function determines the correct timestamps to use based on source data
 * and validates the result to ensure no Invalid Date objects are created
 */
export function createLocalTask(task: Task): ValidatedLocalTask {
  // Determine the correct timestamps to use
  let createdAt: Date | null = null;
  let updatedAt: Date | null = null;

  if (task.source?.data && task.source?.name) {
    // Use the appropriate external task source to extract timestamps
    const taskSource = ExternalTaskSourceFactory.get(task.source.name);
    if (taskSource) {
      const timestamps = taskSource.extractTimestamps(task.source.data);
      createdAt = timestamps.createdAt;
      updatedAt = timestamps.updatedAt;
    }
  }

  // Fall back to file system timestamps if no source data
  if (!createdAt && task.createdAt) {
    createdAt = task.createdAt;
  }
  if (!updatedAt && task.updatedAt) {
    updatedAt = task.updatedAt;
  }

  const localTask = {
    task,
    sortable: {
      createdAt,
      updatedAt,
      title: task.title || "",
      priority: task.priority || "",
      status: task.status || "",
      category: task.category || "",
      project: extractDisplayValue(task.project) || "",
      areas: extractFirstAreaDisplayValue(task.areas) || "",
    },
  };

  // Validate the LocalTask before returning to catch any Invalid Date objects
  return LocalTaskValidator.validate(localTask);
}

/**
 * Extract display value from a link string
 * Converts "[[Project Name]]" to "Project Name"
 * Throws validation error for invalid types
 */
function extractDisplayValue(value: any): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value !== "string") {
    throw new Error(
      `Invalid LocalTask: project/area must be string, got ${typeof value}`
    );
  }

  // Handle Obsidian link format [[Link Text]]
  const linkMatch = value.match(/^\[\[([^\]]+)\]\]$/);
  if (linkMatch) {
    return linkMatch[1];
  }

  return value;
}

/**
 * Extract display value from the first area in an areas array
 * Throws validation error for invalid types
 */
function extractFirstAreaDisplayValue(areas: any): string {
  if (areas === null || areas === undefined) {
    return "";
  }

  // Handle string case
  if (typeof areas === "string") {
    return extractDisplayValue(areas);
  }

  // Handle array case
  if (Array.isArray(areas)) {
    if (areas.length === 0) return "";

    // Validate all elements are strings
    for (let i = 0; i < areas.length; i++) {
      if (
        areas[i] !== null &&
        areas[i] !== undefined &&
        typeof areas[i] !== "string"
      ) {
        throw new Error(
          `Invalid LocalTask: areas array must contain only strings, got ${typeof areas[
            i
          ]} at index ${i}`
        );
      }
    }

    // Find the first non-null string value
    const firstStringArea = areas.find(
      (area) => area !== null && area !== undefined && typeof area === "string"
    );
    return extractDisplayValue(firstStringArea);
  }

  // Invalid type
  throw new Error(
    `Invalid LocalTask: areas must be string or string array, got ${typeof areas}`
  );
}
