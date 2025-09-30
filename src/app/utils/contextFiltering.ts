/**
 * Context-based filtering utilities for tasks
 * Simplified version for the new architecture
 */

import type { Task } from "../core/entities";
import { extractDisplayValue } from "./linkUtils";

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
      const project =
        typeof task.project === "string"
          ? extractDisplayValue(task.project) ||
            task.project.replace(/^\[\[|\]\]$/g, "")
          : task.project;
      if (project) {
        projects.add(project);
      }
    }

    // Collect areas - ensure areas is an array before iterating
    if (task.areas) {
      if (Array.isArray(task.areas)) {
        task.areas.forEach((area) => {
          const cleanArea =
            typeof area === "string"
              ? extractDisplayValue(area) || area.replace(/^\[\[|\]\]$/g, "")
              : area;
          if (cleanArea) {
            areas.add(cleanArea);
          }
        });
      } else if (typeof (task.areas as any) === "string") {
        // Handle case where areas is a single string (runtime safety)
        const areaStr = task.areas as any;
        const cleanArea =
          extractDisplayValue(areaStr) || areaStr.replace(/^\[\[|\]\]$/g, "");
        if (cleanArea) {
          areas.add(cleanArea);
        }
      }
    }

    // Collect parent tasks
    if (task.parentTask) {
      const parent =
        typeof task.parentTask === "string"
          ? extractDisplayValue(task.parentTask) ||
            task.parentTask.replace(/^\[\[|\]\]$/g, "")
          : task.parentTask;
      if (parent) {
        parentTasks.add(parent);
      }
    }

    // Collect sources
    if (task.source?.filePath) {
      sources.add(task.source.filePath);
    }
  });

  return {
    projects: Array.from(projects).sort(),
    areas: Array.from(areas).sort(),
    parentTasks: Array.from(parentTasks).sort(),
    sources: Array.from(sources).sort(),
  };
}
