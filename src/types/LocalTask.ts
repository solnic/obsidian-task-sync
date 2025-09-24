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
import { extractDisplayValue as utilsExtractDisplayValue } from "../utils/linkUtils";

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
      project: extractProjectDisplayValue(task.project),
      areas: extractAreasDisplayValue(task.areas),
    },
  };

  // Validate the LocalTask before returning to catch any Invalid Date objects
  return LocalTaskValidator.validate(localTask);
}

/**
 * Extract display value from a project property (required field)
 * Handles: null, undefined, string, and objects with name property
 * Returns empty string for null/undefined (valid states) and invalid objects
 */
function extractProjectDisplayValue(value: any): string {
  // Handle valid null/undefined states (project can be null)
  if (value === null || value === undefined) {
    return "";
  }

  // Handle valid string values (including wiki links)
  if (typeof value === "string") {
    return utilsExtractDisplayValue(value) || "";
  }

  // Handle objects that might have a name property (from malformed front-matter)
  if (typeof value === "object" && value !== null) {
    if (typeof value.name === "string") {
      return value.name;
    }
    // For other object types, return empty string (graceful degradation)
    return "";
  }

  // For any other type (numbers, booleans, etc.), return empty string
  return "";
}

/**
 * Extract display value from the first area in an areas array (required field)
 * Handles: null, undefined, empty array, string array, and objects with name property
 * Returns empty string for null/undefined/empty array (valid states) and invalid objects
 */
function extractAreasDisplayValue(areas: any): string {
  // Handle valid null/undefined states (areas can be null/undefined)
  if (areas === null || areas === undefined) {
    return "";
  }

  // Handle string case (shouldn't happen per interface but be defensive)
  if (typeof areas === "string") {
    return extractProjectDisplayValue(areas);
  }

  // Handle array case (expected type)
  if (Array.isArray(areas)) {
    // Empty array is a valid state
    if (areas.length === 0) return "";

    // Find the first valid area, handling both strings and objects
    for (const area of areas) {
      if (area === null || area === undefined) {
        continue; // Skip null/undefined elements
      }

      if (typeof area === "string") {
        const displayValue = utilsExtractDisplayValue(area);
        if (displayValue) {
          return displayValue;
        }
      } else if (
        typeof area === "object" &&
        area.name &&
        typeof area.name === "string"
      ) {
        // Handle objects with name property (from malformed front-matter)
        return area.name;
      }
      // Skip other types (numbers, booleans, etc.)
    }

    return ""; // No valid areas found
  }

  // For any other type (objects, numbers, etc.), return empty string
  return "";
}
