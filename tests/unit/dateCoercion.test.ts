/**
 * Tests for date coercion utilities and entity schemas
 */

import { describe, test, expect } from "vitest";
import {
  TaskSchema,
  ProjectSchema,
  AreaSchema,
  CalendarEventSchema,
  ScheduleSchema,
} from "../../src/app/core/entities";
import {
  coerceToDate,
  requiredDateSchema,
  optionalDateSchema,
} from "../../src/app/utils/dateCoercion";

describe("dateCoercion", () => {
  describe("coerceToDate", () => {
    test("should handle Date objects", () => {
      const date = new Date("2024-01-15T10:30:00Z");
      expect(coerceToDate(date)).toEqual(date);
    });

    test("should handle valid date strings", () => {
      const result = coerceToDate("2024-01-15T10:30:00Z");
      expect(result).toBeInstanceOf(Date);
      expect(result?.getFullYear()).toBe(2024);
      expect(result?.getMonth()).toBe(0); // January is 0
      expect(result?.getDate()).toBe(15);
    });

    test("should handle ISO date strings in local timezone", () => {
      const result = coerceToDate("2024-01-15");
      expect(result).toBeInstanceOf(Date);
      expect(result?.getFullYear()).toBe(2024);
      expect(result?.getMonth()).toBe(0); // January is 0
      expect(result?.getDate()).toBe(15);
      // Verify it's in local timezone (not UTC)
      // The date should be at midnight local time, not UTC
      expect(result?.getHours()).toBe(0);
      expect(result?.getMinutes()).toBe(0);
      expect(result?.getSeconds()).toBe(0);
    });

    test("should handle null and undefined", () => {
      expect(coerceToDate(null)).toBe(null);
      expect(coerceToDate(undefined)).toBe(null);
    });

    test("should handle invalid date strings", () => {
      expect(coerceToDate("invalid-date")).toBe(null);
      expect(coerceToDate("")).toBe(null);
      expect(coerceToDate("   ")).toBe(null);
    });

    test("should handle invalid Date objects", () => {
      const invalidDate = new Date("invalid");
      expect(coerceToDate(invalidDate)).toBe(null);
    });
  });

  describe("requiredDateSchema", () => {
    test("should parse valid date strings", () => {
      const result = requiredDateSchema.parse("2024-01-15T10:30:00Z");
      expect(result).toBeInstanceOf(Date);
      expect(result.getFullYear()).toBe(2024);
    });

    test("should pass through Date objects", () => {
      const date = new Date("2024-01-15T10:30:00Z");
      const result = requiredDateSchema.parse(date);
      expect(result).toEqual(date);
    });

    test("should throw on invalid date strings", () => {
      expect(() => requiredDateSchema.parse("invalid-date")).toThrow();
    });
  });

  describe("optionalDateSchema", () => {
    test("should parse valid date strings", () => {
      const result = optionalDateSchema.parse("2024-01-15T10:30:00Z");
      expect(result).toBeInstanceOf(Date);
      expect(result?.getFullYear()).toBe(2024);
    });

    test("should handle null and undefined", () => {
      expect(optionalDateSchema.parse(null)).toBeUndefined();
      expect(optionalDateSchema.parse(undefined)).toBeUndefined();
    });

    test("should return undefined for invalid dates", () => {
      expect(optionalDateSchema.parse("invalid-date")).toBeUndefined();
    });
  });

  describe("TaskSchema date coercion", () => {
    test("should coerce string dates in task creation", () => {
      const taskData = {
        id: "test-task",
        title: "Test Task",
        status: "todo",
        done: false,
        doDate: "2024-01-15T10:30:00Z",
        dueDate: "2024-01-20T17:00:00Z",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T12:00:00Z",
        areas: [],
        tags: [],
        source: {
          extension: "obsidian",
          keys: {},
        },
      };

      const result = TaskSchema.parse(taskData);
      expect(result.doDate).toBeInstanceOf(Date);
      expect(result.dueDate).toBeInstanceOf(Date);
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    test("should handle optional date fields as null", () => {
      const taskData = {
        id: "test-task",
        title: "Test Task",
        status: "todo",
        done: false,
        doDate: null,
        dueDate: undefined,
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T12:00:00Z",
        areas: [],
        tags: [],
        source: {
          extension: "obsidian",
          keys: {},
        },
      };

      const result = TaskSchema.parse(taskData);
      expect(result.doDate).toBeUndefined();
      expect(result.dueDate).toBeUndefined();
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe("ProjectSchema date coercion", () => {
    test("should coerce string dates in project creation", () => {
      const projectData = {
        id: "test-project",
        name: "Test Project",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T12:00:00Z",
        areas: [],
        tags: [],
        source: {
          extension: "obsidian",
          keys: {},
        },
      };

      const result = ProjectSchema.parse(projectData);
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe("AreaSchema date coercion", () => {
    test("should coerce string dates in area creation", () => {
      const areaData = {
        id: "test-area",
        name: "Test Area",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T12:00:00Z",
        tags: [],
        source: {
          extension: "obsidian",
          keys: {},
        },
      };

      const result = AreaSchema.parse(areaData);
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe("CalendarEventSchema date coercion", () => {
    test("should coerce string dates in calendar event creation", () => {
      const eventData = {
        id: "test-event",
        title: "Test Event",
        startDate: "2024-01-15T10:30:00Z",
        endDate: "2024-01-15T11:30:00Z",
        allDay: false,
        calendar: {
          id: "cal-1",
          name: "Test Calendar",
          visible: true,
        },
      };

      const result = CalendarEventSchema.parse(eventData);
      expect(result.startDate).toBeInstanceOf(Date);
      expect(result.endDate).toBeInstanceOf(Date);
    });
  });

  describe("ScheduleSchema date coercion", () => {
    test("should coerce string dates in schedule creation", () => {
      const scheduleData = {
        id: "test-schedule",
        date: "2024-01-15",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T12:00:00Z",
        tasks: [],
        unscheduledTasks: [],
        events: [],
        isPlanned: false,
        dailyNoteExists: false,
        planningCompletedAt: "2024-01-15T18:00:00Z",
        source: {
          extension: "obsidian",
          keys: {},
        },
      };

      const result = ScheduleSchema.parse(scheduleData);
      expect(result.date).toBeInstanceOf(Date);
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
      expect(result.planningCompletedAt).toBeInstanceOf(Date);
    });
  });
});
