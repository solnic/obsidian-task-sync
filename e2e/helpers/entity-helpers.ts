/**
 * E2E Test Helpers for Entity Creation
 * Leverages the plugin's automatic entity caching system
 */

import type { SharedTestContext } from './shared-context';

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
  content: string = ''
): Promise<any> {
  return await context.page.evaluate(async ({ props, content }) => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins['obsidian-task-sync'];

    if (!plugin) {
      throw new Error('Task Sync plugin not found');
    }

    // Convert props to the format expected by createTask
    const taskData = {
      title: props.title,
      category: props.category,
      priority: props.priority,
      areas: props.areas?.join(', ') || '',
      project: props.project,
      done: props.done || false,
      status: props.status || 'Backlog',
      parentTask: props.parentTask,
      tags: props.tags || [],
      description: content
    };

    // Create the task using the plugin API (this will trigger automatic caching)
    await plugin.createTask(taskData);

    // Wait a bit for the event system to process the creation
    await new Promise(resolve => setTimeout(resolve, 100));

    // Get the cached task from storage service
    const cachedTasks = plugin.storageService.getCachedTasks();
    const createdTask = cachedTasks.find((t: any) => t.name === props.title);

    if (!createdTask) {
      throw new Error(`Task "${props.title}" was not found in cache after creation`);
    }

    return createdTask;
  }, { props, content });
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
  return await context.page.evaluate(async ({ props }) => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins['obsidian-task-sync'];

    if (!plugin) {
      throw new Error('Task Sync plugin not found');
    }

    // Convert props to the format expected by createArea
    const areaData = {
      name: props.name,
      description: props.description || ''
    };

    // Create the area using the plugin API (this will trigger automatic caching)
    await plugin.createArea(areaData);

    // Wait a bit for the event system to process the creation
    await new Promise(resolve => setTimeout(resolve, 100));

    // Get the cached area from storage service
    const cachedAreas = plugin.storageService.getCachedAreas();
    const createdArea = cachedAreas.find((a: any) => a.name === props.name);

    if (!createdArea) {
      throw new Error(`Area "${props.name}" was not found in cache after creation`);
    }

    return createdArea;
  }, { props });
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
  return await context.page.evaluate(async ({ props }) => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins['obsidian-task-sync'];

    if (!plugin) {
      throw new Error('Task Sync plugin not found');
    }

    // Convert props to the format expected by createProject
    const projectData = {
      name: props.name,
      description: props.description || '',
      areas: props.areas || []
    };

    // Create the project using the plugin API (this will trigger automatic caching)
    await plugin.createProject(projectData);

    // Wait a bit for the event system to process the creation
    await new Promise(resolve => setTimeout(resolve, 100));

    // Get the cached project from storage service
    const cachedProjects = plugin.storageService.getCachedProjects();
    const createdProject = cachedProjects.find((p: any) => p.name === props.name);

    if (!createdProject) {
      throw new Error(`Project "${props.name}" was not found in cache after creation`);
    }

    return createdProject;
  }, { props });
}
