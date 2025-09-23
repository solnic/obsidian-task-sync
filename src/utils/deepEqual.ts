/**
 * Deep equality utility for object comparison
 * Provides efficient deep comparison without the issues of JSON.stringify()
 */

/**
 * Performs deep equality comparison between two values
 * Handles objects, arrays, primitives, and null/undefined values
 * 
 * @param a - First value to compare
 * @param b - Second value to compare
 * @returns true if values are deeply equal, false otherwise
 */
export function deepEqual(a: any, b: any): boolean {
  // Handle strict equality (primitives, same reference)
  if (a === b) {
    return true;
  }

  // Handle null/undefined cases
  if (a == null || b == null) {
    return a === b;
  }

  // Handle different types
  if (typeof a !== typeof b) {
    return false;
  }

  // Handle Date objects
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }

  // Handle arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) {
        return false;
      }
    }
    return true;
  }

  // Handle objects
  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) {
      return false;
    }

    for (const key of keysA) {
      if (!keysB.includes(key)) {
        return false;
      }
      if (!deepEqual(a[key], b[key])) {
        return false;
      }
    }
    return true;
  }

  // All other cases (functions, symbols, etc.)
  return false;
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
