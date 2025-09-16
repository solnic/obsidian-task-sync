/**
 * ULID Integration Tests
 * Tests the replacement of custom ID generation with ULID library
 */

import { describe, it, expect } from "vitest";
import {
  generateId,
  generatePrefixedId,
  isValidUlid,
  isValidPrefixedUlid,
  extractUlid,
  getUlidTimestamp,
} from "../src/utils/idGenerator";

describe("ULID Integration", () => {
  describe("generateId", () => {
    it("should generate a valid ULID", () => {
      const id = generateId();
      expect(id).toBeDefined();
      expect(typeof id).toBe("string");
      expect(id.length).toBe(26);
      expect(isValidUlid(id)).toBe(true);
    });

    it("should generate unique IDs", () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });

    it("should generate lexicographically sortable IDs", async () => {
      const id1 = generateId();
      // Small delay to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 1));
      const id2 = generateId();

      expect(id1 < id2).toBe(true);
    });
  });

  describe("generatePrefixedId", () => {
    it("should generate a prefixed ULID", () => {
      const id = generatePrefixedId("test");
      expect(id).toMatch(/^test-[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$/i);
      expect(isValidPrefixedUlid(id, "test")).toBe(true);
    });

    it("should work with different prefixes", () => {
      const scheduleId = generatePrefixedId("schedule");
      const calendarId = generatePrefixedId("calendar");

      expect(scheduleId.startsWith("schedule-")).toBe(true);
      expect(calendarId.startsWith("calendar-")).toBe(true);
      expect(isValidPrefixedUlid(scheduleId, "schedule")).toBe(true);
      expect(isValidPrefixedUlid(calendarId, "calendar")).toBe(true);
    });
  });

  describe("isValidUlid", () => {
    it("should validate correct ULIDs", () => {
      const id = generateId();
      expect(isValidUlid(id)).toBe(true);
    });

    it("should reject invalid ULIDs", () => {
      expect(isValidUlid("invalid")).toBe(false);
      expect(isValidUlid("123")).toBe(false);
      expect(isValidUlid("0123456789ABCDEFGHJKMNPQIL")).toBe(false); // 26 chars but contains invalid chars I, L
      expect(isValidUlid("0123456789ABCDEFGHJKMNPQOU")).toBe(false); // 26 chars but contains invalid chars O, U
      expect(isValidUlid("")).toBe(false);
    });
  });

  describe("isValidPrefixedUlid", () => {
    it("should validate correct prefixed ULIDs", () => {
      const id = generatePrefixedId("test");
      expect(isValidPrefixedUlid(id, "test")).toBe(true);
    });

    it("should reject invalid prefixed ULIDs", () => {
      expect(isValidPrefixedUlid("invalid-id", "test")).toBe(false);
      expect(isValidPrefixedUlid("test-invalid", "test")).toBe(false);
      expect(
        isValidPrefixedUlid("wrong-01ARYZ6S41TSV4RRFFQ69G5FAV", "test")
      ).toBe(false);
    });
  });

  describe("extractUlid", () => {
    it("should extract ULID from prefixed ID", () => {
      const id = generatePrefixedId("test");
      const extracted = extractUlid(id, "test");

      expect(extracted).toBeDefined();
      expect(extracted!.length).toBe(26);
      expect(isValidUlid(extracted!)).toBe(true);
    });

    it("should return null for invalid prefixed ID", () => {
      expect(extractUlid("invalid-id", "test")).toBe(null);
      expect(extractUlid("test-invalid", "test")).toBe(null);
    });
  });

  describe("getUlidTimestamp", () => {
    it("should extract timestamp from ULID", () => {
      const beforeTime = Date.now();
      const id = generateId();
      const afterTime = Date.now();

      const timestamp = getUlidTimestamp(id);
      expect(timestamp).toBeDefined();
      expect(timestamp!.getTime()).toBeGreaterThanOrEqual(beforeTime);
      expect(timestamp!.getTime()).toBeLessThanOrEqual(afterTime);
    });

    it("should extract timestamp from prefixed ULID", () => {
      const beforeTime = Date.now();
      const id = generatePrefixedId("test");
      const afterTime = Date.now();

      const timestamp = getUlidTimestamp(id);
      expect(timestamp).toBeDefined();
      expect(timestamp!.getTime()).toBeGreaterThanOrEqual(beforeTime);
      expect(timestamp!.getTime()).toBeLessThanOrEqual(afterTime);
    });

    it("should return null for invalid ULID", () => {
      expect(getUlidTimestamp("invalid")).toBe(null);
      expect(getUlidTimestamp("test-invalid")).toBe(null);
    });
  });

  describe("Backward compatibility", () => {
    it("should handle old-style IDs gracefully", () => {
      // Old style: Date.now().toString(36) + Math.random().toString(36).substring(2)
      const oldStyleId = "1234567890abc";

      // Should not be considered valid ULIDs
      expect(isValidUlid(oldStyleId)).toBe(false);
      expect(getUlidTimestamp(oldStyleId)).toBe(null);
    });

    it("should handle old-style prefixed IDs gracefully", () => {
      // Old style: `schedule-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
      const oldStylePrefixedId = "schedule-1234567890-abc123def";

      // Should not be considered valid prefixed ULIDs
      expect(isValidPrefixedUlid(oldStylePrefixedId, "schedule")).toBe(false);
      expect(extractUlid(oldStylePrefixedId, "schedule")).toBe(null);
    });
  });
});
