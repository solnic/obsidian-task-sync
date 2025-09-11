/**
 * Context-based filtering utilities for tasks
 * Provides automatic filtering based on current file context (project/area/parent task)
 */

import type { Task } from "../types/entities";
import type { FileContext } from "../main";
import type { GitHubIssue, GitHubPullRequest } from "../services/GitHubService";

export interface FilterState {
  project: string | null;
  area: string | null;
  parentTask: string | null;
}

/**
 * Get filter state based on current context
 */
export function getContextFilters(context: FileContext): FilterState {
  const filters: FilterState = {
    project: null,
    area: null,
    parentTask: null,
  };

  switch (context.type) {
    case "project":
      if (context.name) {
        filters.project = context.name;
      }
      break;
    case "area":
      if (context.name) {
        filters.area = context.name;
      }
      break;
    case "task":
      if (context.name) {
        filters.parentTask = context.name;
      }
      break;
  }

  return filters;
}

/**
 * Filter local tasks based on context and additional filters
 */
export function filterLocalTasks(
  tasks: Task[],
  context: FileContext,
  additionalFilters: Partial<FilterState> = {}
): Task[] {
  const contextFilters = getContextFilters(context);
  const combinedFilters = { ...contextFilters, ...additionalFilters };

  return tasks.filter((task) => {
    // Project filter
    if (combinedFilters.project) {
      const taskProject = task.project?.replace(/^\[\[|\]\]$/g, ""); // Remove wiki link brackets
      if (taskProject !== combinedFilters.project) {
        return false;
      }
    }

    // Area filter
    if (combinedFilters.area) {
      const taskAreas = task.areas?.map(area => area.replace(/^\[\[|\]\]$/g, "")) || [];
      if (!taskAreas.includes(combinedFilters.area)) {
        return false;
      }
    }

    // Parent task filter
    if (combinedFilters.parentTask) {
      const taskParent = task.parentTask?.replace(/^\[\[|\]\]$/g, ""); // Remove wiki link brackets
      if (taskParent !== combinedFilters.parentTask) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Filter GitHub issues based on context and additional filters
 * Note: GitHub issues don't have direct project/area mapping, but we can filter
 * based on imported tasks that match the context
 */
export function filterGitHubIssues(
  issues: GitHubIssue[],
  context: FileContext,
  importedTasks: Task[],
  additionalFilters: Partial<FilterState> = {}
): GitHubIssue[] {
  const contextFilters = getContextFilters(context);
  const combinedFilters = { ...contextFilters, ...additionalFilters };

  // If no context filters are active, return all issues
  if (!combinedFilters.project && !combinedFilters.area && !combinedFilters.parentTask) {
    return issues;
  }

  // Get GitHub task IDs that match the context filters
  const relevantTaskIds = new Set<string>();
  
  importedTasks
    .filter(task => task.source?.name === "github")
    .forEach(task => {
      const matchesContext = filterLocalTasks([task], context, additionalFilters).length > 0;
      if (matchesContext && task.source?.key) {
        relevantTaskIds.add(task.source.key);
      }
    });

  // Filter issues based on whether they have been imported as relevant tasks
  return issues.filter(issue => {
    const issueKey = `github-${issue.id}`;
    return relevantTaskIds.has(issueKey);
  });
}

/**
 * Filter GitHub pull requests based on context and additional filters
 */
export function filterGitHubPullRequests(
  pullRequests: GitHubPullRequest[],
  context: FileContext,
  importedTasks: Task[],
  additionalFilters: Partial<FilterState> = {}
): GitHubPullRequest[] {
  const contextFilters = getContextFilters(context);
  const combinedFilters = { ...contextFilters, ...additionalFilters };

  // If no context filters are active, return all pull requests
  if (!combinedFilters.project && !combinedFilters.area && !combinedFilters.parentTask) {
    return pullRequests;
  }

  // Get GitHub task IDs that match the context filters
  const relevantTaskIds = new Set<string>();
  
  importedTasks
    .filter(task => task.source?.name === "github")
    .forEach(task => {
      const matchesContext = filterLocalTasks([task], context, additionalFilters).length > 0;
      if (matchesContext && task.source?.key) {
        relevantTaskIds.add(task.source.key);
      }
    });

  // Filter pull requests based on whether they have been imported as relevant tasks
  return pullRequests.filter(pr => {
    const prKey = `github-${pr.id}`;
    return relevantTaskIds.has(prKey);
  });
}

/**
 * Get available filter options from tasks
 */
export function getFilterOptions(tasks: Task[]): {
  projects: string[];
  areas: string[];
  parentTasks: string[];
} {
  const projects = new Set<string>();
  const areas = new Set<string>();
  const parentTasks = new Set<string>();

  tasks.forEach(task => {
    // Collect projects
    if (task.project) {
      const project = task.project.replace(/^\[\[|\]\]$/g, "");
      if (project) {
        projects.add(project);
      }
    }

    // Collect areas
    if (task.areas) {
      task.areas.forEach(area => {
        const cleanArea = area.replace(/^\[\[|\]\]$/g, "");
        if (cleanArea) {
          areas.add(cleanArea);
        }
      });
    }

    // Collect parent tasks
    if (task.parentTask) {
      const parent = task.parentTask.replace(/^\[\[|\]\]$/g, "");
      if (parent) {
        parentTasks.add(parent);
      }
    }
  });

  return {
    projects: Array.from(projects).sort(),
    areas: Array.from(areas).sort(),
    parentTasks: Array.from(parentTasks).sort(),
  };
}

/**
 * Check if any context filters are active
 */
export function hasActiveContextFilters(context: FileContext): boolean {
  const filters = getContextFilters(context);
  return !!(filters.project || filters.area || filters.parentTask);
}

/**
 * Get display text for active context filters
 */
export function getActiveContextFilterText(context: FileContext): string {
  const filters = getContextFilters(context);
  const activeFilters: string[] = [];

  if (filters.project) {
    activeFilters.push(`Project: ${filters.project}`);
  }
  if (filters.area) {
    activeFilters.push(`Area: ${filters.area}`);
  }
  if (filters.parentTask) {
    activeFilters.push(`Parent: ${filters.parentTask}`);
  }

  return activeFilters.join(", ");
}
