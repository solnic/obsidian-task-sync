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
      await plugin.waitForStoreRefresh();

      const cachedTasks = plugin.getCachedTasks();
      const createdTask = cachedTasks.find((t: any) => t.title === props.title);

      if (!createdTask) {
        throw new Error(
          `Task "${props.title}" was not found in cache after creation`
        );
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
