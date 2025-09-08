/**
 * TaskFileManager Service
 * Concrete implementation of FileManager for task-specific file operations
 * Handles task file creation, status changes, project/area assignments, and task-specific operations
 */

import { App, Vault } from 'obsidian';
import { TaskSyncSettings } from '../main';
import { FileManager, FileCreationData } from './FileManager';
import { generateTaskFrontMatter } from './base-definitions/FrontMatterGenerator';

/**
 * Interface for task creation data
 */
export interface TaskCreationData extends FileCreationData {
  title: string;
  type?: string;
  priority?: string;
  areas?: string | string[];
  project?: string;
  done?: boolean;
  status?: string;
  parentTask?: string;
  subTasks?: string[];
  tags?: string[];
}

/**
 * TaskFileManager - Handles all task file operations
 * Extends the abstract FileManager with task-specific functionality
 */
export class TaskFileManager extends FileManager {

  constructor(app: App, vault: Vault, settings: TaskSyncSettings) {
    super(app, vault, settings);
  }

  /**
   * Create a task file with proper front-matter structure
   * @param data - Task creation data
   * @returns Path of the created task file
   */
  async createTaskFile(data: TaskCreationData): Promise<string> {
    const taskFolder = this.settings.tasksFolder;

    // Normalize areas to string for compatibility with existing interface
    const normalizedAreas = Array.isArray(data.areas) ? data.areas.join(', ') : (data.areas || '');

    // Generate front-matter using existing FrontMatterGenerator
    const frontMatter = generateTaskFrontMatter({
      name: data.title,
      category: data.type,
      priority: data.priority,
      areas: normalizedAreas,
      project: data.project,
      done: data.done,
      status: data.status,
      parentTask: data.parentTask,
      subTasks: data.subTasks,
      tags: data.tags,
      description: data.description
    });

    // Create content with front-matter and optional description
    const content = `---
${frontMatter}
---

${data.description || ''}`;

    return await this.createFile(taskFolder, data.title, content);
  }

  /**
   * Implementation of abstract createEntityFile method
   * @param data - File creation data
   * @returns Path of the created file
   */
  async createEntityFile(data: FileCreationData): Promise<string> {
    if (this.isTaskCreationData(data)) {
      return await this.createTaskFile(data);
    }
    throw new Error('Invalid data type for TaskFileManager');
  }

  /**
   * Type guard to check if data is TaskCreationData
   */
  private isTaskCreationData(data: FileCreationData): data is TaskCreationData {
    return 'title' in data;
  }

  /**
   * Change task status - supports both Done boolean and Status string
   * @param filePath - Path to the task file
   * @param status - Either boolean (for Done property) or string (for Status property)
   */
  async changeTaskStatus(filePath: string, status: boolean | string): Promise<void> {
    if (typeof status === 'boolean') {
      await this.updateProperty(filePath, 'Done', status);
    } else {
      await this.updateProperty(filePath, 'Status', status);
    }
  }

  /**
   * Assign task to a project
   * @param filePath - Path to the task file
   * @param projectName - Name of the project to assign to
   */
  async assignToProject(filePath: string, projectName: string): Promise<void> {
    // Format project as link
    const formattedProject = projectName.startsWith('[[') && projectName.endsWith(']]')
      ? projectName
      : `[[${projectName}]]`;
    await this.updateProperty(filePath, 'Project', formattedProject);
  }

  /**
   * Assign task to areas
   * @param filePath - Path to the task file
   * @param areas - Array of area names to assign to
   */
  async assignToAreas(filePath: string, areas: string[]): Promise<void> {
    // Format areas as links
    const formattedAreas = areas.map(area => {
      // Don't double-format if already a link
      if (area.startsWith('[[') && area.endsWith(']]')) {
        return area;
      }
      return `[[${area}]]`;
    });
    await this.updateProperty(filePath, 'Areas', formattedAreas);
  }

  /**
   * Set task priority
   * @param filePath - Path to the task file
   * @param priority - Priority level (Low, Medium, High, Critical)
   */
  async setTaskPriority(filePath: string, priority: string): Promise<void> {
    await this.updateProperty(filePath, 'Priority', priority);
  }

  /**
   * Set task type
   * @param filePath - Path to the task file
   * @param type - Task type (Task, Bug, Feature, Improvement, Chore)
   */
  async setTaskType(filePath: string, type: string): Promise<void> {
    await this.updateProperty(filePath, 'Type', type);
  }

  /**
   * Add tags to task
   * @param filePath - Path to the task file
   * @param tags - Array of tags to add
   */
  async addTags(filePath: string, tags: string[]): Promise<void> {
    const currentFrontMatter = await this.loadFrontMatter(filePath);
    const currentTags = currentFrontMatter.tags || [];
    const newTags = [...new Set([...currentTags, ...tags])]; // Remove duplicates
    await this.updateProperty(filePath, 'tags', newTags);
  }

