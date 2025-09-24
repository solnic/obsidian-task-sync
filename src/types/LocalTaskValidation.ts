/**
 * Validation schema for LocalTask objects
 * Ensures LocalTask objects are properly formed before being used in UI
 */

import { z } from "zod";
import type { LocalTask } from "./LocalTask";

/**
 * Schema for validating LocalTask sortable attributes
 */
export const LocalTaskSortableSchema = z.object({
  /** Creation timestamp - must be valid Date or null */
  createdAt: z.date().nullable(),

  /** Update timestamp - must be valid Date or null */
  updatedAt: z.date().nullable(),

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
  /** Original task entity - minimal validation, allow any additional properties */
  task: z.record(z.string(), z.any()), // Allow any task object structure

  /** Sortable attributes with strict validation */
  sortable: LocalTaskSortableSchema,
});

export type ValidatedLocalTask = z.infer<typeof LocalTaskSchema>;

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

/**
 * Error class for LocalTask validation failures
 */
export class LocalTaskValidationError extends Error {
  constructor(
    message: string,
    public readonly validationErrors: string[],
    public readonly originalError?: Error
  ) {
    super(`LocalTask validation failed: ${message}`);
    this.name = "LocalTaskValidationError";
  }
}
