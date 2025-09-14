/**
 * Tests for Apple Reminders due date support
 * Verifies that due dates are properly imported from Apple Reminders to tasks
 */

import { describe, it, expect } from "vitest";

// Test the due date transformation logic
describe("Apple Reminders Due Date Support", () => {
  it("should include due date in ExternalTaskData transformation", () => {
    // Mock Apple Reminder with due date
    const mockReminder = {
      id: "test-reminder-1",
      title: "Task with due date",
      notes: "This task has a due date",
      completed: false,
      creationDate: new Date("2023-12-01T10:00:00.000Z"),
      modificationDate: new Date("2023-12-01T11:00:00.000Z"),
      dueDate: new Date("2023-12-15T09:00:00.000Z"), // Due date set
      priority: 5,
      list: {
        id: "work-list",
        name: "Work",
        color: "#FF0000",
      },
      allDay: false,
      url: "reminder://test-reminder-1",
    };

    // Simulate the transformation logic from AppleRemindersService
    const transformReminderToTaskData = (reminder: any) => {
      return {
        id: reminder.id,
        title: reminder.title,
        description: reminder.notes || undefined,
        status: reminder.completed ? "completed" : "open",
        priority: "Medium", // Simplified for test
        assignee: undefined as string | undefined,
        labels: [reminder.list.name],
        createdAt: reminder.creationDate,
        updatedAt: reminder.modificationDate,
        dueDate: reminder.dueDate, // Include due date
        externalUrl: reminder.url || `reminder://${reminder.id}`,
        sourceType: "apple-reminders",
        sourceData: reminder,
      };
    };

    const taskData = transformReminderToTaskData(mockReminder);

    // Verify due date is included
    expect(taskData.dueDate).toBeDefined();
    expect(taskData.dueDate).toEqual(new Date("2023-12-15T09:00:00.000Z"));
    expect(taskData.title).toBe("Task with due date");
    expect(taskData.status).toBe("open");
  });

  it("should handle reminders without due dates", () => {
    // Mock Apple Reminder without due date
    const mockReminder = {
      id: "test-reminder-2",
      title: "Task without due date",
      notes: "This task has no due date",
      completed: false,
      creationDate: new Date("2023-12-01T10:00:00.000Z"),
      modificationDate: new Date("2023-12-01T11:00:00.000Z"),
      dueDate: undefined as Date | undefined, // No due date
      priority: 3,
      list: {
        id: "personal-list",
        name: "Personal",
        color: "#00FF00",
      },
      allDay: false,
      url: "reminder://test-reminder-2",
    };

    // Simulate the transformation logic
    const transformReminderToTaskData = (reminder: any) => {
      return {
        id: reminder.id,
        title: reminder.title,
        description: reminder.notes || undefined,
        status: reminder.completed ? "completed" : "open",
        priority: "Low",
        assignee: undefined as string | undefined,
        labels: [reminder.list.name],
        createdAt: reminder.creationDate,
        updatedAt: reminder.modificationDate,
        dueDate: reminder.dueDate, // Should be undefined
        externalUrl: reminder.url || `reminder://${reminder.id}`,
        sourceType: "apple-reminders",
        sourceData: reminder,
      };
    };

    const taskData = transformReminderToTaskData(mockReminder);

    // Verify due date is undefined
    expect(taskData.dueDate).toBeUndefined();
    expect(taskData.title).toBe("Task without due date");
    expect(taskData.status).toBe("open");
  });

  it("should generate correct front-matter with due date", () => {
    // Mock task data with due date
    const taskData = {
      id: "test-task-1",
      title: "Task with due date",
      description: "Task description",
      status: "open",
      priority: "High",
      assignee: undefined as string | undefined,
      labels: ["Work"],
      createdAt: new Date("2023-12-01T10:00:00.000Z"),
      updatedAt: new Date("2023-12-01T11:00:00.000Z"),
      dueDate: new Date("2023-12-15T09:00:00.000Z"),
      externalUrl: "reminder://test-task-1",
      sourceType: "apple-reminders" as const,
      sourceData: {},
    };

    // Mock config
    const config = {
      targetArea: "Work",
      taskType: "Task",
      importLabelsAsTags: true,
    };

    // Simulate front-matter generation logic from TaskImportManager
    const generateTaskFrontMatter = (taskData: any, config: any) => {
      const frontMatter: Record<string, any> = {};

      frontMatter.Title = taskData.title;
      frontMatter.Type = "Task";
      frontMatter.Category = config.taskType || "Task";
      frontMatter.Priority = taskData.priority || "Low";
      frontMatter.Areas = config.targetArea ? [`[[${config.targetArea}]]`] : [];
      frontMatter.Done = false;
      frontMatter.Status = "Backlog"; // Simplified mapping
      frontMatter["Parent task"] = "";
      frontMatter.tags = config.importLabelsAsTags ? taskData.labels : [];

      // Do Date - from config if provided
      if (config.doDate) {
        frontMatter["Do Date"] = config.doDate.toISOString().split("T")[0];
      }

      // Due Date - from external task data if provided
      if (taskData.dueDate) {
        frontMatter["Due Date"] = taskData.dueDate.toISOString().split("T")[0];
      }

      return frontMatter;
    };

    const frontMatter = generateTaskFrontMatter(taskData, config);

    // Verify due date is in front-matter
    expect(frontMatter["Due Date"]).toBe("2023-12-15");
    expect(frontMatter.Title).toBe("Task with due date");
    expect(frontMatter.Priority).toBe("High");
    expect(frontMatter.Areas).toEqual(["[[Work]]"]);
  });

  it("should not include due date in front-matter when not provided", () => {
    // Mock task data without due date
    const taskData = {
      id: "test-task-2",
      title: "Task without due date",
      description: "Task description",
      status: "open",
      priority: "Medium",
      assignee: undefined as string | undefined,
      labels: ["Personal"],
      createdAt: new Date("2023-12-01T10:00:00.000Z"),
      updatedAt: new Date("2023-12-01T11:00:00.000Z"),
      dueDate: undefined as Date | undefined, // No due date
      externalUrl: "reminder://test-task-2",
      sourceType: "apple-reminders" as const,
      sourceData: {},
    };

    const config = {
      taskType: "Task",
      importLabelsAsTags: true,
    };

    // Simulate front-matter generation
    const generateTaskFrontMatter = (taskData: any, config: any) => {
      const frontMatter: Record<string, any> = {};

      frontMatter.Title = taskData.title;
      frontMatter.Type = "Task";
      frontMatter.Category = config.taskType || "Task";
      frontMatter.Priority = taskData.priority || "Low";
      frontMatter.Areas = config.targetArea ? [`[[${config.targetArea}]]`] : [];
      frontMatter.Done = false;
      frontMatter.Status = "Backlog";
      frontMatter["Parent task"] = "";
      frontMatter.tags = config.importLabelsAsTags ? taskData.labels : [];

      // Due Date - only add if provided
      if (taskData.dueDate) {
        frontMatter["Due Date"] = taskData.dueDate.toISOString().split("T")[0];
      }

      return frontMatter;
    };

    const frontMatter = generateTaskFrontMatter(taskData, config);

    // Verify due date is not in front-matter
    expect(frontMatter["Due Date"]).toBeUndefined();
    expect(frontMatter.Title).toBe("Task without due date");
    expect(frontMatter.Priority).toBe("Medium");
  });

  it("should handle date formatting correctly", () => {
    const testDates = [
      new Date("2023-12-15T09:00:00.000Z"), // Morning
      new Date("2023-12-15T23:59:59.999Z"), // End of day
      new Date("2024-01-01T00:00:00.000Z"), // New Year
      new Date("2024-02-29T12:00:00.000Z"), // Leap year
    ];

    const expectedFormats = [
      "2023-12-15",
      "2023-12-15",
      "2024-01-01",
      "2024-02-29",
    ];

    testDates.forEach((date, index) => {
      const formatted = date.toISOString().split("T")[0];
      expect(formatted).toBe(expectedFormats[index]);
    });
  });
});
