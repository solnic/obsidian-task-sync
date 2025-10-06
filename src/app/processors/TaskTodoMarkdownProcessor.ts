/**
 * TaskTodoMarkdownProcessor
 * Markdown post processor that enhances todo items with wiki links to task notes
 * by adding status, priority, and category badges
 *
 * Ported from old-stuff to new architecture using:
 * - New settings structure
 * - Task store instead of NoteManagers
 * - New badge styling system
 * - Updated color utilities
 */

import {
  App,
  TFile,
  MarkdownPostProcessor,
  MarkdownPostProcessorContext,
} from "obsidian";
import { TaskSyncSettings } from "../types/settings";
import { taskStore } from "../stores/taskStore";
import { getOptimalTextColor } from "../utils/colorUtils";
import { get } from "svelte/store";
import type { Task } from "../core/entities";

/**
 * Task data interface for badge creation
 * Contains only the properties needed for rendering badges
 */
interface TaskBadgeData {
  title: string;
  category?: string;
  priority?: string;
  status?: string;
  done?: boolean;
}

export class TaskTodoMarkdownProcessor {
  private app: App;
  private settings: TaskSyncSettings;
  private processor: MarkdownPostProcessor;
  private wikiLinkOperations: any; // Will be typed properly when we import ObsidianExtension

  constructor(app: App, settings: TaskSyncSettings, wikiLinkOperations?: any) {
    this.app = app;
    this.settings = settings;
    this.wikiLinkOperations = wikiLinkOperations;

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
   * Process a single todo item to check for task links
   */
  private async processTodoItem(
    todoItem: HTMLElement,
    ctx: MarkdownPostProcessorContext
  ): Promise<void> {
    // Find all wiki links in this todo item
    const links = todoItem.querySelectorAll("a");

    for (let i = 0; i < links.length; i++) {
      const link = links[i] as HTMLElement;
      await this.processWikiLink(link, todoItem, ctx);
    }
  }

  /**
   * Check if a list item is a task list item (has checkbox)
   */
  private isTaskListItem(item: HTMLElement): boolean {
    // Check for task list item checkbox
    const checkbox = item.querySelector('input[type="checkbox"]');
    return checkbox !== null;
  }

  /**
   * Fallback method for extracting file path from href when wiki link operations are not available
   * @deprecated Use wikiLinkOperations.extractFilePathFromHref instead
   */
  private fallbackExtractFilePathFromHref(href: string): string | null {
    // Handle internal links (wiki links)
    if (href.startsWith("app://obsidian.md/")) {
      // Extract the file path from the URL
      const url = new URL(href);
      return decodeURIComponent(url.pathname.substring(1));
    }

    // Handle relative paths
    if (!href.startsWith("http")) {
      return href;
    }

    return null;
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

    // Extract the file path from the href using the wiki link operations
    const filePath =
      this.wikiLinkOperations?.extractFilePathFromHref?.(href) ??
      this.fallbackExtractFilePathFromHref(href);
    if (!filePath) return;

    // Check if this file is a task note managed by our plugin
    const taskData = await this.getTaskData(filePath);
    if (!taskData) return;

    // Add badges to the todo item
    this.addTaskBadges(todoItem, taskData, link);

    // Add task mention indicator if this is a task list item (has checkbox)
    if (this.isTaskListItem(todoItem)) {
      this.addTaskMentionIndicator(todoItem, taskData);
    }
  }

  /**
   * Get task data from file path using the task store
   */
  private async getTaskData(filePath: string): Promise<TaskBadgeData | null> {
    try {
      // Get current tasks from the store
      const storeState = get(taskStore);

      // Find task by file path
      const task = storeState.tasks.find((t: Task) => {
        // Handle different path formats
        const taskFilePath = t.source?.filePath;
        if (!taskFilePath) return false;

        // Check exact match
        if (taskFilePath === filePath) return true;

        // Check if filePath is just the note name (wiki link format)
        // Extract filename from task's full path and compare
        const pathParts = taskFilePath.split("/");
        const taskFileNameWithExt = pathParts[pathParts.length - 1];
        if (!taskFileNameWithExt) return false;

        const taskFileName = taskFileNameWithExt.replace(/\.md$/, "");
        const linkFileName = filePath.replace(/\.md$/, "");

        return taskFileName === linkFileName;
      });

      if (!task) return null;

      // Convert task to format expected by badge creation methods
      return {
        title: task.title,
        category: task.category,
        priority: task.priority,
        status: task.status,
        done: task.done,
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
    taskData: TaskBadgeData,
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
      badge.style.color = getOptimalTextColor(color);
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
      badge.style.color = getOptimalTextColor(color);
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
      badge.style.color = getOptimalTextColor(color);
    }

    return badge;
  }

  /**
   * Get color for category from settings
   */
  private getCategoryColor(category: string): string | null {
    const taskType = this.settings.taskTypes.find((t) => t.name === category);
    if (taskType) {
      return this.getColorValue(taskType.color);
    }

    // Default colors for common categories
    const defaultColors: Record<string, string> = {
      Task: "#3b82f6",
      Bug: "#ef4444",
      Feature: "#10b981",
      Improvement: "#8b5cf6",
      Chore: "#6b7280",
    };

    return defaultColors[category] || "#6b7280";
  }

  /**
   * Get color for priority from settings
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
      Critical: "#dc2626",
      High: "#ea580c",
      Medium: "#f59e0b",
      Low: "#10b981",
      Urgent: "#dc2626",
      Normal: "#6b7280",
    };

    return defaultColors[priority] || "#6b7280";
  }

  /**
   * Get color for status from settings
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
      Backlog: "#6b7280",
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
  private addTaskMentionIndicator(
    todoItem: HTMLElement,
    taskData: TaskBadgeData
  ): void {
    // Check if indicator already exists to avoid duplicates
    if (todoItem.querySelector(".task-sync-mention-indicator")) {
      return;
    }

    // Create indicator container
    const indicator = document.createElement("span");
    indicator.className = "task-sync-mention-indicator";
    indicator.title = "This todo is synced with a task note";

    // Add sync icon using SVG for consistent cross-platform rendering
    const icon = document.createElement("span");
    icon.className = "task-sync-mention-icon";
    icon.style.marginLeft = "4px";
    icon.style.opacity = "0.7";
    icon.style.display = "inline-block";
    icon.style.verticalAlign = "middle";

    // Use inline SVG for link icon to ensure consistent rendering
    icon.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none"
        xmlns="http://www.w3.org/2000/svg" style="vertical-align: middle;">
        <path d="M6.5 9.5L9.5 6.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M4.5 11.5C3.11929 11.5 2 10.3807 2 9C2 7.61929 3.11929 6.5 4.5 6.5H6.5"
          stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M11.5 4.5C12.8807 4.5 14 5.61929 14 7C14 8.38071 12.8807 9.5 11.5 9.5H9.5"
          stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
    `;

    // Add completion state indicator
    if (taskData.done) {
      icon.style.color = "#10b981"; // Green for completed
      icon.title = "Task is completed";
    } else {
      icon.style.color = "#6b7280"; // Gray for incomplete
      icon.title = "Task is incomplete";
    }

    indicator.appendChild(icon);

    // Insert indicator at the end of the todo item
    todoItem.appendChild(indicator);
  }
}
