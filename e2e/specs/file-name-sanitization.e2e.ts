/**
 * End-to-End Tests for File Name Sanitization and Base Formula Structure
 * Tests the complete workflow of creating tasks, projects, and areas with invalid characters
 * and verifying that base files are created with proper formulas
 */

import { test, expect, describe, beforeAll, beforeEach } from "vitest";
import {
  createTestTaskFile,
  getFileContent,
  fileExists,
  verifyTaskProperties,
  createFullyQualifiedLink,
} from "../helpers/global";
import { setupE2ETestHooks } from "../helpers/shared-context";
import { createArea, createTask } from "../helpers/entity-helpers";

describe("File Name Sanitization and Base Formulas", () => {
  const context = setupE2ETestHooks();

  test("should create task with invalid characters and generate proper base", async () => {
    // Create a task with invalid characters in the name
    const taskName = "Project: Website/Mobile*App";
    const sanitizedTaskName = "Project- Website-Mobile-App";

    await createTask(
      context,
      {
        title: taskName,
        category: "Feature",
        project: "Website Redesign",
        areas: ["Development"],
        done: false,
        status: "In Progress",
      },
      "This is a test task with invalid characters in the name."
    );

    await verifyTaskProperties(context.page, `Tasks/${sanitizedTaskName}.md`, {
      Title: taskName,
      Category: "Feature",
      Areas: [createFullyQualifiedLink("Development", "Areas")],
      Project: createFullyQualifiedLink("Website Redesign", "Projects"),
      Done: false,
      Status: "In Progress",
    });
  });

  test("should create area with invalid characters and generate proper base", async () => {
    // Create an area with invalid characters using the helper
    const areaName = "Development: Frontend/Backend*";
    await createArea(context, {
      name: areaName,
      description: "This is a test area with invalid characters",
    });

    // Verify the area file was created with sanitized name
    const areaExists = await fileExists(
      context.page,
      "Areas/Development- Frontend-Backend.md"
    );
    expect(areaExists).toBe(true);

    // Verify the base file was created with sanitized name
    const baseExists = await fileExists(
      context.page,
      "Bases/Development- Frontend-Backend.base"
    );
    expect(baseExists).toBe(true);

    // Verify the base file contains the new formula structure
    const baseContent = await getFileContent(
      context.page,
      "Bases/Development- Frontend-Backend.base"
    );
    expect(baseContent).toContain("formulas:");
    expect(baseContent).toContain("Title: link(file.name, Title)");
    expect(baseContent).toContain("formula.Title");
    expect(baseContent).toContain("name: Type");
    expect(baseContent).toContain("type: string");
  });

  test("should handle basic file name sanitization", async () => {
    // Test basic sanitization case
    const testCase = {
      input: "Project: Website/Mobile*App",
      expected: "Project- Website-Mobile-App",
    };

    await createTestTaskFile(
      context.page,
      testCase.expected,
      {
        Title: testCase.input,
        Type: "Task",
        Done: false,
      },
      `Test task for: ${testCase.input}`
    );

    // Verify the task file was created with expected name
    const taskExists = await fileExists(
      context.page,
      `Tasks/${testCase.expected}.md`
    );
    expect(taskExists).toBe(true);

    // Verify the content has the original title using API
    const frontMatter = await context.page.evaluate(async (path) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      return await plugin.taskFileManager.loadFrontMatter(path);
    }, `Tasks/${testCase.expected}.md`);

    expect(frontMatter.Title).toBe(testCase.input); // Original title should be preserved
  });
});
