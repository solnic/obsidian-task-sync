# E2E Test Helper Functions Guide

## Overview

This guide documents the helper functions available for e2e tests and best practices for writing reliable tests.

## Core Principle: Never Use `waitForTimeout`

❌ **Bad:**
```typescript
await page.click('[data-testid="submit-button"]');
await page.waitForTimeout(1000); // Arbitrary timeout
```

✅ **Good:**
```typescript
await page.click('[data-testid="submit-button"]');
await page.waitForSelector(".success-message", { state: "visible" });
```

## Available Helper Functions

### File Operations

#### `readVaultFile(page, filePath)`
Read file content from Obsidian vault.

```typescript
const content = await readVaultFile(page, "Tasks/My Task.md");
```

#### `getFileContent(page, filePath)`
Get file content (alias for readVaultFile).

```typescript
const content = await getFileContent(page, "Tasks/My Task.md");
```

#### `fileExists(page, filePath)`
Check if file exists in vault.

```typescript
const exists = await fileExists(page, "Tasks/My Task.md");
expect(exists).toBe(true);
```

#### `createFile(page, filePath, frontmatter, content)`
Create a file with frontmatter and content.

```typescript
await createFile(page, "Tasks/New Task.md", {
  Title: "New Task",
  Status: "Backlog"
}, "Task description");
```

#### `openFile(page, filePath)`
Open a file in the editor and wait for it to be active.

```typescript
await openFile(page, "Tasks/My Task.md");
```

### Wait Helpers

#### `waitForFileProcessed(page, filePath, timeout?)`
Wait for file to be processed by Obsidian's metadata cache.

```typescript
await createFile(page, "Test.md", {}, "content");
await waitForFileProcessed(page, "Test.md");
```

#### `waitForFileContentToContain(page, filePath, expectedContent, timeout?)`
Wait for file to contain specific text.

```typescript
await waitForFileContentToContain(page, "Daily/2024-01-01.md", "[[My Task]]");
```

#### `waitForFileUpdate(page, filePath, expectedContent?, timeout?)`
Wait for a file to be updated.

```typescript
await updateFileFrontmatter(page, "Tasks/My Task.md", { Status: "Done" });
await waitForFileUpdate(page, "Tasks/My Task.md", "Status: Done");
```

#### `waitForContextUpdate(page, expectedContextType, timeout?)`
Wait for context widget to update after file navigation.

```typescript
await openFile(page, "Projects/My Project.md");
await waitForContextUpdate(page, "Project");
```

#### `waitForPropertyTypeInferred(page, filePath, propertyName, timeout?)`
Wait for Obsidian to infer property types from a file.

```typescript
await createFile(page, "Test.md", { myProp: "value" }, "");
await waitForPropertyTypeInferred(page, "Test.md", "myProp");
```

#### `waitForUIRecreation(page, selector, timeout?)`
Wait for UI component to be recreated after state change.

```typescript
await propertyDropdown.selectOption("number");
await waitForUIRecreation(page, '[data-testid="property-toggle"]');
```

#### `waitForCommandComplete(page, expectedNotice?, timeout?)`
Wait for command execution to complete.

```typescript
await executeCommand(page, "Create Task");
await waitForCommandComplete(page, "Task created successfully");
```

#### `waitForNoticesCleared(page, timeout?)`
Wait for all notices to disappear.

```typescript
await waitForNoticesCleared(page);
```

#### `waitForNoticeDisappear(page, noticeText, timeout?)`
Wait for a specific notice to disappear.

```typescript
await waitForNoticeDisappear(page, "Task created");
```

### Frontmatter Operations

#### `getFrontMatter(page, filePath)`
Get file frontmatter with proper waiting.

```typescript
const fm = await getFrontMatter(page, "Tasks/My Task.md");
expect(fm.Status).toBe("Done");
```

#### `updateFileFrontmatter(page, filePath, updates)`
Update file frontmatter.

```typescript
await updateFileFrontmatter(page, "Tasks/My Task.md", {
  Status: "Done",
  Priority: "High"
});
```

### Entity Helpers

#### `createTask(page, taskData)`
Create a task using the application's task creation system.

```typescript
await createTask(page, {
  title: "My Task",
  category: "Feature",
  priority: "High",
  status: "In Progress"
});
```

#### `createProject(page, projectData)`
Create a project.

```typescript
await createProject(page, {
  title: "My Project",
  areas: ["Work"]
});
```

#### `createArea(page, areaData)`
Create an area.

```typescript
await createArea(page, {
  title: "Work"
});
```

### Command Execution

#### `executeCommand(page, command, options?)`
Execute an Obsidian command.

