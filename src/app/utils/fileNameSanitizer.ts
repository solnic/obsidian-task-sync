/**
 * File name sanitization utilities
 * Ensures file names are safe for use across different operating systems
 */

/**
 * Sanitize a string to be safe for use as a file name
 * Removes or replaces characters that are not allowed in file names
 */
export function sanitizeFileName(fileName: string): string {
  if (!fileName) {
    return "untitled";
  }

  // Replace problematic characters with safe alternatives
  let sanitized = fileName
    // Replace path separators
    .replace(/[/\\]/g, "-")
    // Replace other problematic characters
    .replace(/[<>:"|?*]/g, "-")
    // Replace multiple consecutive spaces or dashes with single dash
    .replace(/[\s-]+/g, "-")
    // Remove leading/trailing spaces and dashes
    .replace(/^[-\s]+|[-\s]+$/g, "");

  // Ensure the filename is not empty after sanitization
  if (!sanitized) {
    return "untitled";
  }

  // Limit length to reasonable file name length (255 is typical max, but we'll be conservative)
  if (sanitized.length > 200) {
    sanitized = sanitized.substring(0, 200);
  }

  // Remove trailing periods (problematic on Windows)
  sanitized = sanitized.replace(/\.+$/, "");

  // Ensure we don't have an empty string after all processing
  return sanitized || "untitled";
}

/**
 * Sanitize a string for use as a base file name (adds .base extension)
 */
export function sanitizeBaseFileName(baseName: string): string {
  const sanitized = sanitizeFileName(baseName);
  return `${sanitized}.base`;
}

/**
 * Check if a file name is already sanitized
 */
export function isFileNameSafe(fileName: string): boolean {
  const sanitized = sanitizeFileName(fileName);
  return fileName === sanitized;
}
