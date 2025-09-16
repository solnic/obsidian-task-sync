/**
 * Tests for date filtering utilities
 */

import { Task, TaskUtils } from "../src/types/entities";
import {
  getDateString,
  filterTasksByDoDate,
  hasDoDate,
  getTasksForToday,
  getTasksForYesterday,
  getTodayString,
  getYesterdayString,
  getOverdueTasks,
  getUpcomingTasks,
} from "../src/utils/dateFiltering";

describe("dateFiltering", () => {
  describe("getDateString", () => {
    test("should convert Date to YYYY-MM-DD format", () => {
      const date = new Date("2024-01-15T10:30:00Z");
      expect(getDateString(date)).toBe("2024-01-15");
    });

    test("should throw error when called with non-Date object", () => {
      expect(() => getDateString("2024-01-15" as any)).toThrow();
    });
  });

  describe("hasDoDate", () => {
    test("should return true for valid Date object", () => {
      const task: Task = {
        id: "test",
        title: "Test Task",
        doDate: new Date("2024-01-15"),
      } as Task;

      expect(hasDoDate(task)).toBe(true);
    });

    test("should return false for string date", () => {
      const task: Task = {
        id: "test",
        title: "Test Task",
        doDate: "2024-01-15" as any, // Invalid - should be Date object
      } as Task;

      expect(hasDoDate(task)).toBe(false);
    });

    test("should return false for undefined doDate", () => {
      const task: Task = {
        id: "test",
        title: "Test Task",
        doDate: undefined,
      } as Task;

      expect(hasDoDate(task)).toBe(false);
    });
  });

  describe("filterTasksByDoDate", () => {
    test("should filter tasks with valid Date objects", () => {
      const tasks: Task[] = [
        {
          id: "1",
          title: "Task 1",
          doDate: new Date("2024-01-15"),
        } as Task,
        {
          id: "2",
          title: "Task 2",
          doDate: new Date("2024-01-16"),
        } as Task,
        {
          id: "3",
          title: "Task 3",
          doDate: undefined,
        } as Task,
      ];

      const filtered = filterTasksByDoDate(tasks, "2024-01-15");
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe("1");
    });

    test("should handle tasks with invalid doDate gracefully", () => {
      const tasks: Task[] = [
        {
          id: "1",
          title: "Task 1",
          doDate: new Date("2024-01-15"),
        } as Task,
        {
          id: "2",
          title: "Task 2",
          doDate: "2024-01-15" as any, // Invalid - string instead of Date
        } as Task,
        {
          id: "3",
          title: "Task 3",
          doDate: "invalid-date" as any, // Invalid - unparseable string
        } as Task,
      ];

      // Should not crash and should only return tasks with valid Date objects
      expect(() => {
        const filtered = filterTasksByDoDate(tasks, "2024-01-15");
        expect(filtered).toHaveLength(1);
        expect(filtered[0].id).toBe("1");
      }).not.toThrow();
    });

    test("should handle tasks with null or undefined doDate", () => {
      const tasks: Task[] = [
        {
          id: "1",
          title: "Task 1",
          doDate: null as any,
        } as Task,
        {
          id: "2",
          title: "Task 2",
          doDate: undefined,
        } as Task,
      ];

      const filtered = filterTasksByDoDate(tasks, "2024-01-15");
      expect(filtered).toHaveLength(0);
    });
  });

  describe("getTasksForToday and getTasksForYesterday", () => {
    test("should work with mixed valid and invalid doDate values", () => {
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const tasks: Task[] = [
        {
          id: "1",
          title: "Today Task",
          doDate: today,
        } as Task,
        {
          id: "2",
          title: "Yesterday Task",
          doDate: yesterday,
        } as Task,
        {
          id: "3",
          title: "Invalid Task",
          doDate: getTodayString() as any, // String instead of Date
        } as Task,
      ];

      // Should not crash
      expect(() => {
        const todayTasks = getTasksForToday(tasks);
        const yesterdayTasks = getTasksForYesterday(tasks);

        expect(todayTasks).toHaveLength(1);
        expect(todayTasks[0].id).toBe("1");

        expect(yesterdayTasks).toHaveLength(1);
        expect(yesterdayTasks[0].id).toBe("2");
      }).not.toThrow();
    });
  });

  describe("TaskUtils.updateTaskFromFrontmatter", () => {
    test("should handle valid date strings", () => {
      const baseTask: Task = {
        id: "test",
        title: "Test Task",
      } as Task;

      const frontmatter = {
        "Do Date": "2024-01-15",
        "Due Date": "2024-01-20",
      };

      const updatedTask = TaskUtils.updateTaskFromFrontmatter(
        baseTask,
        frontmatter
      );

      expect(updatedTask.doDate).toBeInstanceOf(Date);
      expect(updatedTask.doDate?.toISOString().split("T")[0]).toBe(
        "2024-01-15"
      );
      expect(updatedTask.dueDate).toBeInstanceOf(Date);
      expect(updatedTask.dueDate?.toISOString().split("T")[0]).toBe(
        "2024-01-20"
      );
    });

    test("should handle invalid date strings gracefully", () => {
      const baseTask: Task = {
        id: "test",
        title: "Test Task",
      } as Task;

      const frontmatter = {
        "Do Date": "invalid-date",
        "Due Date": "not-a-date",
      };

      const updatedTask = TaskUtils.updateTaskFromFrontmatter(
        baseTask,
        frontmatter
      );

      // Invalid dates should not be set (remain undefined)
      expect(updatedTask.doDate).toBeUndefined();
      expect(updatedTask.dueDate).toBeUndefined();
    });

    test("should handle non-string date values gracefully", () => {
      const baseTask: Task = {
        id: "test",
        title: "Test Task",
      } as Task;

      const frontmatter = {
        "Do Date": 12345, // Number instead of string
        "Due Date": { invalid: "object" }, // Object instead of string
      };

      const updatedTask = TaskUtils.updateTaskFromFrontmatter(
        baseTask,
        frontmatter
      );

      // Non-string values should not be set (remain undefined)
      expect(updatedTask.doDate).toBeUndefined();
      expect(updatedTask.dueDate).toBeUndefined();
    });

    test("should handle existing Date objects", () => {
      const baseTask: Task = {
        id: "test",
        title: "Test Task",
      } as Task;

      const testDate = new Date("2024-01-15");
      const frontmatter = {
        "Do Date": testDate,
      };

      const updatedTask = TaskUtils.updateTaskFromFrontmatter(
        baseTask,
        frontmatter
      );

      expect(updatedTask.doDate).toBe(testDate);
    });
  });

  describe("Integration with daily planning", () => {
    test("should handle mixed valid and invalid doDate values in daily planning context", () => {
      // Simulate the scenario that was causing the crash
      const tasks: Task[] = [
        {
          id: "1",
          title: "Valid Task",
          doDate: new Date("2024-01-15"),
        } as Task,
        {
          id: "2",
          title: "Invalid String Task",
          doDate: "2024-01-15" as any, // String instead of Date
        } as Task,
        {
          id: "3",
          title: "Invalid Object Task",
          doDate: { invalid: "object" } as any, // Object instead of Date
        } as Task,
        {
          id: "4",
          title: "Null Task",
          doDate: null as any,
        } as Task,
        {
          id: "5",
          title: "Undefined Task",
          doDate: undefined,
        } as Task,
      ];

      // These are the functions called by daily planning that were crashing
      expect(() => {
        const yesterdayTasks = getTasksForYesterday(tasks);
        const todayTasks = getTasksForToday(tasks);
        const overdueTasks = getOverdueTasks(tasks);
        const upcomingTasks = getUpcomingTasks(tasks);

        // Should only return tasks with valid Date objects
        expect(yesterdayTasks.length).toBeGreaterThanOrEqual(0);
        expect(todayTasks.length).toBeGreaterThanOrEqual(0);
        expect(overdueTasks.length).toBeGreaterThanOrEqual(0);
        expect(upcomingTasks.length).toBeGreaterThanOrEqual(0);

        // Verify that all returned tasks have valid Date objects
        [
          ...yesterdayTasks,
          ...todayTasks,
          ...overdueTasks,
          ...upcomingTasks,
        ].forEach((task) => {
          expect(task.doDate).toBeInstanceOf(Date);
        });
      }).not.toThrow();
    });
  });
});
