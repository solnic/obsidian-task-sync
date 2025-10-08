/**
 * Simple test to verify Task note type is registered and visible
 */

import { test, expect } from "../../helpers/setup";

test.describe("Task Note Type Verification", () => {
  test("should register Task note type and show in settings", async ({ page }) => {
    // Verify Task note type is registered
    const verification = await page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      
      if (!plugin || !plugin.typeNote) {
        return { success: false, error: "Plugin or TypeNote not found" };
      }
      
      // Get all note types
      const noteTypes = plugin.typeNote.registry.getAll();
      
      // Find Task note type
      const taskNoteType = noteTypes.find((nt: any) => nt.id === "task");
      
      if (!taskNoteType) {
        return { 
          success: false, 
          error: "Task note type not found",
          availableTypes: noteTypes.map((nt: any) => nt.id)
        };
      }
      
      return {
        success: true,
        taskNoteType: {
          id: taskNoteType.id,
          name: taskNoteType.name,
          version: taskNoteType.version,
          propertyCount: Object.keys(taskNoteType.properties).length,
          properties: Object.keys(taskNoteType.properties),
        },
      };
    });

    console.log("Verification result:", JSON.stringify(verification, null, 2));

    expect(verification.success).toBe(true);
    expect(verification.taskNoteType?.id).toBe("task");
    expect(verification.taskNoteType?.name).toBe("Task");
    expect(verification.taskNoteType?.propertyCount).toBeGreaterThan(0);
  });

  test("should have Create Task command registered", async ({ page }) => {
    const commandCheck = await page.evaluate(async () => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      
      // Get all commands
      const commands = (app as any).commands.commands;
      
      // Find Create Task command
      const createTaskCommand = Object.values(commands).find(
        (cmd: any) => cmd.id === "obsidian-task-sync:create-note-task"
      );
      
      return {
        found: !!createTaskCommand,
        commandName: createTaskCommand ? (createTaskCommand as any).name : null,
        allTaskSyncCommands: Object.values(commands)
          .filter((cmd: any) => cmd.id.startsWith("obsidian-task-sync:"))
          .map((cmd: any) => ({ id: cmd.id, name: cmd.name })),
      };
    });

    console.log("Command check:", JSON.stringify(commandCheck, null, 2));

    expect(commandCheck.found).toBe(true);
    expect(commandCheck.commandName).toBe("Create Task");
  });
});

