/**
 * LocalTask view object for Local Tasks Service
 * Provides a sortable interface that exposes the correct timestamps
 * based on task data for the new architecture
 */

import type { Task } from "../core/entities";
import { z } from "zod";

export interface LocalTask {
  /** Original task entity */
  task: Task;

  /** Sortable attributes that expose the correct values for sorting */
  sortable: {
    /** Creation timestamp */
    createdAt: Date;

    /** Update timestamp */
    updatedAt: Date;

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
 * Schema for validating LocalTask sortable attributes
 * Uses coercion to automatically convert string dates to Date objects
 */
export const LocalTaskSortableSchema = z.object({
  /** Creation timestamp - must be a valid Date object */
  createdAt: z.date(),

  /** Update timestamp - must be a valid Date object */
  updatedAt: z.date(),

  /** Title for sorting - must be string */
  title: z.string(),

  /** Priority for sorting - must be string */
  priority: z.string(),

  /** Status for sorting - must be string */
  status: z.string(),

  /** Category for sorting - must be string */
  category: z.string(),

  /** Project for sorting - must be string */
  project: z.string(),

  /** Areas for sorting - must be string */
  areas: z.string(),
});

/**
 * Schema for validating complete LocalTask objects
 */
export const LocalTaskSchema = z.object({
  /** Original task entity - use the actual Task type */
  task: z.any(), // Allow any task object structure for now

  /** Sortable attributes with strict validation */
  sortable: LocalTaskSortableSchema,
});

export type ValidatedLocalTask = z.infer<typeof LocalTaskSchema>;

/**
 * Create a validated LocalTask view object from a Task entity
 * This function determines the correct timestamps to use and validates the result
 */
export function createLocalTask(task: Task): ValidatedLocalTask {
  // Use task timestamps directly - Task type guarantees these are Date objects
  const createdAt = task.createdAt;
  const updatedAt = task.updatedAt;

  const localTask = {
    task,
    sortable: {
      createdAt,
      updatedAt,
      title: task.title,
      // Use fallbacks to ensure sortable fields are always strings, never undefined
      // This matches the old implementation in old-stuff/types/LocalTask.ts
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

  // Handle valid string values (should be plain strings, not wiki links)
  if (typeof value === "string") {
    return value.trim() || "";
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
        const displayValue = area.trim();
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

/**
 * Utility functions for LocalTask validation
 */
export class LocalTaskValidator {
  /**
   * Validate a LocalTask object and throw on invalid data
   */
  static validate(localTask: unknown): ValidatedLocalTask {
    try {
      return LocalTaskSchema.parse(localTask);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const issues = error.issues
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join(", ");
        throw new Error(`Invalid LocalTask: ${issues}`);
      }
      throw error;
    }
  }

  /**
   * Safely validate a LocalTask object and return null on failure
   */
  static safeParse(localTask: unknown): ValidatedLocalTask | null {
    try {
      return this.validate(localTask);
    } catch (error) {
      console.warn("LocalTask validation failed:", error);
      return null;
    }
  }

  /**
   * Validate that timestamps are not Invalid Date objects
   */
  static validateTimestamps(localTask: LocalTask): void {
    const { createdAt, updatedAt } = localTask.sortable;

    if (createdAt && isNaN(createdAt.getTime())) {
      throw new Error("LocalTask has invalid createdAt timestamp");
    }

    if (updatedAt && isNaN(updatedAt.getTime())) {
      throw new Error("LocalTask has invalid updatedAt timestamp");
    }
  }

  /**
   * Create a validated LocalTask with proper error handling
   */
  static create(task: any, sortableData: any): ValidatedLocalTask {
    const localTask = {
      task,
      sortable: sortableData,
    };

    return this.validate(localTask);
  }
}
