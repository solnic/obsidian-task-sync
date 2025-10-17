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
    ({ title }) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      // Use the public query API
      return plugin.query.findTaskByTitle(title);
    },
    { title }
  );
}

/**
 * Get persisted task data by title from plugin storage
 */
export async function getPersistedTaskByTitle(
  page: ExtendedPage,
  title: string
) {
  return await page.evaluate(
    async ({ title }: { title: string }) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];
      const data = await plugin.loadData();
      return data?.entities?.tasks?.find((t: any) => t.title === title);
    },
    { title }
  );
}

/**
 * Create a task with custom source properties (for testing external integrations)
 */
export async function createTaskWithSource(
  page: ExtendedPage,
  taskData: {
    title: string;
    description?: string;
    category?: string;
    priority?: string;
    status?: string;
    source: {
      extension: string;
      keys?: Record<string, string>;
      data?: any;
    };
  }
): Promise<any> {
  return await page.evaluate(
    async ({ taskData }) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      const createdTask = await plugin.operations.taskOperations.create(
        taskData
      );

      return createdTask;
    },
    { taskData }
  );
}

export async function getProjectByName(page: ExtendedPage, name: string) {
  return await page.evaluate(
    ({ name }) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      // Use the public query API
      return plugin.query.findProjectByName(name);
    },
    { name }
  );
}

export async function getAreaByName(page: ExtendedPage, name: string) {
  return await page.evaluate(
    ({ name }) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      // Use the public query API
      return plugin.query.findAreaByName(name);
    },
    { name }
  );
}

/**
 * Wait for a task to be removed from the store
 * This is useful for testing revert operations where we expect the task to be deleted
 * Uses TaskQueryService.findByTitle for consistency with other query operations
 */
export async function waitForTaskToBeRemoved(
  page: ExtendedPage,
  title: string,
  timeout: number = 5000
) {
  await page.waitForFunction(
    ({ title }) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      // Use the public query API for consistency
      const task = plugin.query.findTaskByTitle(title);

      // Return true when task is NOT found (removed)
      // findTaskByTitle returns undefined when not found
      return task === undefined;
    },
    { title },
    { timeout }
  );
}

export async function waitForTaskUpdated(
  page: ExtendedPage,
  title: string,
  changes: any,
  timeout: number = 5000
) {
  await page.waitForFunction(
    ({ title, changes }) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      // Use the public query API for consistency
      const task = plugin.query.findTaskByTitle(title);

      // Return true when task has changes applied
      return (
        task !== undefined &&
        Object.keys(changes).every((key) => {
          return task[key] === changes[key];
        })
      );
    },
    { title, changes },
    { timeout }
  );

  return getTaskByTitle(page, title);
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
