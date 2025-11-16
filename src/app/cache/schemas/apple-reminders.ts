import { z } from "zod";

// Schema for AppleRemindersList (matches existing type)
export const AppleRemindersListSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().optional(),
  reminderCount: z.number().optional(),
});

export const AppleRemindersListsSchema = z.array(AppleRemindersListSchema);

// Schema for AppleReminder (matches existing type)
export const AppleReminderSchema = z.object({
  id: z.string(),
  title: z.string(),
  notes: z.string().optional(),
  completed: z.boolean(),
  completionDate: z.date().optional(),
  creationDate: z.date().optional(), // Made optional since AppleScript can return undefined
  modificationDate: z.date().optional(), // Made optional since AppleScript can return undefined
  dueDate: z.date().optional(),
  reminders: z.array(z.date()).optional(),
  priority: z.number(), // 0-9 priority level
  list: AppleRemindersListSchema,
  allDay: z.boolean().optional(),
  url: z.string().optional(),
});

export const AppleRemindersSchema = z.array(AppleReminderSchema);

// Schema for AppleScriptReminder (raw AppleScript data)
export const AppleScriptReminderSchema = z.object({
  id: z.string(),
  name: z.string(),
  body: z.string(),
  completed: z.boolean(),
  completionDate: z.string().nullable(),
  creationDate: z.string(),
  modificationDate: z.string(),
  dueDate: z.string().nullable(),
  remindMeDate: z.string().nullable(),
  priority: z.number(),
  allDay: z.boolean(),
});

// Schema for AppleScriptList (raw AppleScript data)
export const AppleScriptListSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
});

// Schema for AppleRemindersConfig
export const AppleRemindersConfigSchema = z.object({
  enabled: z.boolean(),
  includeCompletedReminders: z.boolean(),
  reminderLists: z.array(z.string()),
  syncInterval: z.number(),
  excludeAllDayReminders: z.boolean(),
  defaultTaskType: z.string().optional(),
  importNotesAsDescription: z.boolean().optional(),
  preservePriority: z.boolean().optional(),
});

// Schema for AppleRemindersFilter
export const AppleRemindersFilterSchema = z.object({
  includeCompleted: z.boolean().optional(),
  listNames: z.array(z.string()).optional(),
  dueDateRange: z.object({
    start: z.date().optional(),
    end: z.date().optional(),
  }).optional(),
  priorityRange: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
  }).optional(),
  excludeAllDay: z.boolean().optional(),
});

// Schema for AppleRemindersSyncStatus
export const AppleRemindersSyncStatusSchema = z.object({
  lastSyncTime: z.date().optional(),
  lastSyncCount: z.number(),
  syncInProgress: z.boolean(),
  lastSyncError: z.string().optional(),
  syncedLists: z.array(z.string()),
});

// Type exports for use with SchemaCache
export type AppleReminders = z.infer<typeof AppleRemindersSchema>;
export type AppleRemindersLists = z.infer<typeof AppleRemindersListsSchema>;
export type AppleRemindersConfig = z.infer<typeof AppleRemindersConfigSchema>;
export type AppleRemindersFilter = z.infer<typeof AppleRemindersFilterSchema>;
export type AppleRemindersSyncStatus = z.infer<typeof AppleRemindersSyncStatusSchema>;

// Export individual schemas for validation
export type AppleReminder = z.infer<typeof AppleReminderSchema>;
export type AppleRemindersList = z.infer<typeof AppleRemindersListSchema>;
export type AppleScriptReminder = z.infer<typeof AppleScriptReminderSchema>;
export type AppleScriptList = z.infer<typeof AppleScriptListSchema>;
