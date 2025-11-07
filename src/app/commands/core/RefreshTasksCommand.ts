import { Notice } from "obsidian";
import { Command, type CommandContext } from "../Command";
import { get } from "svelte/store";
import { taskStore } from "../../stores/taskStore";
import type { ObsidianExtension } from "../../extensions/obsidian/ObsidianExtension";
import type { NoteType } from "../../core/type-note";
import type TaskSyncPlugin from "../../../main";
import { taskSourceManager } from "../../core/TaskSourceManager";
import type { Task } from "../../core/entities";
import { ObsidianTaskOperations } from "../../extensions/obsidian/operations/TaskOperations";
import { ObsidianBaseManager } from "../../extensions/obsidian/utils/BaseManager";

/**
 * Refresh Tasks Command
 *
 * Comprehensive refresh operation that:
 * 1. Updates file properties and removes obsolete front-matter keys
 * 2. Recreates missing task files for entities that exist in the store
 * 3. Refreshes task data from all sources while preserving source metadata
 * 4. Regenerates bases to ensure consistency
 *
 * IMPORTANT: This command preserves source.extension throughout the refresh process.
 * Tasks imported from external sources (GitHub, etc.) maintain their original source
 * attribution after refresh.
 */
export class RefreshTasksCommand extends Command {
  getId(): string {
    return "refresh-tasks";
  }

  getName(): string {
    return "Refresh Tasks";
  }

  async execute(): Promise<void> {
    try {
      new Notice("Starting comprehensive refresh...");

      const results = {
        filesScanned: 0,
        filesRepaired: 0,
        propertiesUpdated: 0,
        filesRecreated: 0,
        tasksRefreshed: 0,
        basesRegenerated: 0,
        errors: [] as string[],
      };

      console.log("Task Sync: Starting comprehensive refresh operation...");

      // Step 1: Update file properties, remove obsolete keys, and recreate missing files
      await this.updateFileProperties(results);

      // Step 2: Refresh task data from all sources while preserving source metadata
      await this.rebuildTaskData(results);

      // Step 3: Regenerate bases to ensure consistency
      await this.regenerateBases(results);

      // Show completion notice
      const summary = [
        `Files scanned: ${results.filesScanned}`,
        `Files repaired: ${results.filesRepaired}`,
        `Properties updated: ${results.propertiesUpdated}`,
        `Files recreated: ${results.filesRecreated}`,
        `Tasks refreshed: ${results.tasksRefreshed}`,
        `Bases regenerated: ${results.basesRegenerated}`,
      ];

      if (results.errors.length > 0) {
        summary.push(`Errors: ${results.errors.length}`);
        console.error("Refresh errors:", results.errors);
      }

      new Notice(`Refresh complete!\n${summary.join("\n")}`, 5000);
      console.log("Task Sync: Comprehensive refresh completed", results);
    } catch (error) {
      console.error("Task Sync: Refresh failed:", error);
      new Notice(`Refresh failed: ${error.message}`);
    }
  }

