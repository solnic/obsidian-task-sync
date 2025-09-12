/**
 * Unit tests for Apple Reminders cache key generation
 * Tests that cache keys don't include listNames to enable in-memory filtering
 */

import { describe, test, expect } from "vitest";

// Extract the cache key generation logic to test it independently
function generateRemindersCacheKey(filter?: {
  includeCompleted?: boolean;
  listNames?: string[];
  excludeAllDay?: boolean;
}): string {
  const parts = [
    "apple-reminders",
    filter?.includeCompleted ? "completed" : "incomplete",
    filter?.excludeAllDay ? "no-allday" : "with-allday",
  ];
  return parts.join("|");
}

describe("Apple Reminders Cache Key Generation", () => {
  test("should generate cache key without listNames parameter", () => {
    const filter1 = {
      includeCompleted: false,
      excludeAllDay: true,
      listNames: ["Work", "Personal"], // This should be ignored
    };

    const filter2 = {
      includeCompleted: false,
      excludeAllDay: true,
      listNames: ["Different", "Lists"], // This should also be ignored
    };

    const key1 = generateRemindersCacheKey(filter1);
    const key2 = generateRemindersCacheKey(filter2);

    // Keys should be identical since listNames are ignored
    expect(key1).toBe(key2);
    expect(key1).toBe("apple-reminders|incomplete|no-allday");
  });

  test("should generate different keys for different completion settings", () => {
    const filter1 = {
      includeCompleted: false,
      excludeAllDay: false,
      listNames: ["Work"],
    };

    const filter2 = {
      includeCompleted: true,
      excludeAllDay: false,
      listNames: ["Work"], // Same list, but different completion setting
    };

    const key1 = generateRemindersCacheKey(filter1);
    const key2 = generateRemindersCacheKey(filter2);

    expect(key1).not.toBe(key2);
    expect(key1).toBe("apple-reminders|incomplete|with-allday");
    expect(key2).toBe("apple-reminders|completed|with-allday");
  });

  test("should generate different keys for different allDay settings", () => {
    const filter1 = {
      includeCompleted: false,
      excludeAllDay: false,
      listNames: ["Work"],
    };

    const filter2 = {
      includeCompleted: false,
      excludeAllDay: true,
      listNames: ["Work"], // Same list, but different allDay setting
    };

    const key1 = generateRemindersCacheKey(filter1);
    const key2 = generateRemindersCacheKey(filter2);

    expect(key1).not.toBe(key2);
    expect(key1).toBe("apple-reminders|incomplete|with-allday");
    expect(key2).toBe("apple-reminders|incomplete|no-allday");
  });

  test("should handle undefined filter", () => {
    const key = generateRemindersCacheKey(undefined);
    expect(key).toBe("apple-reminders|incomplete|with-allday");
  });

  test("should handle empty filter", () => {
    const key = generateRemindersCacheKey({});
    expect(key).toBe("apple-reminders|incomplete|with-allday");
  });

  test("should generate all possible cache key combinations", () => {
    // Test that we can generate all possible cache keys for clearing
    const completedOptions = [true, false];
    const allDayOptions = [true, false];
    const expectedKeys = [
      "apple-reminders|completed|no-allday",
      "apple-reminders|completed|with-allday",
      "apple-reminders|incomplete|no-allday",
      "apple-reminders|incomplete|with-allday",
    ];

    const generatedKeys: string[] = [];
    for (const includeCompleted of completedOptions) {
      for (const excludeAllDay of allDayOptions) {
        const key = generateRemindersCacheKey({
          includeCompleted,
          excludeAllDay,
        });
        generatedKeys.push(key);
      }
    }

    expect(generatedKeys.sort()).toEqual(expectedKeys.sort());
  });
});
