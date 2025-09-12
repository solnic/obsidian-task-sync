/**
 * TaskTodoMarkdownProcessor
 * Markdown post processor that enhances todo items with wiki links to task notes
 * by adding status, priority, and category badges
 */

import {
  App,
  TFile,
  MarkdownPostProcessor,
  MarkdownPostProcessorContext,
} from "obsidian";
import { TaskSyncSettings } from "../main";
import { TaskFileManager } from "./TaskFileManager";
import { taskMentionStore } from "../stores/taskMentionStore";

export class TaskTodoMarkdownProcessor {
  private app: App;
  private settings: TaskSyncSettings;
  private taskFileManager: TaskFileManager;
  private processor: MarkdownPostProcessor;

  constructor(
    app: App,
    settings: TaskSyncSettings,
    taskFileManager: TaskFileManager
  ) {
    this.app = app;
    this.settings = settings;
    this.taskFileManager = taskFileManager;

    // Create the processor function
    this.processor = this.createProcessor();
  }

  /**
   * Get the processor function for registration
   */
  getProcessor(): MarkdownPostProcessor {
    return this.processor;
  }

  /**
   * Create the markdown post processor function
   */
  private createProcessor(): MarkdownPostProcessor {
    return async (el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
      await this.processElement(el, ctx);
    };
  }

  /**
   * Process the markdown element to enhance todo items
   */
  private async processElement(
    el: HTMLElement,
    ctx: MarkdownPostProcessorContext
  ): Promise<void> {
    // Find all list items that contain links
    const allListItems = el.querySelectorAll("li");
    const todoItems: HTMLElement[] = [];

    for (let i = 0; i < allListItems.length; i++) {
      const item = allListItems[i] as HTMLElement;

      // Process list items that contain links (potential task references)
      const itemLinks = item.querySelectorAll("a");
      if (itemLinks.length > 0) {
        todoItems.push(item);
      }
    }

    for (const todoItem of todoItems) {
      await this.processTodoItem(todoItem, ctx);
    }
  }

  /**
   * Check if a list item is a task list item
   */
  private isTaskListItem(item: HTMLElement): boolean {
    // Check for various indicators that this is a task list item
    const hasDataTask = item.hasAttribute("data-task");
    const hasTaskClass = item.classList.contains("task-list-item");
    const hasCheckbox = item.querySelector('input[type="checkbox"]') !== null;
    const hasTaskCheckboxClass =
      item.querySelector(".task-list-item-checkbox") !== null;

    // Check if the text content contains checkbox syntax
    const textContent = item.textContent || "";
    const hasCheckboxSyntax = /\[[\sxX]\]/.test(textContent);

    return (
      hasDataTask ||
      hasTaskClass ||
      hasCheckbox ||
      hasTaskCheckboxClass ||
      hasCheckboxSyntax
    );
  }

