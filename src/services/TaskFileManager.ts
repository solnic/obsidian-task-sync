/**
 * TaskFileManager Service
 * Concrete implementation of FileManager for task-specific file operations
 * Handles task file creation, status changes, project/area assignments, and task-specific operations
 */

import { App, Vault, TFile } from "obsidian";
import { TaskSyncSettings } from "../main";
import { FileManager, FileCreationData } from "./FileManager";
import { PROPERTY_REGISTRY } from "../types/properties";
import { PROPERTY_SETS } from "./base-definitions/BaseConfigurations";
import { Task, TaskUtils } from "../types/entities";
import { createWikiLink, createLinkFormat } from "../utils/linkUtils";
import moment from "moment";

/**
 * Interface for task creation data
 */
export interface TaskCreationData extends FileCreationData {
  title: string;
  priority?: string;
  areas?: string | string[];
  project?: string;
  done?: boolean;
  status?: string;
  parentTask?: string;
  doDate?: Date;
  dueDate?: Date;
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
   * @param content - Optional file content that may contain {{tasks}} variable. If not provided, reads from template.
   * @returns Path of the created task file
   */
  async createTaskFile(
    data: TaskCreationData,
    content?: string
  ): Promise<string> {
    const taskFolder = this.settings.tasksFolder;

    // Get content from template if not provided
    let fileContent = content;
    if (!fileContent) {
      fileContent = await this.getTaskTemplateContent(data);
    }

    // Process {{tasks}} variable in content before creating file
    const processedContent = this.processTasksVariable(fileContent, data.title);

    const filePath = await this.createFile(
      taskFolder,
      data.title,
      processedContent
    );
    const frontMatterData = this.generateTaskFrontMatterObject(data);

    await this.updateFrontMatter(filePath, frontMatterData);

    // If this is a parent task, create the corresponding base file
    if (this.shouldUseParentTaskTemplate(data)) {
      const { BaseManager } = await import("./BaseManager");
      const baseManager = new BaseManager(this.app, this.vault, this.settings);
      await baseManager.createOrUpdateParentTaskBase(data.title);
    }

    return filePath;
  }

  /**
   * Get template content for task creation
   * @param data - Task creation data to determine template type
   * @returns Template content or default content if template not found
   */
  private async getTaskTemplateContent(
    data: TaskCreationData
  ): Promise<string> {
    // Determine if this should be a parent task based on task data
    const shouldUseParentTemplate = this.shouldUseParentTaskTemplate(data);
    const templateType = shouldUseParentTemplate ? "parentTask" : "task";

    // Try to read template content
    try {
      const templateContent = await this.readTaskTemplate(templateType);
      // Check if template has meaningful content (not just front-matter)
      const hasContentAfterFrontMatter =
        this.hasContentAfterFrontMatter(templateContent);
      if (hasContentAfterFrontMatter) {
        return templateContent;
      }
      // If template exists but has no content after front-matter, use description if available
      if (data.description) {
        return data.description;
      }
      // Otherwise use the template as-is (empty content)
      return templateContent;
    } catch (error) {
      // Template doesn't exist - use description if available
      return data.description || "";
    }
  }

  /**
   * Determine if a task should use the parent task template
   * @param data - Task creation data
   * @returns True if parent task template should be used
   */
  private shouldUseParentTaskTemplate(data: TaskCreationData): boolean {
    // Use parent task template if:
    // 1. Category is explicitly set to 'Parent Task'
    // 2. Or if the task name suggests it's a parent task (contains words like "Epic", "Parent", etc.)

    if (data.category === "Parent Task") {
      return true;
    }

    // Check if task name suggests it's a parent task
    const parentKeywords = ["epic", "parent", "main", "master", "primary"];
    const taskNameLower = data.title.toLowerCase();
    if (parentKeywords.some((keyword) => taskNameLower.includes(keyword))) {
      return true;
    }

    return false;
  }

  /**
   * Read template content from file
   * @param templateType - Type of template to read
   * @returns Template content
   * @throws Error if template file is not found
   */
  private async readTaskTemplate(
    templateType: "task" | "parentTask"
  ): Promise<string> {
    const templateFileName =
      templateType === "parentTask"
        ? this.settings.defaultParentTaskTemplate
        : this.settings.defaultTaskTemplate;

    return await this.readTemplate(templateFileName);
  }

