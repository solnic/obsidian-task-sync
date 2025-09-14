import { z } from "zod";

// Schema for TaskSchedulingConfig
export const TaskSchedulingConfigSchema = z.object({
  targetCalendar: z.string().optional(),
  startDate: z.date(),
  endDate: z.date().optional(),
  allDay: z.boolean().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
  includeTaskDetails: z.boolean().optional(),
  reminders: z.array(z.number()).optional(),
});

// Schema for ScheduledTaskMetadata
export const ScheduledTaskMetadataSchema = z.object({
  taskPath: z.string(),
  taskTitle: z.string(),
  externalEventId: z.string(),
  calendarService: z.string(),
  targetCalendar: z.string(),
  scheduledAt: z.date(),
  eventStartDate: z.date(),
  eventEndDate: z.date(),
  allDay: z.boolean(),
  eventUrl: z.string().optional(),
  schedulingConfig: TaskSchedulingConfigSchema.optional(),
});

export const ScheduledTasksMetadataSchema = z.array(ScheduledTaskMetadataSchema);

// Export inferred types for use in services
export type TaskSchedulingConfig = z.infer<typeof TaskSchedulingConfigSchema>;
export type ScheduledTaskMetadata = z.infer<typeof ScheduledTaskMetadataSchema>;
export type ScheduledTasksMetadata = z.infer<typeof ScheduledTasksMetadataSchema>;