  /**
   * Remove tags from task
   * @param filePath - Path to the task file
   * @param tagsToRemove - Array of tags to remove
   */
  async removeTags(filePath: string, tagsToRemove: string[]): Promise<void> {
    const currentFrontMatter = await this.loadFrontMatter(filePath);
    const currentTags = currentFrontMatter.tags || [];
    const newTags = currentTags.filter((tag: string) => !tagsToRemove.includes(tag));
    await this.updateProperty(filePath, 'tags', newTags);
  }

  /**
   * Set parent task
   * @param filePath - Path to the task file
   * @param parentTaskName - Name of the parent task
   */
  async setParentTask(filePath: string, parentTaskName: string): Promise<void> {
    const parentTaskLink = parentTaskName ? `[[${parentTaskName}]]` : '';
    await this.updateProperty(filePath, 'Parent task', parentTaskLink);
  }

  /**
   * Add sub-task
   * @param filePath - Path to the task file
   * @param subTaskName - Name of the sub-task to add
   */
  async addSubTask(filePath: string, subTaskName: string): Promise<void> {
    const currentFrontMatter = await this.loadFrontMatter(filePath);
    const currentSubTasks = currentFrontMatter['Sub-tasks'] || [];
    const subTaskLink = `[[${subTaskName}]]`;

    if (!currentSubTasks.includes(subTaskLink)) {
      const newSubTasks = [...currentSubTasks, subTaskLink];
      await this.updateProperty(filePath, 'Sub-tasks', newSubTasks);
    }
  }

  /**
   * Remove sub-task
   * @param filePath - Path to the task file
   * @param subTaskName - Name of the sub-task to remove
   */
  async removeSubTask(filePath: string, subTaskName: string): Promise<void> {
    const currentFrontMatter = await this.loadFrontMatter(filePath);
    const currentSubTasks = currentFrontMatter['Sub-tasks'] || [];
    const subTaskLink = `[[${subTaskName}]]`;
    const newSubTasks = currentSubTasks.filter((task: string) => task !== subTaskLink);
    await this.updateProperty(filePath, 'Sub-tasks', newSubTasks);
  }

  /**
   * Get task summary information
   * @param filePath - Path to the task file
   * @returns Task summary object
   */
  async getTaskSummary(filePath: string): Promise<{
    title: string;
    type: string;
    priority: string;
    done: boolean;
    status: string;
    project: string;
    areas: string[];
    tags: string[];
    parentTask: string;
    subTasks: string[];
  }> {
    const frontMatter = await this.loadFrontMatter(filePath);

    return {
      title: frontMatter.Title || '',
      type: frontMatter.Type || '',
      priority: frontMatter.Priority || '',
      done: frontMatter.Done || false,
      status: frontMatter.Status || '',
      project: frontMatter.Project || '',
      areas: frontMatter.Areas || [],
      tags: frontMatter.tags || [],
      parentTask: frontMatter['Parent task'] || '',
      subTasks: frontMatter['Sub-tasks'] || []
    };
  }

  /**
   * Check if task is completed
   * @param filePath - Path to the task file
   * @returns True if task is done, false otherwise
   */
  async isTaskCompleted(filePath: string): Promise<boolean> {
    const frontMatter = await this.loadFrontMatter(filePath);
    return frontMatter.Done === true;
  }

  /**
   * Get all tasks in the tasks folder
   * @returns Array of task file paths
   */
  async getAllTaskFiles(): Promise<string[]> {
    const taskFolder = this.settings.tasksFolder || 'Tasks';
    const allFiles = this.app.vault.getMarkdownFiles();

    return allFiles
      .filter(file => file.path.startsWith(taskFolder + '/'))
      .map(file => file.path);
  }

  /**
   * Search tasks by criteria
   * @param criteria - Search criteria
   * @returns Array of matching task file paths
   */
  async searchTasks(criteria: {
    type?: string;
    priority?: string;
    done?: boolean;
    status?: string;
    project?: string;
    areas?: string[];
    tags?: string[];
  }): Promise<string[]> {
    const allTaskFiles = await this.getAllTaskFiles();
    const matchingTasks: string[] = [];

    for (const taskPath of allTaskFiles) {
      try {
        const frontMatter = await this.loadFrontMatter(taskPath);

        // Check each criteria
        if (criteria.type && frontMatter.Type !== criteria.type) continue;
        if (criteria.priority && frontMatter.Priority !== criteria.priority) continue;
        if (criteria.done !== undefined && frontMatter.Done !== criteria.done) continue;
        if (criteria.status && frontMatter.Status !== criteria.status) continue;
        if (criteria.project && frontMatter.Project !== criteria.project) continue;

        if (criteria.areas && criteria.areas.length > 0) {
          const taskAreas = frontMatter.Areas || [];
          if (!criteria.areas.some(area => taskAreas.includes(area))) continue;
        }

        if (criteria.tags && criteria.tags.length > 0) {
          const taskTags = frontMatter.tags || [];
          if (!criteria.tags.some(tag => taskTags.includes(tag))) continue;
        }

        matchingTasks.push(taskPath);
      } catch (error) {
        console.warn(`Failed to process task file ${taskPath}:`, error);
      }
    }

    return matchingTasks;
  }
}
