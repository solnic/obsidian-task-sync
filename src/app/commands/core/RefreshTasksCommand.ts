import { Notice } from "obsidian";
import { Command } from "../Command";
import { get } from "svelte/store";
import { taskStore } from "../../stores/taskStore";
import { taskSourceManager } from "../../core/TaskSourceManager";
import { ObsidianBaseManager } from "../../extensions/obsidian/utils/BaseManager";

/**
 * Refresh Tasks Command
 *
 * Comprehensive refresh operation that:
 * 1. Refreshes task data from all sources while preserving source metadata
 * 2. Regenerates bases to ensure consistency
 *
 * IMPORTANT: This command preserves source.extension throughout the refresh process.
 * Tasks imported from external sources (GitHub, etc.) maintain their original source
 * attribution after refresh.
 *
 * File operations (creating missing files, updating properties) are handled automatically
 * by the Obsidian extension during its refresh process.
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
        tasksRefreshed: 0,
        basesRegenerated: 0,
        errors: [] as string[],
      };

      console.log("Task Sync: Starting comprehensive refresh operation...");

      // Step 1: Refresh task data from all sources while preserving source metadata
      // Each source handles its own file operations (Obsidian creates/updates files)
      await this.rebuildTaskData(results);

      // Step 2: Regenerate bases to ensure consistency
      await this.regenerateBases(results);

      // Show completion notice
      const summary = [
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
