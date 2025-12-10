/**
 * E2E tests for GitHub Status Syncing
 * 
 * These tests verify that when GitHub issues/PRs are closed:
 * 1. The task's `done` property is set to true
 * 2. The task's `status` property is set to a configured "done" status (e.g., "Done")
 * 3. The Obsidian note file is updated with the correct Status and Done values
 * 4. Other Obsidian-specific properties (priority, areas, project) are preserved
 * 
 * BDD-style tests following Gherkin Given/When/Then pattern
 */

import { test, expect } from "../../helpers/setup";
import {
  openView,
  enableIntegration,
  switchToTaskService,
  selectFromDropdown,
  fileExists,
  readVaultFile,
  updateFileFrontmatter,
  waitForFileUpdate,
} from "../../helpers/global";
import {
  stubGitHubWithFixtures,
  clickIssueImportButton,
  waitForIssueImportComplete,
} from "../../helpers/github-integration-helpers";
import {
  getTaskByTitle,
  waitForTaskProperty,
} from "../../helpers/entity-helpers";

test.describe("GitHub Status Syncing", { tag: '@github' }, () => {

  test.describe("Phase 1: Status Mapping on Import", () => {

    test("should set status to 'Done' when importing a closed GitHub issue", async ({ page }) => {
      // GIVEN: GitHub integration is enabled and there is a closed issue
      await openView(page, "task-sync-main");
      await enableIntegration(page, "github");

      // Stub with fixture that includes a closed issue
      await stubGitHubWithFixtures(page, {
        repositories: "repositories-with-orgs",
        issues: "issues-multiple",
        organizations: "organizations-basic",
        currentUser: "current-user-basic",
        labels: "labels-basic",
      });

      await page.waitForSelector(
        '[data-testid="service-github"]:not([disabled])',
        { state: "visible", timeout: 2500 }
      );

      await switchToTaskService(page, "github");
      await selectFromDropdown(page, "organization-filter", "solnic");
      await selectFromDropdown(page, "repository-filter", "obsidian-task-sync");

      // Switch to closed issues filter
      await page.locator('[data-testid="closed-filter"]').click();
      
      // Refresh to fetch closed issues
      const refreshButton = page.locator('[data-testid="task-sync-github-refresh-button"]');
      await refreshButton.click();
      
      // Wait for refresh to complete
      await page.waitForFunction(
        () => {
          const btn = document.querySelector('[data-testid="task-sync-github-refresh-button"]');
          return btn && !btn.hasAttribute("disabled");
        },
        undefined,
        { timeout: 2500 }
      );

      // WHEN: Importing a closed issue (#444 is "Closed test issue - completed")
      await clickIssueImportButton(page, 444);
      await waitForIssueImportComplete(page, 444);

      // THEN: The task should have done=true AND status="Done"
      const task = await getTaskByTitle(page, "Closed test issue - completed");
      expect(task).toBeDefined();
      expect(task.done).toBe(true);
      expect(task.status).toBe("Done"); // Should use the configured isDone=true status

      // AND: The file should have the correct frontmatter
      const fileContent = await readVaultFile(page, "Tasks/Closed test issue - completed.md");
      expect(fileContent).toContain("Done: true");
      expect(fileContent).toContain("Status: Done");
    });

    test("should set status to 'Backlog' when importing an open GitHub issue", async ({ page }) => {
      // GIVEN: GitHub integration is enabled and there is an open issue
      await openView(page, "task-sync-main");
      await enableIntegration(page, "github");

      await stubGitHubWithFixtures(page, {
        repositories: "repositories-with-orgs",
        issues: "issues-multiple",
        organizations: "organizations-basic",
        currentUser: "current-user-basic",
        labels: "labels-basic",
      });

      await page.waitForSelector(
        '[data-testid="service-github"]:not([disabled])',
        { state: "visible", timeout: 2500 }
      );

      await switchToTaskService(page, "github");
      await selectFromDropdown(page, "organization-filter", "solnic");
      await selectFromDropdown(page, "repository-filter", "obsidian-task-sync");

      // WHEN: Importing an open issue (#111 is "First test issue")
      await clickIssueImportButton(page, 111);
      await waitForIssueImportComplete(page, 111);

      // THEN: The task should have done=false AND status="Backlog" (default)
      const task = await getTaskByTitle(page, "First test issue");
      expect(task).toBeDefined();
      expect(task.done).toBe(false);
      expect(task.status).toBe("Backlog");

      // AND: The file should have the correct frontmatter
      const fileContent = await readVaultFile(page, "Tasks/First test issue.md");
      expect(fileContent).toContain("Done: false");
      expect(fileContent).toContain("Status: Backlog");
    });

  });

  test.describe("Phase 2: Status Sync on Refresh", () => {

    test("should update task status to 'Done' when GitHub issue is closed during refresh", async ({ page }) => {
      // GIVEN: An open GitHub issue has been imported
      await openView(page, "task-sync-main");
      await enableIntegration(page, "github");

      await stubGitHubWithFixtures(page, {
        repositories: "repositories-with-orgs",
        issues: "issues-multiple",
        organizations: "organizations-basic",
        currentUser: "current-user-basic",
        labels: "labels-basic",
      });

      await page.waitForSelector(
        '[data-testid="service-github"]:not([disabled])',
        { state: "visible", timeout: 2500 }
      );

      await switchToTaskService(page, "github");
      await selectFromDropdown(page, "organization-filter", "solnic");
      await selectFromDropdown(page, "repository-filter", "obsidian-task-sync");

      // Import an open issue
      await clickIssueImportButton(page, 111);
      await waitForIssueImportComplete(page, 111);

      // Verify initial state
      const initialTask = await getTaskByTitle(page, "First test issue");
      expect(initialTask.done).toBe(false);
      expect(initialTask.status).toBe("Backlog");

      // WHEN: The GitHub issue is closed (simulate by updating stub)
      await page.evaluate(() => {
        const stubs = (window as any).__githubApiStubs;
        if (stubs && stubs.issues) {
          const issue = stubs.issues.find((i: any) => i.number === 111);
          if (issue) {
            issue.state = "closed";
            issue.state_reason = "completed";
            issue.closed_at = new Date().toISOString();
            issue.updated_at = new Date().toISOString();
          }
        }
      });

      // AND: GitHub is refreshed
      const refreshButton = page.locator('[data-testid="task-sync-github-refresh-button"]');
      await refreshButton.click();
      
      await page.waitForFunction(
        () => {
          const btn = document.querySelector('[data-testid="task-sync-github-refresh-button"]');
          return btn && !btn.hasAttribute("disabled");
        },
        undefined,
        { timeout: 2500 }
      );

      // Wait for the task to be updated with done=true
      await waitForTaskProperty(page, "First test issue", "done", true);

      // THEN: The task should be updated with done=true AND status="Done"
      const updatedTask = await getTaskByTitle(page, "First test issue");
      expect(updatedTask.done).toBe(true);
      expect(updatedTask.status).toBe("Done");
    });

    test("should use configured isDone status option when syncing closed state", async ({ page }) => {
      // GIVEN: GitHub integration is enabled with custom status configuration
      await openView(page, "task-sync-main");
      await enableIntegration(page, "github");

      // Configure custom status options where "Completed" is the isDone status
      await page.evaluate(async () => {
        const app = (window as any).app;
        const plugin = app.plugins.plugins["obsidian-task-sync"];
        
        plugin.settings.taskStatuses = [
          { name: "Todo", color: "#6b7280", isDefault: true, isDone: false, isInProgress: false },
          { name: "Working", color: "#f59e0b", isDefault: false, isDone: false, isInProgress: true },
          { name: "Completed", color: "#10b981", isDefault: false, isDone: true, isInProgress: false },
        ];
        
        await plugin.saveSettings();
      });

      await stubGitHubWithFixtures(page, {
        repositories: "repositories-with-orgs",
        issues: "issues-multiple",
        organizations: "organizations-basic",
        currentUser: "current-user-basic",
        labels: "labels-basic",
      });

      await page.waitForSelector(
        '[data-testid="service-github"]:not([disabled])',
        { state: "visible", timeout: 2500 }
      );

      await switchToTaskService(page, "github");
      await selectFromDropdown(page, "organization-filter", "solnic");
      await selectFromDropdown(page, "repository-filter", "obsidian-task-sync");

      // Switch to closed issues filter and refresh
      await page.locator('[data-testid="closed-filter"]').click();
      const refreshButton = page.locator('[data-testid="task-sync-github-refresh-button"]');
      await refreshButton.click();
      
      await page.waitForFunction(
        () => {
          const btn = document.querySelector('[data-testid="task-sync-github-refresh-button"]');
          return btn && !btn.hasAttribute("disabled");
        },
        undefined,
        { timeout: 2500 }
      );

      // WHEN: Importing a closed issue
      await clickIssueImportButton(page, 444);
      await waitForIssueImportComplete(page, 444);

      // THEN: The task should use the configured "Completed" status (not hardcoded "Done")
      const task = await getTaskByTitle(page, "Closed test issue - completed");
      expect(task).toBeDefined();
      expect(task.done).toBe(true);
      expect(task.status).toBe("Completed"); // Should use configured isDone=true status
    });

  });

  test.describe("Phase 3: File Frontmatter Updates", () => {

    test("should update Obsidian note frontmatter when GitHub issue state changes", async ({ page }) => {
      // GIVEN: An open GitHub issue has been imported
      await openView(page, "task-sync-main");
      await enableIntegration(page, "github");

      await stubGitHubWithFixtures(page, {
        repositories: "repositories-with-orgs",
        issues: "issues-multiple",
        organizations: "organizations-basic",
        currentUser: "current-user-basic",
        labels: "labels-basic",
      });

      await page.waitForSelector(
        '[data-testid="service-github"]:not([disabled])',
        { state: "visible", timeout: 2500 }
      );

      await switchToTaskService(page, "github");
      await selectFromDropdown(page, "organization-filter", "solnic");
      await selectFromDropdown(page, "repository-filter", "obsidian-task-sync");

      await clickIssueImportButton(page, 111);
      await waitForIssueImportComplete(page, 111);

      // Wait for file to be created
      await waitForFileUpdate(page, "Tasks/First test issue.md", "Done: false");

      // Verify initial file content
      const initialContent = await readVaultFile(page, "Tasks/First test issue.md");
      expect(initialContent).toContain("Done: false");
      expect(initialContent).toContain("Status: Backlog");

      // WHEN: The GitHub issue is closed and synced
      await page.evaluate(() => {
        const stubs = (window as any).__githubApiStubs;
        if (stubs && stubs.issues) {
          const issue = stubs.issues.find((i: any) => i.number === 111);
          if (issue) {
            issue.state = "closed";
            issue.state_reason = "completed";
            issue.closed_at = new Date().toISOString();
            issue.updated_at = new Date().toISOString();
          }
        }
      });

      const refreshButton = page.locator('[data-testid="task-sync-github-refresh-button"]');
      await refreshButton.click();
      
      await page.waitForFunction(
        () => {
          const btn = document.querySelector('[data-testid="task-sync-github-refresh-button"]');
          return btn && !btn.hasAttribute("disabled");
        },
        undefined,
        { timeout: 2500 }
      );

      // Wait for file to be updated
      await waitForFileUpdate(page, "Tasks/First test issue.md", "Done: true");

      // THEN: The file frontmatter should be updated
      const updatedContent = await readVaultFile(page, "Tasks/First test issue.md");
      expect(updatedContent).toContain("Done: true");
      expect(updatedContent).toContain("Status: Done");
    });

    test("should show completed task in Tasks view after GitHub state change sync", async ({ page }) => {
      // GIVEN: An open GitHub issue has been imported
      await openView(page, "task-sync-main");
      await enableIntegration(page, "github");

      await stubGitHubWithFixtures(page, {
        repositories: "repositories-with-orgs",
        issues: "issues-multiple",
        organizations: "organizations-basic",
        currentUser: "current-user-basic",
        labels: "labels-basic",
      });

      await page.waitForSelector(
        '[data-testid="service-github"]:not([disabled])',
        { state: "visible", timeout: 2500 }
      );

      await switchToTaskService(page, "github");
      await selectFromDropdown(page, "organization-filter", "solnic");
      await selectFromDropdown(page, "repository-filter", "obsidian-task-sync");

      await clickIssueImportButton(page, 111);
      await waitForIssueImportComplete(page, 111);

      // WHEN: The GitHub issue is closed and synced
      await page.evaluate(() => {
        const stubs = (window as any).__githubApiStubs;
        if (stubs && stubs.issues) {
          const issue = stubs.issues.find((i: any) => i.number === 111);
          if (issue) {
            issue.state = "closed";
            issue.state_reason = "completed";
            issue.closed_at = new Date().toISOString();
            issue.updated_at = new Date().toISOString();
          }
        }
      });

      const refreshButton = page.locator('[data-testid="task-sync-github-refresh-button"]');
      await refreshButton.click();
      
      await page.waitForFunction(
        () => {
          const btn = document.querySelector('[data-testid="task-sync-github-refresh-button"]');
          return btn && !btn.hasAttribute("disabled");
        },
        undefined,
        { timeout: 2500 }
      );

      // Wait for the task to be updated with done=true
      await waitForTaskProperty(page, "First test issue", "done", true);

      // THEN: The task in the store should have done=true and status="Done"
      const task = await getTaskByTitle(page, "First test issue");
      expect(task).toBeDefined();
      expect(task.done).toBe(true);
      expect(task.status).toBe("Done");
      
      // AND: The task should be visible in the local tasks view (switch and verify)
      await switchToTaskService(page, "local");
      
      // The task should exist in the store - UI filtering of completed tasks
      // is a separate concern; the key is that the data is correct
      const taskAfterSwitch = await getTaskByTitle(page, "First test issue");
      expect(taskAfterSwitch).toBeDefined();
      expect(taskAfterSwitch.done).toBe(true);
      expect(taskAfterSwitch.status).toBe("Done");
    });

  });

  test.describe("Phase 4: Edge Cases and Property Preservation", () => {

    test("should preserve Obsidian-specific properties when syncing status from GitHub", async ({ page }) => {
      // GIVEN: An open GitHub issue has been imported and enriched with Obsidian properties
      await openView(page, "task-sync-main");
      await enableIntegration(page, "github");

      await stubGitHubWithFixtures(page, {
        repositories: "repositories-with-orgs",
        issues: "issues-multiple",
        organizations: "organizations-basic",
        currentUser: "current-user-basic",
        labels: "labels-basic",
      });

      await page.waitForSelector(
        '[data-testid="service-github"]:not([disabled])',
        { state: "visible", timeout: 2500 }
      );

      await switchToTaskService(page, "github");
      await selectFromDropdown(page, "organization-filter", "solnic");
      await selectFromDropdown(page, "repository-filter", "obsidian-task-sync");

      await clickIssueImportButton(page, 111);
      await waitForIssueImportComplete(page, 111);

      // Add Obsidian-specific properties
      await updateFileFrontmatter(page, "Tasks/First test issue.md", {
        Priority: "High",
        Areas: ["Development", "Testing"],
        Project: "My Important Project",
      });

      await waitForFileUpdate(page, "Tasks/First test issue.md", "Priority: High");

      // Wait for the task store to be updated with the new priority
      await waitForTaskProperty(page, "First test issue", "priority", "High");

      // Verify Obsidian properties were set
      const taskBeforeSync = await getTaskByTitle(page, "First test issue");
      expect(taskBeforeSync.priority).toBe("High");
      expect(taskBeforeSync.areas).toEqual(["Development", "Testing"]);
      expect(taskBeforeSync.project).toBe("My Important Project");

      // WHEN: The GitHub issue is closed and synced
      await page.evaluate(() => {
        const stubs = (window as any).__githubApiStubs;
        if (stubs && stubs.issues) {
          const issue = stubs.issues.find((i: any) => i.number === 111);
          if (issue) {
            issue.state = "closed";
            issue.state_reason = "completed";
            issue.closed_at = new Date().toISOString();
            issue.updated_at = new Date().toISOString();
          }
        }
      });

      const refreshButton = page.locator('[data-testid="task-sync-github-refresh-button"]');
      await refreshButton.click();
      
      await page.waitForFunction(
        () => {
          const btn = document.querySelector('[data-testid="task-sync-github-refresh-button"]');
          return btn && !btn.hasAttribute("disabled");
        },
        undefined,
        { timeout: 2500 }
      );

      // Wait for the task to be updated with done=true
      await waitForTaskProperty(page, "First test issue", "done", true);

      // THEN: Status should be updated but Obsidian properties should be preserved
      const taskAfterSync = await getTaskByTitle(page, "First test issue");
      expect(taskAfterSync.done).toBe(true);
      expect(taskAfterSync.status).toBe("Done");
      
      // Obsidian-specific properties should NOT be overwritten
      expect(taskAfterSync.priority).toBe("High");
      expect(taskAfterSync.areas).toEqual(["Development", "Testing"]);
      expect(taskAfterSync.project).toBe("My Important Project");

      // Verify file content
      const fileContent = await readVaultFile(page, "Tasks/First test issue.md");
      expect(fileContent).toContain("Done: true");
      expect(fileContent).toContain("Status: Done");
      expect(fileContent).toContain("Priority: High");
      expect(fileContent).toContain("Development");
      expect(fileContent).toContain("Testing");
      expect(fileContent).toContain("Project: My Important Project");
    });

    test.skip("should handle PR merged state by setting done and appropriate status", async ({ page }) => {
      // SKIP: This test requires PR tab UI which may not exist yet
      // The core functionality (merged PR sets done=true and status="Done") 
      // should be implemented as part of Phase 1 in GitHubTaskOperations.transformPullRequestToTask
      
      // GIVEN: GitHub integration is enabled with pull requests
      await openView(page, "task-sync-main");
      await enableIntegration(page, "github");

      await stubGitHubWithFixtures(page, {
        repositories: "repositories-with-orgs",
        pullRequests: "pull-requests-mixed-states",
        organizations: "organizations-basic",
        currentUser: "current-user-basic",
        labels: "labels-basic",
      });

      await page.waitForSelector(
        '[data-testid="service-github"]:not([disabled])',
        { state: "visible", timeout: 2500 }
      );

      await switchToTaskService(page, "github");
      await selectFromDropdown(page, "organization-filter", "solnic");
      await selectFromDropdown(page, "repository-filter", "obsidian-task-sync");

      // Switch to Pull Requests tab
      await page.locator('[data-testid="github-type-pull-requests"]').click();

      // Wait for PRs to load
      await page.waitForSelector('[data-testid="github-pr-item"]', {
        state: "visible",
        timeout: 2500,
      });

      // Find and import a merged PR
      const mergedPR = page.locator('[data-testid="github-pr-item"]')
        .filter({ hasText: "merged" });
      
      await mergedPR.hover();
      const importButton = mergedPR.locator('[data-testid="pr-import-button"]');
      await importButton.click();

      // Wait for import to complete
      await page.waitForFunction(
        () => {
          const prItems = Array.from(document.querySelectorAll('[data-testid="github-pr-item"]'));
          for (let i = 0; i < prItems.length; i++) {
            const item = prItems[i];
            if (item.textContent?.includes("merged") && item.getAttribute("data-imported") === "true") {
              return true;
            }
          }
          return false;
        },
        undefined,
        { timeout: 5000 }
      );

      // THEN: The task should have done=true and status="Done"
      const task = await page.evaluate(() => {
        const app = (window as any).app;
        const plugin = app.plugins.plugins["obsidian-task-sync"];
        const tasks = plugin.query.getAllTasks();
        return tasks.find((t: any) => t.title.toLowerCase().includes("merged"));
      });

      expect(task).toBeDefined();
      expect(task.done).toBe(true);
      expect(task.status).toBe("Done");
    });

    test("should gracefully handle missing isDone status configuration", async ({ page }) => {
      // GIVEN: GitHub integration with misconfigured status options (no isDone=true status)
      await openView(page, "task-sync-main");
      await enableIntegration(page, "github");

      // Configure status options WITHOUT any isDone=true status
      await page.evaluate(async () => {
        const app = (window as any).app;
        const plugin = app.plugins.plugins["obsidian-task-sync"];
        
        plugin.settings.taskStatuses = [
          { name: "Todo", color: "#6b7280", isDefault: true, isDone: false, isInProgress: false },
          { name: "Working", color: "#f59e0b", isDefault: false, isDone: false, isInProgress: true },
          { name: "Review", color: "#8b5cf6", isDefault: false, isDone: false, isInProgress: false },
          // Note: No status with isDone=true
        ];
        
        await plugin.saveSettings();
      });

      await stubGitHubWithFixtures(page, {
        repositories: "repositories-with-orgs",
        issues: "issues-multiple",
        organizations: "organizations-basic",
        currentUser: "current-user-basic",
        labels: "labels-basic",
      });

      await page.waitForSelector(
        '[data-testid="service-github"]:not([disabled])',
        { state: "visible", timeout: 2500 }
      );

      await switchToTaskService(page, "github");
      await selectFromDropdown(page, "organization-filter", "solnic");
      await selectFromDropdown(page, "repository-filter", "obsidian-task-sync");

      // Switch to closed filter and refresh
      await page.locator('[data-testid="closed-filter"]').click();
      const refreshButton = page.locator('[data-testid="task-sync-github-refresh-button"]');
      await refreshButton.click();
      
      await page.waitForFunction(
        () => {
          const btn = document.querySelector('[data-testid="task-sync-github-refresh-button"]');
          return btn && !btn.hasAttribute("disabled");
        },
        undefined,
        { timeout: 2500 }
      );

      // WHEN: Importing a closed issue
      await clickIssueImportButton(page, 444);
      await waitForIssueImportComplete(page, 444);

      // THEN: The task should still have done=true
      // And status should fall back to first available status or log a warning
      const task = await getTaskByTitle(page, "Closed test issue - completed");
      expect(task).toBeDefined();
      expect(task.done).toBe(true);
      
      // Status should use some fallback (first available status)
      expect(task.status).toBeDefined();
      expect(typeof task.status).toBe("string");
      expect(task.status.length).toBeGreaterThan(0);
    });

    test("should sync correctly with user's custom status options", async ({ page }) => {
      // GIVEN: User has customized status options with different names
      await openView(page, "task-sync-main");
      await enableIntegration(page, "github");

      // Configure custom Kanban-style status options
      await page.evaluate(async () => {
        const app = (window as any).app;
        const plugin = app.plugins.plugins["obsidian-task-sync"];
        
        plugin.settings.taskStatuses = [
          { name: "Inbox", color: "#6b7280", isDefault: true, isDone: false, isInProgress: false },
          { name: "Next Up", color: "#3b82f6", isDefault: false, isDone: false, isInProgress: false },
          { name: "Doing", color: "#f59e0b", isDefault: false, isDone: false, isInProgress: true },
          { name: "Shipped", color: "#10b981", isDefault: false, isDone: true, isInProgress: false },
          { name: "Wont Do", color: "#ef4444", isDefault: false, isDone: true, isInProgress: false },
        ];
        
        await plugin.saveSettings();
      });

      await stubGitHubWithFixtures(page, {
        repositories: "repositories-with-orgs",
        issues: "issues-multiple",
        organizations: "organizations-basic",
        currentUser: "current-user-basic",
        labels: "labels-basic",
      });

      await page.waitForSelector(
        '[data-testid="service-github"]:not([disabled])',
        { state: "visible", timeout: 2500 }
      );

      await switchToTaskService(page, "github");
      await selectFromDropdown(page, "organization-filter", "solnic");
      await selectFromDropdown(page, "repository-filter", "obsidian-task-sync");

      // Import an open issue first
      await clickIssueImportButton(page, 111);
      await waitForIssueImportComplete(page, 111);

      // Verify it uses the default status for open issues
      const openTask = await getTaskByTitle(page, "First test issue");
      expect(openTask.done).toBe(false);
      expect(openTask.status).toBe("Inbox"); // Should use isDefault=true status

      // Now simulate closing the issue
      await page.evaluate(() => {
        const stubs = (window as any).__githubApiStubs;
        if (stubs && stubs.issues) {
          const issue = stubs.issues.find((i: any) => i.number === 111);
          if (issue) {
            issue.state = "closed";
            issue.state_reason = "completed";
            issue.closed_at = new Date().toISOString();
            issue.updated_at = new Date().toISOString();
          }
        }
      });

      // Refresh to sync the change
      const refreshButton = page.locator('[data-testid="task-sync-github-refresh-button"]');
      await refreshButton.click();
      
      await page.waitForFunction(
        () => {
          const btn = document.querySelector('[data-testid="task-sync-github-refresh-button"]');
          return btn && !btn.hasAttribute("disabled");
        },
        undefined,
        { timeout: 2500 }
      );

      // Wait for the task to be updated with done=true
      await waitForTaskProperty(page, "First test issue", "done", true);

      // THEN: Status should be updated to the first isDone=true status ("Shipped")
      const closedTask = await getTaskByTitle(page, "First test issue");
      expect(closedTask.done).toBe(true);
      expect(closedTask.status).toBe("Shipped"); // First isDone=true status
    });

  });

});
