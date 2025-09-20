import { test, expect, describe, beforeEach } from "vitest";
import { getFileContent, fileExists, executeCommand } from "../helpers/global";
import { setupE2ETestHooks } from "../helpers/shared-context";

describe("Template Refresh Bug", () => {
  const context = setupE2ETestHooks();

  test("should not corrupt Area and Project templates during refresh", async () => {
    // Delete any existing templates first to avoid conflicts
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const templateFiles = [
        "Templates/Area.md",
        "Templates/Project.md",
        "Templates/Task.md",
      ];

      for (const templatePath of templateFiles) {
        const file = app.vault.getAbstractFileByPath(templatePath);
        if (file) {
          await app.vault.delete(file);
        }
      }
    });

    // Create proper Area template with correct front-matter
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const areaTemplateContent = `---
Name: {{name}}
Type: Area
Project:
---

{{description}}

## Tasks

![[{{name}}.base]]`;

      await app.vault.create("Templates/Area.md", areaTemplateContent);
    });

    // Create proper Project template with correct front-matter
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const projectTemplateContent = `---
Name: {{name}}
Type: Project
Areas: []
---

{{description}}

## Tasks

![[{{name}}.base]]`;

      await app.vault.create("Templates/Project.md", projectTemplateContent);
    });

    // Create Task template with full task properties
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const taskTemplateContent = `---
Title: {{name}}
Type: Task
Category: {{category}}
Priority: {{priority}}
Areas: {{areas}}
Project: {{project}}
Done: {{done}}
Status: {{status}}
Parent task: {{parentTask}}

tags: {{tags}}
---

{{description}}`;

      await app.vault.create("Templates/Task.md", taskTemplateContent);
    });

    // Configure the templates in settings
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      if (plugin) {
        plugin.settings.defaultAreaTemplate = "Area.md";
        plugin.settings.defaultProjectTemplate = "Project.md";
        plugin.settings.defaultTaskTemplate = "Task.md";
        await plugin.saveSettings();
      }
    });

    await context.page.waitForTimeout(1000);

    // Get original template contents before refresh
    const originalAreaContent = await getFileContent(
      context.page,
      "Templates/Area.md"
    );
    const originalProjectContent = await getFileContent(
      context.page,
      "Templates/Project.md"
    );
    const originalTaskContent = await getFileContent(
      context.page,
      "Templates/Task.md"
    );

    console.log("Original Area template:", originalAreaContent);
    console.log("Original Project template:", originalProjectContent);
    console.log("Original Task template:", originalTaskContent);

    // Execute refresh command - this should NOT corrupt the templates
    await executeCommand(context, "Task Sync: Refresh");

    // Wait for refresh to complete
    await context.page.waitForTimeout(3000);

    // Get template contents after refresh
    const afterAreaContent = await getFileContent(
      context.page,
      "Templates/Area.md"
    );
    const afterProjectContent = await getFileContent(
      context.page,
      "Templates/Project.md"
    );
    const afterTaskContent = await getFileContent(
      context.page,
      "Templates/Task.md"
    );

    console.log("After refresh Area template:", afterAreaContent);
    console.log("After refresh Project template:", afterProjectContent);
    console.log("After refresh Task template:", afterTaskContent);

    // Area template should NOT have task-specific properties added
    expect(afterAreaContent).toContain("Name: {{name}}");
    expect(afterAreaContent).toContain("Type: Area");
    expect(afterAreaContent).toContain("Project:");
    expect(afterAreaContent).not.toContain("Title:"); // Should not have task properties
    expect(afterAreaContent).not.toContain("Category:");
    expect(afterAreaContent).not.toContain("Priority:");
    expect(afterAreaContent).not.toContain("Done:");
    expect(afterAreaContent).not.toContain("Status:");
    expect(afterAreaContent).not.toContain("Parent task:");

    // Project template should NOT have task-specific properties added
    expect(afterProjectContent).toContain("Name: {{name}}");
    expect(afterProjectContent).toContain("Type: Project");
    expect(afterProjectContent).toContain("Areas: []");
    expect(afterProjectContent).not.toContain("Title:"); // Should not have task properties
    expect(afterProjectContent).not.toContain("Category:");
    expect(afterProjectContent).not.toContain("Priority:");
    expect(afterProjectContent).not.toContain("Done:");
    expect(afterProjectContent).not.toContain("Status:");
    expect(afterProjectContent).not.toContain("Parent task:");

    // Task template should be properly updated with correct property order
    expect(afterTaskContent).toContain("Title: {{name}}");
    expect(afterTaskContent).toContain("Type: Task");
    expect(afterTaskContent).toContain("Category: {{category}}");
    expect(afterTaskContent).toContain("Priority: {{priority}}");
  });

  test("should create missing templates during refresh", async () => {
    // Configure templates in settings but don't create the files
    await context.page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      if (plugin) {
        plugin.settings.defaultAreaTemplate = "MissingArea.md";
        plugin.settings.defaultProjectTemplate = "MissingProject.md";
        plugin.settings.defaultTaskTemplate = "MissingTask.md";
        await plugin.saveSettings();
      }
    });

    // Verify templates don't exist yet
    expect(await fileExists(context.page, "Templates/MissingArea.md")).toBe(
      false
    );
    expect(await fileExists(context.page, "Templates/MissingProject.md")).toBe(
      false
    );
    expect(await fileExists(context.page, "Templates/MissingTask.md")).toBe(
      false
    );

    // Execute refresh command - this should create missing templates
    await executeCommand(context, "Task Sync: Refresh");

    // Wait for refresh to complete
    await context.page.waitForTimeout(3000);

    // Verify templates were created
    expect(await fileExists(context.page, "Templates/MissingArea.md")).toBe(
      true
    );
    expect(await fileExists(context.page, "Templates/MissingProject.md")).toBe(
      true
    );
    expect(await fileExists(context.page, "Templates/MissingTask.md")).toBe(
      true
    );

    // Verify they have correct content structure
    const areaContent = await getFileContent(
      context.page,
      "Templates/MissingArea.md"
    );
    const projectContent = await getFileContent(
      context.page,
      "Templates/MissingProject.md"
    );
    const taskContent = await getFileContent(
      context.page,
      "Templates/MissingTask.md"
    );

    // Area template should have area-specific properties only
    expect(areaContent).toContain("Name:");
    expect(areaContent).toContain("Type: Area");
    expect(areaContent).not.toContain("Title:");
    expect(areaContent).not.toContain("Category:");

    // Project template should have project-specific properties only
    expect(projectContent).toContain("Name:");
    expect(projectContent).toContain("Type: Project");
    expect(projectContent).toContain("Areas:");
    expect(projectContent).not.toContain("Title:");
    expect(projectContent).not.toContain("Category:");

    // Task template should have task-specific properties
    expect(taskContent).toContain("Title:");
    expect(taskContent).toContain("Type: Task");
    expect(taskContent).toContain("Category:");
    expect(taskContent).toContain("Priority:");
  });
});
