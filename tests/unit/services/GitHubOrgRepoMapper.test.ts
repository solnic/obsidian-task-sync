/**
 * Unit tests for GitHubOrgRepoMapper
 */

import { GitHubOrgRepoMapper } from "../../../src/services/GitHubOrgRepoMapper";
import { GitHubOrgRepoMapping } from "../../../src/components/ui/settings/types";

describe("GitHubOrgRepoMapper", () => {
  let mapper: GitHubOrgRepoMapper;

  beforeEach(() => {
    mapper = new GitHubOrgRepoMapper();
  });

  describe("resolveMapping", () => {
    it("should return no match for empty repository", () => {
      const result = mapper.resolveMapping("");
      expect(result.matchType).toBe("none");
    });

    it("should return no match for invalid repository format", () => {
      const result = mapper.resolveMapping("invalid-repo");
      expect(result.matchType).toBe("none");
    });

    it("should match exact repository mapping", () => {
      const mappings: GitHubOrgRepoMapping[] = [
        {
          repository: "microsoft/vscode",
          targetArea: "Development",
          targetProject: "VSCode",
          priority: 1,
        },
      ];
      mapper.setMappings(mappings);

      const result = mapper.resolveMapping("microsoft/vscode");
      expect(result.matchType).toBe("repository");
      expect(result.targetArea).toBe("Development");
      expect(result.targetProject).toBe("VSCode");
      expect(result.matchedMapping).toEqual(mappings[0]);
    });

    it("should match organization mapping when no repository match", () => {
      const mappings: GitHubOrgRepoMapping[] = [
        {
          organization: "microsoft",
          targetArea: "Microsoft Projects",
          targetProject: "General",
          priority: 1,
        },
      ];
      mapper.setMappings(mappings);

      const result = mapper.resolveMapping("microsoft/some-repo");
      expect(result.matchType).toBe("organization");
      expect(result.targetArea).toBe("Microsoft Projects");
      expect(result.targetProject).toBe("General");
    });

    it("should prioritize repository mapping over organization mapping", () => {
      const mappings: GitHubOrgRepoMapping[] = [
        {
          organization: "microsoft",
          targetArea: "Microsoft Projects",
          targetProject: "General",
          priority: 1,
        },
        {
          repository: "microsoft/vscode",
          targetArea: "Development",
          targetProject: "VSCode",
          priority: 1,
        },
      ];
      mapper.setMappings(mappings);

      const result = mapper.resolveMapping("microsoft/vscode");
      expect(result.matchType).toBe("repository");
      expect(result.targetArea).toBe("Development");
      expect(result.targetProject).toBe("VSCode");
    });

    it("should respect priority ordering for same match type", () => {
      const mappings: GitHubOrgRepoMapping[] = [
        {
          organization: "microsoft",
          targetArea: "Low Priority",
          targetProject: "General",
          priority: 1,
        },
        {
          organization: "microsoft",
          targetArea: "High Priority",
          targetProject: "Important",
          priority: 10,
        },
      ];
      mapper.setMappings(mappings);

      const result = mapper.resolveMapping("microsoft/some-repo");
      expect(result.matchType).toBe("organization");
      expect(result.targetArea).toBe("High Priority");
      expect(result.targetProject).toBe("Important");
    });

    it("should not match organization if repository is specified in mapping", () => {
      const mappings: GitHubOrgRepoMapping[] = [
        {
          organization: "microsoft",
          repository: "microsoft/vscode", // This should only match exact repo
          targetArea: "Development",
          targetProject: "VSCode",
          priority: 1,
        },
      ];
      mapper.setMappings(mappings);

      const result = mapper.resolveMapping("microsoft/other-repo");
      expect(result.matchType).toBe("none");
    });
  });

  describe("enhanceImportConfig", () => {
    it("should not modify config when no mapping found", () => {
      const config = { taskType: "Task" };
      const result = mapper.enhanceImportConfig("unknown/repo", config);
      expect(result).toEqual(config);
    });

    it("should add area and project from repository mapping", () => {
      const mappings: GitHubOrgRepoMapping[] = [
        {
          repository: "microsoft/vscode",
          targetArea: "Development",
          targetProject: "VSCode",
          priority: 1,
        },
      ];
      mapper.setMappings(mappings);

      const config = { taskType: "Task" };
      const result = mapper.enhanceImportConfig("microsoft/vscode", config);
      expect(result.targetArea).toBe("Development");
      expect(result.targetProject).toBe("VSCode");
      expect(result.taskType).toBe("Task"); // Should preserve existing properties
    });

    it("should add only area when project not specified", () => {
      const mappings: GitHubOrgRepoMapping[] = [
        {
          repository: "microsoft/vscode",
          targetArea: "Development",
          priority: 1,
        },
      ];
      mapper.setMappings(mappings);

      const config = { taskType: "Task" };
      const result = mapper.enhanceImportConfig("microsoft/vscode", config);
      expect(result.targetArea).toBe("Development");
      expect(result.targetProject).toBeUndefined();
    });

    it("should add only project when area not specified", () => {
      const mappings: GitHubOrgRepoMapping[] = [
        {
          repository: "microsoft/vscode",
          targetProject: "VSCode",
          priority: 1,
        },
      ];
      mapper.setMappings(mappings);

      const config = { taskType: "Task" };
      const result = mapper.enhanceImportConfig("microsoft/vscode", config);
      expect(result.targetProject).toBe("VSCode");
      expect(result.targetArea).toBeUndefined();
    });

    it("should override existing areas and project with GitHub mappings", () => {
      const mappings: GitHubOrgRepoMapping[] = [
        {
          repository: "microsoft/vscode",
          targetArea: "Development",
          targetProject: "VSCode",
          priority: 1,
        },
      ];
      mapper.setMappings(mappings);

      const config = {
        taskType: "Task",
        targetArea: "Existing Area",
        targetProject: "Existing Project",
      };
      const result = mapper.enhanceImportConfig("microsoft/vscode", config);
      expect(result.targetArea).toBe("Development"); // Should override with GitHub mapping
      expect(result.targetProject).toBe("VSCode"); // Should override with GitHub mapping
    });
  });

  describe("validateMapping", () => {
    it("should validate valid organization mapping", () => {
      const mapping: GitHubOrgRepoMapping = {
        organization: "microsoft",
        targetArea: "Development",
        priority: 1,
      };
      const result = mapper.validateMapping(mapping);
      expect(result.isValid).toBe(true);
    });

    it("should validate valid repository mapping", () => {
      const mapping: GitHubOrgRepoMapping = {
        repository: "microsoft/vscode",
        targetProject: "VSCode",
        priority: 1,
      };
      const result = mapper.validateMapping(mapping);
      expect(result.isValid).toBe(true);
    });

    it("should reject mapping with neither organization nor repository", () => {
      const mapping: GitHubOrgRepoMapping = {
        targetArea: "Development",
        priority: 1,
      };
      const result = mapper.validateMapping(mapping);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Must specify either organization or repository"
      );
    });

    it("should reject mapping with neither target area nor project", () => {
      const mapping: GitHubOrgRepoMapping = {
        organization: "microsoft",
        priority: 1,
      };
      const result = mapper.validateMapping(mapping);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Must specify at least one target (area or project)"
      );
    });

    it("should reject invalid repository format", () => {
      const mapping: GitHubOrgRepoMapping = {
        repository: "invalid-format",
        targetArea: "Development",
        priority: 1,
      };
      const result = mapper.validateMapping(mapping);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Repository must be in format 'owner/repo'"
      );
    });
  });

  describe("mapping management", () => {
    it("should add and retrieve mappings", () => {
      const mapping: GitHubOrgRepoMapping = {
        organization: "microsoft",
        targetArea: "Development",
        priority: 1,
      };

      mapper.addMapping(mapping);
      const mappings = mapper.getMappings();
      expect(mappings).toHaveLength(1);
      expect(mappings[0]).toEqual(mapping);
    });

    it("should get mappings for specific organization", () => {
      const mappings: GitHubOrgRepoMapping[] = [
        { organization: "microsoft", targetArea: "MS", priority: 1 },
        { organization: "google", targetArea: "Google", priority: 1 },
        { organization: "microsoft", targetArea: "MS2", priority: 2 },
      ];
      mapper.setMappings(mappings);

      const msMapping = mapper.getMappingsForOrganization("microsoft");
      expect(msMapping).toHaveLength(2);
      expect(msMapping.every((m) => m.organization === "microsoft")).toBe(true);
    });

    it("should get mapping for specific repository", () => {
      const mappings: GitHubOrgRepoMapping[] = [
        { repository: "microsoft/vscode", targetArea: "VSCode", priority: 1 },
        { repository: "microsoft/typescript", targetArea: "TS", priority: 1 },
      ];
      mapper.setMappings(mappings);

      const mapping = mapper.getMappingForRepository("microsoft/vscode");
      expect(mapping?.targetArea).toBe("VSCode");

      const noMapping = mapper.getMappingForRepository("microsoft/other");
      expect(noMapping).toBeUndefined();
    });
  });
});
