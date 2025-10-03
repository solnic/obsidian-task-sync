/**
 * Common interface for external task sources
 * Provides type-safe abstraction for importing tasks from external systems
 */

import { z } from "zod";

/**
 * Validated external task data with proper type safety
 * This replaces the loose ExternalTaskData interface
 */
export const ExternalTaskDataSchema = z.object({
  /** Unique identifier from the external system */
  id: z.string().min(1),

  /** Task title/summary */
  title: z.string().min(1),

  /** Optional task description/body */
  description: z.string().optional(),

  /** Task status in external system */
  status: z.string().min(1),

  /** Optional priority level */
  priority: z.string().optional(),

  /** Optional assignee username */
  assignee: z.string().optional(),

  /** Optional labels/tags from external system */
  labels: z.array(z.string()).optional(),

  /** Creation timestamp - must be valid Date */
  createdAt: z.date(),

  /** Last update timestamp - must be valid Date */
  updatedAt: z.date(),

  /** Optional due date for task completion */
  dueDate: z.date().optional(),

  /** Optional reminder timestamps */
  reminders: z.array(z.date()).optional(),

  /** URL to view task in external system */
  externalUrl: z.string().url(),

  /** Source system type */
  sourceType: z.enum(["github", "linear", "apple-reminders", "apple-calendar"]),
});

export type ValidatedExternalTaskData = z.infer<typeof ExternalTaskDataSchema>;

/**
 * Standardized timestamp information for LocalTask sorting
 * This replaces the hardcoded source-specific logic in LocalTask
 */
export interface ExternalTimestamps {
  /** Creation timestamp from external source */
  createdAt: Date | null;
  
  /** Last update timestamp from external source */
  updatedAt: Date | null;
}

/**
 * Common interface that all external task sources must implement
 * Ensures type safety and consistent behavior across all integrations
 */
export interface ExternalTaskSource {
  /** Source system identifier */
  readonly sourceType: ValidatedExternalTaskData["sourceType"];

  /**
   * Transform raw external data to validated ExternalTaskData
   * Must validate all inputs and throw on invalid data
   */
  transformToExternalTaskData(rawData: unknown): ValidatedExternalTaskData;

  /**
   * Extract standardized timestamps for LocalTask sorting
   * Returns null for invalid or missing timestamps
   */
  extractTimestamps(rawData: unknown): ExternalTimestamps;

  /**
   * Validate raw external data against source-specific schema
   * Should throw descriptive errors for invalid data
   */
  validateRawData(rawData: unknown): void;
}

/**
 * Factory for creating external task sources
 * Ensures all sources implement the common interface
 */
export class ExternalTaskSourceFactory {
  private static sources = new Map<string, ExternalTaskSource>();

  /**
   * Register an external task source
   */
  static register(sourceType: string, source: ExternalTaskSource): void {
    this.sources.set(sourceType, source);
  }

  /**
   * Get a registered external task source
   */
  static get(sourceType: string): ExternalTaskSource | undefined {
    return this.sources.get(sourceType);
  }

  /**
   * Get all registered source types
   */
  static getRegisteredTypes(): string[] {
    return Array.from(this.sources.keys());
  }
}

/**
 * Utility functions for working with external task data
 */
export class ExternalTaskDataUtils {
  /**
   * Safely parse and validate external task data
   * Throws descriptive errors for invalid data
   */
  static validate(data: unknown): ValidatedExternalTaskData {
    try {
      return ExternalTaskDataSchema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const issues = error.issues.map(issue => 
          `${issue.path.join('.')}: ${issue.message}`
        ).join(', ');
        throw new Error(`Invalid external task data: ${issues}`);
      }
      throw error;
    }
  }

  /**
   * Create a safe Date object from unknown input
   * Returns null for invalid dates instead of Invalid Date objects
   */
  static createValidDate(dateValue: unknown): Date | null {
    if (!dateValue) {
      return null;
    }

    if (dateValue instanceof Date) {
      return isNaN(dateValue.getTime()) ? null : dateValue;
    }

    if (typeof dateValue === 'string' || typeof dateValue === 'number') {
      const date = new Date(dateValue);
      return isNaN(date.getTime()) ? null : date;
    }

    return null;
  }

  /**
   * Create validated external task data with proper error handling
   */
  static create(data: Partial<ValidatedExternalTaskData>): ValidatedExternalTaskData {
    // Ensure required dates are valid
    if (data.createdAt && isNaN(data.createdAt.getTime())) {
      throw new Error('Invalid createdAt date');
    }
    if (data.updatedAt && isNaN(data.updatedAt.getTime())) {
      throw new Error('Invalid updatedAt date');
    }

    return this.validate(data);
  }
}

/**
 * Error types for external task source operations
 */
export class ExternalTaskSourceError extends Error {
  constructor(
    message: string,
    public readonly sourceType: string,
    public readonly originalError?: Error
  ) {
    super(`[${sourceType}] ${message}`);
    this.name = 'ExternalTaskSourceError';
  }
}

export class ExternalTaskValidationError extends ExternalTaskSourceError {
  constructor(
    message: string,
    sourceType: string,
    public readonly validationErrors: string[],
    originalError?: Error
  ) {
    super(`Validation failed: ${message}`, sourceType, originalError);
    this.name = 'ExternalTaskValidationError';
  }
}
