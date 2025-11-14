/**
 * GitHub Organization/Repository Mapper Service
 * Maps GitHub organizations and repositories to Obsidian areas and projects
 */

import type { GitHubOrgRepoMapping } from "../../../types/settings";

export interface OrgRepoMappingResult {
  /** Target area for the imported task */
  targetArea?: string;
  /** Target project for the imported task */
  targetProject?: string;
  /** The mapping that was matched (for debugging/logging) */
  matchedMapping?: GitHubOrgRepoMapping;
  /** The type of match that was found */
  matchType?: "repository" | "organization" | "none";
}

export class GitHubOrgRepoMapper {
  private mappings: GitHubOrgRepoMapping[];

  constructor(mappings: GitHubOrgRepoMapping[] = []) {
    this.mappings = [...mappings];
  }

  /**
   * Update the mappings configuration
   */
  setMappings(mappings: GitHubOrgRepoMapping[]): void {
    this.mappings = [...mappings];
  }

  /**
   * Get the current mappings configuration
   */
  getMappings(): GitHubOrgRepoMapping[] {
    return [...this.mappings];
  }

  /**
   * Resolve area and project mappings for a given repository
   * @param repository Repository in format 'owner/repo' (e.g., 'microsoft/vscode')
   * @returns Mapping result with target area/project if found
   */
  resolveMapping(repository: string): OrgRepoMappingResult {
    if (!repository || !repository.includes("/")) {
      return { matchType: "none" };
    }

    const [owner, _repo] = repository.split("/", 2);

    // Sort mappings by priority (higher priority first), then by specificity
    const sortedMappings = this.getSortedMappings();

    // First, try to find exact repository match
    for (const mapping of sortedMappings) {
      if (mapping.repository && mapping.repository === repository) {
        return {
          targetArea: mapping.targetArea,
          targetProject: mapping.targetProject,
          matchedMapping: mapping,
          matchType: "repository",
        };
      }
    }

    // Then, try to find organization match
    for (const mapping of sortedMappings) {
      if (
        mapping.organization &&
        mapping.organization === owner &&
        !mapping.repository
      ) {
        return {
          targetArea: mapping.targetArea,
          targetProject: mapping.targetProject,
          matchedMapping: mapping,
          matchType: "organization",
        };
      }
    }

    return { matchType: "none" };
  }

  /**
   * Apply organization/repository mappings to task data
   * @param repository Repository in format 'owner/repo'
   * @param taskData Existing task data to enhance
   * @returns Enhanced task data with org/repo mappings applied
   */
  enhanceTaskData(
    repository: string,
    taskData: { project?: string; areas?: string[] }
  ): { project?: string; areas?: string[] } {
    const mapping = this.resolveMapping(repository);

    if (mapping.matchType === "none") {
      return taskData;
    }

    const enhancedData = { ...taskData };

    // Apply project mapping if found - GitHub mappings take precedence over existing data
    if (mapping.targetProject) {
      enhancedData.project = mapping.targetProject;
    }

    // Apply area mapping if found - GitHub mappings take precedence over existing data
    if (mapping.targetArea) {
      enhancedData.areas = [mapping.targetArea];
    }

    return enhancedData;
  }

  /**
   * Check if a repository has any configured mappings
   * @param repository Repository in format 'owner/repo'
   * @returns True if any mapping exists for this repository or its organization
   */
  hasMapping(repository: string): boolean {
    const result = this.resolveMapping(repository);
    return result.matchType !== "none";
  }

  /**
   * Get all mappings for a specific organization
   * @param organization Organization name
   * @returns Array of mappings for the organization
   */
  getMappingsForOrganization(organization: string): GitHubOrgRepoMapping[] {
    return this.mappings.filter(
      (mapping) => mapping.organization === organization
    );
  }

  /**
   * Get mapping for a specific repository
   * @param repository Repository in format 'owner/repo'
   * @returns Mapping for the repository if it exists
   */
  getMappingForRepository(
    repository: string
  ): GitHubOrgRepoMapping | undefined {
    return this.mappings.find((mapping) => mapping.repository === repository);
  }

  /**
   * Add a new mapping
   * @param mapping The mapping to add
   */
  addMapping(mapping: GitHubOrgRepoMapping): void {
    this.mappings.push({ ...mapping });
  }

  /**
   * Remove a mapping
   * @param index Index of the mapping to remove
   */
  removeMapping(index: number): void {
    if (index >= 0 && index < this.mappings.length) {
      this.mappings.splice(index, 1);
    }
  }

  /**
   * Update a mapping at a specific index
   * @param index Index of the mapping to update
   * @param mapping New mapping data
   */
  updateMapping(index: number, mapping: GitHubOrgRepoMapping): void {
    if (index >= 0 && index < this.mappings.length) {
      this.mappings[index] = { ...mapping };
    }
  }

  /**
   * Validate a mapping configuration
   * @param mapping The mapping to validate
   * @returns Validation result with any errors
   */
  validateMapping(mapping: GitHubOrgRepoMapping): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Must have either organization or repository
    if (!mapping.organization && !mapping.repository) {
      errors.push("Must specify either organization or repository");
    }

    // Repository format validation
    if (mapping.repository && !mapping.repository.includes("/")) {
      errors.push("Repository must be in format 'owner/repo'");
    }

    // Must have at least one target
    if (!mapping.targetArea && !mapping.targetProject) {
      errors.push("Must specify at least one target (area or project)");
    }

    // Priority validation
    if (mapping.priority !== undefined && mapping.priority < 0) {
      errors.push("Priority must be non-negative");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Sort mappings by priority and specificity
   * Repository-specific mappings take precedence over organization mappings
   * Higher priority numbers take precedence over lower ones
   */
  private getSortedMappings(): GitHubOrgRepoMapping[] {
    return [...this.mappings].sort((a, b) => {
      // First sort by priority (higher first)
      const priorityA = a.priority ?? 0;
      const priorityB = b.priority ?? 0;
      if (priorityA !== priorityB) {
        return priorityB - priorityA;
      }

      // Then by specificity (repository-specific before organization-only)
      const specificityA = a.repository ? 2 : a.organization ? 1 : 0;
      const specificityB = b.repository ? 2 : b.organization ? 1 : 0;
      return specificityB - specificityA;
    });
  }
}
