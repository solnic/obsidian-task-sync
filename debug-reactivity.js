// Debug script to test reactivity
const { test, expect } = require('@playwright/test');

test('debug reactivity issue', async ({ page }) => {
  // Navigate to the app
  await page.goto('app://obsidian.md/');
  
  // Wait for the app to load
  await page.waitForSelector('[data-testid="task-sync-main"]', { timeout: 30000 });
  
  // Enable GitHub integration
  await page.click('[data-testid="service-github"]');
  
  // Create a simple task first
  const taskData = {
    title: "Test Task",
    description: "Test description",
    category: "Bug",
    status: "Backlog",
    priority: "Medium",
    project: "",
    doDate: undefined,
    source: {
      extension: "github",
      url: "https://github.com/test/test/issues/123",
      filePath: "Tasks/Test Task.md",
      data: {
        id: 123,
        number: 123,
        title: "Test Task",
        html_url: "https://github.com/test/test/issues/123",
      },
    },
  };

  // Create the task
  await page.evaluate(async (taskData) => {
    const app = window.app;
    const plugin = app.plugins.plugins["obsidian-task-sync"];
    const task = await plugin.operations.taskOperations.create(taskData);
    console.log("Created task:", task);
    return task;
  }, taskData);

  // Wait for task file to be created
  await page.waitForTimeout(2000);

  // Check if task is in store
  const taskInStore = await page.evaluate(async () => {
    const app = window.app;
    const plugin = app.plugins.plugins["obsidian-task-sync"];
    const task = plugin.stores.taskStore.findByTitle("Test Task");
    console.log("Task in store:", task);
    return task;
  });

  console.log("Task in store:", taskInStore);

  // Now modify the task frontmatter
  await page.evaluate(async () => {
    const app = window.app;
    const file = app.vault.getAbstractFileByPath("Tasks/Test Task.md");
    if (file) {
      console.log("Found file, updating frontmatter...");
      await app.fileManager.processFrontMatter(file, (frontmatter) => {
        frontmatter["Do Date"] = "2024-02-15";
        console.log("Updated frontmatter:", frontmatter);
      });
    } else {
      console.log("File not found!");
    }
  });

  // Wait for changes to propagate
  await page.waitForTimeout(2000);

  // Check if task store was updated
  const updatedTaskInStore = await page.evaluate(async () => {
    const app = window.app;
    const plugin = app.plugins.plugins["obsidian-task-sync"];
    const task = plugin.stores.taskStore.findByTitle("Test Task");
    console.log("Updated task in store:", task);
    return task;
  });

  console.log("Updated task in store:", updatedTaskInStore);
  
  expect(updatedTaskInStore.doDate).toBeDefined();
});
