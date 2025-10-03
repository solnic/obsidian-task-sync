/**
 * Registry for external task sources
 * Initializes and registers all available external task sources
 */

import { ExternalTaskSourceFactory } from "../types/ExternalTaskSource";
import { GitHubTaskSource } from "./sources/GitHubTaskSource";
import { AppleRemindersTaskSource } from "./sources/AppleRemindersTaskSource";

/**
 * Initialize and register all external task sources
 * This should be called during plugin initialization
 */
export function initializeExternalTaskSources(): void {
  // Register GitHub task source
  ExternalTaskSourceFactory.register("github", new GitHubTaskSource());
  
  // Register Apple Reminders task source
  ExternalTaskSourceFactory.register("apple-reminders", new AppleRemindersTaskSource());
  
  // TODO: Add other sources as they are implemented
  // ExternalTaskSourceFactory.register("linear", new LinearTaskSource());
  // ExternalTaskSourceFactory.register("apple-calendar", new AppleCalendarTaskSource());
}

/**
 * Get all registered external task source types
 */
export function getRegisteredTaskSourceTypes(): string[] {
  return ExternalTaskSourceFactory.getRegisteredTypes();
}

/**
 * Check if a task source type is registered
 */
export function isTaskSourceRegistered(sourceType: string): boolean {
  return ExternalTaskSourceFactory.get(sourceType) !== undefined;
}
