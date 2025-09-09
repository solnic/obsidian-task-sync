/**
 * Core entity types for the Task Sync plugin
 * Implements GTD (Getting Things Done) methodology with hierarchical organization
 */

// Base interface for all entities
export interface BaseEntity {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

// Task status enumeration
export enum TaskStatus {
  TODO = "todo",
  IN_PROGRESS = "in-progress",
  WAITING = "waiting",
  DONE = "done",
  CANCELLED = "cancelled",
}

// Task priority levels
export enum TaskPriority {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  URGENT = "urgent",
}

// External source tracking for imported tasks
export interface TaskSource {
  /** Source system name (e.g., 'github', 'linear') */
  name: string;
  /** External identifier in the source system */
  key: string;
  /** Optional URL to the external task */
  url?: string;
}

// Task entity - core unit of work
export interface Task extends BaseEntity {
  // Core properties
  status: TaskStatus;
  priority: TaskPriority;

  // Scheduling
  deadline?: Date;
  scheduledDate?: Date;
  completedAt?: Date;

  // Hierarchy and organization
  projectId?: string;
  areaId?: string;
  parentTaskId?: string; // For subtasks

  // Content and context
  content?: string; // Full markdown content
  tags: string[];

  // File system integration
  filePath?: string; // Path to the task file in vault
  fileExists: boolean;

  // Dependencies and relationships
  dependsOn: string[]; // Task IDs this task depends on
  blocks: string[]; // Task IDs this task blocks

  // Tracking and metrics
  estimatedDuration?: number; // In minutes
  actualDuration?: number; // In minutes

  // External source tracking
  source?: TaskSource;

  // Configuration
  frontmatter: [
    "TYPE",
    "TITLE",
    "CATEGORY",
    "PRIORITY",
    "AREAS",
    "PROJECT",
    "DONE",
    "STATUS",
    "PARENT_TASK",
    "TAGS"
  ];

  base: [
    "TITLE",
    "TYPE",
    "CATEGORY",
    "PRIORITY",
    "AREAS",
    "PROJECT",
    "DONE",
    "STATUS",
    "PARENT_TASK",
    "TAGS",
    "CREATED_AT",
    "UPDATED_AT"
  ];

  // Template and automation
  templateId?: string;
  recurring?: RecurringConfig;
}

// Recurring task configuration
export interface RecurringConfig {
  enabled: boolean;
  pattern: "daily" | "weekly" | "monthly" | "yearly" | "custom";
  interval: number; // For custom patterns
  endDate?: Date;
  lastGenerated?: Date;
}

// Project entity - collection of related tasks
export interface Project extends BaseEntity {
  // Organization
  areaId?: string;

  // Status and progress
  status: "active" | "on-hold" | "completed" | "cancelled";
  progress: number; // 0-100 percentage

  // Scheduling
  startDate?: Date;
  deadline?: Date;
  completedAt?: Date;

  // Content and context
  content?: string; // Full markdown content
  tags: string[];

  // File system integration
  filePath?: string;
  fileExists: boolean;

  // Task management
  taskIds: string[]; // Tasks belonging to this project

  // Template and automation
  templateId?: string;

  // Goals and outcomes
  objectives: string[];
  successCriteria: string[];

  // Configuration
  frontmatter: ["TYPE", "TITLE", "AREAS"];
}

// Area entity - life/work area for organizing projects
export interface Area extends BaseEntity {
  // Content and context
  content?: string; // Full markdown content
  tags: string[];

  // File system integration
  filePath?: string;
  fileExists: boolean;

  // Organization
  projectIds: string[]; // Projects in this area

  // Goals and vision
  purpose?: string;
  vision?: string;
  goals: string[];

  // Template and automation
  templateId?: string;

  // Status
  isActive: boolean;

  // Configuration
  frontmatter: ["TYPE", "TITLE", "PROJECTS"];
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
