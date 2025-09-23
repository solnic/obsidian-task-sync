/**
 * Deep equality utility using fast-deep-equal package
 * Provides efficient deep comparison for object comparison
 */

import fastDeepEqual from "fast-deep-equal";

/**
 * Performs deep equality comparison between two values
 * Uses the fast-deep-equal package for optimal performance
 * 
 * @param a - First value to compare
 * @param b - Second value to compare
 * @returns true if values are deeply equal, false otherwise
 */
export function deepEqual(a: any, b: any): boolean {
  return fastDeepEqual(a, b);
}

/**
 * Convenience function to check if settings objects have changed
 * Specifically designed for settings comparison in service subscriptions
 * 
 * @param previous - Previous settings object (can be null for initial state)
 * @param current - Current settings object
 * @returns true if settings have changed, false if they are the same
 */
export function settingsChanged(previous: any, current: any): boolean {
  // Initial state - always consider as changed
  if (previous === null) {
    return true;
  }

  // Use deep equality to detect actual changes
  return !deepEqual(previous, current);
}
