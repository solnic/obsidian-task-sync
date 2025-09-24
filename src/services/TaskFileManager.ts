/**
 * TaskFileManager Service
 * Concrete implementation of FileManager for task-specific file operations
 * Handles task file creation, status changes, project/area assignments, and task-specific operations
 */

import { App, Vault, TFile } from "obsidian";
import { TaskSyncSettings } from "../main";
import { FileManager } from "./FileManager";
import { PROPERTY_REGISTRY } from "../types/properties";
import { Task, TaskUtils } from "../types/entities";
import {
  PROPERTY_SETS,
  generateTaskFrontMatter,
  generateTaskFrontMatter as getTaskPropertyDefinitions,
} from "./base-definitions/BaseConfigurations";
import { createWikiLink } from "../utils/linkUtils";
import { getDateString } from "../utils/dateFiltering";
import moment from "moment";

/**
 * Interface for task creation data
 */
export interface TaskCreationData {
  title: string;
  description?: string;
  category?: string;
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
   * Generate front-matter object for a task using property sets from base configurations
   * @param data - Task creation data
   * @returns Front-matter object with all required properties in correct order
   */
  private generateTaskFrontMatterObject(
    data: TaskCreationData
  ): Record<string, any> {
    const frontMatterData: Record<string, any> = {};

    // Get property order from settings or use default from TASK_FRONTMATTER property set
    // Always use PROPERTY_SETS.TASK_FRONTMATTER to ensure we have property keys, not names
    const propertyOrder = PROPERTY_SETS.TASK_FRONTMATTER;

    // Process each property in the defined order
    for (const propertyKey of propertyOrder) {
      const prop =
        PROPERTY_REGISTRY[propertyKey as keyof typeof PROPERTY_REGISTRY];

      if (!prop || !prop.frontmatter) continue;

      let value = data[prop.key as keyof TaskCreationData];

      if (value !== undefined && value !== null) {
        // Convert Date objects to ISO date strings for front-matter
        if (prop.type === "date" && value instanceof Date) {
          value = getDateString(value); // YYYY-MM-DD format
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
      } else {
        // Set empty value for required properties without defaults
        frontMatterData[prop.name] = prop.type === "array" ? [] : "";
      }
    }

    // Ensure Type is always set to "Task"
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

    // Skip if essential properties are null (metadata cache not ready)
    if (frontMatter.Title === null || frontMatter.Title === undefined) {
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

  /**
   * Override updateProperty to handle Date objects properly
   * @param filePath - Path to the file
   * @param propertyKey - The property key to update
   * @param value - The new value
   */
  async updateProperty(
    filePath: string,
    propertyKey: string,
    value: any
  ): Promise<void> {
    // Convert Date objects to date strings for date properties
    if (value instanceof Date) {
      // Check if this is a date property by looking up the property definition
      const propertyDef = Object.values(PROPERTY_REGISTRY).find(
        (prop) => prop.name === propertyKey && prop.type === "date"
      );

      if (propertyDef) {
        value = getDateString(value); // Convert to YYYY-MM-DD format
      }
    }

    // Call the parent implementation with the converted value
    await super.updateProperty(filePath, propertyKey, value);
  }

  // ============================================================================
  // PROPERTY ORDER MANAGEMENT
  // ============================================================================

  /**
   * Check if a Type value represents a valid task type
   * @param type - The Type value to check
   * @returns True if the type is a valid task type
   */
  private isValidTaskType(type: string): boolean {
    // Get configured task types from settings
    const configuredTaskTypes = this.settings.taskTypes.map(
      (taskType) => taskType.name
    );
    return configuredTaskTypes.includes(type);
  }

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
   * Uses property sets from base configurations and Obsidian's processFrontmatter API
   * @param filePath - Path to the task file
   * @returns Object with hasChanges and propertiesChanged count
   */
  async updateTaskFileProperties(
    filePath: string
  ): Promise<{ hasChanges: boolean; propertiesChanged: number }> {
    const file = this.app.vault.getAbstractFileByPath(filePath) as TFile;

    if (!file) {
      return { hasChanges: false, propertiesChanged: 0 };
    }

    // Get existing front-matter using Obsidian's metadata cache
    const existingFrontMatter = await this.loadFrontMatter(filePath);

    // Check if file should be processed as a task file
    // Skip files that have a Type property that clearly indicates they're not tasks
    if (
      existingFrontMatter.Type &&
      existingFrontMatter.Type !== "Task" &&
      !this.isValidTaskType(existingFrontMatter.Type)
    ) {
      return { hasChanges: false, propertiesChanged: 0 };
    }

    // Get property order from settings or use default from TASK_FRONTMATTER property set
    const propertyOrder =
      this.settings.taskPropertyOrder || PROPERTY_SETS.TASK_FRONTMATTER;

    // Build the target front-matter structure using property registry
    const targetFrontMatter: Record<string, any> = {};
    const validPropertyNames = new Set<string>();

    // Process each property in the defined order
    for (const propertyKey of propertyOrder) {
      const prop =
        PROPERTY_REGISTRY[propertyKey as keyof typeof PROPERTY_REGISTRY];
      if (!prop || !prop.frontmatter) continue;

      validPropertyNames.add(prop.name);

      // Set value from existing front-matter or use default
      if (existingFrontMatter[prop.name] !== undefined) {
        targetFrontMatter[prop.name] = existingFrontMatter[prop.name];
      } else if (prop.default !== undefined) {
        targetFrontMatter[prop.name] = prop.default;
      } else {
        // Set empty value for required properties without defaults
        targetFrontMatter[prop.name] = prop.type === "array" ? [] : "";
      }
    }

    // Preserve existing Type if it's a valid task type, otherwise set to "Task"
    if (
      existingFrontMatter.Type &&
      this.isValidTaskType(existingFrontMatter.Type)
    ) {
      targetFrontMatter.Type = existingFrontMatter.Type;
    } else {
      targetFrontMatter.Type = "Task";
    }

    // Check if changes are needed
    let hasChanges = false;
    let propertiesChanged = 0;

    // Check for missing properties
    for (const [key, value] of Object.entries(targetFrontMatter)) {
      if (!(key in existingFrontMatter)) {
        hasChanges = true;
        propertiesChanged++;
      } else if (existingFrontMatter[key] !== value) {
        // Count as change if values are different, regardless of whether the new value is empty
        hasChanges = true;
        propertiesChanged++;
      }
    }

    // Check property order by comparing current order with target order
    if (!hasChanges) {
      const currentOrder = Object.keys(existingFrontMatter);
      const targetOrder = Object.keys(targetFrontMatter);

      // Simple order check - if the first few properties don't match expected order
      if (
        currentOrder.length !== targetOrder.length ||
        currentOrder.slice(0, Math.min(3, targetOrder.length)).join(",") !==
          targetOrder.slice(0, Math.min(3, targetOrder.length)).join(",")
      ) {
        hasChanges = true;
        propertiesChanged++;
      }
    }

    // Apply changes using Obsidian's processFrontmatter API
    if (hasChanges) {
      await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
        // Preserve custom properties and common Obsidian properties
        const commonObsidianProperties = new Set([
          "tags",
          "aliases",
          "cssclass",
          "publish",
          "created",
          "modified",
        ]);

        const preservedProperties: Record<string, any> = {};

        // Save properties that should be preserved (non-plugin properties)
        for (const [key, value] of Object.entries(frontmatter)) {
          if (
            commonObsidianProperties.has(key) ||
            !validPropertyNames.has(key)
          ) {
            preservedProperties[key] = value;
          }
        }

        // Clear only plugin-managed properties
        Object.keys(frontmatter).forEach((key) => {
          if (validPropertyNames.has(key)) {
            delete frontmatter[key];
          }
        });

        // Add plugin properties in the correct order
        for (const [key, value] of Object.entries(targetFrontMatter)) {
          frontmatter[key] = value;
        }

        // Re-add preserved properties at the end
        for (const [key, value] of Object.entries(preservedProperties)) {
          frontmatter[key] = value;
        }
      });
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

  // ============================================================================
  // TEMPLATE MANAGEMENT IMPLEMENTATION
  // ============================================================================

  /**
   * Implementation of abstract method from FileManager
   * Creates task template files (both regular and parent task templates)
   */
  async createTemplate(filename?: string): Promise<void> {
    // Default to creating regular task template
    await this.createTaskTemplate(filename);
  }

  /**
   * Implementation of abstract method from FileManager
   * Ensures both task and parent task templates exist
   */
  async ensureTemplateExists(): Promise<void> {
    await this.ensureTaskTemplateExists();
    await this.ensureParentTaskTemplateExists();
  }

  /**
   * Implementation of abstract method from FileManager
   * Updates task template properties to match current property order
   */
  async updateTemplateProperties(content: string): Promise<string> {
    return await this.reorderTaskTemplateProperties(content);
  }

  /**
   * Create a Task template file with proper front-matter and content
   */
  async createTaskTemplate(filename?: string): Promise<void> {
    const templateFileName = filename || this.settings.defaultTaskTemplate;
    const templatePath = `${this.settings.templateFolder}/${templateFileName}`;

    // Check if file already exists
    const fileExists = await this.vault.adapter.exists(templatePath);
    if (fileExists) {
      throw new Error(
        `Template file ${templateFileName} already exists. Please configure a different file or overwrite the current one.`
      );
    }

    // Generate template content with configured default values
    const templateContent = this.generateTaskTemplateWithDefaults();

    // Create the template file (Obsidian will create the folder automatically if needed)
    await this.vault.create(templatePath, templateContent);
    console.log(`Created task template: ${templatePath}`);
  }

  /**
   * Create a Parent Task template file with proper front-matter and content
   */
  async createParentTaskTemplate(filename?: string): Promise<void> {
    const templateFileName =
      filename || this.settings.defaultParentTaskTemplate;
    const templatePath = `${this.settings.templateFolder}/${templateFileName}`;

    // Check if file already exists
    const fileExists = await this.vault.adapter.exists(templatePath);
    if (fileExists) {
      throw new Error(
        `Template file ${templateFileName} already exists. Please configure a different file or overwrite the current one.`
      );
    }

    // Generate template content
    const templateContent = this.generateParentTaskTemplateWithDefaults();

    // Create the template file (Obsidian will create the folder automatically if needed)
    await this.vault.create(templatePath, templateContent);
    console.log(`Created parent task template: ${templatePath}`);
  }

  /**
   * Ensure task template exists, creating it if missing
   */
  async ensureTaskTemplateExists(): Promise<void> {
    const taskTemplatePath = `${this.settings.templateFolder}/${this.settings.defaultTaskTemplate}`;
    const taskTemplateExists = await this.app.vault.adapter.exists(
      taskTemplatePath
    );

    if (!taskTemplateExists) {
      console.log(
        `Task Sync: Task template '${this.settings.defaultTaskTemplate}' not found, creating it...`
      );
      try {
        await this.createTaskTemplate(this.settings.defaultTaskTemplate);
        console.log(`Task Sync: Created task template: ${taskTemplatePath}`);
      } catch (error) {
        console.error(`Task Sync: Failed to create task template:`, error);
      }
    }
  }

  /**
   * Ensure parent task template exists, creating it if missing
   */
  async ensureParentTaskTemplateExists(): Promise<void> {
    const parentTaskTemplatePath = `${this.settings.templateFolder}/${this.settings.defaultParentTaskTemplate}`;
    const parentTaskTemplateExists = await this.app.vault.adapter.exists(
      parentTaskTemplatePath
    );

    if (!parentTaskTemplateExists) {
      console.log(
        `Task Sync: Parent task template '${this.settings.defaultParentTaskTemplate}' not found, creating it...`
      );
      try {
        await this.createParentTaskTemplate(
          this.settings.defaultParentTaskTemplate
        );
        console.log(
          `Task Sync: Created parent task template: ${parentTaskTemplatePath}`
        );
      } catch (error) {
        console.error(
          `Task Sync: Failed to create parent task template:`,
          error
        );
      }
    }
  }

  /**
   * Generate a task template with default values for auto-creation
   */
  private generateTaskTemplateWithDefaults(): string {
    // Create front-matter structure using property definitions with defaults
    const frontMatterData: Record<string, any> = {};

    // Get property order from settings or use default
    const propertyOrder =
      this.settings.taskPropertyOrder || PROPERTY_SETS.TASK_FRONTMATTER;

    // Validate property order - ensure all required properties are present
    const requiredProperties = PROPERTY_SETS.TASK_FRONTMATTER;
    const isValidOrder =
      requiredProperties.every((prop) => propertyOrder.includes(prop)) &&
      propertyOrder.every((prop) =>
        requiredProperties.includes(prop as (typeof requiredProperties)[number])
      );

    // Use validated order or fall back to default
    const finalPropertyOrder = isValidOrder
      ? propertyOrder
      : requiredProperties;

    for (const propertyKey of finalPropertyOrder) {
      const prop =
        PROPERTY_REGISTRY[propertyKey as keyof typeof PROPERTY_REGISTRY];
      if (!prop) continue;

      // Use default values from property definitions
      if (prop.default !== undefined) {
        frontMatterData[prop.name] = prop.default;
      } else if (prop.type === "array") {
        frontMatterData[prop.name] = [];
      } else {
        // Set specific defaults for key properties
        if (prop.name === "Type") {
          frontMatterData[prop.name] = "Task"; // Always 'Task' for task entities
        } else if (prop.name === "Category") {
          frontMatterData[prop.name] = this.settings.taskTypes?.[0]?.name || "";
        } else if (prop.name === "Title") {
          frontMatterData[prop.name] = ""; // Title will be set by property handler
        } else {
          // Use empty string for other properties without defaults
          frontMatterData[prop.name] = "";
        }
      }
    }

    return this.generateFrontMatter(frontMatterData);
  }

  /**
   * Generate a parent task template with default values
   */
  private generateParentTaskTemplateWithDefaults(): string {
    // Create front-matter structure using property definitions with defaults
    const frontMatterData: Record<string, any> = {};

    // Get task property definitions in the correct order
    const taskProperties = getTaskPropertyDefinitions();

    for (const prop of taskProperties) {
      // Use default values from property definitions
      if (prop.default !== undefined) {
        frontMatterData[prop.name] = prop.default;
      } else if (prop.type === "array") {
        frontMatterData[prop.name] = [];
      } else {
        // Use empty string for properties without defaults
        frontMatterData[prop.name] = "";
      }
    }

    const baseContent = this.generateFrontMatter(frontMatterData);

    // Add embedded base for related tasks using {{tasks}} variable
    return baseContent + "\n\n## Related Tasks\n\n{{tasks}}";
  }

  /**
   * Generate front-matter string from data object
   */
  private generateFrontMatter(frontMatterData: Record<string, any>): string {
    const frontMatterLines = ["---"];
    for (const [key, value] of Object.entries(frontMatterData)) {
      if (Array.isArray(value)) {
        frontMatterLines.push(
          `${key}: [${value.map((v) => `"${v}"`).join(", ")}]`
        );
      } else {
        frontMatterLines.push(`${key}: ${value}`);
      }
    }
    frontMatterLines.push("---");
    return frontMatterLines.join("\n");
  }
}
