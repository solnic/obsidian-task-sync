/**
 * Utility functions for handling Obsidian link formats
 */

import { Task, EntityDataView } from "../types/entities";

/**
 * Converts Obsidian link format to display value
 * Examples:
 * - "[[Projects/Task Sync|Task Sync]]" → "Task Sync"
 * - "[[Task Sync]]" → "Task Sync"
 * - "Projects/Task Sync|Task Sync" → "Task Sync"
 * - "Task Sync" → "Task Sync"
 */
export function extractDisplayValue(
  value: string | undefined | null
): string | undefined {
  if (!value || typeof value !== "string") {
    return undefined;
  }

  // Handle full Obsidian link format: [[path|display]] or [[path]]
  const obsidianLinkMatch = value.match(/^\[\[([^\]]+)\]\]$/);
  if (obsidianLinkMatch) {
    const linkContent = obsidianLinkMatch[1];
    // Check if it has display text after |
    const pipeIndex = linkContent.indexOf("|");
    if (pipeIndex !== -1) {
      return linkContent.substring(pipeIndex + 1).trim();
    }
    // No display text, use the path part (extract filename)
    const pathParts = linkContent.split("/");
    return pathParts[pathParts.length - 1].trim();
  }

  // Handle path|display format without brackets
  const pipeIndex = value.indexOf("|");
  if (pipeIndex !== -1) {
    return value.substring(pipeIndex + 1).trim();
  }

  // Plain value, return as-is
  return value.trim();
}

/**
 * Converts array of Obsidian link formats to display values
 */
export function extractDisplayValues(
  values: string[] | undefined | null
): string[] | undefined {
  if (!values || !Array.isArray(values)) {
    return undefined;
  }

  return values
    .map(extractDisplayValue)
    .filter((value): value is string => value !== undefined);
}

/**
 * Creates a proper Obsidian link format with full path and display name
 * Examples:
 * - createLinkFormat("Task Sync", "Projects") → "Projects/Task Sync|Task Sync"
 * - createLinkFormat("Open Source", "Areas") → "Areas/Open Source|Open Source"
 */
export function createLinkFormat(displayName: string, folder: string): string {
  return `${folder}/${displayName}|${displayName}`;
}

/**
 * Creates a proper Obsidian wikilink format
 * Examples:
 * - createWikiLink("Task Sync", "Projects") → "[[Projects/Task Sync|Task Sync]]"
 * - createWikiLink("Open Source", "Areas") → "[[Areas/Open Source|Open Source]]"
 */
export function createWikiLink(displayName: string, folder: string): string {
  return `[[${createLinkFormat(displayName, folder)}]]`;
}

/**
 * Extracts the full path from a link format
 * Examples:
 * - "Projects/Task Sync|Task Sync" → "Projects/Task Sync"
 * - "[[Areas/Open Source|Open Source]]" → "Areas/Open Source"
 * - "Task Sync" → "Task Sync"
 */
export function extractFullPath(
  value: string | undefined | null
): string | undefined {
  if (!value || typeof value !== "string") {
    return undefined;
  }

  // Handle full Obsidian link format: [[path|display]] or [[path]]
  const obsidianLinkMatch = value.match(/^\[\[([^\]]+)\]\]$/);
  if (obsidianLinkMatch) {
    const linkContent = obsidianLinkMatch[1];
    // Check if it has display text after |
    const pipeIndex = linkContent.indexOf("|");
    if (pipeIndex !== -1) {
      return linkContent.substring(0, pipeIndex).trim();
    }
    // No display text, return the full content
    return linkContent.trim();
  }

  // Handle path|display format without brackets
  const pipeIndex = value.indexOf("|");
  if (pipeIndex !== -1) {
    return value.substring(0, pipeIndex).trim();
  }

  // Plain value, return as-is
  return value.trim();
}

/**
 * Creates a data view object for a Task entity
 * Converts all linked properties to display values
 */
export function createTaskDataView(task: Task): EntityDataView {
  return {
    id: task.id,
    title: task.title,
    type: task.type,
    category: task.category,
    priority: task.priority,
    status: task.status,
    done: task.done,
    project: extractDisplayValue(task.project),
    areas: extractDisplayValues(task.areas),
    parentTask: extractDisplayValue(task.parentTask),
    tags: task.tags,
    source: task.source,
  };
}
