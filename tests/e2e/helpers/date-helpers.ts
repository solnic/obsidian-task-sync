/**
 * Date helper utilities for e2e tests
 * Provides robust date formatting that's consistent across different environments
 */

/**
 * Format a Date object to YYYY-MM-DD string format
 * More robust than .toISOString().split("T")[0] for e2e tests
 */
export function getDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Get today's date as YYYY-MM-DD string
 */
export function getTodayString(): string {
  return getDateString(new Date());
}

/**
 * Get yesterday's date as YYYY-MM-DD string
 */
export function getYesterdayString(): string {
  return getDateString(new Date(Date.now() - 24 * 60 * 60 * 1000));
}
