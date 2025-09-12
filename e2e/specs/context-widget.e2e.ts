/**
 * E2E tests for ContextWidget functionality
 */

import { test, expect, describe } from "vitest";
import {
  createTestFolders,
  waitForElementVisible,
} from "../helpers/task-sync-setup";
import { setupE2ETestHooks, openFile } from "../helpers/shared-context";
import { createProject, createArea } from "../helpers/entity-helpers";
import { openGitHubIssuesView } from "../helpers/github-integration-helpers";
import { toggleSidebar } from "../helpers/plugin-setup";

describe("ContextWidget", () => {
  const context = setupE2ETestHooks();

  beforeAll(async () => {
    await createTestFolders(context.page);
  });

  beforeEach(async () => {
    await toggleSidebar(context.page, "right", true);
  });

  test("should display 'No context' when no file is open", async () => {
    // Open GitHub Issues view
    await openGitHubIssuesView(context.page);

    // Wait for the view to load
    await waitForElementVisible(context.page, "[data-testid='tasks-view']");

    // Check that context widget shows service name and "import context" with "No context"
    await waitForElementVisible(context.page, "[data-testid='context-widget']");

    // Check service name
    const serviceName = await context.page.textContent(
      "[data-testid='context-widget'] .service-name"
    );
    expect(serviceName).toBe("GitHub");

    // Check no context message
    const noContext = await context.page.textContent(
      "[data-testid='context-widget'] .no-context"
    );
    expect(noContext).toBe("No context");
  });

  test("should display project context when project file is open", async () => {
    // Create a test project
    const projectName = "Test Project Context";
    await createProject(context, {
      name: projectName,
      description: "Test project for context widget",
    });

    // Open the project file
    await openFile(context, `Projects/${projectName}.md`);

    // Open GitHub Issues view
    await openGitHubIssuesView(context.page);

    // Wait for the view to load
    await waitForElementVisible(context.page, "[data-testid='tasks-view']");

    // Check that context widget shows project context
    await waitForElementVisible(context.page, "[data-testid='context-widget']");

    // Check service name
    const serviceName = await context.page.textContent(
      "[data-testid='context-widget'] .service-name"
    );
    expect(serviceName).toBe("GitHub");

    // Check project context
    const contextType = await context.page.textContent(
      "[data-testid='context-widget'] .context-type"
    );
    expect(contextType).toBe("Project");

    const contextName = await context.page.textContent(
      "[data-testid='context-widget'] .context-name"
    );
    expect(contextName).toBe(projectName);

    // Check that the widget has the correct CSS class
    const contextWidgetClass = await context.page.getAttribute(
      "[data-testid='context-widget']",
      "class"
    );
    expect(contextWidgetClass).toContain("context-type-project");
  });

  test("should display area context when area file is open", async () => {
    // Create a test area
    const areaName = "Test Area Context";
    await createArea(context, {
      name: areaName,
      description: "Test area for context widget",
    });

    // Open the area file
    await openFile(context, `Areas/${areaName}.md`);

    // Open GitHub Issues view
    await openGitHubIssuesView(context.page);

    // Wait for the view to load
    await waitForElementVisible(context.page, "[data-testid='tasks-view']");

    // Check that context widget shows area context
    await waitForElementVisible(context.page, "[data-testid='context-widget']");

    // Check area context
    const contextType = await context.page.textContent(
      "[data-testid='context-widget'] .context-type"
    );
    expect(contextType).toBe("Area");

    const contextName = await context.page.textContent(
      "[data-testid='context-widget'] .context-name"
    );
    expect(contextName).toBe(areaName);

    // Check that the widget has the correct CSS class
    const contextWidgetClass2 = await context.page.getAttribute(
      "[data-testid='context-widget']",
      "class"
    );
    expect(contextWidgetClass2).toContain("context-type-area");
  });

  test("should update context when switching between files", async () => {
    // Create test entities
    const projectName = "Switch Test Project";
    const areaName = "Switch Test Area";

    await createProject(context, {
      name: projectName,
      description: "Test project for switching",
    });
    await createArea(context, {
      name: areaName,
      description: "Test area for switching",
    });

    // Open GitHub Issues view first
    await openGitHubIssuesView(context.page);
    await waitForElementVisible(context.page, "[data-testid='tasks-view']");

    // Open project file
    await openFile(context, `Projects/${projectName}.md`);

    // Check project context
    await waitForElementVisible(context.page, "[data-testid='context-widget']");
    let contextType = await context.page.textContent(
      "[data-testid='context-widget'] .context-type"
    );
    expect(contextType).toBe("Project");

    let contextName = await context.page.textContent(
      "[data-testid='context-widget'] .context-name"
    );
    expect(contextName).toBe(projectName);

    // Switch to area file
    await openFile(context, `Areas/${areaName}.md`);

    // Check that context updated to area
    contextType = await context.page.textContent(
      "[data-testid='context-widget'] .context-type"
    );
    expect(contextType).toBe("Area");

    contextName = await context.page.textContent(
      "[data-testid='context-widget'] .context-name"
    );
    expect(contextName).toBe(areaName);

    // Check CSS class changed
    const contextWidgetClass3 = await context.page.getAttribute(
      "[data-testid='context-widget']",
      "class"
    );
    expect(contextWidgetClass3).toContain("context-type-area");
  });

  test("should show no context when switching to non-project/area file", async () => {
    // Create a project first to have some context
    const projectName = "Context Reset Project";
    await createProject(context, {
      name: projectName,
      description: "Test project for context reset",
    });

    // Open GitHub Issues view
    await openGitHubIssuesView(context.page);
    await waitForElementVisible(context.page, "[data-testid='tasks-view']");

    // Open project file to establish context
    await openFile(context, `Projects/${projectName}.md`);

    // Verify project context
    await waitForElementVisible(context.page, "[data-testid='context-widget']");
    let contextType = await context.page.textContent(
      "[data-testid='context-widget'] .context-type"
    );
    expect(contextType).toBe("Project");

    let contextName = await context.page.textContent(
      "[data-testid='context-widget'] .context-name"
    );
    expect(contextName).toBe(projectName);

    // Create and open a file outside of Projects/Areas folders
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      await app.vault.create("Random Note.md", "This is a random note");
    });

    await openFile(context, "Random Note.md");

    // Check that context reset to "No context"
    const noContext = await context.page.textContent(
      "[data-testid='context-widget'] .no-context"
    );
    expect(noContext).toBe("No context");

    // Check CSS class changed
    const contextWidgetClass4 = await context.page.getAttribute(
      "[data-testid='context-widget']",
      "class"
    );
    expect(contextWidgetClass4).toContain("context-type-none");
  });
});
