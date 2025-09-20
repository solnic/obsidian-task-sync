/**
 * Debug utility for conditional logging
 * Provides development-only logging that can be easily disabled in production
 */

/**
 * Check if we're in development mode
 * In Obsidian plugins, we can use the presence of certain development indicators
 */
function isDevelopment(): boolean {
  // Check for common development indicators
  return (
    // @ts-ignore - process may not be available in all environments
    (typeof process !== "undefined" &&
      process.env?.NODE_ENV === "development") ||
    // Check if we're running in a development context (e.g., with hot reload)
    (typeof window !== "undefined" &&
      window.location?.hostname === "localhost") ||
    // Check for development build indicators
    (typeof globalThis !== "undefined" && (globalThis as any).__DEV__ === true)
  );
}

/**
 * Development-only console.debug wrapper
 * Only logs in development mode, silent in production
 */
export function debugLog(...args: any[]): void {
  if (isDevelopment()) {
    console.debug(...args);
  }
}

/**
 * Development-only console.log wrapper
 * Only logs in development mode, silent in production
 */
export function devLog(...args: any[]): void {
  if (isDevelopment()) {
    console.log(...args);
  }
}

/**
 * Always log (for important messages that should appear in production)
 * Use sparingly for critical information only
 */
export function prodLog(...args: any[]): void {
  console.log(...args);
}
