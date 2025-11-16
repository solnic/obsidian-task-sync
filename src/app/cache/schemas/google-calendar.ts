import { z } from "zod";

// Schema for GoogleCalendar (matches Google Calendar API v3)
export const GoogleCalendarSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  backgroundColor: z.string().optional(),
  foregroundColor: z.string().optional(),
  timeZone: z.string().optional(),
  summary: z.string().optional(),
  primary: z.boolean().optional(),
  accessRole: z.string().optional(),
});

export const GoogleCalendarsSchema = z.array(GoogleCalendarSchema);

// Schema for GoogleCalendarAttendee
export const GoogleCalendarAttendeeSchema = z.object({
  email: z.string(),
  displayName: z.string().optional(),
  responseStatus: z.string().optional(), // needsAction, declined, tentative, accepted
  organizer: z.boolean().optional(),
  self: z.boolean().optional(),
  resource: z.boolean().optional(),
  optional: z.boolean().optional(),
  comment: z.string().optional(),
});

// Schema for GoogleCalendarEvent (matches Google Calendar API v3)
export const GoogleCalendarEventSchema = z.object({
  id: z.string(),
  summary: z.string().optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  start: z.object({
    dateTime: z.string().optional(),
    date: z.string().optional(),
    timeZone: z.string().optional(),
  }),
  end: z.object({
    dateTime: z.string().optional(),
    date: z.string().optional(),
    timeZone: z.string().optional(),
  }),
  calendar: GoogleCalendarSchema,
  attendees: z.array(GoogleCalendarAttendeeSchema).optional(),
  organizer: GoogleCalendarAttendeeSchema.optional(),
  htmlLink: z.string().optional(),
  status: z.string().optional(), // confirmed, tentative, cancelled
  visibility: z.string().optional(), // default, public, private, confidential
  reminders: z
    .object({
      useDefault: z.boolean().optional(),
      overrides: z
        .array(
          z.object({
            method: z.string(), // email, popup
            minutes: z.number(),
          })
        )
        .optional(),
    })
    .optional(),
});

export const GoogleCalendarEventsSchema = z.array(GoogleCalendarEventSchema);

// TypeScript types derived from Zod schemas
export type GoogleCalendar = z.infer<typeof GoogleCalendarSchema>;
export type GoogleCalendars = z.infer<typeof GoogleCalendarsSchema>;
export type GoogleCalendarAttendee = z.infer<
  typeof GoogleCalendarAttendeeSchema
>;
export type GoogleCalendarEvent = z.infer<typeof GoogleCalendarEventSchema>;
export type GoogleCalendarEvents = z.infer<typeof GoogleCalendarEventsSchema>;
