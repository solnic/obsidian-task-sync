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

/**
 * Check if a string is a valid prefixed ULID
 * @param id - The string to validate
 * @param prefix - The expected prefix
 * @returns True if the string is a valid prefixed ULID
 */
export function isValidPrefixedUlid(id: string, prefix: string): boolean {
  if (!id.startsWith(`${prefix}-`)) {
    return false;
  }
  const ulidPart = id.substring(prefix.length + 1);
  return isValidUlid(ulidPart);
}

/**
 * Extract the ULID part from a prefixed ID
 * @param prefixedId - The prefixed ID string
 * @param prefix - The prefix to remove
 * @returns The ULID part or null if invalid
 */
export function extractUlid(prefixedId: string, prefix: string): string | null {
  if (!isValidPrefixedUlid(prefixedId, prefix)) {
    return null;
  }
  return prefixedId.substring(prefix.length + 1);
}

/**
 * Get the timestamp from a ULID
 * @param id - The ULID string (can be prefixed)
 * @returns The timestamp as a Date object, or null if invalid
 */
export function getUlidTimestamp(id: string): Date | null {
  // Extract ULID part if it's prefixed
  let ulidPart = id;
  if (id.includes("-")) {
    const parts = id.split("-");
    ulidPart = parts[parts.length - 1];
  }

  if (!isValidUlid(ulidPart)) {
    return null;
  }

  try {
    // ULID timestamp is the first 10 characters, Crockford's Base32 encoded
    const timestampPart = ulidPart.substring(0, 10);

    // Convert from Crockford's Base32 to decimal
    const base32Chars = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
    let timestamp = 0;

    for (let i = 0; i < timestampPart.length; i++) {
      const char = timestampPart[i];
      const value = base32Chars.indexOf(char);
      if (value === -1) {
        return null;
      }
      timestamp = timestamp * 32 + value;
    }

    return new Date(timestamp);
  } catch {
    return null;
  }
}
