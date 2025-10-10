/**
 * Tests for GitHubOrgRepoMapper
 * Verifies organization/repository to area/project mapping functionality
 */

import { GitHubOrgRepoMapper } from "../../../src/app/services/GitHubOrgRepoMapper";
import type { GitHubOrgRepoMapping } from "../../../src/app/types/settings";

describe("GitHubOrgRepoMapper", () => {
  let mapper: GitHubOrgRepoMapper;

  beforeEach(() => {
    mapper = new GitHubOrgRepoMapper();
  });

  describe("resolveMapping", () => {
    test("should return no match for invalid repository format", () => {
      const result = mapper.resolveMapping("invalid-repo");
      expect(result.matchType).toBe("none");
    });

    test("should return no match for empty repository", () => {
      const result = mapper.resolveMapping("");
      expect(result.matchType).toBe("none");
    });

    test("should match exact repository mapping", () => {
      const mappings: GitHubOrgRepoMapping[] = [
        {
          repository: "microsoft/vscode",
          targetArea: "VSCode Development",
          targetProject: "VSCode Core",
          priority: 1,
        },
      ];
      mapper.setMappings(mappings);

      const result = mapper.resolveMapping("microsoft/vscode");
      expect(result.matchType).toBe("repository");
      expect(result.targetArea).toBe("VSCode Development");
      expect(result.targetProject).toBe("VSCode Core");
      expect(result.matchedMapping).toEqual(mappings[0]);
    });

    test("should match organization mapping when no repository match", () => {
      const mappings: GitHubOrgRepoMapping[] = [
        {
          organization: "microsoft",
          targetArea: "Microsoft Projects",
          targetProject: "Microsoft",
          priority: 1,
        },
      ];
      mapper.setMappings(mappings);

      const result = mapper.resolveMapping("microsoft/any-repo");
      expect(result.matchType).toBe("organization");
      expect(result.targetArea).toBe("Microsoft Projects");
      expect(result.targetProject).toBe("Microsoft");
      expect(result.matchedMapping).toEqual(mappings[0]);
    });

    test("should prioritize repository mapping over organization mapping", () => {
      const mappings: GitHubOrgRepoMapping[] = [
        {
          organization: "microsoft",
          targetArea: "Microsoft Projects",
          targetProject: "Microsoft",
          priority: 1,
        },
        {
          repository: "microsoft/vscode",
          targetArea: "VSCode Development",
          targetProject: "VSCode Core",
          priority: 1,
        },
      ];
      mapper.setMappings(mappings);

      const result = mapper.resolveMapping("microsoft/vscode");
      expect(result.matchType).toBe("repository");
      expect(result.targetArea).toBe("VSCode Development");
      expect(result.targetProject).toBe("VSCode Core");
    });

    test("should respect priority ordering", () => {
      const mappings: GitHubOrgRepoMapping[] = [
        {
          organization: "microsoft",
          targetArea: "Low Priority",
          targetProject: "Low Priority Project",
          priority: 1,
        },
        {
          organization: "microsoft",
          targetArea: "High Priority",
          targetProject: "High Priority Project",
          priority: 5,
        },
      ];
      mapper.setMappings(mappings);

      const result = mapper.resolveMapping("microsoft/any-repo");
      expect(result.matchType).toBe("organization");
      expect(result.targetArea).toBe("High Priority");
      expect(result.targetProject).toBe("High Priority Project");
    });
  });

  describe("enhanceTaskData", () => {
    test("should not modify task data when no mapping exists", () => {
      const taskData = {
        project: "Original Project",
        areas: ["Original Area"],
      };

      const result = mapper.enhanceTaskData("unknown/repo", taskData);
      expect(result).toEqual(taskData);
    });

    test("should apply project mapping when found", () => {
      const mappings: GitHubOrgRepoMapping[] = [
        {
          repository: "microsoft/vscode",
          targetProject: "VSCode Core",
          priority: 1,
        },
      ];
      mapper.setMappings(mappings);

      const taskData = {
        project: "Original Project",
        areas: ["Original Area"],
      };

      const result = mapper.enhanceTaskData("microsoft/vscode", taskData);
      expect(result.project).toBe("VSCode Core");
      expect(result.areas).toEqual(["Original Area"]); // Should not change
    });

    test("should apply area mapping when found", () => {
      const mappings: GitHubOrgRepoMapping[] = [
        {
          repository: "microsoft/vscode",
          targetArea: "VSCode Development",
          priority: 1,
        },
      ];
      mapper.setMappings(mappings);

      const taskData = {
        project: "Original Project",
        areas: ["Original Area"],
      };

      const result = mapper.enhanceTaskData("microsoft/vscode", taskData);
      expect(result.project).toBe("Original Project"); // Should not change
      expect(result.areas).toEqual(["VSCode Development"]);
    });

    test("should apply both area and project mappings", () => {
      const mappings: GitHubOrgRepoMapping[] = [
        {
          repository: "microsoft/vscode",
          targetArea: "VSCode Development",
          targetProject: "VSCode Core",
          priority: 1,
        },
      ];
      mapper.setMappings(mappings);

      const taskData = {
        project: "Original Project",
        areas: ["Original Area"],
      };

      const result = mapper.enhanceTaskData("microsoft/vscode", taskData);
      expect(result.project).toBe("VSCode Core");
      expect(result.areas).toEqual(["VSCode Development"]);
    });
  });

  describe("validateMapping", () => {
    test("should require either organization or repository", () => {
      const mapping: GitHubOrgRepoMapping = {
        targetArea: "Test Area",
      };

      const result = mapper.validateMapping(mapping);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Must specify either organization or repository");
    });

    test("should require at least one target", () => {
      const mapping: GitHubOrgRepoMapping = {
        organization: "microsoft",
      };

      const result = mapper.validateMapping(mapping);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Must specify at least one target (area or project)");
    });

    test("should validate repository format", () => {
      const mapping: GitHubOrgRepoMapping = {
        repository: "invalid-format",
        targetArea: "Test Area",
      };

      const result = mapper.validateMapping(mapping);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Repository must be in format 'owner/repo'");
    });

    test("should validate priority is non-negative", () => {
      const mapping: GitHubOrgRepoMapping = {
        organization: "microsoft",
        targetArea: "Test Area",
        priority: -1,
      };

      const result = mapper.validateMapping(mapping);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Priority must be non-negative");
    });

    test("should pass validation for valid mapping", () => {
      const mapping: GitHubOrgRepoMapping = {
        repository: "microsoft/vscode",
        targetArea: "VSCode Development",
        targetProject: "VSCode Core",
        priority: 1,
      };

      const result = mapper.validateMapping(mapping);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("mapping management", () => {
    test("should add new mapping", () => {
      const mapping: GitHubOrgRepoMapping = {
        organization: "microsoft",
        targetArea: "Microsoft Projects",
        priority: 1,
      };

      mapper.addMapping(mapping);
      const mappings = mapper.getMappings();
      expect(mappings).toHaveLength(1);
      expect(mappings[0]).toEqual(mapping);
    });

    test("should remove mapping by index", () => {
      const mapping1: GitHubOrgRepoMapping = {
        organization: "microsoft",
        targetArea: "Microsoft Projects",
        priority: 1,
      };
      const mapping2: GitHubOrgRepoMapping = {
        organization: "google",
        targetArea: "Google Projects",
        priority: 2,
      };

      mapper.setMappings([mapping1, mapping2]);
      mapper.removeMapping(0);

      const mappings = mapper.getMappings();
      expect(mappings).toHaveLength(1);
      expect(mappings[0]).toEqual(mapping2);
    });

    test("should update mapping by index", () => {
      const originalMapping: GitHubOrgRepoMapping = {
        organization: "microsoft",
        targetArea: "Microsoft Projects",
        priority: 1,
      };
      const updatedMapping: GitHubOrgRepoMapping = {
        organization: "microsoft",
        targetArea: "Updated Microsoft Projects",
        targetProject: "Microsoft Core",
        priority: 2,
      };

      mapper.setMappings([originalMapping]);
      mapper.updateMapping(0, updatedMapping);

      const mappings = mapper.getMappings();
      expect(mappings).toHaveLength(1);
      expect(mappings[0]).toEqual(updatedMapping);
    });
  });
});