  /**
   * Check if template content has meaningful content after front-matter
   * @param content - Template content to check
   * @returns True if there's content after front-matter, false otherwise
   */
  private hasContentAfterFrontMatter(content: string): boolean {
    // Split content by lines
    const lines = content.split("\n");

    // Find the end of front-matter (second occurrence of ---)
    let frontMatterEndIndex = -1;
    let dashCount = 0;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === "---") {
        dashCount++;
        if (dashCount === 2) {
          frontMatterEndIndex = i;
          break;
        }
      }
    }

    // If no front-matter found, consider the whole content as meaningful
    if (frontMatterEndIndex === -1) {
      return content.trim().length > 0;
    }

    // Check if there's non-empty content after front-matter
    const contentAfterFrontMatter = lines
      .slice(frontMatterEndIndex + 1)
      .join("\n");
    return contentAfterFrontMatter.trim().length > 0;
  }

  /**
   * Generate front-matter object for a task with missing keys and values filled from property definitions
   * @param data - Task creation data
   * @returns Front-matter object with all required properties
   */
  private generateTaskFrontMatterObject(
    data: TaskCreationData
  ): Record<string, any> {
    const frontMatterData: Record<string, any> = {};

    for (const propertyKey of PROPERTY_SETS.TASK_FRONTMATTER) {
      const prop =
        PROPERTY_REGISTRY[propertyKey as keyof typeof PROPERTY_REGISTRY];

      if (!prop) continue;

      let value = data[prop.key];

      if (value !== undefined && value !== null) {
        // Convert Date objects to ISO date strings for front-matter
        if (prop.type === "date" && value instanceof Date) {
          value = value.toISOString().split("T")[0]; // YYYY-MM-DD format
        }

        // Format as links if the property has link: true
        if (prop.link) {
          const folder = this.getLinkFolder(prop.key);

          if (prop.type === "array" && Array.isArray(value)) {
            // For arrays, format each item as a link with proper path|display format
            value = value.map((item) => {
              if (typeof item === "string" && item.trim() !== "") {
                // Don't double-format if already a proper link
                if (item.startsWith("[[") && item.endsWith("]]")) {
                  return item;
                }
                // Create proper link format with path and display name
                return createWikiLink(item.trim(), folder);
              }
              return item;
            });
          } else if (
            prop.type === "string" &&
            typeof value === "string" &&
            value.trim() !== ""
          ) {
            // For strings, format as a link with proper path|display format
            // Don't double-format if already a proper link
            if (!value.startsWith("[[") || !value.endsWith("]]")) {
              value = createWikiLink(value.trim(), folder);
            }
          }
        }
        frontMatterData[prop.name] = value;
      } else if (prop.default !== undefined) {
        frontMatterData[prop.name] = prop.default;
      }
    }

    frontMatterData.Type = "Task";

    return frontMatterData;
  }

  /**
   * Load a Task entity from an Obsidian TFile
   * @param file - The TFile to load
   * @param cache - Optional metadata cache to use instead of waiting for cache
   * @returns Task entity
   * @throws Error if file is not a valid task
   */
  async loadEntity(file: TFile, cache?: any): Promise<Task> {
    const frontMatter =
      cache?.frontmatter || (await this.waitForMetadataCache(file));

    if (frontMatter.Type !== "Task") {
      return;
    }

    // Helper function to clean link formatting from strings
    const cleanLinkFormat = (value: any): any => {
      if (typeof value === "string") {
        // Remove [[ ]] brackets from links
        return value.replace(/^\[\[|\]\]$/g, "");
      }
      if (Array.isArray(value)) {
        // Clean each item in array
        return value.map((item) =>
          typeof item === "string" ? item.replace(/^\[\[|\]\]$/g, "") : item
        );
      }
      return value;
    };

    // Ensure areas is always an array
    let areas = cleanLinkFormat(frontMatter.Areas);
    if (!Array.isArray(areas)) {
      if (areas === undefined || areas === null) {
        areas = [];
      } else if (typeof areas === "string") {
        areas = [areas];
      } else {
        areas = [];
      }
    }

    // Helper function to parse date strings to Date objects using moment.js
    const parseDate = (dateValue: any): Date | undefined => {
      if (!dateValue || dateValue === "") {
        return undefined;
      }

      if (dateValue instanceof Date) {
        return dateValue;
      }

      if (typeof dateValue === "string") {
        // Use moment.js for reliable date parsing
        const momentDate = moment(dateValue);
        if (momentDate.isValid()) {
          return momentDate.toDate();
        }
      }

      return undefined;
    };

    // Create base task entity
    const baseTask: Task = {
      id: this.generateId(),
      file,
      filePath: file.path,
      title: "",
      // File system properties
      createdAt: new Date(file.stat.ctime),
      updatedAt: new Date(file.stat.mtime),
      // Source is not loaded from front-matter - it's set separately as an internal property
      source: undefined,
    };

    // Use utility function to update properties from front-matter
    const taskWithFrontmatter = TaskUtils.updateTaskFromFrontmatter(
      baseTask,
      frontMatter
    );

    // Handle special cases that need custom processing
    taskWithFrontmatter.parentTask = cleanLinkFormat(
      frontMatter["Parent task"]
    );
    taskWithFrontmatter.project = cleanLinkFormat(frontMatter.Project);
    taskWithFrontmatter.areas = areas;
    taskWithFrontmatter.doDate = parseDate(frontMatter["Do Date"]);
    taskWithFrontmatter.dueDate = parseDate(frontMatter["Due Date"]);

    return taskWithFrontmatter;
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
    throw new Error("Invalid data type for TaskFileManager");
  }

  /**
   * Type guard to check if data is TaskCreationData
   */
  private isTaskCreationData(data: FileCreationData): data is TaskCreationData {
    return "title" in data;
  }

  /**
   * Get the appropriate folder for a linked property
   */
  private getLinkFolder(propertyKey: string): string {
    switch (propertyKey) {
      case "project":
        return this.settings.projectsFolder || "Projects";
      case "areas":
        return this.settings.areasFolder || "Areas";
      case "parentTask":
        return this.settings.tasksFolder || "Tasks";
      default:
        return ""; // No folder prefix for unknown properties
    }
  }

  /**
   * Change task status - supports both Done boolean and Status string
   * @param filePath - Path to the task file
   * @param status - Either boolean (for Done property) or string (for Status property)
   */
  async changeTaskStatus(
    filePath: string,
    status: boolean | string
  ): Promise<void> {
    if (typeof status === "boolean") {
      await this.updateProperty(filePath, "Done", status);
    } else {
      await this.updateProperty(filePath, "Status", status);
    }
  }

  /**
   * Assign task to a project
   * @param filePath - Path to the task file
   * @param projectName - Name of the project to assign to
   */
  async assignToProject(filePath: string, projectName: string): Promise<void> {
    // Format as link if not empty
    const projectLink =
      projectName && projectName.trim() !== "" ? `[[${projectName}]]` : "";
    await this.updateProperty(filePath, "Project", projectLink);
  }

  /**
   * Assign task to areas
   * @param filePath - Path to the task file
   * @param areas - Array of area names to assign to
   */
  async assignToAreas(filePath: string, areas: string[]): Promise<void> {
    // Format each area as a link
    const areaLinks = areas.map((area) => {
      if (typeof area === "string" && area.trim() !== "") {
        // Don't double-format if already a link
        if (area.startsWith("[[") && area.endsWith("]]")) {
          return area;
        }
        return `[[${area}]]`;
      }
      return area;
    });
    await this.updateProperty(filePath, "Areas", areaLinks);
  }

  /**
   * Set task priority
   * @param filePath - Path to the task file
   * @param priority - Priority level (Low, Medium, High, Critical)
   */
  async setTaskPriority(filePath: string, priority: string): Promise<void> {
    await this.updateProperty(filePath, "Priority", priority);
  }

  /**
   * Set task type
   * @param filePath - Path to the task file
   * @param type - Task type (Task, Bug, Feature, Improvement, Chore)
   */
  async setTaskType(filePath: string, type: string): Promise<void> {
    await this.updateProperty(filePath, "Type", type);
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
    await this.updateProperty(filePath, "tags", newTags);
  }

  /**
   * Remove tags from task
   * @param filePath - Path to the task file
   * @param tagsToRemove - Array of tags to remove
   */
  async removeTags(filePath: string, tagsToRemove: string[]): Promise<void> {
    const currentFrontMatter = await this.loadFrontMatter(filePath);
    const currentTags = currentFrontMatter.tags || [];
    const newTags = currentTags.filter(
      (tag: string) => !tagsToRemove.includes(tag)
    );
    await this.updateProperty(filePath, "tags", newTags);
  }

  /**
   * Set parent task
   * @param filePath - Path to the task file
   * @param parentTaskName - Name of the parent task
   */
  async setParentTask(filePath: string, parentTaskName: string): Promise<void> {
    const parentTaskLink = parentTaskName ? `[[${parentTaskName}]]` : "";
    await this.updateProperty(filePath, "Parent task", parentTaskLink);
  }

  // ============================================================================
  // PROPERTY ORDER MANAGEMENT
  // ============================================================================

  /**
   * Get task properties in the custom order from settings
   * @returns Array of property definitions in the correct order
   */
  getTaskPropertiesInOrder(): any[] {
    // Get property order from settings or use default
    const propertyOrder =
      this.settings.taskPropertyOrder || PROPERTY_SETS.TASK_FRONTMATTER;

    // Validate property order - ensure all required properties are present
    const requiredProperties = PROPERTY_SETS.TASK_FRONTMATTER;
    const isValidOrder =
      requiredProperties.every((prop: any) => propertyOrder.includes(prop)) &&
      propertyOrder.every((prop: any) =>
        requiredProperties.includes(prop as (typeof requiredProperties)[number])
      );

    // Use validated order or fall back to default
    const finalPropertyOrder = isValidOrder
      ? propertyOrder
      : requiredProperties;

    // Convert property keys to property definitions in the correct order
    return finalPropertyOrder
      .map((propertyKey: any) => {
        const prop =
          PROPERTY_REGISTRY[propertyKey as keyof typeof PROPERTY_REGISTRY];
        return { ...prop };
      })
      .filter((prop: any) => prop); // Filter out any undefined properties
  }

  /**
   * Reorder properties in task template content to match current property order
   * @param content - Template content to reorder
   * @returns Content with reordered properties
   */
  async reorderTaskTemplateProperties(content: string): Promise<string> {
    const frontMatterMatch = content.match(
      /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/
    );
    if (!frontMatterMatch) {
      return content;
    }

    const [, frontMatterText, bodyContent] = frontMatterMatch;

    // Parse existing front-matter
    const existingData: Record<string, string> = {};
    const lines = frontMatterText.split("\n");
    for (const line of lines) {
      const match = line.match(/^([^:]+):\s*(.*)$/);
      if (match) {
        const [, key, value] = match;
        existingData[key.trim()] = value;
      }
    }

    // Get the current property order
    const properties = this.getTaskPropertiesInOrder();

    // Regenerate front-matter in correct order
    const frontMatterLines = ["---"];
    for (const prop of properties) {
      const value = existingData[prop.name] || "";
      frontMatterLines.push(`${prop.name}: ${value}`);
    }

    // Add any additional properties not in the schema
    for (const [key, value] of Object.entries(existingData)) {
      if (!properties.some((p: any) => p.name === key)) {
        frontMatterLines.push(`${key}: ${value}`);
      }
    }

    frontMatterLines.push("---");

    return frontMatterLines.join("\n") + "\n" + bodyContent;
  }

  /**
   * Implementation of abstract method from FileManager
   */
  getPropertiesInOrder(): any[] {
    return this.getTaskPropertiesInOrder();
  }

  /**
   * Implementation of abstract method from FileManager
   */
  async updateFileProperties(
    filePath: string
  ): Promise<{ hasChanges: boolean; propertiesChanged: number }> {
    return this.updateTaskFileProperties(filePath);
  }

  /**
   * Update a task file's properties to match current schema and property order
   * @param filePath - Path to the task file
   * @returns Object with hasChanges and propertiesChanged count
   */
  async updateTaskFileProperties(
    filePath: string
  ): Promise<{ hasChanges: boolean; propertiesChanged: number }> {
    const file = this.app.vault.getAbstractFileByPath(filePath) as TFile;
    const fullContent = await this.vault.read(file);

    // Extract existing front-matter
    const existingFrontMatter = this.extractFrontMatterData(fullContent);

    // Check if file has correct Type property for tasks
    if (existingFrontMatter.Type && existingFrontMatter.Type !== "Task") {
      return { hasChanges: false, propertiesChanged: 0 };
    }

    const properties = this.getTaskPropertiesInOrder();
    const currentSchema: Record<string, any> = {};
    const propertyOrder: string[] = [];

    properties.forEach((prop: any) => {
      currentSchema[prop.name] = {
        type: prop.type,
        ...(prop.default !== undefined && { default: prop.default }),
        ...(prop.link && { link: prop.link }),
      };
      propertyOrder.push(prop.name);
    });

    let hasChanges = false;
    let propertiesChanged = 0;

    // Create updated front-matter object
    const updatedFrontMatter = { ...existingFrontMatter };

    // Add all missing fields from schema
    for (const [fieldName, fieldConfig] of Object.entries(currentSchema)) {
      const config = fieldConfig as { default?: any };
      if (config && !(fieldName in updatedFrontMatter)) {
        // Add any field that's defined in the schema
        updatedFrontMatter[fieldName] = config.default || "";
        console.log(
          `Task Sync: Added missing field '${fieldName}' to ${filePath}`
        );
        hasChanges = true;
        propertiesChanged++;
      }
    }

    // Remove obsolete fields (fields not in current schema) - but be conservative
    const validFields = new Set(Object.keys(currentSchema));
    for (const fieldName of Object.keys(updatedFrontMatter)) {
      // Only remove fields that are clearly not part of the schema
      // Keep common fields that might be used by other plugins
      const commonFields = ["tags", "aliases", "cssclass", "publish"];
      if (!validFields.has(fieldName) && !commonFields.includes(fieldName)) {
        delete updatedFrontMatter[fieldName];
        hasChanges = true;
        propertiesChanged++;
      }
    }

    // Check if property order matches schema
    if (
      !hasChanges &&
      !this.isPropertyOrderCorrect(fullContent, currentSchema, propertyOrder)
    ) {
      hasChanges = true;
      propertiesChanged++; // Count order change as one property change
    }

    // Only update the file if there are changes
    if (hasChanges) {
      // Manually reorder properties to ensure correct order
      const file = this.app.vault.getAbstractFileByPath(filePath);
      if (file) {
        // Regenerate the front-matter section in correct order
        const frontMatterLines = ["---"];

        // Include ALL fields from the schema in the correct order
        for (const fieldName of propertyOrder) {
          const value = updatedFrontMatter[fieldName];
          if (value !== undefined) {
            frontMatterLines.push(
              `${fieldName}: ${this.formatPropertyValue(value)}`
            );
          }
        }

        // Add any additional fields that aren't in the schema but exist in the file
        for (const [key, value] of Object.entries(updatedFrontMatter)) {
          if (!propertyOrder.includes(key)) {
            frontMatterLines.push(`${key}: ${this.formatPropertyValue(value)}`);
          }
        }

        frontMatterLines.push("---");

        // Extract body content (everything after front-matter)
        const frontMatterMatch = fullContent.match(
          /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/
        );
        const bodyContent = frontMatterMatch ? frontMatterMatch[2] : "";

        // Combine updated front-matter with existing body
        const updatedContent = frontMatterLines.join("\n") + "\n" + bodyContent;

        // Write back to file
        await this.vault.modify(file as any, updatedContent);
      }
    }

    return { hasChanges, propertiesChanged };
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
  }> {
    const frontMatter = await this.loadFrontMatter(filePath);

    return {
      title: frontMatter.Title || "",
      type: frontMatter.Type || "",
      priority: frontMatter.Priority || "",
      done: frontMatter.Done || false,
      status: frontMatter.Status || "",
      project: frontMatter.Project || "",
      areas: frontMatter.Areas || [],
      tags: frontMatter.tags || [],
      parentTask: frontMatter["Parent task"] || "",
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
    const taskFolder = this.settings.tasksFolder;
    const allFiles = this.app.vault.getMarkdownFiles();

    return allFiles
      .filter((file) => file.path.startsWith(taskFolder + "/"))
      .map((file) => file.path);
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
        if (criteria.priority && frontMatter.Priority !== criteria.priority)
          continue;
        if (criteria.done !== undefined && frontMatter.Done !== criteria.done)
          continue;
        if (criteria.status && frontMatter.Status !== criteria.status) continue;
        if (criteria.project && frontMatter.Project !== criteria.project)
          continue;

        if (criteria.areas && criteria.areas.length > 0) {
          const taskAreas = frontMatter.Areas || [];
          if (!criteria.areas.some((area) => taskAreas.includes(area)))
            continue;
        }

        if (criteria.tags && criteria.tags.length > 0) {
          const taskTags = frontMatter.tags || [];
          if (!criteria.tags.some((tag) => taskTags.includes(tag))) continue;
        }

        matchingTasks.push(taskPath);
      } catch (error) {
        console.warn(`Failed to process task file ${taskPath}:`, error);
      }
    }

    return matchingTasks;
  }
}
