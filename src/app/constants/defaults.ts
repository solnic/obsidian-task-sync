/**
 * Default values and constants for TaskSync application
 * Centralized location for all default values to maintain consistency
 */

/**
 * Default task status value
 */
export const DEFAULT_TASK_STATUS = "Backlog";

/**
 * Default task priority value
 */
export const DEFAULT_TASK_PRIORITY = "Medium";

/**
 * Default task priorities with colors
 */
export const DEFAULT_TASK_PRIORITIES = [
  { name: "Critical", color: "#dc2626" },
  { name: "High", color: "#ea580c" },
  { name: "Medium", color: "#f59e0b" },
  { name: "Low", color: "#10b981" },
  { name: "Urgent", color: "#dc2626" },
  { name: "Normal", color: "#6b7280" },
] as const;

/**
 * Default task statuses with colors and states
 */
export const DEFAULT_TASK_STATUSES = [
  { name: "Backlog", color: "#64748b", isDone: false, isInProgress: false },
  { name: "In Progress", color: "#3b82f6", isDone: false, isInProgress: true },
  { name: "Review", color: "#f59e0b", isDone: false, isInProgress: false },
  { name: "Done", color: "#10b981", isDone: true, isInProgress: false },
] as const;

/**
 * Default task categories with colors
 */
export const DEFAULT_TASK_CATEGORIES = [
  { name: "Feature", color: "#3b82f6" },
  { name: "Bug", color: "#ef4444" },
  { name: "Enhancement", color: "#8b5cf6" },
  { name: "Documentation", color: "#10b981" },
  { name: "Chore", color: "#6b7280" },
] as const;

/**
 * Priority order mapping for sorting
 */
export const PRIORITY_ORDER = {
  Critical: 5,
  High: 4,
  Medium: 3,
  Low: 2,
  Normal: 1,
} as const;
