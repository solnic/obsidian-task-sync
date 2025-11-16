/**
 * Host abstraction for TaskSync application
 * Defines the required interface for mounting and operating TaskSync within different host environments
 *
 * The Host provides access to the primary persistence storage where the TaskSync application
 * stores its canonical data. This is fundamentally different from Extensions and their storage
 * mechanisms. Extensions store different and/or limited representations of entities for their
 * specific purposes.
 *
 * For example: The ObsidianExtension persists tasks as markdown note files, but this is only
 * a representation layer for displaying tasks within Obsidian's note system. This is NOT the
 * same as the Host's task persistence - task entities stored by the Host are the canonical,
 * high-level data structures that include complete metadata like IDs, source information,
 * and full entity state that may not be represented in the extension's view layer.
 */

import { TaskSyncSettings } from "../types/settings";
import { Area, Project, Task } from "./entities";
import { Extension } from "./extension";
import type { FileContext } from "../types/context";

/**
 * Abstract Host class that defines the required interface for mounting and operating
 * the TaskSync application within different host environments.
 *
 * This is a higher-level mounting concept - not to be confused with Svelte's component
 * mount() function - where the TaskSync app can be initialized and operate within a
 * given host environment.
 */
export abstract class Host {
  /**
   * Load TaskSync settings from the host's storage system.
   * For ObsidianHost, this loads settings from Obsidian's plugin data storage.
   *
   * @returns Promise resolving to the TaskSync settings object
   * @throws Error if settings cannot be loaded
   */
  abstract loadSettings(): Promise<TaskSyncSettings>;

  /**
   * Load and initialize extensions after the host environment is fully ready.
   * This should be called after the host's layout/workspace is ready and
   * all necessary APIs are available for extension operations.
   *
   * @throws Error if extension loading fails
   */
  abstract load(): Promise<void>;

  /**
   * Persist TaskSync settings to the host's storage system.
   * For ObsidianHost, this saves to Obsidian's plugin data storage.
   *
   * @param settings - The TaskSync settings object to persist
   * @throws Error if settings cannot be saved
   */
  abstract saveSettings(settings: TaskSyncSettings): Promise<void>;

  /**
   * Persist TaskSync application data to the host's storage system.
   * This stores the canonical, high-level data structures that include complete
   * metadata like IDs, source information, and full entity state.
   *
   * @param data - The TaskSync application data to persist
   * @throws Error if data cannot be saved
   */
  abstract saveData(data: any): Promise<void>;

  /**
   * Load TaskSync application data from the host's persistence storage.
   * This loads the canonical, high-level data structures that include complete
   * metadata like IDs, source information, and full entity state.
   *
   * @returns Promise resolving to the TaskSync application data
   * @throws Error if data cannot be loaded
   */
  abstract loadData(): Promise<any>;

  /**
   * Open a file in the host environment.
   * For ObsidianHost, this opens the file in Obsidian's workspace.
   *
   * @param entity - The entity with a file associated
   * @throws Error if file cannot be opened
   */
  abstract openFile(entity: Area | Project | Task): Promise<void>;

  /**
   * Show a notice to the user.
   * For ObsidianHost, this uses Obsidian's Notice API.
   *
   * @param message - The message to display
   * @param duration - Duration in milliseconds (default: 5000)
   */
  abstract showNotice(message: string, duration?: number): void;

  /**
   * Lifecycle callback that runs when TaskSync initializes in the host environment.
   * This is where the host can perform any necessary setup operations.
   *
   * @throws Error if initialization fails
   */
  abstract onload(): Promise<void>;

  /**
   * Lifecycle callback that runs when TaskSync unloads from the host environment.
   * This is where the host can perform any necessary cleanup operations.
   *
   * @throws Error if cleanup fails
   */
  abstract onunload(): Promise<void>;

  /**
   * Get an extension by its ID.
   *
   * @param extensionId - The ID of the extension to retrieve
   * @returns The extension instance, or undefined if not found
   */
  abstract getExtensionById(id: string): Extension | undefined;

  /**
   * Get the current file context from the ContextExtension.
   * This provides a clean interface for components to access context without
   * directly depending on the ContextExtension or context store.
   *
   * @returns The current file context
   */
  getCurrentContext(): FileContext {
    const contextExtension = this.getExtensionById("context") as any;
    if (contextExtension && contextExtension.getCurrentContext) {
      return contextExtension.getCurrentContext();
    }
    return { type: "none" };
  }

  /**
   * Get the TaskSync application instance.
   * This provides access to the app for testing and advanced operations.
   *
   * @returns The TaskSync application instance
   */
  abstract getApp(): any;
}
