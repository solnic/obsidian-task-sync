/**
 * E2E Test Helpers for Entity Creation
 * Leverages the plugin's automatic entity caching system
 */

import type { SharedTestContext } from "./shared-context";

/**
 * Create a task using the plugin's createTask API
 * Returns the cached entity from the plugin's storage service
 */
export async function createTask(
  context: SharedTestContext,
  props: {
    title: string;
    category?: string;
    priority?: string;
    areas?: string[];
    project?: string;
    done?: boolean;
    status?: string;
    parentTask?: string;
    tags?: string[];
  },
  content: string = ""
): Promise<any> {
  return await context.page.evaluate(
    async ({ props, content }) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      await plugin.createTask(Object.assign(props, { content }));

      // Wait for file system to settle
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Force a store refresh and wait for it
      await plugin.waitForStoreRefresh();
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Try to get the task from the store
      let createdTask = null;
      let attempts = 0;
      const maxAttempts = 10;

      while (!createdTask && attempts < maxAttempts) {
        const cachedTasks = plugin.getCachedTasks();
        createdTask = cachedTasks.find((t: any) => t.title === props.title);

        if (!createdTask) {
          await plugin.waitForStoreRefresh();
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        attempts++;
      }

      if (!createdTask) {
        // If still not found, try to find the file directly
        const taskPath = `Tasks/${props.title}.md`;
        const file = app.vault.getAbstractFileByPath(taskPath);
        if (file) {
          // File exists, create a minimal task object
          createdTask = {
            id: props.title.replace(/\s+/g, ""),
            title: props.title,
            filePath: taskPath,
            file: file,
            ...props,
          };
        } else {
          const cachedTasks = plugin.getCachedTasks();
          throw new Error(
            `Task "${
              props.title
            }" was not found in cache after creation. Available tasks: ${cachedTasks
              .map((t: any) => t.title)
              .join(", ")}. File exists: ${!!file}`
          );
        }
      }

      return createdTask;
    },
    { props, content }
  );
}

/**
 * Create an area using the plugin's createArea API
 * Returns the cached entity from the plugin's storage service
 */
export async function createArea(
  context: SharedTestContext,
  props: {
    name: string;
    description?: string;
  }
): Promise<any> {
  return await context.page.evaluate(
    async ({ props }) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      if (!plugin) {
        throw new Error("Task Sync plugin not found");
      }

      await plugin.createArea(props);
      await plugin.waitForStoreRefresh();

      const cachedAreas = plugin.getCachedAreas();
      const createdArea = cachedAreas.find((a: any) => a.name === props.name);

      if (!createdArea) {
        throw new Error(
          `Area "${props.name}" was not found in cache after creation`
        );
      }

      return createdArea;
    },
    { props }
  );
}

/**
 * Create a project using the plugin's createProject API
 * Returns the cached entity from the plugin's storage service
 */
export async function createProject(
  context: SharedTestContext,
  props: {
    name: string;
    description?: string;
    areas?: string[];
  }
): Promise<any> {
  return await context.page.evaluate(
    async ({ props }) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      if (!plugin) {
        throw new Error("Task Sync plugin not found");
      }

      await plugin.createProject(props);
      await plugin.waitForStoreRefresh();

      const cachedProjects = plugin.getCachedProjects();
      const createdProject = cachedProjects.find(
        (p: any) => p.name === props.name
      );

      if (!createdProject) {
        throw new Error(
          `Project "${props.name}" was not found in cache after creation`
        );
      }

      return createdProject;
    },
    { props }
  );
}
