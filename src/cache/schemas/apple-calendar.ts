import { z } from "zod";

// Schema for AppleCalendar (matches existing type)
export const AppleCalendarSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  color: z.string().optional(),
  visible: z.boolean(),
  account: z.string().optional(),
  type: z.string().optional(),
});

export const AppleCalendarsSchema = z.array(AppleCalendarSchema);

// Schema for AppleCalendarAttendee
export const AppleCalendarAttendeeSchema = z.object({
  name: z.string().optional(),
  email: z.string(),
  status: z.enum(["accepted", "declined", "tentative", "pending"]),
  isOrganizer: z.boolean().optional(),
});

// Schema for AppleCalendarEvent (matches existing type)
export const AppleCalendarEventSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  location: z.string().optional(),
  startDate: z.date(),
  endDate: z.date(),
  allDay: z.boolean(),
  status: z.enum(["confirmed", "tentative", "cancelled"]),
  availability: z.enum(["busy", "free"]),
  calendar: AppleCalendarSchema,
  url: z.string().optional(),
  attendees: z.array(AppleCalendarAttendeeSchema).optional(),
  organizer: AppleCalendarAttendeeSchema.optional(),
  recurrenceRule: z.string().optional(),
  creationDate: z.date().optional(),
  modificationDate: z.date().optional(),
});

export const AppleCalendarEventsSchema = z.array(AppleCalendarEventSchema);

// Export inferred types for use in the service
export type AppleCalendar = z.infer<typeof AppleCalendarSchema>;
export type AppleCalendars = z.infer<typeof AppleCalendarsSchema>;
export type AppleCalendarAttendee = z.infer<typeof AppleCalendarAttendeeSchema>;
export type AppleCalendarEvent = z.infer<typeof AppleCalendarEventSchema>;
export type AppleCalendarEvents = z.infer<typeof AppleCalendarEventsSchema>;
