/**
 * E2E tests for ContextWidget functionality
 */

import { test, expect, describe, beforeAll, beforeEach } from "vitest";
import {
  createTestFolders,
  waitForElementVisible,
  openFile,
  enableIntegration,
} from "../../helpers/global";
import { setupE2ETestHooks } from "../../helpers/shared-context-vitest";
import { createProject, createArea } from "../../helpers/entity-helpers";
import {
  openGitHubIssuesView,
  stubGitHubWithFixtures,
} from "../../helpers/github-integration-helpers";
import { toggleSidebar } from "../../helpers/global";

describe("ContextWidget", () => {
  const context = setupE2ETestHooks();

  beforeEach(async () => {
    await toggleSidebar(context.page, "right", true);
  });

  test("should display 'No context' when no file is open", async () => {
    // Enable GitHub integration first
    await enableIntegration(context.page, "githubIntegration", {
      personalAccessToken: "fake-token-for-testing",
      defaultRepository: "solnic/obsidian-task-sync",
    });

    // Stub GitHub APIs
    await stubGitHubWithFixtures(context.page, {
      repositories: "repositories-basic",
      issues: "issues-basic",
      currentUser: "current-user-basic",
      labels: "labels-basic",
    });

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
    // Enable GitHub integration first
    await enableIntegration(context.page, "githubIntegration", {
      personalAccessToken: "fake-token-for-testing",
      defaultRepository: "solnic/obsidian-task-sync",
    });

    // Stub GitHub APIs
    await stubGitHubWithFixtures(context.page, {
      repositories: "repositories-basic",
      issues: "issues-basic",
      currentUser: "current-user-basic",
      labels: "labels-basic",
    });

    // Create a test project
    const projectName = "Test Project Context";
    await createProject(context.page, {
      name: projectName,
      description: "Test project for context widget",
    });

    // Open the project file
    await openFile(context.page, `Projects/${projectName}.md`);

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
    // Enable GitHub integration first
    await enableIntegration(context.page, "githubIntegration", {
      personalAccessToken: "fake-token-for-testing",
      defaultRepository: "solnic/obsidian-task-sync",
    });

    // Stub GitHub APIs
    await stubGitHubWithFixtures(context.page, {
      repositories: "repositories-basic",
      issues: "issues-basic",
      currentUser: "current-user-basic",
      labels: "labels-basic",
    });

    // Create a test area
    const areaName = "Test Area Context";
    await createArea(context.page, {
      name: areaName,
      description: "Test area for context widget",
    });

    // Open the area file
    await openFile(context.page, `Areas/${areaName}.md`);

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
    // Enable GitHub integration first
    await enableIntegration(context.page, "githubIntegration", {
      personalAccessToken: "fake-token-for-testing",
      defaultRepository: "solnic/obsidian-task-sync",
    });

    // Stub GitHub APIs
    await stubGitHubWithFixtures(context.page, {
      repositories: "repositories-basic",
      issues: "issues-basic",
      currentUser: "current-user-basic",
      labels: "labels-basic",
    });

    // Create test entities
    const projectName = "Switch Test Project";
    const areaName = "Switch Test Area";

    await createProject(context.page, {
      name: projectName,
      description: "Test project for switching",
    });
    await createArea(context.page, {
      name: areaName,
      description: "Test area for switching",
    });

    // Open GitHub Issues view first
    await openGitHubIssuesView(context.page);
    await waitForElementVisible(context.page, "[data-testid='tasks-view']");

    // Open project file
    await openFile(context.page, `Projects/${projectName}.md`);

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
    await openFile(context.page, `Areas/${areaName}.md`);

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
    // Enable GitHub integration first
    await enableIntegration(context.page, "githubIntegration", {
      personalAccessToken: "fake-token-for-testing",
      defaultRepository: "solnic/obsidian-task-sync",
    });

    // Stub GitHub APIs
    await stubGitHubWithFixtures(context.page, {
      repositories: "repositories-basic",
      issues: "issues-basic",
      currentUser: "current-user-basic",
      labels: "labels-basic",
    });

    // Create a project first to have some context
    const projectName = "Context Reset Project";
    await createProject(context.page, {
      name: projectName,
      description: "Test project for context reset",
    });

    // Open GitHub Issues view
    await openGitHubIssuesView(context.page);
    await waitForElementVisible(context.page, "[data-testid='tasks-view']");

    // Open project file to establish context
    await openFile(context.page, `Projects/${projectName}.md`);

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

    await openFile(context.page, "Random Note.md");

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