  /**
   * Check if a todo item is a task mention (contains task link)
   */
  private isTaskMention(item: HTMLElement): boolean {
    if (!this.isTaskListItem(item)) {
      return false;
    }

    // Check if it contains a wiki link to a task
    const links = item.querySelectorAll("a");
    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      const href = link.getAttribute("href");
      if (href) {
        const filePath = this.extractFilePathFromHref(href);
        if (filePath && filePath.startsWith(this.settings.tasksFolder + "/")) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Process a single todo item
   */
  private async processTodoItem(
    todoItem: HTMLElement,
    ctx: MarkdownPostProcessorContext
  ): Promise<void> {
    // Find all links within the todo item
    const allLinks = todoItem.querySelectorAll("a");

    for (let i = 0; i < allLinks.length; i++) {
      const link = allLinks[i] as HTMLElement;
      await this.processWikiLink(link, todoItem, ctx);
    }
  }

  /**
   * Process a wiki link to check if it points to a task note
   */
  private async processWikiLink(
    link: HTMLElement,
    todoItem: HTMLElement,
    ctx: MarkdownPostProcessorContext
  ): Promise<void> {
    const href = link.getAttribute("href");
    if (!href) return;

    // Extract the file path from the href
    const filePath = this.extractFilePathFromHref(href);
    if (!filePath) return;

    // Check if this file is a task note managed by our plugin
    const taskData = await this.getTaskData(filePath);
    if (!taskData) return;

    // Add badges to the todo item
    this.addTaskBadges(todoItem, taskData, link);

    // Add task mention indicator if this is a task mention
    if (this.isTaskMention(todoItem)) {
      this.addTaskMentionIndicator(todoItem, taskData);
    }
  }

  /**
   * Extract file path from internal link href
   */
  private extractFilePathFromHref(href: string): string | null {
    // Remove the leading hash and decode URI
    const cleanHref = decodeURIComponent(href.replace(/^#/, ""));

    // Handle different link formats
    if (cleanHref.includes("|")) {
      // Format: "path|display" - extract path part
      return cleanHref.split("|")[0];
    }

    return cleanHref;
  }

  /**
   * Get task data from a file path
   */
  private async getTaskData(filePath: string): Promise<any | null> {
    try {
      // Try different path variations to find the task file
      const possiblePaths = [
        filePath,
        `${filePath}.md`,
        `${this.settings.tasksFolder}/${filePath}`,
        `${this.settings.tasksFolder}/${filePath}.md`,
      ];

      let file: TFile | null = null;
      let actualPath = "";

      for (const path of possiblePaths) {
        const testFile = this.app.vault.getAbstractFileByPath(path) as TFile;
        if (testFile) {
          file = testFile;
          actualPath = path;
          break;
        }
      }

      if (!file) return null;

      // Check if it's in the tasks folder
      if (!actualPath.startsWith(`${this.settings.tasksFolder}/`)) {
        return null;
      }

      // Get the front matter
      const cache = this.app.metadataCache.getFileCache(file);
      const frontmatter = cache?.frontmatter;

      if (!frontmatter || frontmatter.Type !== "Task") {
        return null;
      }

      return {
        status: frontmatter.Status,
        priority: frontmatter.Priority,
        category: frontmatter.Category,
        done: frontmatter.Done,
        title: frontmatter.Title,
      };
    } catch (error) {
      console.error(
        "TaskTodoMarkdownProcessor: Error getting task data:",
        error
      );
      return null;
    }
  }

  /**
   * Add task badges to the todo item
   */
  private addTaskBadges(
    todoItem: HTMLElement,
    taskData: any,
    link: HTMLElement
  ): void {
    // Check if badges already exist to avoid duplicates
    if (todoItem.querySelector(".task-sync-todo-badges")) {
      return;
    }

    // Create badges container
    const badgesContainer = document.createElement("span");
    badgesContainer.className = "task-sync-todo-badges";

    // Add category badge
    if (taskData.category) {
      const categoryBadge = this.createCategoryBadge(taskData.category);
      badgesContainer.appendChild(categoryBadge);
    }

    // Add priority badge
    if (taskData.priority) {
      const priorityBadge = this.createPriorityBadge(taskData.priority);
      badgesContainer.appendChild(priorityBadge);
    }

    // Add status badge
    if (taskData.status) {
      const statusBadge = this.createStatusBadge(taskData.status);
      badgesContainer.appendChild(statusBadge);
    }

    // Insert badges after the link
    link.parentNode?.insertBefore(badgesContainer, link.nextSibling);
  }

  /**
   * Create a category badge
   */
  private createCategoryBadge(category: string): HTMLElement {
    const badge = document.createElement("span");
    badge.className = "task-sync-todo-category-badge";
    badge.textContent = category;
    badge.title = `Category: ${category}`;

    // Apply color based on category
    const color = this.getCategoryColor(category);
    if (color) {
      badge.style.backgroundColor = color;
    }

    return badge;
  }

  /**
   * Create a priority badge
   */
  private createPriorityBadge(priority: string): HTMLElement {
    const badge = document.createElement("span");
    badge.className = "task-sync-todo-priority-badge";
    badge.textContent = priority;
    badge.title = `Priority: ${priority}`;

    // Apply color based on priority
    const color = this.getPriorityColor(priority);
    if (color) {
      badge.style.backgroundColor = color;
    }

    return badge;
  }

  /**
   * Create a status badge
   */
  private createStatusBadge(status: string): HTMLElement {
    const badge = document.createElement("span");
    badge.className = "task-sync-todo-status-badge";
    badge.textContent = status;
    badge.title = `Status: ${status}`;

    // Apply color based on status
    const color = this.getStatusColor(status);
    if (color) {
      badge.style.backgroundColor = color;
    }

    return badge;
  }

  /**
   * Get color for category based on settings
   */
  private getCategoryColor(category: string): string | null {
    const taskType = this.settings.taskTypes.find((t) => t.name === category);
    if (taskType) {
      return this.getColorValue(taskType.color);
    }

    // Default colors for common categories
    const defaultColors: Record<string, string> = {
      Feature: "#3b82f6",
      Bug: "#ef4444",
      Enhancement: "#10b981",
      Documentation: "#f59e0b",
      Maintenance: "#6b7280",
      Research: "#8b5cf6",
      Design: "#ec4899",
      Testing: "#14b8a6",
      Refactor: "#f97316",
    };

    return defaultColors[category] || "#6b7280";
  }

  /**
   * Get color for priority based on settings
   */
  private getPriorityColor(priority: string): string | null {
    const taskPriority = this.settings.taskPriorities.find(
      (p) => p.name === priority
    );
    if (taskPriority) {
      return this.getColorValue(taskPriority.color);
    }

    // Default colors for common priorities
    const defaultColors: Record<string, string> = {
      High: "#ef4444",
      Medium: "#f59e0b",
      Low: "#10b981",
      Critical: "#dc2626",
      Urgent: "#f97316",
    };

    return defaultColors[priority] || "#6b7280";
  }

  /**
   * Get color for status
   */
  private getStatusColor(status: string): string | null {
    const taskStatus = this.settings.taskStatuses.find(
      (s) => s.name === status
    );
    if (taskStatus) {
      return this.getColorValue(taskStatus.color);
    }

    // Default colors for common statuses
    const defaultColors: Record<string, string> = {
      Open: "#10b981",
      Closed: "#6b7280",
      "In Progress": "#3b82f6",
      Done: "#10b981",
      Todo: "#f59e0b",
      Blocked: "#ef4444",
      Review: "#8b5cf6",
      Testing: "#14b8a6",
      Merged: "#10b981",
      Draft: "#f59e0b",
    };

    return defaultColors[status] || "#6b7280";
  }

  /**
   * Convert color name to hex value
   */
  private getColorValue(colorName: string): string {
    const colorMap: Record<string, string> = {
      blue: "#3b82f6",
      red: "#ef4444",
      green: "#10b981",
      yellow: "#f59e0b",
      purple: "#8b5cf6",
      pink: "#ec4899",
      indigo: "#6366f1",
      cyan: "#06b6d4",
      orange: "#f97316",
      gray: "#6b7280",
      grey: "#6b7280",
    };

    return colorMap[colorName.toLowerCase()] || colorName;
  }

  /**
   * Add task mention indicator to show this todo is synced with a task
   */
  private addTaskMentionIndicator(todoItem: HTMLElement, taskData: any): void {
    // Check if indicator already exists to avoid duplicates
    if (todoItem.querySelector(".task-sync-mention-indicator")) {
      return;
    }

    // Create indicator container
    const indicator = document.createElement("span");
    indicator.className = "task-sync-mention-indicator";
    indicator.title = "This todo is synced with a task note";

    // Add sync icon (using a simple symbol for now)
    const icon = document.createElement("span");
    icon.className = "task-sync-mention-icon";
    icon.textContent = "🔗"; // Link symbol to indicate sync
    icon.style.fontSize = "0.8em";
    icon.style.marginLeft = "4px";
    icon.style.opacity = "0.7";

    // Add completion state indicator
    if (taskData.done) {
      icon.style.color = "#10b981"; // Green for completed
      icon.title = "Task is completed";
    } else {
      icon.style.color = "#6b7280"; // Gray for incomplete
      icon.title = "Task is incomplete";
    }

    indicator.appendChild(icon);

    // Find the best place to insert the indicator
    const badgesContainer = todoItem.querySelector(".task-sync-todo-badges");
    if (badgesContainer) {
      // Insert after badges
      badgesContainer.appendChild(indicator);
    } else {
      // Insert at the end of the todo item
      todoItem.appendChild(indicator);
    }
  }
}
