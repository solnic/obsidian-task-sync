/**
 * LocalTask view object for Local Tasks Service
 * Provides a sortable interface that exposes the correct timestamps
 * based on whether the task has source data or uses file system timestamps
 */

import type { Task } from "./entities";

export interface LocalTask {
  /** Original task entity */
  task: Task;

  /** Sortable attributes that expose the correct values for sorting */
  sortable: {
    /** Creation timestamp - uses source data if available, otherwise file system */
    createdAt: Date | null;

    /** Update timestamp - uses source data if available, otherwise file system */
    updatedAt: Date | null;

    /** Title for sorting */
    title: string;

    /** Priority for sorting */
    priority: string;

    /** Status for sorting */
    status: string;

    /** Category for sorting */
    category: string;

    /** Project for sorting */
    project: string;

    /** Areas for sorting (first area) */
    areas: string;
  };
}

/**
 * Create a LocalTask view object from a Task entity
 * This function determines the correct timestamps to use based on source data
 */
export function createLocalTask(task: Task): LocalTask {
  // Determine the correct timestamps to use
  let createdAt: Date | null = null;
  let updatedAt: Date | null = null;

  if (task.source?.data) {
    // Try to extract timestamps from source data (including GitHub)
    createdAt = extractTimestampFromFileContent(task, "Created");
    updatedAt = extractTimestampFromFileContent(task, "Updated");
  }

  // Fall back to file system timestamps if no source data
  if (!createdAt && task.createdAt) {
    createdAt = task.createdAt;
  }
  if (!updatedAt && task.updatedAt) {
    updatedAt = task.updatedAt;
  }

  return {
    task,
    sortable: {
      createdAt,
      updatedAt,
      title: task.title || "",
      priority: task.priority || "",
      status: task.status || "",
      category: task.category || "",
      project: extractDisplayValue(task.project) || "",
      areas: extractFirstAreaDisplayValue(task.areas) || "",
    },
  };
}

/**
 * Extract timestamp from task source data
 * Handles various timestamp formats from different sources
 */
function extractTimestampFromFileContent(
  task: Task,
  label: "Created" | "Updated"
): Date | null {
  try {
    if (!task.source?.data) {
      return null;
    }

    const sourceData = task.source.data;

    // Helper function to safely create and validate Date objects
    const createValidDate = (dateValue: any): Date | null => {
      if (!dateValue) {
        return null;
      }

      const date = new Date(dateValue);
      // Check if the Date object is valid
      if (isNaN(date.getTime())) {
        return null;
      }

      return date;
    };

    // For GitHub tasks, we can extract the original timestamps from the raw GitHub data
    // The GitHub issue data is stored in task.source.data and contains created_at/updated_at
    if (task.source.name === "github") {
      if (label === "Created" && sourceData.created_at) {
        return createValidDate(sourceData.created_at);
      }

      if (label === "Updated" && sourceData.updated_at) {
        return createValidDate(sourceData.updated_at);
      }
    } else {
      // For other sources, check for various timestamp formats
      if (label === "Created") {
        if (sourceData.created_at) {
          return createValidDate(sourceData.created_at);
        }
        if (sourceData.createdAt) {
          return createValidDate(sourceData.createdAt);
        }
      }

      if (label === "Updated") {
        if (sourceData.updated_at) {
          return createValidDate(sourceData.updated_at);
        }
        if (sourceData.updatedAt) {
          return createValidDate(sourceData.updatedAt);
        }
      }
    }

    return null;
  } catch (error) {
    console.warn(
      `Failed to extract ${label} timestamp from source data:`,
      error
    );
    return null;
  }
}

/**
 * Extract display value from a link string
 * Converts "[[Project Name]]" to "Project Name"
 */
function extractDisplayValue(value: string | undefined): string {
  if (!value || typeof value !== "string") return "";

  // Handle Obsidian link format [[Link Text]]
  const linkMatch = value.match(/^\[\[([^\]]+)\]\]$/);
  if (linkMatch) {
    return linkMatch[1];
  }

  return value;
}

/**
 * Extract display value from the first area in an areas array
 */
function extractFirstAreaDisplayValue(
  areas: string[] | string | undefined
): string {
  if (!areas) return "";

  const areaArray = Array.isArray(areas) ? areas : [areas];
  if (areaArray.length === 0) return "";

  // Find the first string value in the array
  const firstStringArea = areaArray.find((area) => typeof area === "string");
  return extractDisplayValue(firstStringArea);
}
