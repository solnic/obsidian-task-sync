/**
 * Integration Types for External Task Import
 * Defines interfaces for importing tasks from external systems like GitHub and Linear
 */

/**
 * Standardized representation of external task data
 * Used as an intermediate format when importing from different sources
 */
export interface ExternalTaskData {
  /** Unique identifier from the external system */
  id: string;

  /** Task title/summary */
  title: string;

  /** Optional task description/body */
  description?: string;

  /** Task status in external system */
  status: string;

  /** Optional priority level */
  priority?: string;

  /** Optional assignee username */
  assignee?: string;

  /** Optional labels/tags from external system */
  labels?: string[];

  /** Creation timestamp */
  createdAt: Date;

  /** Last update timestamp */
  updatedAt: Date;

  /** URL to view task in external system */
  externalUrl: string;

  /** Source system type */
  sourceType: "github" | "linear";

  /** Raw data from source system for reference */
  sourceData: Record<string, any>;
}

/**
 * Configuration for importing external tasks
 * Determines how and where tasks should be created in Obsidian
 */
export interface TaskImportConfig {
  /** Target area for the imported task */
  targetArea?: string;

  /** Target project for the imported task */
  targetProject?: string;

  /** Task type to assign (Bug, Feature, etc.) */
  taskType?: string;

  /** Whether to import external labels as Obsidian tags */
  importLabelsAsTags?: boolean;

  /** Whether to preserve assignee information */
  preserveAssignee?: boolean;
}

/**
 * Result of a task import operation
 * Provides feedback on success/failure and details
 */
export interface ImportResult {
  /** Whether the import was successful */
  success: boolean;

  /** Path to the created task file (if successful) */
  taskPath?: string;

  /** Error message (if failed) */
  error?: string;

  /** Whether the task was skipped */
  skipped?: boolean;

  /** Reason for skipping (if skipped) */
  reason?: string;
}

/**
 * Metadata about an imported task
 * Used to track import status and prevent duplicates
 */
export interface ImportedTaskMetadata {
  /** External task ID */
  externalId: string;

  /** Source system */
  externalSource: "github" | "linear";

  /** Path to the created Obsidian task */
  taskPath: string;

  /** When the task was imported */
  importedAt: Date;

  /** Last sync timestamp */
  lastSyncedAt: Date;

  /** External URL for reference */
  externalUrl: string;

  /** Import configuration used */
  importConfig?: TaskImportConfig;
}

/**
 * Bulk import configuration options
 * Controls behavior when importing multiple tasks
 */
export interface BulkImportOptions {
  /** Skip tasks that have already been imported */
  skipExisting?: boolean;

  /** Maximum number of concurrent imports */
  maxConcurrent?: number;

  /** Perform a dry run without actually creating files */
  dryRun?: boolean;

  /** Progress callback for UI updates */
  onProgress?: (completed: number, total: number) => void;
}

/**
 * Result of a bulk import operation
 * Provides summary statistics and detailed results
 */
export interface BulkImportResult {
  /** Total number of tasks processed */
  total: number;

  /** Number of tasks successfully imported */
  imported: number;

  /** Number of tasks skipped */
  skipped: number;

  /** Number of tasks that failed to import */
  failed: number;

  /** Detailed results for each task */
  results: ImportResult[];

  /** Total duration in milliseconds */
  duration: number;
}
