/**
 * Date coercion utilities for Zod schemas
 * Provides consistent date parsing with proper local timezone handling
 */

import moment from "moment";
import { z } from "zod";

/**
 * Coerce a value to a Date object with proper timezone handling
 * Handles strings, Date objects, and null/undefined values
 *
 * For YYYY-MM-DD format strings, creates a Date in local timezone (not UTC)
 * to avoid date shifting issues when converting between timezones.
 */
export function coerceToDate(val: unknown): Date | null {
  if (val === null || val === undefined) return null;

  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val;
  }

  if (typeof val === "string" && val.trim() !== "") {
    // Special handling for YYYY-MM-DD format to use local timezone
    // This prevents date shifting when the user's timezone is not UTC
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
      const [year, month, day] = val.split("-").map(Number);
      const date = new Date(year, month - 1, day); // month is 0-indexed
      return isNaN(date.getTime()) ? null : date;
    }

    // For other formats, use moment.js
    const momentDate = moment(val);
    return momentDate.isValid() ? momentDate.toDate() : null;
  }

  return null;
}

/**
 * Zod schema for required date fields that can be coerced from strings
 * Throws an error if the date cannot be parsed
 */
export const requiredDateSchema = z
  .union([z.string(), z.date()])
  .transform((val) => {
    const result = coerceToDate(val);
    if (result === null) {
      throw new Error(`Invalid date value: ${val}`);
    }
    return result;
  })
  .pipe(z.date());

/**
 * Zod schema for optional date fields that can be coerced from strings
 * Returns undefined if the date cannot be parsed
 */
export const optionalDateSchema = z
  .union([z.string(), z.date(), z.null(), z.undefined()])
  .transform((val) => {
    if (val === null || val === undefined) return undefined;
    const result = coerceToDate(val);
    return result || undefined;
  })
  .pipe(z.date().optional());
