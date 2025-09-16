/**
 * E2E Test Helpers for Entity Creation
 * Leverages the plugin's automatic entity caching system
 */

import type { SharedTestContext } from "./shared-context";

/**
 * Create a task using the plugin's createTask API
 * Returns the created entity directly from the plugin
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
    dueDate?: string;
  },
  content: string = ""
): Promise<any> {
  return await context.page.evaluate(
    async ({ props, content }) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins["obsidian-task-sync"];

      // Create task and get the created entity directly
      const createdTask = await plugin.createTask(
        Object.assign(props, { content })
      );

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
