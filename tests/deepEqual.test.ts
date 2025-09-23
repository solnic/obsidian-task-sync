/**
 * Tests for deep equality utility
 */

import { deepEqual, settingsChanged } from "../src/utils/equality";

describe("deepEqual", () => {
  describe("primitive values", () => {
    test("should return true for identical primitives", () => {
      expect(deepEqual(1, 1)).toBe(true);
      expect(deepEqual("hello", "hello")).toBe(true);
      expect(deepEqual(true, true)).toBe(true);
      expect(deepEqual(false, false)).toBe(true);
    });

    test("should return false for different primitives", () => {
      expect(deepEqual(1, 2)).toBe(false);
      expect(deepEqual("hello", "world")).toBe(false);
      expect(deepEqual(true, false)).toBe(false);
      expect(deepEqual(1, "1")).toBe(false);
    });
  });

  describe("null and undefined", () => {
    test("should handle null values correctly", () => {
      expect(deepEqual(null, null)).toBe(true);
      expect(deepEqual(null, undefined)).toBe(false);
      expect(deepEqual(null, 0)).toBe(false);
      expect(deepEqual(null, "")).toBe(false);
    });

    test("should handle undefined values correctly", () => {
      expect(deepEqual(undefined, undefined)).toBe(true);
      expect(deepEqual(undefined, null)).toBe(false);
      expect(deepEqual(undefined, 0)).toBe(false);
    });
  });

  describe("arrays", () => {
    test("should return true for identical arrays", () => {
      expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
      expect(deepEqual([], [])).toBe(true);
      expect(deepEqual([null], [null])).toBe(true);
    });

    test("should return false for different arrays", () => {
      expect(deepEqual([1, 2, 3], [1, 2, 4])).toBe(false);
      expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
      expect(deepEqual([1, 2, 3], [3, 2, 1])).toBe(false);
    });

    test("should handle nested arrays", () => {
      expect(
        deepEqual(
          [
            [1, 2],
            [3, 4],
          ],
          [
            [1, 2],
            [3, 4],
          ]
        )
      ).toBe(true);
      expect(
        deepEqual(
          [
            [1, 2],
            [3, 4],
          ],
          [
            [1, 2],
            [3, 5],
          ]
        )
      ).toBe(false);
    });
  });

  describe("objects", () => {
    test("should return true for identical objects", () => {
      expect(deepEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
      expect(deepEqual({}, {})).toBe(true);
      expect(deepEqual({ a: null }, { a: null })).toBe(true);
    });

    test("should return false for different objects", () => {
      expect(deepEqual({ a: 1, b: 2 }, { a: 1, b: 3 })).toBe(false);
      expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
      expect(deepEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true); // Order shouldn't matter
    });

    test("should handle nested objects", () => {
      const obj1 = { a: { b: { c: 1 } } };
      const obj2 = { a: { b: { c: 1 } } };
      const obj3 = { a: { b: { c: 2 } } };

      expect(deepEqual(obj1, obj2)).toBe(true);
      expect(deepEqual(obj1, obj3)).toBe(false);
    });
  });

  describe("dates", () => {
    test("should handle Date objects correctly", () => {
      const date1 = new Date("2024-01-01");
      const date2 = new Date("2024-01-01");
      const date3 = new Date("2024-01-02");

      expect(deepEqual(date1, date2)).toBe(true);
      expect(deepEqual(date1, date3)).toBe(false);
    });
  });

  describe("mixed types", () => {
    test("should handle complex nested structures", () => {
      const obj1 = {
        name: "test",
        items: [1, 2, { nested: true }],
        meta: { created: new Date("2024-01-01") },
      };
      const obj2 = {
        name: "test",
        items: [1, 2, { nested: true }],
        meta: { created: new Date("2024-01-01") },
      };
      const obj3 = {
        name: "test",
        items: [1, 2, { nested: false }],
        meta: { created: new Date("2024-01-01") },
      };

      expect(deepEqual(obj1, obj2)).toBe(true);
      expect(deepEqual(obj1, obj3)).toBe(false);
    });
  });
});

describe("settingsChanged", () => {
  test("should return true for initial state (null previous)", () => {
    expect(settingsChanged(null, { enabled: true })).toBe(true);
    expect(settingsChanged(null, {})).toBe(true);
  });

  test("should return false for identical settings", () => {
    const settings = { enabled: true, apiKey: "test" };
    expect(settingsChanged(settings, settings)).toBe(false);
    expect(settingsChanged({ enabled: true }, { enabled: true })).toBe(false);
  });

  test("should return true for different settings", () => {
    expect(settingsChanged({ enabled: true }, { enabled: false })).toBe(true);
    expect(settingsChanged({ apiKey: "old" }, { apiKey: "new" })).toBe(true);
    expect(settingsChanged({}, { newProp: "value" })).toBe(true);
  });

  test("should handle complex settings objects", () => {
    const settings1 = {
      github: { enabled: true, token: "abc" },
      filters: ["bug", "feature"],
    };
    const settings2 = {
      github: { enabled: true, token: "abc" },
      filters: ["bug", "feature"],
    };
    const settings3 = {
      github: { enabled: true, token: "xyz" },
      filters: ["bug", "feature"],
    };

    expect(settingsChanged(settings1, settings2)).toBe(false);
    expect(settingsChanged(settings1, settings3)).toBe(true);
  });
});
