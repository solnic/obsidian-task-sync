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
  taskData: {
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
  }
): Promise<any> {
  return await page.evaluate(
    async ({ taskData }) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      const taskOperations = plugin.operations.taskOperations;
      const createdTask = await taskOperations.create(taskData);

      console.debug("Task created:", createdTask);

      return createdTask;
    },
    { taskData }
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
