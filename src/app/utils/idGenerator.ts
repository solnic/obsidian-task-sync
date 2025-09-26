/**
 * ID Generation Utility
 * Provides consistent ULID-based ID generation across the application
 */

import { ulid } from "ulid";

/**
 * Generate a unique ULID
 * ULIDs are lexicographically sortable, URL-safe, and case-insensitive
 * @returns A new ULID string
 */
export function generateId(): string {
  return ulid();
}

/**
 * Generate a prefixed ULID for specific entity types
 * @param prefix - The prefix to add to the ULID (e.g., 'task', 'schedule', 'github')
 * @returns A prefixed ULID string
 */
export function generatePrefixedId(prefix: string): string {
  return `${prefix}-${ulid()}`;
}

/**
 * Check if a string is a valid ULID
 * @param id - The string to validate
 * @returns True if the string is a valid ULID
 */
export function isValidUlid(id: string): boolean {
  // ULID regex pattern: 26 characters, base32 encoded (Crockford's Base32)
  // Valid characters: 0123456789ABCDEFGHJKMNPQRSTVWXYZ (no I, L, O, U)
  const ulidPattern = /^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$/;
  return ulidPattern.test(id);
}
