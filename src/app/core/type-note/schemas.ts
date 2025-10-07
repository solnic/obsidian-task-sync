/**
 * Common Zod schemas for TypeNote properties
 * Provides reusable schemas for common property types
 */

import { z } from "zod";

/**
 * Schema for string properties
 */
export const stringSchema = z.string();

/**
 * Schema for optional string properties
 */
export const optionalStringSchema = z.string().optional();

/**
 * Schema for non-empty string properties
 */
export const nonEmptyStringSchema = z.string().min(1, "Value cannot be empty");

/**
 * Schema for number properties
 */
export const numberSchema = z.number();

/**
 * Schema for optional number properties
 */
export const optionalNumberSchema = z.number().optional();

/**
 * Schema for positive number properties
 */
export const positiveNumberSchema = z
  .number()
  .positive("Value must be positive");

/**
 * Schema for non-negative number properties
 */
export const nonNegativeNumberSchema = z
  .number()
  .nonnegative("Value must be non-negative");

/**
 * Schema for boolean properties
 */
export const booleanSchema = z.boolean();

/**
 * Schema for optional boolean properties
 */
export const optionalBooleanSchema = z.boolean().optional();

/**
 * Schema for date properties with coercion
 * Accepts Date objects, ISO strings, or timestamps
 */
export const dateSchema = z.coerce.date();

/**
 * Schema for optional date properties with coercion
 */
export const optionalDateSchema = z.coerce.date().optional();

/**
 * Schema for array of strings
 */
export const stringArraySchema = z.array(z.string()).default([]);

/**
 * Schema for optional array of strings
 */
export const optionalStringArraySchema = z.array(z.string()).optional();

/**
 * Schema for array of numbers
 */
export const numberArraySchema = z.array(z.number()).default([]);

/**
 * Schema for optional array of numbers
 */
export const optionalNumberArraySchema = z.array(z.number()).optional();

/**
 * Schema for email addresses
 */
export const emailSchema = z.string().email("Invalid email address");

/**
 * Schema for optional email addresses
 */
export const optionalEmailSchema = z
  .string()
  .email("Invalid email address")
  .optional();

/**
 * Schema for URLs
 */
export const urlSchema = z.string().url("Invalid URL");

/**
 * Schema for optional URLs
 */
export const optionalUrlSchema = z.string().url("Invalid URL").optional();

/**
 * Schema for enum/choice properties
 * Creates a schema that accepts one of the provided values
 */
export function enumSchema<T extends string>(values: readonly T[]) {
  return z.enum(values as [T, ...T[]]);
}

/**
 * Schema for optional enum/choice properties
 */
export function optionalEnumSchema<T extends string>(values: readonly T[]) {
  return z.enum(values as [T, ...T[]]).optional();
}

/**
 * Schema for record/object properties
 */
export const recordSchema = z.record(z.string(), z.any());

/**
 * Schema for optional record/object properties
 */
export const optionalRecordSchema = z.record(z.string(), z.any()).optional();

/**
 * Schema for semantic version strings
 */
export const versionSchema = z
  .string()
  .regex(
    /^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?(?:\+[a-zA-Z0-9.-]+)?$/,
    "Invalid semantic version format (expected: major.minor.patch)"
  );

/**
 * Schema for optional semantic version strings
 */
export const optionalVersionSchema = z
  .string()
  .regex(
    /^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?(?:\+[a-zA-Z0-9.-]+)?$/,
    "Invalid semantic version format (expected: major.minor.patch)"
  )
  .optional();

/**
 * Schema for hex color codes
 */
export const colorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color code (expected: #RRGGBB)");

/**
 * Schema for optional hex color codes
 */
export const optionalColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color code (expected: #RRGGBB)")
  .optional();

/**
 * Schema for markdown content
 */
export const markdownSchema = z.string();

/**
 * Schema for optional markdown content
 */
export const optionalMarkdownSchema = z.string().optional();

/**
 * Schema for file paths
 */
export const filePathSchema = z.string();

/**
 * Schema for optional file paths
 */
export const optionalFilePathSchema = z.string().optional();

/**
 * Schema for tags (array of non-empty strings)
 */
export const tagsSchema = z
  .array(z.string().min(1, "Tag cannot be empty"))
  .default([]);

/**
 * Schema for optional tags
 */
export const optionalTagsSchema = z
  .array(z.string().min(1, "Tag cannot be empty"))
  .optional();

/**
 * Schema for priority values (Low, Medium, High, Urgent)
 */
export const prioritySchema = enumSchema([
  "Low",
  "Medium",
  "High",
  "Urgent",
] as const);

/**
 * Schema for optional priority values
 */
export const optionalPrioritySchema = optionalEnumSchema([
  "Low",
  "Medium",
  "High",
  "Urgent",
] as const);

/**
 * Schema for status values (Backlog, In Progress, Done)
 */
export const statusSchema = enumSchema([
  "Backlog",
  "In Progress",
  "Done",
] as const);

/**
 * Schema for optional status values
 */
export const optionalStatusSchema = optionalEnumSchema([
  "Backlog",
  "In Progress",
  "Done",
] as const);

/**
 * Create a schema with custom validation
 */
export function customSchema<T>(
  baseSchema: z.ZodType<T>,
  validator: (value: T) => boolean,
  errorMessage: string
) {
  return baseSchema.refine(validator, { message: errorMessage });
}

/**
 * Create a schema with transformation
 */
export function transformSchema<TInput, TOutput>(
  baseSchema: z.ZodType<TInput>,
  transformer: (value: TInput) => TOutput
) {
  return baseSchema.transform(transformer);
}

/**
 * Create a schema for a union of types
 */
export function unionSchema(...schemas: z.ZodTypeAny[]) {
  if (schemas.length < 2) {
    throw new Error("Union schema requires at least 2 schemas");
  }
  return z.union(schemas as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]);
}

/**
 * Create a schema for an intersection of types
 */
export function intersectionSchema<
  T extends z.ZodTypeAny,
  U extends z.ZodTypeAny
>(schema1: T, schema2: U) {
  return z.intersection(schema1, schema2);
}

/**
 * Create a nullable schema
 */
export function nullableSchema<T extends z.ZodTypeAny>(schema: T) {
  return schema.nullable();
}

/**
 * Create a schema with default value
 */
export function withDefault<T extends z.ZodTypeAny>(
  schema: T,
  defaultValue: z.infer<T>
) {
  return schema.default(defaultValue as any);
}

/**
 * Create a schema for a literal value
 */
export function literalSchema<T extends string | number | boolean>(value: T) {
  return z.literal(value);
}

/**
 * Schema for NoteType metadata
 */
export const noteTypeMetadataSchema = z.object({
  description: optionalStringSchema,
  author: optionalStringSchema,
  icon: optionalStringSchema,
  color: optionalColorSchema,
  category: optionalStringSchema,
  tags: optionalTagsSchema,
  createdAt: optionalDateSchema,
  updatedAt: optionalDateSchema,
  deprecated: optionalBooleanSchema,
  replacedBy: optionalStringSchema,
});

/**
 * Schema for Template metadata
 */
export const templateMetadataSchema = z.object({
  author: optionalStringSchema,
  description: optionalStringSchema,
  createdAt: optionalDateSchema,
  updatedAt: optionalDateSchema,
  tags: optionalTagsSchema,
});
