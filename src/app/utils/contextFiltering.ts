/**
 * Context-based filtering utilities for tasks
 * Simplified version for the new architecture
 */

import type { Task } from "../core/entities";

/**
 * Get available filter options from tasks
 */
export function getFilterOptions(tasks: Task[]): {
  projects: string[];
  areas: string[];
  parentTasks: string[];
  sources: string[];
} {
  const projects = new Set<string>();
  const areas = new Set<string>();
  const parentTasks = new Set<string>();
  const sources = new Set<string>();

  tasks.forEach((task) => {
    // Collect projects
    if (task.project) {
      projects.add(task.project);
    }

    // Collect areas
    if (task.areas && Array.isArray(task.areas)) {
      task.areas.forEach((area) => {
        areas.add(area);
      });
    }

    // Collect parent tasks
    if (task.parentTask) {
      parentTasks.add(task.parentTask);
    }

    // Collect sources - use extension (e.g., "obsidian", "github")
    if (task.source?.extension) {
      sources.add(task.source.extension);
    }
  });

  return {
    projects: Array.from(projects).sort(),
    areas: Array.from(areas).sort(),
    parentTasks: Array.from(parentTasks).sort(),
    sources: Array.from(sources).sort(),
  };
}
