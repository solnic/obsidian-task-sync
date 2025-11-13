/**
 * Core domain entities with Zod validation
 * Source-agnostic entity definitions for the Svelte app architecture
 */

import { z } from "zod";
import { DEFAULT_TASK_STATUS } from "../constants/defaults";
import { requiredDateSchema, optionalDateSchema } from "../utils/dateCoercion";

/**
 * Helper schema for optional string fields that converts null to undefined
 * This is needed because Obsidian front-matter can have null values for missing fields
 * but Zod's .optional() only accepts undefined, not null
 */
const optionalStringSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((val) => (val === null || val === undefined ? undefined : val))
  .pipe(z.string().optional());

// Core domain entities - completely source agnostic
export const TaskStatusSchema = z
  .string()
  .min(1, "Task status cannot be empty");
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

// Source tracking for tasks from external systems
export const TaskSourceSchema = z.object({
  // Which extension manages this entity
  extension: z.string(),
  // Natural keys for ALL extensions that have this entity
  // Example: { github: "https://...", obsidian: "Tasks/foo.md" }
  keys: z.record(z.string(), z.string()).default({}),
  // Raw data from external service (e.g., GitHub issue/PR, Linear issue)
  // Used for rendering service-specific UI and caching
  data: z.any().optional(),
});
export type TaskSource = z.infer<typeof TaskSourceSchema>;

export const TaskSchema = z.object({
  // Core identity
  id: z.string(),

  // Core task properties
  title: z.string(),
  description: optionalStringSchema,
  // Status can be empty string on input - will be resolved to default by buildEntity
  status: z.string().default(DEFAULT_TASK_STATUS),
  done: z.boolean().default(false),

  // Organization - stored as plain entity names (source-agnostic)
  // Note: Wiki link format [[filepath|Name]] is only used in Obsidian frontmatter/bases
  // Entity properties always use plain string names for cross-extension compatibility
  category: optionalStringSchema,
  priority: optionalStringSchema,
  parentTask: optionalStringSchema, // Plain task title, not wiki link
  project: optionalStringSchema, // Plain project name, not wiki link
  areas: z.array(z.string()).default([]), // Plain area names, not wiki links
  tags: z.array(z.string()).default([]),

  // Scheduling
  doDate: optionalDateSchema,
  dueDate: optionalDateSchema,

  // System properties
  createdAt: requiredDateSchema,
  updatedAt: requiredDateSchema,

  // Source tracking (which extension owns this task)
  source: TaskSourceSchema,
});

export type Task = Readonly<z.infer<typeof TaskSchema>>;

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: optionalStringSchema,
  areas: z.array(z.string()).default([]), // Plain area names, not wiki links
  tags: z.array(z.string()).default([]),
  createdAt: requiredDateSchema,
  updatedAt: requiredDateSchema,
  source: TaskSourceSchema,
});

export type Project = Readonly<z.infer<typeof ProjectSchema>>;

export const AreaSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: optionalStringSchema,
  tags: z.array(z.string()).default([]),
  createdAt: requiredDateSchema,
  updatedAt: requiredDateSchema,
  source: TaskSourceSchema,
});

export type Area = Readonly<z.infer<typeof AreaSchema>>;

// Calendar Event schema for Schedule entity
export const CalendarEventSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  location: z.string().optional(),
  startDate: requiredDateSchema,
  endDate: requiredDateSchema,
  allDay: z.boolean(),
  calendar: z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    color: z.string().optional(),
    visible: z.boolean(),
    metadata: z.record(z.string(), z.any()).optional(),
  }),
  url: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export type CalendarEvent = z.infer<typeof CalendarEventSchema>;

// Schedule entity schema
export const ScheduleSchema = z.object({
  // Core identity
  id: z.string(),

  // Schedule metadata
  date: requiredDateSchema, // The date this schedule is for
  createdAt: requiredDateSchema,
  updatedAt: requiredDateSchema,

  // Tasks included in this schedule
  tasks: z.array(TaskSchema).default([]),

  // Unscheduled tasks (for daily planning)
  unscheduledTasks: z.array(TaskSchema).default([]),

  // Calendar events for this schedule
  events: z.array(CalendarEventSchema).default([]),

  // Daily note information (for DailySchedule)
  dailyNotePath: z.string().optional(),
  dailyNoteExists: z.boolean().default(false),

  // Planning state
  isPlanned: z.boolean().default(false),
  planningCompletedAt: optionalDateSchema,

  // Source tracking (which extension owns this schedule)
  source: TaskSourceSchema,
});

export type Schedule = Readonly<z.infer<typeof ScheduleSchema>>;

// Schedule creation data interface
export const ScheduleCreateDataSchema = z.object({
  date: requiredDateSchema,
  dailyNotePath: z.string().optional(),
  tasks: z.array(TaskSchema).optional(),
  events: z.array(CalendarEventSchema).optional(),
});

export type ScheduleCreateData = z.infer<typeof ScheduleCreateDataSchema>;

// Schedule persistence item with task IDs instead of full task objects
export const SchedulePersistenceItemSchema = z.object({
  id: z.string(),
  date: z.string(), // ISO date string
  dailyNotePath: z.string().optional(),
  dailyNoteExists: z.boolean(),
  isPlanned: z.boolean(),
  planningCompletedAt: z.string().optional(), // ISO date string
  createdAt: z.string(), // ISO date string
  updatedAt: z.string(), // ISO date string
  taskIds: z.array(z.string()), // Array of task IDs instead of full task objects
  unscheduledTaskIds: z.array(z.string()), // Array of unscheduled task IDs
  events: z.array(CalendarEventSchema), // Events are still stored as full objects
});

export type SchedulePersistenceItem = z.infer<
  typeof SchedulePersistenceItemSchema
>;

// Schedule persistence data interface
export const SchedulePersistenceDataSchema = z.object({
  schedules: z.array(SchedulePersistenceItemSchema),
  lastSync: requiredDateSchema,
});

export type SchedulePersistenceData = z.infer<
  typeof SchedulePersistenceDataSchema
>;
