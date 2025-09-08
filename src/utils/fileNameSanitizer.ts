/**
 * File Name Sanitizer Utility
 * Handles sanitization of file names to ensure compatibility with Obsidian and various operating systems
 *
 * Invalid characters in Obsidian: * " \ / < > : | ?
 * These characters are replaced with safe alternatives or removed entirely
 */

export interface SanitizationOptions {
  /** Character to replace invalid characters with (default: '-') */
  replacement?: string;
  /** Whether to collapse multiple consecutive replacement characters (default: true) */
  collapseReplacements?: boolean;
  /** Whether to trim whitespace from start and end (default: true) */
  trimWhitespace?: boolean;
  /** Maximum length for the sanitized name (default: 255) */
  maxLength?: number;
}

/**
 * List of characters that are invalid in Obsidian file names
 * Based on Obsidian forum documentation and Windows/macOS/Linux compatibility
 */
const INVALID_CHARACTERS = /[*"\\/<>:|?#]/g;

/**
 * Sanitize a file name by replacing invalid characters with safe alternatives
 *
 * @param fileName - The original file name to sanitize
 * @param options - Configuration options for sanitization behavior
 * @returns Sanitized file name safe for use in Obsidian
 */
export function sanitizeFileName(fileName: string, options: SanitizationOptions = {}): string {
  const {
    replacement = '-',
    collapseReplacements = true,
    trimWhitespace = true,
    maxLength = 255
  } = options;

  if (!fileName || typeof fileName !== 'string') {
    throw new Error('File name must be a non-empty string');
  }

  let sanitized = fileName;

  // Replace invalid characters with the replacement character
  sanitized = sanitized.replace(INVALID_CHARACTERS, replacement);

  // Collapse multiple consecutive replacement characters if enabled
  if (collapseReplacements && replacement) {
    const escapedReplacement = replacement.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const collapseRegex = new RegExp(`${escapedReplacement}{2,}`, 'g');
    sanitized = sanitized.replace(collapseRegex, replacement);
  }

  // Trim whitespace if enabled
  if (trimWhitespace) {
    sanitized = sanitized.trim();
  }

  // Remove leading/trailing replacement characters
  if (replacement) {
    const escapedReplacement = replacement.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const trimRegex = new RegExp(`^${escapedReplacement}+|${escapedReplacement}+$`, 'g');
    sanitized = sanitized.replace(trimRegex, '');
  }

  // Ensure the name is not empty after sanitization
  if (!sanitized) {
    sanitized = 'untitled';
  }

  // Truncate to maximum length if specified
  if (maxLength > 0 && sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength).trim();

    // Remove trailing replacement character if truncation created one
    if (replacement) {
      const escapedReplacement = replacement.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const trailingRegex = new RegExp(`${escapedReplacement}+$`);
      sanitized = sanitized.replace(trailingRegex, '');
    }
  }

  return sanitized;
}

/**
 * Create a safe file name with extension
 *
 * @param baseName - The base name without extension
 * @param extension - File extension (with or without leading dot)
 * @param options - Sanitization options
 * @returns Complete sanitized file name with extension
 */
export function createSafeFileName(baseName: string, extension: string = 'md', options: SanitizationOptions = {}): string {
  const sanitizedBase = sanitizeFileName(baseName, options);
  const cleanExtension = extension.startsWith('.') ? extension : `.${extension}`;

  return `${sanitizedBase}${cleanExtension}`;
}

/**
 * Validate if a file name contains any invalid characters
 *
 * @param fileName - File name to validate
 * @returns Object with validation result and list of invalid characters found
 */
export function validateFileName(fileName: string): { isValid: boolean; invalidCharacters: string[] } {
  if (!fileName || typeof fileName !== 'string') {
    return { isValid: false, invalidCharacters: [] };
  }

  const matches = fileName.match(INVALID_CHARACTERS);
  const invalidCharacters = matches ? [...new Set(matches)] : [];

  return {
    isValid: invalidCharacters.length === 0,
    invalidCharacters
  };
}

/**
 * Get a preview of how a file name would be sanitized without actually sanitizing it
 *
 * @param fileName - Original file name
 * @param options - Sanitization options
 * @returns Object with original name, sanitized preview, and whether changes would be made
 */
export function previewSanitization(fileName: string, options: SanitizationOptions = {}): {
  original: string;
  sanitized: string;
  hasChanges: boolean;
  invalidCharacters: string[];
} {
  const validation = validateFileName(fileName);
  const sanitized = sanitizeFileName(fileName, options);

  return {
    original: fileName,
    sanitized,
    hasChanges: fileName !== sanitized,
    invalidCharacters: validation.invalidCharacters
  };
}
