/**
 * Validation utilities for settings
 */

import { ValidationResult } from "./types";
import { VALIDATION_PATTERNS } from "./defaults";

/**
 * Validates a folder path
 */
export function validateFolderPath(path: string): ValidationResult {
  // Allow empty strings for optional folders
  if (!path.trim()) {
    return { isValid: true };
  }

  // Check for invalid characters
  if (!VALIDATION_PATTERNS.folderName.test(path)) {
    return {
      isValid: false,
      error: "Folder path contains invalid characters",
    };
  }

  // Check for reserved names (Windows)
  const reservedNames = [
    "CON",
    "PRN",
    "AUX",
    "NUL",
    "COM1",
    "COM2",
    "COM3",
    "COM4",
    "COM5",
    "COM6",
    "COM7",
    "COM8",
    "COM9",
    "LPT1",
    "LPT2",
    "LPT3",
    "LPT4",
    "LPT5",
    "LPT6",
    "LPT7",
    "LPT8",
    "LPT9",
  ];
  const pathParts = path.split("/").filter((part) => part.length > 0);

  for (const part of pathParts) {
    if (reservedNames.includes(part.toUpperCase())) {
      return {
        isValid: false,
        error: `"${part}" is a reserved folder name`,
      };
    }

    // Check for "Obsidian" folder name (case-insensitive)
    // Obsidian hides folders named "Obsidian" to avoid confusion with the .obsidian system folder
    if (part.toLowerCase() === "obsidian") {
      return {
        isValid: false,
        error: `"${part}" folder name is not recommended as Obsidian hides folders with this name. Use "Templates" or "MyTemplates" instead.`,
      };
    }
  }

  return { isValid: true };
}

/**
 * Validates a file name
 */
export function validateFileName(fileName: string): ValidationResult {
  // Allow empty strings for optional files
  if (!fileName.trim()) {
    return { isValid: true };
  }

  // Check for invalid characters and ensure it has an extension
  if (!VALIDATION_PATTERNS.fileName.test(fileName)) {
    return {
      isValid: false,
      error: "File name contains invalid characters or missing extension",
    };
  }

  // Check for reserved names (Windows)
  const reservedNames = [
    "CON",
    "PRN",
    "AUX",
    "NUL",
    "COM1",
    "COM2",
    "COM3",
    "COM4",
    "COM5",
    "COM6",
    "COM7",
    "COM8",
    "COM9",
    "LPT1",
    "LPT2",
    "LPT3",
    "LPT4",
    "LPT5",
    "LPT6",
    "LPT7",
    "LPT8",
    "LPT9",
  ];
  const nameWithoutExt = fileName.split(".")[0];

  if (reservedNames.includes(nameWithoutExt.toUpperCase())) {
    return {
      isValid: false,
      error: `"${nameWithoutExt}" is a reserved file name`,
    };
  }

  return { isValid: true };
}

/**
 * Validates a base file name (must end with .base)
 */
export function validateBaseFileName(fileName: string): ValidationResult {
  const baseValidation = validateFileName(fileName);
  if (!baseValidation.isValid) {
    return baseValidation;
  }

  if (fileName.trim() && !fileName.endsWith(".base")) {
    return {
      isValid: false,
      error: "Base file must have .base extension",
    };
  }

  return { isValid: true };
}

/**
 * Validates template file name (must end with .md)
 */
export function validateTemplateFileName(fileName: string): ValidationResult {
  const baseValidation = validateFileName(fileName);
  if (!baseValidation.isValid) {
    return baseValidation;
  }

  if (fileName.trim() && !fileName.endsWith(".md")) {
    return {
      isValid: false,
      error: "Template file must have .md extension",
    };
  }

  return { isValid: true };
}

/**
 * Validates GitHub Personal Access Token format
 */
export function validateGitHubToken(token: string): ValidationResult {
  // Allow empty tokens (integration can be disabled)
  if (!token.trim()) {
    return { isValid: true };
  }

  // GitHub Classic PAT format: ghp_ followed by 40 characters
  const classicPATPattern = /^ghp_[a-zA-Z0-9]{40}$/;

  // GitHub Fine-grained PAT format: github_pat_ followed by version and token
  const fineGrainedPATPattern = /^github_pat_[a-zA-Z0-9_]{82,}$/;

  if (classicPATPattern.test(token) || fineGrainedPATPattern.test(token)) {
    return { isValid: true };
  }

  return {
    isValid: false,
    error:
      "Invalid GitHub Personal Access Token format. Expected format: ghp_... (classic) or github_pat_... (fine-grained)",
  };
}
