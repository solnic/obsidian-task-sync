/**
 * E2E Test Helpers for Entity Creation
 * Provides high-level helpers that leverage main.ts APIs for creating tasks, areas, and projects
 * with smart waiting for base file creation and proper event handling
 */

import type { SharedTestContext } from './shared-context';

/**
 * Create a task using the plugin's createTask API
 * @param context Test context
 * @param props Task properties
 * @param content Optional task content (default: empty string)
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
): Promise<string> {
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

    // Create the task using the plugin API
    await plugin.createTask(taskData);

    // Return the expected file path
    const sanitizedTitle = props.title.replace(/[<>:"/\\|?*]/g, '-');
    return `Tasks/${sanitizedTitle}.md`;
  }, { props, content });
}

/**
 * Create an area using the plugin's createArea API with smart waiting for base creation
 * @param context Test context
 * @param props Area properties
 */
export async function createArea(
  context: SharedTestContext,
  props: {
    name: string;
    description?: string;
  }
): Promise<string> {
  const areaPath = await context.page.evaluate(async ({ props }) => {
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

    // Create the area using the plugin API
    await plugin.createArea(areaData);

    // Return the expected file path
    const sanitizedName = props.name.replace(/[<>:"/\\|?*]/g, '-');
    return `Areas/${sanitizedName}.md`;
  }, { props });

  // Smart wait for base file creation if area bases are enabled
  await waitForBaseFileCreation(context, props.name, 'area');

  return areaPath;
}

/**
 * Create a project using the plugin's createProject API with smart waiting for base creation
 * @param context Test context
 * @param props Project properties
 */
export async function createProject(
  context: SharedTestContext,
  props: {
    name: string;
    description?: string;
    areas?: string[];
  }
): Promise<string> {
  const projectPath = await context.page.evaluate(async ({ props }) => {
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

    // Create the project using the plugin API
    await plugin.createProject(projectData);

    // Return the expected file path
    const sanitizedName = props.name.replace(/[<>:"/\\|?*]/g, '-');
    return `Projects/${sanitizedName}.md`;
  }, { props });

  // Smart wait for base file creation if project bases are enabled
  await waitForBaseFileCreation(context, props.name, 'project');

  return projectPath;
}

/**
 * Smart wait for base file creation
 * Waits for the corresponding base file to be created when areas/projects/parent tasks are created
 * @param context Test context
 * @param entityName Name of the entity (area, project, or parent task)
 * @param entityType Type of entity ('area', 'project', 'parent-task')
 */
async function waitForBaseFileCreation(
  context: SharedTestContext,
  entityName: string,
  entityType: 'area' | 'project' | 'parent-task' = 'area'
): Promise<void> {
  // Check if bases are enabled and wait for base file creation
  const baseFileCreated = await context.page.evaluate(async ({ name, type }) => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins['obsidian-task-sync'];

    if (!plugin) {
      return false;
    }

    // Check if the relevant bases are enabled
    const areaBasesEnabled = plugin.settings.areaBasesEnabled;
    const projectBasesEnabled = plugin.settings.projectBasesEnabled;

    if (type === 'area' && !areaBasesEnabled) {
      return true; // No area bases to wait for
    }
    if (type === 'project' && !projectBasesEnabled) {
      return true; // No project bases to wait for
    }
    // Parent task bases are always created when needed

    // Sanitize the name for file path
    const sanitizedName = name.replace(/[<>:"/\\|?*]/g, '-');
    const baseFilePath = `${plugin.settings.basesFolder}/${sanitizedName}.base`;

    // Wait for the base file to exist
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds with 100ms intervals

    while (attempts < maxAttempts) {
      const baseFile = app.vault.getAbstractFileByPath(baseFilePath);
      if (baseFile) {
        console.log(`Base file created: ${baseFilePath}`);
        return true;
      }

      // Wait 100ms before next attempt
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    console.warn(`Base file not created within timeout: ${baseFilePath}`);
    return false;
  }, { name: entityName, type: entityType });

  if (!baseFileCreated) {
    console.warn(`Base file creation timeout for ${entityType}: ${entityName}`);
  }
}

/**
 * Create a parent task using the plugin's createTask API with smart waiting for base creation
 * Parent tasks are tasks that can have child tasks and automatically get base files created
 * @param context Test context
 * @param props Parent task properties
 * @param content Optional task content (default: empty string)
 */
export async function createParentTask(
  context: SharedTestContext,
  props: {
    title: string;
    category?: string;
    priority?: string;
    areas?: string[];
    project?: string;
    done?: boolean;
    status?: string;
    tags?: string[];
  },
  content: string = ''
): Promise<string> {
  // Ensure the task will be treated as a parent task by using 'Feature' category
  // or by including 'Epic' in the title (based on TaskFileManager logic)
  const parentProps = {
    ...props,
    category: props.category || 'Feature' // Feature category triggers parent task behavior
  };

  // For parent tasks, append {{tasks}} section to custom content
  let finalContent: string | undefined = undefined;

  if (content) {
    // Simply append the {{tasks}} section to the custom content
    finalContent = content + '\n\n## Related Tasks\n\n{{tasks}}';
  }

  const taskPath = await createTask(context, parentProps, finalContent);

  // Smart wait for parent task base file creation
  await waitForBaseFileCreation(context, props.title, 'parent-task');

  return taskPath;
}
