/**
 * Obsidian Property Registry
 * Single source of truth for all entity properties used in Obsidian Bases
 * This is Obsidian-specific because it defines front-matter properties and base configurations
 *
 * IMPORTANT: link: true flag indicates properties that should use wiki link format [[filepath|Name]]
 * in frontmatter and base properties (Obsidian-specific representation).
 * Entity properties always store plain names for cross-extension compatibility.
 * Conversion between formats happens at the boundary in Operations classes.
 */

import { PropertyDefinition } from "../../../types/properties";

// ============================================================================
// OBSIDIAN PROPERTY REGISTRY - SINGLE SOURCE OF TRUTH
// ============================================================================

export const PROPERTY_REGISTRY: Record<string, PropertyDefinition> = {
  TITLE: {
    key: "title",
    name: "Title",
    type: "string",
    source: "formula.Title",
    frontmatter: true,
  },
  NAME: {
    key: "name",
    name: "Name",
    type: "string",
    frontmatter: true,
  },
  TYPE: {
    key: "type",
    name: "Type",
    type: "string",
    default: "Task",
    frontmatter: true,
  },
  CATEGORY: {
    key: "category",
    name: "Category",
    type: "string",
    frontmatter: true,
  },
  PRIORITY: {
    key: "priority",
    name: "Priority",
    type: "string",
    default: null,
    frontmatter: true,
  },
  AREAS: {
    key: "areas",
    name: "Areas",
    type: "array",
    link: true,
    default: [],
    frontmatter: true,
  },
  PROJECT: {
    key: "project",
    name: "Project",
    type: "string",
    link: true,
    frontmatter: true,
  },
  DONE: {
    key: "done",
    name: "Done",
    type: "checkbox",
    default: false,
    frontmatter: true,
  },
  STATUS: {
    key: "status",
    name: "Status",
    type: "string",
    frontmatter: true,
  },
  PARENT_TASK: {
    key: "parentTask",
    name: "Parent task",
    type: "string",
    link: true,
    frontmatter: true,
  },
  DO_DATE: {
    key: "doDate",
    name: "Do Date",
    type: "date",
    frontmatter: true,
  },
  DUE_DATE: {
    key: "dueDate",
    name: "Due Date",
    type: "date",
    frontmatter: true,
  },
  TAGS: {
    key: "tags",
    name: "Tags",
    type: "array",
    default: [],
    frontmatter: true,
  },
  REMINDERS: {
    key: "reminders",
    name: "Reminders",
    type: "array",
    default: [],
    frontmatter: true,
  },
  CREATED_AT: {
    key: "createdAt",
    name: "Created At",
    type: "date",
    source: "file.ctime",
    frontmatter: false,
  },
  UPDATED_AT: {
    key: "updatedAt",
    name: "Updated At",
    type: "date",
    source: "file.mtime",
    frontmatter: false,
  },
  PROJECTS: {
    key: "projects",
    name: "Projects",
    type: "array",
    link: true,
    default: [],
    frontmatter: true,
  },
} as const;

/**
 * Generate front-matter properties for project files
 */
export function generateProjectFrontMatter(): PropertyDefinition[] {
  return [
    PROPERTY_REGISTRY.NAME, // Use Name instead of Title for projects
    PROPERTY_REGISTRY.TYPE,
    PROPERTY_REGISTRY.AREAS,
    PROPERTY_REGISTRY.TAGS,
  ];
}

/**
 * Generate front-matter properties for area files
 */
export function generateAreaFrontMatter(): PropertyDefinition[] {
  return [
    PROPERTY_REGISTRY.NAME, // Use Name instead of Title for areas
    PROPERTY_REGISTRY.TYPE,
    PROPERTY_REGISTRY.TAGS,
  ];
}

/**
 * Generate front-matter properties for task files
 */
export function generateTaskFrontMatter(): PropertyDefinition[] {
  return [
    PROPERTY_REGISTRY.TITLE,
    PROPERTY_REGISTRY.TYPE,
    PROPERTY_REGISTRY.CATEGORY,
    PROPERTY_REGISTRY.PRIORITY,
    PROPERTY_REGISTRY.AREAS,
    PROPERTY_REGISTRY.PROJECT,
    PROPERTY_REGISTRY.DONE,
    PROPERTY_REGISTRY.STATUS,
    PROPERTY_REGISTRY.PARENT_TASK,
    PROPERTY_REGISTRY.DO_DATE,
    PROPERTY_REGISTRY.DUE_DATE,
    PROPERTY_REGISTRY.TAGS,
    PROPERTY_REGISTRY.REMINDERS,
  ];
}
