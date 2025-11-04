/**
 * Context types for the new architecture
 * Defines file context interface and related types
 */

import type { Task, Project, Area } from "../core/entities";

/**
 * File context interface for context-aware functionality
 * Represents the current file's context (project, area, task, daily note, etc.)
 */
export interface FileContext {
  type: "project" | "area" | "task" | "daily" | "none";
  name?: string;
  path?: string;
  entity?: Task | Project | Area; // Resolved entity for the current context
  dailyPlanningMode?: boolean; // Whether Daily Planning wizard is currently active
}

/**
 * Filter state based on context
 * Used for context-aware filtering of tasks and other entities
 */
export interface ContextFilterState {
  project: string | null;
  area: string | null;
  parentTask: string | null;
}
