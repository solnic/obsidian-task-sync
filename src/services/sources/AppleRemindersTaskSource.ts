/**
 * Apple Reminders implementation of ExternalTaskSource interface
 * Provides type-safe Apple Reminder to task transformation
 */

import { z } from "zod";
import {
  ExternalTaskSource,
  ValidatedExternalTaskData,
  ExternalTimestamps,
  ExternalTaskDataUtils,
  ExternalTaskSourceError,
  ExternalTaskValidationError,
} from "../../types/ExternalTaskSource";

/**
 * Apple Reminder schema for validation
 */
const AppleReminderSchema = z.object({
  id: z.string(),
  title: z.string(),
  notes: z.string().optional(),
  completed: z.boolean(),
  priority: z.number().optional(),
  dueDate: z.string().optional(),
  creationDate: z.string().optional(),
  modificationDate: z.string().optional(),
  completionDate: z.string().optional(),
  list: z.object({
    name: z.string(),
  }).optional(),
});

export type AppleReminder = z.infer<typeof AppleReminderSchema>;

/**
 * Apple Reminders task source implementation
 */
export class AppleRemindersTaskSource implements ExternalTaskSource {
  readonly sourceType = "apple-reminders" as const;

  /**
   * Transform Apple Reminder to validated external task data
   */
  transformToExternalTaskData(rawData: unknown): ValidatedExternalTaskData {
    try {
      this.validateRawData(rawData);
      const reminder = rawData as AppleReminder;

      const createdAt = this.parseAppleDate(reminder.creationDate);
      const updatedAt = this.parseAppleDate(reminder.modificationDate) || createdAt;

      if (!createdAt) {
        throw new ExternalTaskSourceError(
          `Invalid creation date in Apple Reminder ${reminder.id}: ${reminder.creationDate}`,
          this.sourceType
        );
      }

      const taskData = {
        id: `apple-reminder-${reminder.id}`,
        title: reminder.title,
        description: reminder.notes,
        status: reminder.completed ? "completed" : "open",
        priority: this.mapApplePriority(reminder.priority),
        labels: reminder.list ? [reminder.list.name] : undefined,
        createdAt,
        updatedAt: updatedAt || createdAt,
        dueDate: this.parseAppleDate(reminder.dueDate),
        externalUrl: `x-apple-reminderkit://REMCDReminder/${reminder.id}`,
        sourceType: this.sourceType,
      };

      return ExternalTaskDataUtils.validate(taskData);
    } catch (error) {
      if (error instanceof ExternalTaskSourceError) {
        throw error;
      }
      throw new ExternalTaskSourceError(
        `Failed to transform Apple Reminder: ${error instanceof Error ? error.message : 'Unknown error'}`,
        this.sourceType,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Extract timestamps from Apple Reminder data
   */
  extractTimestamps(rawData: unknown): ExternalTimestamps {
    try {
      this.validateRawData(rawData);
      const reminder = rawData as AppleReminder;
      
      const createdAt = this.parseAppleDate(reminder.creationDate);
      const updatedAt = this.parseAppleDate(reminder.modificationDate);
      
      return {
        createdAt,
        updatedAt: updatedAt || createdAt,
      };
    } catch (error) {
      return {
        createdAt: null,
        updatedAt: null,
      };
    }
  }

  /**
   * Validate raw Apple Reminder data
   */
  validateRawData(rawData: unknown): void {
    try {
      AppleReminderSchema.parse(rawData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors = error.issues.map(issue => 
          `${issue.path.join('.')}: ${issue.message}`
        );
        throw new ExternalTaskValidationError(
          'Apple Reminder data validation failed',
          this.sourceType,
          validationErrors,
          error
        );
      }
      throw new ExternalTaskSourceError(
        'Apple Reminder data validation failed',
        this.sourceType,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Parse Apple date string to Date object
   * Apple dates can be in various formats
   */
  private parseAppleDate(dateString?: string): Date | null {
    if (!dateString) {
      return null;
    }

    return ExternalTaskDataUtils.createValidDate(dateString);
  }

  /**
   * Map Apple priority (0-9) to standard priority levels
   */
  private mapApplePriority(applePriority?: number): string | undefined {
    if (applePriority === undefined || applePriority === null) {
      return undefined;
    }

    // Apple uses 0 = no priority, 1-3 = low, 4-6 = medium, 7-9 = high
    if (applePriority === 0) return undefined;
    if (applePriority >= 1 && applePriority <= 3) return "Low";
    if (applePriority >= 4 && applePriority <= 6) return "Medium";
    if (applePriority >= 7 && applePriority <= 9) return "High";
    
    return undefined;
  }
}
