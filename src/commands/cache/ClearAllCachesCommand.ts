/**
 * Clear All Caches Command
 * Clears all plugin caches
 */

import { Command, type CommandContext } from "../Command";
import { Notice } from "obsidian";

export class ClearAllCachesCommand extends Command {
  constructor(context: CommandContext) {
    super(context);
  }

  getId(): string {
    return "clear-all-caches";
  }

  getName(): string {
    return "Clear all caches";
  }

  async execute(): Promise<void> {
    try {
      console.log("🧹 Starting comprehensive cache clearing...");

      // Step 1: Save all store data before clearing
      await this.saveAllStoreData();

      // Step 2: Clear CacheManager caches
      await this.clearCacheManagerCaches();

      // Step 3: Clear integration service caches
      await this.clearIntegrationServiceCaches();

      // Step 4: Refresh all stores to reload from files
      await this.refreshAllStores();

      console.log("🧹 Cache clearing completed successfully");
      new Notice("All caches cleared and stores refreshed");
    } catch (error) {
      console.error("🧹 Error during cache clearing:", error);
      new Notice("Cache clearing completed with some errors - check console");
    }
  }

  /**
   * Save all store data to ensure no data loss
   */
  private async saveAllStoreData(): Promise<void> {
    console.log("🧹 Saving all store data...");

    try {
      const plugin = this.plugin as any;
      const stores = plugin.stores;
      if (stores) {
        const savePromises = [];

        if (stores.taskStore?.saveData) {
          savePromises.push(stores.taskStore.saveData());
        }

        if (stores.projectStore?.saveData) {
          savePromises.push(stores.projectStore.saveData());
        }

        if (stores.areaStore?.saveData) {
          savePromises.push(stores.areaStore.saveData());
        }

        if (stores.taskMentionStore?.saveData) {
          savePromises.push(stores.taskMentionStore.saveData());
        }

        if (stores.scheduleStore?.saveData) {
          savePromises.push(stores.scheduleStore.saveData());
        }

        await Promise.all(savePromises);
        console.log("🧹 Store data saved successfully");
      }
    } catch (error) {
      console.warn("🧹 Error saving store data:", error);
    }
  }

  /**
   * Clear CacheManager caches
   */
  private async clearCacheManagerCaches(): Promise<void> {
    console.log("🧹 Clearing CacheManager caches...");

    try {
      const cacheManager = this.taskSyncPlugin.cacheManager;
      if (cacheManager?.clearAllCaches) {
        await cacheManager.clearAllCaches();
        console.log("🧹 CacheManager caches cleared");
      } else {
        console.warn("🧹 CacheManager not available or missing clearAllCaches method");
      }
    } catch (error) {
      console.warn("🧹 Error clearing CacheManager caches:", error);
    }
  }

  /**
   * Clear integration service caches
   */
  private async clearIntegrationServiceCaches(): Promise<void> {
    console.log("🧹 Clearing integration service caches...");

    try {
      const integrationManager = this.integrationManager;
      if (!integrationManager) {
        console.warn("🧹 IntegrationManager not available");
        return;
      }

      const clearPromises = [];

      // Clear GitHub service cache
      const githubService = integrationManager.getGitHubService?.();
      if (githubService?.clearCache) {
        clearPromises.push(
          githubService.clearCache().then(() =>
            console.log("🧹 GitHub service cache cleared")
          ).catch((error: any) =>
            console.warn("🧹 Error clearing GitHub cache:", error)
          )
        );
      }

      // Clear Apple Reminders service cache
      const appleRemindersService = integrationManager.getAppleRemindersService?.();
      if (appleRemindersService?.clearCache) {
        clearPromises.push(
          appleRemindersService.clearCache().then(() =>
            console.log("🧹 Apple Reminders service cache cleared")
          ).catch((error: any) =>
            console.warn("🧹 Error clearing Apple Reminders cache:", error)
          )
        );
      }

      // Clear Apple Calendar service cache (access directly from plugin)
      const plugin = this.plugin as any;
      const appleCalendarService = plugin.appleCalendarService;
      if (appleCalendarService?.clearCache) {
        clearPromises.push(
          appleCalendarService.clearCache().then(() =>
            console.log("🧹 Apple Calendar service cache cleared")
          ).catch((error: any) =>
            console.warn("🧹 Error clearing Apple Calendar cache:", error)
          )
        );
      }

      if (clearPromises.length > 0) {
        await Promise.all(clearPromises);
        console.log("🧹 Integration service caches cleared");
      } else {
        console.log("🧹 No integration service caches to clear");
      }
    } catch (error) {
      console.warn("🧹 Error clearing integration service caches:", error);
    }
  }

  /**
   * Refresh all stores to reload data from files
   */
  private async refreshAllStores(): Promise<void> {
    console.log("🧹 Refreshing all stores...");

    try {
      const plugin = this.plugin as any;
      const stores = plugin.stores;
      if (stores) {
        const refreshPromises = [];

        if (stores.taskStore?.refreshEntities) {
          refreshPromises.push(stores.taskStore.refreshEntities());
        }

        if (stores.projectStore?.refreshEntities) {
          refreshPromises.push(stores.projectStore.refreshEntities());
        }

        if (stores.areaStore?.refreshEntities) {
          refreshPromises.push(stores.areaStore.refreshEntities());
        }

        if (stores.taskMentionStore?.refreshEntities) {
          refreshPromises.push(stores.taskMentionStore.refreshEntities());
        }

        if (stores.scheduleStore?.refreshEntities) {
          refreshPromises.push(stores.scheduleStore.refreshEntities());
        }

        await Promise.all(refreshPromises);
        console.log("🧹 All stores refreshed successfully");
      }
    } catch (error) {
      console.warn("🧹 Error refreshing stores:", error);
    }
  }
}
