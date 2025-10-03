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
  priority: z.number(), // 0-9 priority level
  list: AppleRemindersListSchema,
  allDay: z.boolean().optional(),
  url: z.string().optional(),
});

export const AppleRemindersSchema = z.array(AppleReminderSchema);

export type AppleRemindersList = z.infer<typeof AppleRemindersListSchema>;
export type AppleRemindersLists = z.infer<typeof AppleRemindersListsSchema>;
export type AppleReminder = z.infer<typeof AppleReminderSchema>;
export type AppleReminders = z.infer<typeof AppleRemindersSchema>;
