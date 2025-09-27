/**
 * Unit tests for settings validation utilities
 */

import { describe, test, expect } from "vitest";
import {
  validateFolderPath,
  validateFileName,
  validateBaseFileName,
  validateTemplateFileName,
  validateGitHubToken,
} from "../../../../src/app/components/settings/validation";

describe("Settings Validation", () => {
  describe("validateFolderPath", () => {
    test("should accept valid folder paths", () => {
      expect(validateFolderPath("Tasks")).toEqual({ isValid: true });
      expect(validateFolderPath("My Tasks")).toEqual({ isValid: true });
      expect(validateFolderPath("Projects/Active")).toEqual({ isValid: true });
      expect(validateFolderPath("")).toEqual({ isValid: true }); // Empty is allowed
    });

    test("should reject invalid characters", () => {
      const result = validateFolderPath("Tasks<>:");
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("invalid characters");
    });

    test("should reject reserved Windows names", () => {
      const result = validateFolderPath("CON");
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("reserved folder name");
    });

    test("should reject Obsidian folder name", () => {
      const result = validateFolderPath("obsidian");
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("not recommended");
    });
  });

  describe("validateFileName", () => {
    test("should accept valid file names", () => {
      expect(validateFileName("task.md")).toEqual({ isValid: true });
      expect(validateFileName("my-template.md")).toEqual({ isValid: true });
      expect(validateFileName("")).toEqual({ isValid: true }); // Empty is allowed
    });

    test("should reject files without extensions", () => {
      const result = validateFileName("task");
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("missing extension");
    });

    test("should reject reserved Windows names", () => {
      const result = validateFileName("CON.md");
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("reserved file name");
    });
  });

  describe("validateBaseFileName", () => {
    test("should accept valid base file names", () => {
      expect(validateBaseFileName("Tasks.base")).toEqual({ isValid: true });
      expect(validateBaseFileName("")).toEqual({ isValid: true });
    });

    test("should reject files without .base extension", () => {
      const result = validateBaseFileName("Tasks.md");
      expect(result.isValid).toBe(false);
      expect(result.error).toContain(".base extension");
    });
  });

  describe("validateTemplateFileName", () => {
    test("should accept valid template file names", () => {
      expect(validateTemplateFileName("task.md")).toEqual({ isValid: true });
      expect(validateTemplateFileName("")).toEqual({ isValid: true });
    });

    test("should reject files without .md extension", () => {
      const result = validateTemplateFileName("task.txt");
      expect(result.isValid).toBe(false);
      expect(result.error).toContain(".md extension");
    });
  });

  describe("validateGitHubToken", () => {
    test("should accept non-empty tokens", () => {
      expect(validateGitHubToken("ghp_1234567890")).toEqual({ isValid: true });
      expect(validateGitHubToken("some-token")).toEqual({ isValid: true });
    });

    test("should reject empty tokens", () => {
      const result = validateGitHubToken("");
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("required");
    });

    test("should reject whitespace-only tokens", () => {
      const result = validateGitHubToken("   ");
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("required");
    });
  });
});
