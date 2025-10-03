/**
 * Type definitions index for the Task Sync plugin
 * Exports all types for easy importing throughout the codebase
 */

// Entity types
export * from "./entities";

// Service types
export * from "./services";

// Integration types
export * from "./integrations";

// Plugin-specific types
export interface PluginState {
  isInitialized: boolean;
  isLoading: boolean;
  lastSyncTime: Date | null;
  errorCount: number;
  warningCount: number;
}

// Event types for plugin communication
export interface PluginEvent {
  type: string;
  data?: any;
  timestamp: Date;
}

// UI state types
export interface UIState {
  activeModal: string | null;
  selectedTask: string | null;
  selectedProject: string | null;
  selectedArea: string | null;
  dashboardView: "tasks" | "projects" | "areas" | "overview";
  filters: UIFilters;
  sorting: UISorting;
}

export interface UIFilters {
  status: string[];
  priority: string[];
  tags: string[];
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
  searchQuery: string;
}

export interface UISorting {
  field: string;
  direction: "asc" | "desc";
  secondary?: {
    field: string;
    direction: "asc" | "desc";
  };
}

// Error types
export class TaskSyncError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: Record<string, any>,
  ) {
    super(message);
    this.name = "TaskSyncError";
  }
}

export class ValidationError extends TaskSyncError {
  constructor(
    message: string,
    public field: string,
    context?: Record<string, any>,
  ) {
    super(message, "VALIDATION_ERROR", context);
    this.name = "ValidationError";
  }
}

export class FileSystemError extends TaskSyncError {
  constructor(
    message: string,
    public filePath: string,
    context?: Record<string, any>,
  ) {
    super(message, "FILESYSTEM_ERROR", context);
    this.name = "FileSystemError";
  }
}

export class TemplateError extends TaskSyncError {
  constructor(
    message: string,
    public templateId: string,
    context?: Record<string, any>,
  ) {
    super(message, "TEMPLATE_ERROR", context);
    this.name = "TemplateError";
  }
}
