/**
 * E2E Test Helpers for Entity Creation
 * Leverages the plugin's automatic entity caching system
 */

import type { ExtendedPage } from "./global";

export async function updateEntity(
  page: ExtendedPage,
  entity: any,
  props: any
) {
  return await page.evaluate(
    async ({ entity, props }) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      await plugin.noteManagers.update(entity, props);
    },
    { entity, props }
  );
}

/**
 * Create a task using the plugin's createTask API
 * Returns the created entity directly from the plugin
 */
export async function createTask(
  page: ExtendedPage,
  props: {
    title: string;
    description?: string;
    category?: string;
    priority?: string;
    areas?: string[];
    project?: string;
    done?: boolean;
    status?: string;
    parentTask?: string;
    tags?: string[];
    dueDate?: string;
  },
  content: string = ""
): Promise<any> {
  return await page.evaluate(
    async ({ props, content }) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      if (!plugin) {
        throw new Error("Task Sync plugin not found");
      }

      // Access the taskSyncApp and use the new architecture
      const taskSyncApp = plugin.taskSyncApp;

      if (!taskSyncApp || !taskSyncApp.isInitialized()) {
        throw new Error("TaskSync app is not initialized");
      }

      // Access the global taskOperations that we exposed through the plugin
      const taskOperations = plugin.operations.taskOperations;

      if (!taskOperations) {
        throw new Error("taskOperations not available on plugin");
      }

      // Prepare task data in the format expected by the new architecture
      const taskData = {
        title: props.title,
        description: props.description || content || "",
        category: props.category || "",
        priority: props.priority || "",
        areas: props.areas || [],
        project: props.project || "",
        done: props.done || false,
        status: props.status || "Not Started",
        parentTask: props.parentTask || "",
        tags: props.tags || [],
        doDate: props.dueDate ? new Date(props.dueDate) : undefined,
        dueDate: props.dueDate ? new Date(props.dueDate) : undefined,
      };

      // Create task using the new architecture
      const createdTask = await taskOperations.create(taskData);

      if (!createdTask) {
        throw new Error(`Failed to create task "${props.title}"`);
      }

      return createdTask;
    },
    { props, content }
  );
}

/**
 * Create an area using the plugin's createArea API
 * Returns the created entity directly from the plugin
 */
export async function createArea(
  page: ExtendedPage,
  props: {
    name: string;
    description?: string;
  }
): Promise<any> {
  return await page.evaluate(
    async ({ props }) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      if (!plugin) {
        throw new Error("Task Sync plugin not found");
      }

      // Create area and get the created entity directly
      const createdArea = await plugin.createArea(props);

      if (!createdArea) {
        throw new Error(`Failed to create area "${props.name}"`);
      }

      return createdArea;
    },
    { props }
  );
}

/**
 * Create a project using the plugin's createProject API
 * Returns the created entity directly from the plugin
 */
export async function createProject(
  page: ExtendedPage,
  props: {
    name: string;
    description?: string;
    areas?: string[];
  }
): Promise<any> {
  return await page.evaluate(
    async ({ props }) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      if (!plugin) {
        throw new Error("Task Sync plugin not found");
      }

      // Create project and get the created entity directly
      const createdProject = await plugin.createProject(props);

      if (!createdProject) {
        throw new Error(`Failed to create project "${props.name}"`);
      }

      return createdProject;
    },
    { props }
  );
}
