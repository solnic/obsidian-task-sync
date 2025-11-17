/**
 * E2E Test Helpers for Entity Creation
 * Leverages the plugin's automatic entity caching system
 */

import type { ExtendedPage } from "./global";
import { waitForFileCreation } from "./global";

export async function updateEntity(
  page: ExtendedPage,
  entity: unknown,
  props: Record<string, unknown>
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
    source?: {
      extension: string;
      keys: Record<string, string>;
      data?: any;
    };
  }
): Promise<any> {
  return await page.evaluate(
    async ({ taskData }) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      // Use plugin operations which will properly set the source
      const createdTask = await plugin.operations.task.create(taskData);

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
 * Get all tasks from the task store
 */
export async function getAllTasks(page: ExtendedPage) {
  return await page.evaluate(() => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins["obsidian-task-sync"];

    // Use the public query API
    return plugin.query.getAllTasks();
  });
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
      return data?.entities?.tasks?.find((t: { title: string }) => t.title === title);
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
  changes: Record<string, unknown>,
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
 * Wait for a project to be removed from the store
 * This is useful for testing deletion operations where we expect the project to be deleted
 */
export async function waitForProjectToBeRemoved(
  page: ExtendedPage,
  name: string,
  timeout: number = 5000
) {
  await page.waitForFunction(
    ({ name }) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      // Use the public query API for consistency
      const project = plugin.query.findProjectByName(name);

      // Return true when project is NOT found (removed)
      return project === undefined;
    },
    { name },
    { timeout }
  );
}

/**
 * Wait for an area to be removed from the store
 * This is useful for testing deletion operations where we expect the area to be deleted
 */
export async function waitForAreaToBeRemoved(
  page: ExtendedPage,
  name: string,
  timeout: number = 5000
) {
  await page.waitForFunction(
    ({ name }) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      // Use the public query API for consistency
      const area = plugin.query.findAreaByName(name);

      // Return true when area is NOT found (removed)
      return area === undefined;
    },
    { name },
    { timeout }
  );
}

/**
 * Create an area using the NoteKit system
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

      // Use plugin operations which will properly set the source
      const areaData = {
        name: props.name,
        description: props.description,
        tags: [] as string[],
      };

      const createdArea = await plugin.operations.area.create(areaData);

      return createdArea;
    },
    { props }
  );

  // Wait for the file to be created
  await waitForFileCreation(page, `Areas/${props.name}.md`);

  return createdArea;
}

/**
 * Create a project using the NoteKit system
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

      // Use plugin operations which will properly set the source
      const projectData = {
        name: props.name,
        description: props.description,
        areas: props.areas || [],
        tags: [] as string[],
      };

      const createdProject = await plugin.operations.project.create(
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

/**
 * Create a task entity directly in the store and data.json WITHOUT creating a file
 * This is useful for testing file recreation scenarios where an entity exists but its file is missing
 */
export async function createTaskEntityWithoutFile(
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
    filePath: string; // The file path to set in source.keys.obsidian (file won't be created)
  }
): Promise<any> {
  // Generate ID in Node.js context
  const { ulid } = await import("ulid");
  const taskId = ulid();

  return await page.evaluate(
    async ({ taskData, taskId }) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      // Create the task entity
      const task = {
        id: taskId,
        title: taskData.title,
        description: taskData.description || "",
        category: taskData.category || "Task",
        priority: taskData.priority || "",
        areas: taskData.areas || [],
        project: taskData.project || "",
        done: taskData.done || false,
        status: taskData.status || "Backlog",
        tags: [] as string[],
        createdAt: new Date(),
        updatedAt: new Date(),
        source: {
          extension: "obsidian",
          keys: {
            obsidian: taskData.filePath,
          },
        },
      };

      // Load current data
      const pluginData = (await plugin.loadData()) || {};
      const entities = pluginData.entities || {};
      const tasks = entities.tasks || [];

      // Add the task to the entities
      tasks.push(task);

      // Save back to data.json
      pluginData.entities = {
        ...entities,
        tasks,
      };
      await plugin.saveData(pluginData);

      // Also add to the task store directly so it's immediately available
      // Access the taskStore from the plugin's stores property
      if (plugin.stores && plugin.stores.taskStore) {
        plugin.stores.taskStore.dispatch({
          type: "ADD_TASK",
          task,
        });
      }

      return task;
    },
    { taskData, taskId }
  );
}
