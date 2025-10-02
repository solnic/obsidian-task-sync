/**
 * Date coercion utilities for Zod schemas
 * Provides consistent date parsing using moment.js for string-to-date conversion
 */

import moment from "moment";
import { z } from "zod";

/**
 * Coerce a value to a Date object using moment.js
 * Handles strings, Date objects, and null/undefined values
 */
export function coerceToDate(val: unknown): Date | null {
  if (val === null || val === undefined) return null;
  
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val;
  }
  
  if (typeof val === "string" && val.trim() !== "") {
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