  /**
   * Update file properties, remove obsolete front-matter keys, and recreate missing files
   */
  private async updateFileProperties(results: {
    filesScanned: number;
    filesRepaired: number;
    propertiesUpdated: number;
    filesRecreated: number;
    errors: string[];
  }): Promise<void> {
    try {
      console.log("Task Sync: Updating file properties...");

      // Get the Obsidian extension to access task operations
      const plugin = this.plugin as TaskSyncPlugin;
      const obsidianExtension = plugin.host.getExtensionById(
        "obsidian"
      ) as ObsidianExtension;

      if (!obsidianExtension) {
        throw new Error("Obsidian extension not found");
      }

      // Get the Task note type to determine valid front-matter keys
      const taskNoteType = plugin.typeNote.registry.get("task") as NoteType;

      if (!taskNoteType) {
        throw new Error("Task note type not found");
      }

      // Build set of valid front-matter keys from property definitions
      const validFrontMatterKeys = new Set<string>();
      for (const propKey of Object.keys(taskNoteType.properties)) {
        const propDef = taskNoteType.properties[propKey];
        if (propDef.frontMatterKey) {
          validFrontMatterKeys.add(propDef.frontMatterKey);
        }
      }

      // Get all task entities from the store
      const taskStoreState = get(taskStore);
      const allTaskEntities = taskStoreState.tasks.filter(
        (task) => task.source.extension === "obsidian"
      );

      // Get all task files in the vault
      const taskFiles = this.app.vault
        .getMarkdownFiles()
        .filter((file) =>
          file.path.startsWith(this.settings.tasksFolder + "/")
        );

      results.filesScanned = taskFiles.length;

      // Track which entities have files
      const entitiesWithFiles = new Set<string>();

      // Get task operations to update files
      const taskOps = new ObsidianTaskOperations(this.app, this.settings);

      // Process each task file
      for (const file of taskFiles) {
        try {
          // Find the task entity for this file
          const taskEntity = allTaskEntities.find(
            (task) => task.source.keys.obsidian === file.path
          );

          if (taskEntity) {
            entitiesWithFiles.add(taskEntity.id);

            // Update the file using task operations
            // This will replace all front-matter properties with those from the entity,
            // removing any custom user-added properties.
            await taskOps.updateNote(taskEntity);
            results.filesRepaired++;
            results.propertiesUpdated++;
          } else {
            console.warn(`No task entity found for file: ${file.path}`);
          }
        } catch (error) {
          console.error(`Error processing file ${file.path}:`, error);
          results.errors.push(`${file.path}: ${error.message}`);
        }
      }

      // Check for entities without files and recreate them
      // An entity is missing a file if:
      // 1. It has a file path in source.keys.obsidian but the file doesn't exist
      // 2. It doesn't have a file path at all
      const entitiesWithoutFiles = allTaskEntities.filter((task) => {
        // If we already found this entity's file, skip it
        if (entitiesWithFiles.has(task.id)) {
          return false;
        }

        // If the entity has a file path, check if the file exists
        const filePath = task.source.keys.obsidian;
        if (filePath) {
          const file = this.app.vault.getAbstractFileByPath(filePath);
          return !file; // Include if file doesn't exist
        }

        // If no file path, include it (needs a file created)
        return true;
      });

      if (entitiesWithoutFiles.length > 0) {
        console.log(
          `Found ${entitiesWithoutFiles.length} entities without files, recreating...`
        );

        for (const task of entitiesWithoutFiles) {
          try {
            console.log(`Recreating file for task: ${task.title}`);
            await taskOps.createNote(task);
            results.filesRecreated++;
          } catch (error) {
            console.error(
              `Failed to recreate file for task ${task.title}:`,
              error
            );
            results.errors.push(`${task.title}: ${error.message}`);
          }
        }
      }

      console.log("Task Sync: File properties updated successfully");
    } catch (error) {
      console.error("Task Sync: Failed to update file properties:", error);
      throw error;
    }
  }

  /**
   * Refresh task data from all sources while preserving source metadata
   *
   * This method uses TaskSourceManager.refreshAll() which:
   * 1. Calls refreshSource() for each registered source
   * 2. Each refreshSource() call:
   *    a. Fetches fresh data from the source
   *    b. Dispatches LOAD_SOURCE_SUCCESS to update the store
   *    c. Calls SyncManager.syncAllCrossSourceEntities()
   * 3. SyncManager merges cross-source tasks using "source-wins" strategy
   * 4. source.extension is preserved because the merge uses the original source extension
   *
   * Example: A GitHub task with a file in Obsidian:
   * - Task has source.extension="github" and source.keys={github:"...", obsidian:"..."}
   * - When Obsidian refreshes, it creates a new task with source.extension="obsidian"
   * - SyncManager detects both tasks reference the same file
   * - SyncManager merges them, preserving source.extension="github" (source-wins)
   * - Result: Task maintains GitHub attribution while file is updated
   */
  private async rebuildTaskData(results: {
    tasksRefreshed: number;
    errors: string[];
  }): Promise<void> {
    try {
      console.log("Task Sync: Refreshing task data from all sources...");

      // Refresh all sources - this automatically handles source metadata preservation
      // through the SyncManager's "source-wins" merge strategy
      await taskSourceManager.refreshAll();

      // Count refreshed tasks
      const storeState = get(taskStore);
      results.tasksRefreshed = storeState.tasks.length;

      console.log(`Task Sync: Task data refreshed successfully - ${results.tasksRefreshed} tasks refreshed`);
    } catch (error) {
      console.error("Task Sync: Failed to refresh task data:", error);
      throw error;
    }
  }

  /**
   * Regenerate bases to ensure consistency
   */
  private async regenerateBases(results: {
    basesRegenerated: number;
    errors: string[];
  }): Promise<void> {
    try {
      console.log("Task Sync: Regenerating bases...");

      const baseManager = new ObsidianBaseManager(
        this.app,
        this.app.vault,
        this.settings
      );

      // Regenerate task bases
      const projectsAndAreas = await baseManager.getProjectsAndAreas();
      await baseManager.createOrUpdateTasksBase(projectsAndAreas);
      results.basesRegenerated++;

      console.log("Task Sync: Bases regenerated successfully");
    } catch (error) {
      console.error("Task Sync: Failed to regenerate bases:", error);
      results.errors.push(`Base regeneration: ${error.message}`);
    }
  }
}
