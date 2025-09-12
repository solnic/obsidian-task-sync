/**
 * Test for Apple Reminders date deserialization fix
 * Verifies that cached reminder data with string dates is properly converted back to Date objects
 */

import { describe, it, expect } from "vitest";
import { AppleReminder } from "../src/types/apple-reminders";

// Helper function to simulate the deserialization logic
function deserializeCachedReminders(
  cachedReminders: AppleReminder[]
): AppleReminder[] {
  return cachedReminders.map((reminder) => ({
    ...reminder,
    creationDate:
      typeof reminder.creationDate === "string"
        ? new Date(reminder.creationDate)
        : reminder.creationDate,
    modificationDate:
      typeof reminder.modificationDate === "string"
        ? new Date(reminder.modificationDate)
        : reminder.modificationDate,
    completionDate:
      reminder.completionDate && typeof reminder.completionDate === "string"
        ? new Date(reminder.completionDate)
        : reminder.completionDate,
    dueDate:
      reminder.dueDate && typeof reminder.dueDate === "string"
        ? new Date(reminder.dueDate)
        : reminder.dueDate,
  }));
}

describe("Apple Reminders Date Deserialization", () => {
  it("should deserialize string dates to Date objects", () => {
    // Create mock reminder data with string dates (as would be stored in JSON)
    const mockCachedReminders: AppleReminder[] = [
      {
        id: "test-reminder-1",
        title: "Test Reminder",
        notes: "Test notes",
        completed: false,
        creationDate: "2023-12-01T10:00:00.000Z" as any, // String instead of Date
        modificationDate: "2023-12-01T11:00:00.000Z" as any, // String instead of Date
        dueDate: "2023-12-02T09:00:00.000Z" as any, // String instead of Date
        completionDate: "2023-12-01T12:00:00.000Z" as any, // String instead of Date
        priority: 1,
        list: {
          id: "test-list",
          name: "Test List",
          color: "#007AFF",
        },
        allDay: false,
        url: "reminder://test-reminder-1",
      },
    ];

    // Call deserialization function
    const deserializedReminders =
      deserializeCachedReminders(mockCachedReminders);

    expect(deserializedReminders.length).toBe(1);
    const reminder = deserializedReminders[0];

    // Verify that dates are now proper Date objects
    expect(reminder.creationDate).toBeInstanceOf(Date);
    expect(reminder.modificationDate).toBeInstanceOf(Date);
    expect(reminder.dueDate).toBeInstanceOf(Date);
    expect(reminder.completionDate).toBeInstanceOf(Date);

    // Verify that the dates have the correct values
    expect(reminder.creationDate.toISOString()).toBe(
      "2023-12-01T10:00:00.000Z"
    );
    expect(reminder.modificationDate.toISOString()).toBe(
      "2023-12-01T11:00:00.000Z"
    );
    expect(reminder.dueDate!.toISOString()).toBe("2023-12-02T09:00:00.000Z");
    expect(reminder.completionDate!.toISOString()).toBe(
      "2023-12-01T12:00:00.000Z"
    );

    // Verify that toLocaleDateString() works (this was the original error)
    expect(() => reminder.creationDate.toLocaleDateString()).not.toThrow();
    expect(() => reminder.modificationDate.toLocaleDateString()).not.toThrow();
    expect(() => reminder.dueDate!.toLocaleDateString()).not.toThrow();
    expect(() => reminder.completionDate!.toLocaleDateString()).not.toThrow();
  });

  it("should handle optional date fields correctly", () => {
    // Create mock reminder data with some optional dates as strings and some as undefined
    const mockCachedReminders: AppleReminder[] = [
      {
        id: "test-reminder-3",
        title: "Test Reminder 3",
        notes: "Test notes",
        completed: false,
        creationDate: "2023-12-01T10:00:00.000Z" as any,
        modificationDate: "2023-12-01T11:00:00.000Z" as any,
        dueDate: undefined, // Optional field
        completionDate: undefined, // Optional field
        priority: 1,
        list: {
          id: "test-list",
          name: "Test List",
          color: "#007AFF",
        },
        allDay: false,
        url: "reminder://test-reminder-3",
      },
    ];

    // Call deserialization function
    const deserializedReminders =
      deserializeCachedReminders(mockCachedReminders);

    expect(deserializedReminders.length).toBe(1);
    const reminder = deserializedReminders[0];

    // Verify that required dates are Date objects
    expect(reminder.creationDate).toBeInstanceOf(Date);
    expect(reminder.modificationDate).toBeInstanceOf(Date);

    // Verify that optional dates remain undefined
    expect(reminder.dueDate).toBeUndefined();
    expect(reminder.completionDate).toBeUndefined();

    // Verify that toLocaleDateString() works on required dates
    expect(() => reminder.creationDate.toLocaleDateString()).not.toThrow();
    expect(() => reminder.modificationDate.toLocaleDateString()).not.toThrow();
  });
});
