/**
 * AreaQueryService - Pure functions for querying areas
 * No dependencies on stores - operates on readonly arrays
 */

import type { Area } from "../core/entities";

export class AreaQueryService {
  /**
   * Find an area by file path
   *
   * @param areas - Array of areas to search
   * @param filePath - File path to find
   * @returns Area with the specified file path, or undefined if not found
   */
  static findByFilePath(
    areas: readonly Area[],
    filePath: string
  ): Area | undefined {
    return areas.find((area) => area.source.keys.obsidian === filePath);
  }

  /**
   * Find an area by name
   *
   * @param areas - Array of areas to search
   * @param name - Area name to find
   * @returns Area with the specified name, or undefined if not found
   */
  static findByName(areas: readonly Area[], name: string): Area | undefined {
    return areas.find((area) => area.name === name);
  }

  /**
   * Find an area by ID
   *
   * @param areas - Array of areas to search
   * @param id - Area ID to find
   * @returns Area with the specified ID, or undefined if not found
   */
  static findById(areas: readonly Area[], id: string): Area | undefined {
    return areas.find((area) => area.id === id);
  }

  /**
   * Get areas by extension
   *
   * @param areas - Array of areas to filter
   * @param extensionId - Extension ID to filter by
   * @returns Areas from the specified extension
   */
  static getByExtension(
    areas: readonly Area[],
    extensionId: string
  ): readonly Area[] {
    return areas.filter((area) => area.source?.extension === extensionId);
  }

  /**
   * Search areas by query string
   *
   * @param areas - Array of areas to search
   * @param query - Search query
   * @returns Areas matching the search query
   */
  static search(areas: readonly Area[], query: string): readonly Area[] {
    if (!query) return areas;

    const lowerQuery = query.toLowerCase();
    return areas.filter(
      (area) =>
        area.name.toLowerCase().includes(lowerQuery) ||
        area.description?.toLowerCase().includes(lowerQuery) ||
        area.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Get all unique tags from areas
   *
   * @param areas - Array of areas
   * @returns Sorted array of unique tags
   */
  static getAllTags(areas: readonly Area[]): readonly string[] {
    const allTags = new Set<string>();
    areas.forEach((area) => {
      area.tags.forEach((tag) => allTags.add(tag));
    });
    return Array.from(allTags).sort();
  }
}
