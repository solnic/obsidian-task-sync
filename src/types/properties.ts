export interface PropertyDefinition {
  key: string;
  name: string;
  type: "string" | "number" | "checkbox" | "array" | "date";
  source?: string;
  link?: boolean;
  default?: any;
  frontmatter: boolean; // Whether this property is part of front-matter
}

// ============================================================================
// SINGLE SOURCE OF TRUTH FOR ALL PROPERTIES
// ============================================================================

export const PROPERTY_REGISTRY: Record<string, PropertyDefinition> = {
  TITLE: {
    key: "title",
    name: "Title",
    type: "string",
    source: "formula.Title",
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
  PROJECTS: {
    key: "projects",
    name: "Projects",
    type: "array",
    link: true,
    default: [],
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
    default: "Backlog",
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
    name: "tags",
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
    type: "string",
    source: "file.ctime",
    frontmatter: false, // This comes from file system, not front-matter
  },
  UPDATED_AT: {
    key: "updatedAt",
    name: "Updated At",
    type: "string",
    source: "file.mtime",
    frontmatter: false, // This comes from file system, not front-matter
  },
  SOURCE: {
    key: "source",
    name: "Source",
    type: "string",
    frontmatter: false, // Internal property, not stored in front-matter
  },
};