```typescript
await executeCommand(page, "Create Task");
await executeCommand(page, "Refresh Tasks", { notice: "Tasks refreshed" });
```

### Settings Helpers

#### `openTaskSyncSettings(page)`
Open Task Sync plugin settings.

```typescript
await openTaskSyncSettings(page);
```

#### `closeSettings(page)`
Close settings modal.

```typescript
await closeSettings(page);
```

#### `updatePluginSettings(page, settings)`
Update plugin settings directly.

```typescript
await updatePluginSettings(page, {
  areaBasesEnabled: true,
  projectBasesEnabled: true
});
```

### Notice Helpers

#### `waitForNotice(page, expectedText, timeout?)`
Wait for a notice with specific text to appear.

```typescript
await waitForNotice(page, "Task created successfully");
```

#### `expectNotice(page, expectedText, timeout?)`
Wait for and verify a notice appears.

```typescript
await expectNotice(page, "Task created successfully");
```

## Best Practices

### 1. Use Specific Wait Conditions

❌ **Bad:**
```typescript
await page.click('[data-testid="submit"]');
await page.waitForTimeout(1000);
const content = await getFileContent(page, "file.md");
```

✅ **Good:**
```typescript
await page.click('[data-testid="submit"]');
await waitForFileContentToContain(page, "file.md", "expected content");
const content = await getFileContent(page, "file.md");
```

### 2. Use Helpers Instead of `page.evaluate`

❌ **Bad:**
```typescript
const content = await page.evaluate(async (path) => {
  const app = (window as any).app;
  const file = app.vault.getAbstractFileByPath(path);
  return await app.vault.read(file);
}, filePath);
```

✅ **Good:**
```typescript
const content = await getFileContent(page, filePath);
```

### 3. Wait for Actual Conditions

❌ **Bad:**
```typescript
await page.click('[data-testid="delete"]');
await page.waitForTimeout(500);
// Hope the file is deleted
```

✅ **Good:**
```typescript
await page.click('[data-testid="delete"]');
await page.waitForFunction(
  ({ path }) => {
    const app = (window as any).app;
    return !app.vault.getAbstractFileByPath(path);
  },
  { path: filePath },
  { timeout: 5000 }
);
```

### 4. Use Test Data Helpers

❌ **Bad:**
```typescript
await page.evaluate(async () => {
  const app = (window as any).app;
  await app.vault.create("Tasks/Test.md", "---\nTitle: Test\n---");
});
```

✅ **Good:**
```typescript
await createTask(page, {
  title: "Test",
  category: "Feature"
});
```

## Debugging

### Console Output

Console debug statements from the Electron app now automatically appear in test output:

```typescript
// In your plugin code:
console.debug("Task created:", task);

// This will appear in test output as:
// [Obsidian Debug] Task created: {...}
```

### Capturing Screenshots

Screenshots are automatically captured on test failure. You can also manually capture:

```typescript
await page.screenshot({ path: "debug-screenshot.png" });
```

### Viewing Test Artifacts

After a test failure, check:
- `tests/e2e/debug/` - Screenshots, logs, and HTML snapshots
- `test-results/` - Playwright traces and videos

## Common Patterns

### Creating and Verifying a Task

```typescript
await createTask(page, {
  title: "My Task",
  category: "Feature",
  priority: "High"
});

await openTasksView(page);
await waitForLocalTasksToLoad(page);
await getTaskItemByTitle(page, "My Task");
```

### Updating and Verifying Frontmatter

```typescript
await updateFileFrontmatter(page, "Tasks/My Task.md", {
  Status: "Done"
});

await waitForFileUpdate(page, "Tasks/My Task.md", "Status: Done");

const fm = await getFrontMatter(page, "Tasks/My Task.md");
expect(fm.Status).toBe("Done");
```

### Opening File and Checking Context

```typescript
await openFile(page, "Projects/My Project.md");
await waitForContextUpdate(page, "Project");

const contextType = page.locator('[data-testid="context-widget"] .context-type');
await expect(contextType).toHaveText("Project");
```

## Need a New Helper?

If you find yourself writing the same `page.evaluate` or wait logic multiple times:

1. Add the helper to `tests/e2e/helpers/global.ts`
2. Document it in this guide
3. Update existing tests to use the new helper

Example:

```typescript
/**
 * Wait for a specific property value in the plugin
 */
export async function waitForPluginCondition(
  page: Page,
  property: string,
  expectedValue: any,
  timeout: number = 5000
): Promise<void> {
  await page.waitForFunction(
    ({ property, expectedValue }) => {
      const plugin = (window as any).app.plugins.plugins["obsidian-task-sync"];
      return plugin && plugin[property] === expectedValue;
    },
    { property, expectedValue },
    { timeout }
  );
}
```

