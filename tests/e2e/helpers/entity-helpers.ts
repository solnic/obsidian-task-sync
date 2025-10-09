/**
 * E2E Test Helpers for Entity Creation
 * Leverages the plugin's automatic entity caching system
 */

import type { ExtendedPage } from "./global";
import { waitForFileCreation } from "./global";

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
    doDate?: string;
  }
): Promise<any> {
  return await page.evaluate(
    async ({ taskData }) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      const taskOperations = plugin.operations.taskOperations;
      const createdTask = await taskOperations.create(taskData);

      return createdTask;
    },
    { taskData }
  );
}

export async function getTaskByTitle(page: ExtendedPage, title: string) {
  return await page.evaluate(
    async ({ title }) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      const task = await plugin.stores.taskStore.findByTitle(title);

      return task;
    },
    { title }
  );
}

/**
 * Wait for a task to be removed from the store
 * This is useful for testing revert operations where we expect the task to be deleted
 */
export async function waitForTaskToBeRemoved(
  page: ExtendedPage,
  title: string,
  timeout: number = 5000
) {
  await page.waitForFunction(
    async ({ title }) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      const task = await plugin.stores.taskStore.findByTitle(title);

      // Return true when task is undefined (removed)
      return task === undefined;
    },
    { title },
    { timeout }
  );
}

/**
 * Create an area using the TypeNote system
 * Returns the created entity directly from the plugin
 */
export async function createArea(
  page: ExtendedPage,
  props: {
    name: string;
    description?: string;
  }
): Promise<any> {
  const createdArea = await page.evaluate(
    async ({ props }) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      // Use entity operations to create area (triggers event → ObsidianExtension creates note)
      const areaData = {
        name: props.name,
        description: props.description,
        tags: [],
      };

      const createdArea = await plugin.operations.areaOperations.create(
        areaData
      );

      return createdArea;
    },
    { props }
  );

  // Wait for the file to be created
  await waitForFileCreation(page, `Areas/${props.name}.md`);

  return createdArea;
}

/**
 * Create a project using the TypeNote system
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
  const createdProject = await page.evaluate(
    async ({ props }) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      if (!plugin) {
        throw new Error("Task Sync plugin not found");
      }

      // Use entity operations to create project (triggers event → ObsidianExtension creates note)
      const projectData = {
        name: props.name,
        description: props.description,
        areas: props.areas || [],
        tags: [],
      };

      const createdProject = await plugin.operations.projectOperations.create(
        projectData
      );

      return createdProject;
    },
    { props }
  );

  // Wait for the file to be created
  await waitForFileCreation(page, `Projects/${props.name}.md`);

  return createdProject;
}
