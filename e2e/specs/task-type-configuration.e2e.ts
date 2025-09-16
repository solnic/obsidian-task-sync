/**
 * E2E tests for Task Type Configuration UI
 * Tests the task type management interface in plugin settings
 */

import { test, expect, describe, beforeAll, beforeEach } from "vitest";
import {
  createTestFolders,
  openTaskSyncSettings,
  scrollToSettingsSection,
  scrollToAddTaskTypeSection,
  waitForTaskSyncPlugin,
} from "../helpers/task-sync-setup";
import { setupE2ETestHooks } from "../helpers/shared-context";
import { createArea } from "../helpers/entity-helpers";

describe("Task Type Configuration", () => {
  const context = setupE2ETestHooks();

  async function openTaskSyncSettingsWrapper() {
    await openTaskSyncSettings(context);
  }

  async function scrollToTaskTypesSection() {
    await scrollToSettingsSection(context.page, "Task Categories");
  }

  test(
    "should display task types settings section",
    { timeout: 15000 },
    async () => {
      await createTestFolders(context.page);
      await openTaskSyncSettingsWrapper();

      const taskTypesSection = context.page
        .locator(".task-sync-section-header")
        .filter({ hasText: "Task Categories" });
      expect(await taskTypesSection.isVisible()).toBe(true);

      await scrollToTaskTypesSection();

      const settingItems = context.page.locator(".setting-item");
      const settingCount = await settingItems.count();
      expect(settingCount).toBeGreaterThan(5);

      const addTypeSection = context.page
        .locator(".setting-item")
        .filter({ hasText: "Add New Task Category" });
      expect(await addTypeSection.isVisible()).toBe(true);
    }
  );

  test("should display default task types", { timeout: 15000 }, async () => {
    await createTestFolders(context.page);
    await openTaskSyncSettingsWrapper();
    await scrollToTaskTypesSection();

    const taskSetting = context.page
      .locator(".setting-item")
      .filter({ hasText: "Task" })
      .first();
    expect(await taskSetting.isVisible()).toBe(true);

    const bugSetting = context.page
      .locator(".setting-item")
      .filter({ hasText: "Bug" })
      .first();
    expect(await bugSetting.isVisible()).toBe(true);

    const featureSetting = context.page
      .locator(".setting-item")
      .filter({ hasText: "Feature" })
      .first();
    expect(await featureSetting.isVisible()).toBe(true);

    const improvementSetting = context.page
      .locator(".setting-item")
      .filter({ hasText: "Improvement" })
      .first();
    expect(await improvementSetting.isVisible()).toBe(true);

    const choreSetting = context.page
      .locator(".setting-item")
      .filter({ hasText: "Chore" })
      .first();
    expect(await choreSetting.isVisible()).toBe(true);

    const taskTypeSettings = context.page
      .locator(".setting-item")
      .filter({ hasText: /Task|Bug|Feature|Improvement|Chore/ });
    const settingCount = await taskTypeSettings.count();
    expect(settingCount).toBeGreaterThanOrEqual(5);
  });

  test("should add new task type", { timeout: 15000 }, async () => {
    await createTestFolders(context.page);
    await openTaskSyncSettingsWrapper();
    await scrollToAddTaskTypeSection(context.page);

    const addSection = context.page
      .locator(".setting-item")
      .filter({ hasText: "Add New Task Category" });
    expect(await addSection.isVisible()).toBe(true);

    const newTypeInput = addSection.locator(
      'input[placeholder*="Epic, Story, Research"]'
    );
    await newTypeInput.fill("Epic");

    const addButton = addSection
      .locator("button")
      .filter({ hasText: "Add Task Category" });
    await addButton.click();

    const epicSetting = context.page
      .locator(".setting-item")
      .filter({ hasText: "Epic" })
      .first();
    await epicSetting.waitFor({ state: "visible", timeout: 5000 });
    expect(await epicSetting.isVisible()).toBe(true);

    const epicDeleteButton = epicSetting.locator('button:has-text("Delete")');
    expect(await epicDeleteButton.isVisible()).toBe(true);
  });

  test(
    "should prevent adding duplicate task types",
    { timeout: 15000 },
    async () => {
      await createTestFolders(context.page);
      await openTaskSyncSettingsWrapper();
      await scrollToAddTaskTypeSection(context.page);

      const addSection = context.page
        .locator(".setting-item")
        .filter({ hasText: "Add New Task Category" });

      const newTypeInput = addSection.locator(
        'input[placeholder*="Epic, Story, Research"]'
      );
      await newTypeInput.fill("Bug");

      const addButton = addSection
        .locator("button")
        .filter({ hasText: "Add Task Category" });
      await addButton.click();

      await context.page.waitForTimeout(500);

      const bugSettings = context.page
        .locator(".setting-item")
        .filter({ hasText: "Bug" });
      const bugCount = await bugSettings.count();
      expect(bugCount).toBe(1);
    }
  );

  test(
    "should prevent adding empty task type",
    { timeout: 15000 },
    async () => {
      await createTestFolders(context.page);
      await openTaskSyncSettingsWrapper();
      await scrollToAddTaskTypeSection(context.page);

      const addSection = context.page
        .locator(".setting-item")
        .filter({ hasText: "Add New Task Category" });

      const newTypeInput = addSection.locator(
        'input[placeholder*="Epic, Story, Research"]'
      );
      await newTypeInput.fill("   ");

      const addButton = addSection
        .locator("button")
        .filter({ hasText: "Add Task Category" });
      await addButton.click();

      await context.page.waitForTimeout(500);

      const emptySettings = context.page
        .locator(".setting-item")
        .filter({ hasText: /^\s*$/ });
      const emptyCount = await emptySettings.count();
      expect(emptyCount).toBe(0);
    }
  );

  test("should remove task type", { timeout: 15000 }, async () => {
    await createTestFolders(context.page);
    await openTaskSyncSettingsWrapper();
    await scrollToAddTaskTypeSection(context.page);

    const addSection = context.page
      .locator(".setting-item")
      .filter({ hasText: "Add New Task Category" });
    const newTypeInput = addSection.locator(
      'input[placeholder*="Epic, Story, Research"]'
    );
    await newTypeInput.fill("Story");

    const addButton = addSection
      .locator("button")
      .filter({ hasText: "Add Task Category" });
    await addButton.click();

    const storySetting = context.page
      .locator(".setting-item")
      .filter({ hasText: "Story" })
      .first();
    await storySetting.waitFor({ state: "visible", timeout: 5000 });
    expect(await storySetting.isVisible()).toBe(true);

    const deleteButton = storySetting
      .locator("button")
      .filter({ hasText: "Delete" });
    await deleteButton.click();

    await storySetting.waitFor({ state: "detached", timeout: 5000 });

    const storySettings = context.page
      .locator(".setting-item")
      .filter({ hasText: "Story" });
    const storyCount = await storySettings.count();
    expect(storyCount).toBe(0);
  });

  test(
    "should not show delete button for last task type",
    { timeout: 15000 },
    async () => {
      await createTestFolders(context.page);

      await context.page.evaluate(async () => {
        const app = (window as any).app;
        const plugin = app.plugins.plugins["obsidian-task-sync"];
        if (plugin) {
          plugin.settings.taskTypes = [{ name: "Task", color: "blue" }];
          await plugin.saveSettings();
        }
      });

      await openTaskSyncSettingsWrapper();
      await scrollToTaskTypesSection();

      const taskSetting = context.page
        .locator(".setting-item")
        .filter({ hasText: "Task" })
        .first();
      expect(await taskSetting.isVisible()).toBe(true);

      const deleteButton = taskSetting
        .locator("button")
        .filter({ hasText: "Delete" });
      expect(await deleteButton.isVisible()).toBe(false);
    }
  );

  test(
    "should trigger base sync when task type is added",
    { timeout: 30000 },
    async () => {
      await createTestFolders(context.page);
      await waitForTaskSyncPlugin(context.page);

      await createArea(context, {
        name: "Test Area",
        description: "Test area for sync testing.",
      });

      await context.page.evaluate(async () => {
        const app = (window as any).app;
        const plugin = app.plugins.plugins["obsidian-task-sync"];
        if (plugin) {
          plugin.settings.areaBasesEnabled = true;
          plugin.settings.autoSyncAreaProjectBases = true;
          await plugin.saveSettings();
          await plugin.regenerateBases();
        }
      });

      await context.page.waitForTimeout(3000);

      await openTaskSyncSettingsWrapper();
      await scrollToAddTaskTypeSection(context.page);

      const addSection = context.page
        .locator(".setting-item")
        .filter({ hasText: "Add New Task Category" });
      const newTypeInput = addSection.locator(
        'input[placeholder*="Epic, Story, Research"]'
      );
      await newTypeInput.fill("Research");

      const addButton = addSection
        .locator("button")
        .filter({ hasText: "Add Task Category" });
      await addButton.click();

      const researchSetting = context.page
        .locator(".setting-item")
        .filter({ hasText: "Research" })
        .first();
      await researchSetting.waitFor({ state: "visible", timeout: 5000 });

      const hasResearchTaskType = await context.page.evaluate(async () => {
        const app = (window as any).app;
        const plugin = app.plugins.plugins["obsidian-task-sync"];
        if (plugin && plugin.settings && plugin.settings.taskTypes) {
          return plugin.settings.taskTypes.some(
            (t: any) => t.name === "Research"
          );
        }
        return false;
      });

      expect(hasResearchTaskType).toBe(true);
    }
  );

  test(
    "should trigger base sync when task type is created and removed",
    { timeout: 30000 },
    async () => {
      await createTestFolders(context.page);
      await waitForTaskSyncPlugin(context.page);

      await createArea(context, {
        name: "Sync Test",
        description: "Area for testing sync functionality.",
      });

      await context.page.evaluate(async () => {
        const app = (window as any).app;
        const plugin = app.plugins.plugins["obsidian-task-sync"];
        if (plugin) {
          plugin.settings.areaBasesEnabled = true;
          plugin.settings.autoSyncAreaProjectBases = true;
          await plugin.saveSettings();
          await plugin.regenerateBases();
        }
      });

      await context.page.waitForTimeout(3000);

      await openTaskSyncSettingsWrapper();
      await scrollToAddTaskTypeSection(context.page);

      const addSection = context.page
        .locator(".setting-item")
        .filter({ hasText: "Add New Task Category" });
      const newTypeInput = addSection.locator(
        'input[placeholder*="Epic, Story, Research"]'
      );
      await newTypeInput.fill("Epic");

      const addButton = addSection
        .locator("button")
        .filter({ hasText: "Add Task Category" });
      await addButton.click();

      const epicSetting = context.page
        .locator(".setting-item")
        .filter({ hasText: "Epic" })
        .first();
      await epicSetting.waitFor({ state: "visible", timeout: 5000 });

      const hasEpicTaskType = await context.page.evaluate(async () => {
        const app = (window as any).app;
        const plugin = app.plugins.plugins["obsidian-task-sync"];
        if (plugin && plugin.settings && plugin.settings.taskTypes) {
          return plugin.settings.taskTypes.some((t: any) => t.name === "Epic");
        }
        return false;
      });

      expect(hasEpicTaskType).toBe(true);

      await context.page.waitForFunction(
        async () => {
          const app = (window as any).app;
          const baseFile = app.vault.getAbstractFileByPath(
            "Bases/Sync Test.base"
          );
          if (baseFile) {
            const content = await app.vault.read(baseFile);
            return (
              content.includes("name: Epics") &&
              content.includes('Category == "Epic"')
            );
          }
          return false;
        },
        { timeout: 10000 }
      );

      const deleteButton = epicSetting
        .locator("button")
        .filter({ hasText: "Delete" });
      await deleteButton.click();

      await epicSetting.waitFor({ state: "detached", timeout: 5000 });

      await context.page.waitForFunction(
        async () => {
          const app = (window as any).app;
          const baseFile = app.vault.getAbstractFileByPath(
            "Bases/Sync Test.base"
          );
          if (baseFile) {
            const content = await app.vault.read(baseFile);
            return (
              !content.includes("name: Epics") &&
              !content.includes('Category == "Epic"')
            );
          }
          return false;
        },
        { timeout: 10000 }
      );

      const stillHasEpicTaskType = await context.page.evaluate(async () => {
        const app = (window as any).app;
        const plugin = app.plugins.plugins["obsidian-task-sync"];
        if (plugin && plugin.settings && plugin.settings.taskTypes) {
          return plugin.settings.taskTypes.some((t: any) => t.name === "Epic");
        }
        return false;
      });

      expect(stillHasEpicTaskType).toBe(false);

      const baseContent = await context.page.evaluate(async () => {
        const app = (window as any).app;
        const baseFile = app.vault.getAbstractFileByPath(
          "Bases/Sync Test.base"
        );
        if (baseFile) {
          return await app.vault.read(baseFile);
        }
        return null;
      });

      expect(baseContent).not.toContain("name: Epics");
      expect(baseContent).not.toContain('Category == "Epic"');
    }
  );

  test(
    "should handle special characters in task type names",
    { timeout: 15000 },
    async () => {
      await createTestFolders(context.page);
      await openTaskSyncSettingsWrapper();
      await scrollToAddTaskTypeSection(context.page);

      const addSection = context.page
        .locator(".setting-item")
        .filter({ hasText: "Add New Task Category" });
      const newTypeInput = addSection.locator(
        'input[placeholder*="Epic, Story, Research"]'
      );
      await newTypeInput.fill("User Story (UI/UX)");

      const addButton = addSection
        .locator("button")
        .filter({ hasText: "Add Task Category" });
      await addButton.click();

      const userStorySetting = context.page
        .locator(".setting-item")
        .filter({ hasText: "User Story (UI/UX)" })
        .first();
      await userStorySetting.waitFor({ state: "visible", timeout: 5000 });
      expect(await userStorySetting.isVisible()).toBe(true);
    }
  );
});
