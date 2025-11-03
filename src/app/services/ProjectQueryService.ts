/**
 * ProjectQueryService - Pure functions for querying projects
 * No dependencies on stores - operates on readonly arrays
 */

import type { Project } from "../core/entities";

export class ProjectQueryService {
  /**
   * Find a project by file path
   *
   * @param projects - Array of projects to search
   * @param filePath - File path to find
   * @returns Project with the specified file path, or undefined if not found
   */
  static findByFilePath(
    projects: readonly Project[],
    filePath: string
  ): Project | undefined {
    return projects.find(
      (project) => project.source.keys.obsidian === filePath
    );
  }

  /**
   * Find a project by name
   *
   * @param projects - Array of projects to search
   * @param name - Project name to find
   * @returns Project with the specified name, or undefined if not found
   */
  static findByName(
    projects: readonly Project[],
    name: string
  ): Project | undefined {
    return projects.find((project) => project.name === name);
  }

  /**
   * Find a project by ID
   *
   * @param projects - Array of projects to search
   * @param id - Project ID to find
   * @returns Project with the specified ID, or undefined if not found
   */
  static findById(
    projects: readonly Project[],
    id: string
  ): Project | undefined {
    return projects.find((project) => project.id === id);
  }

  /**
   * Get projects by extension
   *
   * @param projects - Array of projects to filter
   * @param extensionId - Extension ID to filter by
   * @returns Projects from the specified extension
   */
  static getByExtension(
    projects: readonly Project[],
    extensionId: string
  ): readonly Project[] {
    return projects.filter(
      (project) => project.source?.extension === extensionId
    );
  }

  /**
   * Get projects by area
   *
   * @param projects - Array of projects to filter
   * @param areaId - Area ID to filter by
   * @returns Projects in the specified area
   */
  static getByArea(
    projects: readonly Project[],
    areaId: string
  ): readonly Project[] {
    return projects.filter((project) => project.areas.includes(areaId));
  }

  /**
   * Search projects by query string
   *
   * @param projects - Array of projects to search
   * @param query - Search query
   * @returns Projects matching the search query
   */
  static search(
    projects: readonly Project[],
    query: string
  ): readonly Project[] {
    if (!query) return projects;

    const lowerQuery = query.toLowerCase();
    return projects.filter(
      (project) =>
        project.name.toLowerCase().includes(lowerQuery) ||
        project.description?.toLowerCase().includes(lowerQuery) ||
        project.tags.some((tag) => tag.toLowerCase().includes(lowerQuery)) ||
        project.areas.some((area) => area.toLowerCase().includes(lowerQuery))
    );
  }
}
