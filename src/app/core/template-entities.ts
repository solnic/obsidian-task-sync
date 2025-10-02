/**
 * Template entities with Zod validation
 * Defines template structures for creating new tasks, projects, and areas
 */

import { z } from "zod";

// Template variable definition
export const TemplateVariableSchema = z.object({
  name: z.string(),
  type: z.enum(["text", "date", "select", "boolean", "number"]),
  description: z.string().optional(),
  required: z.boolean(),
  defaultValue: z.any().optional(),
  options: z.array(z.string()).optional(), // For select type
});

export type TemplateVariable = z.infer<typeof TemplateVariableSchema>;

// Template entity for creating new tasks/projects/areas
export const TemplateSchema = z.object({
  // Core identity
  id: z.string(),
  
  // Template type
  type: z.enum(["task", "project", "area", "parent-task"]),
  
  // Template metadata
  name: z.string(),
  description: z.string().optional(),
  
  // Template content
  content: z.string(), // Markdown template with variables
  variables: z.array(TemplateVariableSchema).default([]),
  
  // File system integration
  filePath: z.string(),
  fileExists: z.boolean(),
  
  // Usage tracking
  usageCount: z.number().default(0),
  lastUsed: z.date().optional(),
  
  // System properties
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Template = Readonly<z.infer<typeof TemplateSchema>>;

// Template information for discovery
export const TemplateInfoSchema = z.object({
  name: z.string(),
  path: z.string(),
  type: z.enum(["native", "templater"]),
  variables: z.array(z.string()),
  description: z.string().optional(),
});

export type TemplateInfo = z.infer<typeof TemplateInfoSchema>;

// Validation result for template variables
export const ValidationResultSchema = z.object({
  isValid: z.boolean(),
  errors: z.array(z.string()).default([]),
});

export type ValidationResult = z.infer<typeof ValidationResultSchema>;
