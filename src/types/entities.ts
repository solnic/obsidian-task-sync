/**
 * Core entity types for the Task Sync plugin
 * Implements GTD (Getting Things Done) methodology with hierarchical organization
 */

import { TFile } from "obsidian";

// Base interface for all entities
export interface BaseEntity {
  id: string;
  file?: TFile; // Obsidian file reference
  filePath?: string; // Path to the file in vault
}

// External source tracking for imported tasks
export interface TaskSource {
  /** Source system name (e.g., 'github', 'linear', 'todo-promotion') */
  name: string;
  /** External identifier in the source system */
  key: string;
  /** Optional URL to the external task */
  url?: string;
  /** Additional metadata for the source */
  metadata?: Record<string, any>;
}

// Task entity - core system properties
export interface Task extends BaseEntity {
  // Front-matter properties (frontmatter: true)
  title: string; // TITLE (from Title front-matter property)
  type?: string; // TYPE
  category?: string; // CATEGORY
  priority?: string; // PRIORITY
  status?: string; // STATUS
  done?: boolean; // DONE
  parentTask?: string; // PARENT_TASK
  project?: string; // PROJECT
  areas?: string[]; // AREAS
  tags?: string[]; // TAGS

  // Internal attributes (not front-matter)
  source?: TaskSource; // External source tracking
}

// Project entity - core system properties
export interface Project extends BaseEntity {
  // Front-matter properties (frontmatter: true)
  name: string; // NAME (from Name front-matter property)
  type?: string; // TYPE
  areas?: string[]; // AREAS
  tags?: string[]; // TAGS
}

// Area entity - core system properties
export interface Area extends BaseEntity {
  // Front-matter properties (frontmatter: true)
  name: string; // NAME (from Name front-matter property)
  type?: string; // TYPE
  tags?: string[]; // TAGS
}

// Template entity for creating new tasks/projects/areas
export interface Template extends BaseEntity {
  // Template type
  type: "task" | "project" | "area" | "parent-task";

  // Template content
  content: string; // Markdown template with variables
  variables: TemplateVariable[];

  // File system integration
  filePath?: string;
  fileExists: boolean;

  // Usage tracking
  usageCount: number;
  lastUsed?: Date;
}

// Template variable definition
export interface TemplateVariable {
  name: string;
  type: "text" | "date" | "select" | "boolean" | "number";
  description?: string;
  required: boolean;
  defaultValue?: any;
  options?: string[]; // For select type
}

// Base file entity for .base files
export interface BaseFile extends BaseEntity {
  // File system integration
  filePath: string;
  fileExists: boolean;

  // Base file configuration
  viewType: "kanban" | "list" | "calendar" | "timeline";
  filters: BaseFileFilter[];
  sorting: BaseFileSorting;
  grouping?: BaseFileGrouping;

  // Content
  entityIds: string[]; // Tasks, projects, or areas to include
  entityType: "task" | "project" | "area";

  // Auto-generation settings
  autoGenerate: boolean;
  autoUpdate: boolean;
  lastGenerated?: Date;
}

// Base file filter configuration
export interface BaseFileFilter {
  field: string;
  operator:
    | "equals"
    | "contains"
    | "startsWith"
    | "endsWith"
    | "greaterThan"
    | "lessThan"
    | "in"
    | "notIn";
  value: any;
  enabled: boolean;
}

// Base file sorting configuration
export interface BaseFileSorting {
  field: string;
  direction: "asc" | "desc";
  secondary?: {
    field: string;
    direction: "asc" | "desc";
  };
}

// Base file grouping configuration
export interface BaseFileGrouping {
  field: string;
  showEmpty: boolean;
  customOrder?: string[];
}
