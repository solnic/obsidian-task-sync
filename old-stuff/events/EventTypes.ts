/**
 * Event Types and Interfaces for the Task Sync Plugin
 * Defines the event system used for file change monitoring and synchronization
 */

/**
 * Enumeration of all event types supported by the plugin
 */
export enum EventType {
  // File change events
  STATUS_CHANGED = "status-changed",
  DONE_CHANGED = "done-changed",
  TASK_CREATED = "task-created",
  TASK_UPDATED = "task-updated",
  TASK_DELETED = "task-deleted",
  PROJECT_CREATED = "project-created",
  PROJECT_UPDATED = "project-updated",
  PROJECT_DELETED = "project-deleted",
  AREA_CREATED = "area-created",
  AREA_UPDATED = "area-updated",
  AREA_DELETED = "area-deleted",

  // Task mention events
  TASK_MENTION_CREATED = "task-mention-created",
  TASK_MENTION_UPDATED = "task-mention-updated",
  TASK_MENTION_DELETED = "task-mention-deleted",
  TASK_MENTION_COMPLETED = "task-mention-completed",
  TASK_MENTION_UNCOMPLETED = "task-mention-uncompleted",

  // System events
  PLUGIN_LOADED = "plugin-loaded",
  PLUGIN_UNLOADED = "plugin-unloaded",
  SETTINGS_CHANGED = "settings-changed",
  BASE_REGENERATED = "base-regenerated",
}

/**
 * Base interface for all plugin events
 */
export interface PluginEvent {
  type: EventType;
  timestamp: Date;
  data: EventData;
}

/**
 * Union type for all possible event data structures
 */
export type EventData =
  | StatusChangedEventData
  | DoneChangedEventData
  | TaskEventData
  | ProjectEventData
  | AreaEventData
  | TaskMentionEventData
  | TaskMentionStateChangedEventData
  | SettingsChangedEventData
  | BaseRegeneratedEventData
  | GenericEventData;

/**
 * Event data for status change events
 */
export interface StatusChangedEventData {
  filePath: string;
  oldStatus?: string;
  newStatus: string;
  frontmatter: Record<string, any>;
  entityType: "task" | "project" | "area";
}

/**
 * Event data for done field change events
 */
export interface DoneChangedEventData {
  filePath: string;
  oldDone?: boolean;
  newDone: boolean;
  frontmatter: Record<string, any>;
  entityType: "task" | "project" | "area";
}

/**
 * Event data for task-related events
 */
export interface TaskEventData {
  filePath: string;
  taskName: string;
  frontmatter?: Record<string, any>;
  content?: string;
}

/**
 * Event data for project-related events
 */
export interface ProjectEventData {
  filePath: string;
  projectName: string;
  frontmatter?: Record<string, any>;
  content?: string;
}

/**
 * Event data for area-related events
 */
export interface AreaEventData {
  filePath: string;
  areaName: string;
  frontmatter?: Record<string, any>;
  content?: string;
}

/**
 * Event data for task mention-related events
 */
export interface TaskMentionEventData {
  filePath: string;
  lineNumber: number;
  taskPath: string;
  taskTitle: string;
  mentionText: string;
  completed: boolean;
  indentation: string;
  listMarker: string;
}

/**
 * Event data for task mention state change events
 */
export interface TaskMentionStateChangedEventData {
  filePath: string;
  lineNumber: number;
  taskPath: string;
  taskTitle: string;
  mentionText: string;
  oldCompleted: boolean;
  newCompleted: boolean;
  indentation: string;
  listMarker: string;
}

/**
 * Event data for settings change events
 */
export interface SettingsChangedEventData {
  /** The section of settings that changed (e.g., 'githubIntegration', 'appleRemindersIntegration') */
  section: string;
  /** The old settings object for this section */
  oldSettings: any;
  /** The new settings object for this section */
  newSettings: any;
  /** Whether this section's settings actually changed */
  hasChanges: boolean;
}

/**
 * Event data for base regeneration events
 */
export interface BaseRegeneratedEventData {
  baseType: "tasks" | "area" | "project" | "parent-task";
  basePath: string;
  entityName?: string;
}

/**
 * Generic event data for simple events
 */
export interface GenericEventData {
  [key: string]: any;
}

/**
 * Interface for event handlers
 */
export interface EventHandler<T extends EventData = EventData> {
  /**
   * Handle an event
   * @param event The event to handle
   * @returns Promise that resolves when handling is complete
   */
  handle(event: PluginEvent & { data: T }): Promise<void>;

  /**
   * Get the event types this handler supports
   */
  getSupportedEventTypes(): EventType[];

  /**
   * Optional method to check if this handler should process a specific event
   * @param event The event to check
   * @returns true if the handler should process this event
   */
  shouldHandle?(event: PluginEvent): boolean;
}

/**
 * Interface for event middleware
 */
export interface EventMiddleware {
  /**
   * Process an event before it's sent to handlers
   * @param event The event to process
   * @returns The processed event, or null to cancel the event
   */
  process(event: PluginEvent): Promise<PluginEvent | null>;
}

/**
 * Configuration for event emission
 */
export interface EventEmissionOptions {
  /**
   * Whether to emit the event asynchronously (default: true)
   */
  async?: boolean;

  /**
   * Whether to continue processing if a handler throws an error (default: true)
   */
  continueOnError?: boolean;

  /**
   * Maximum time to wait for handlers to complete (in milliseconds)
   */
  timeout?: number;
}
