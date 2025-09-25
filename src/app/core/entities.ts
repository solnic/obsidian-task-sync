/**
 * Core domain entities with Zod validation
 * Source-agnostic entity definitions for the Svelte app architecture
 */

import { z } from "zod";

// Core domain entities - completely source agnostic
export const TaskStatusSchema = z
  .string()
  .min(1, "Task status cannot be empty");
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

// Source tracking for tasks from external systems
export const TaskSourceSchema = z.object({
  extensionId: z.string(),
  sourceId: z.string(),
});
export type TaskSource = z.infer<typeof TaskSourceSchema>;

export const TaskSchema = z.object({
  // Core identity
  id: z.string(),

  // Core task properties
  title: z.string(),
  description: z.string().optional(),
  status: TaskStatusSchema.default("Backlog"),
  done: z.boolean().default(false),

  // Organization
  category: z.string().optional(),
  priority: z.string().optional(),
  parentTask: z.string().optional(),
  project: z.string().optional(),
  areas: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),

  // Scheduling
  doDate: z.date().optional(),
  dueDate: z.date().optional(),

  // System properties
  createdAt: z.date(),
  updatedAt: z.date(),

  // Source tracking (which extension owns this task)
  source: TaskSourceSchema.optional(),
});

export type Task = Readonly<z.infer<typeof TaskSchema>>;

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  areas: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  createdAt: z.date(),
  updatedAt: z.date(),
  source: TaskSourceSchema.optional(),
});

export type Project = Readonly<z.infer<typeof ProjectSchema>>;

export const AreaSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  tags: z.array(z.string()).default([]),
  createdAt: z.date(),
  updatedAt: z.date(),
  source: TaskSourceSchema.optional(),
});

export type Area = Readonly<z.infer<typeof AreaSchema>>;
