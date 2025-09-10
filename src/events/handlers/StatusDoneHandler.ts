/**
 * StatusDoneHandler - Synchronizes Status and Done fields
 * Handles STATUS_CHANGED and DONE_CHANGED events to keep fields in sync
 */

import { App, TFile } from "obsidian";
import {
  EventHandler,
  EventType,
  PluginEvent,
  StatusChangedEventData,
  DoneChangedEventData,
} from "../EventTypes";
import { TaskSyncSettings } from "../../components/ui/settings";

/**
 * Handler that synchronizes Status and Done fields based on configuration
 */
export class StatusDoneHandler implements EventHandler {
  private processingFiles: Map<string, Set<string>> = new Map();

  constructor(
    private app: App,
    private settings: TaskSyncSettings,
  ) {}

  /**
   * Update the settings reference for this handler
   * This should be called when plugin settings are updated
   */
  updateSettings(newSettings: TaskSyncSettings): void {
    this.settings = newSettings;
  }

  /**
   * Get the event types this handler supports
   */
  getSupportedEventTypes(): EventType[] {
    return [EventType.STATUS_CHANGED, EventType.DONE_CHANGED];
  }

  /**
   * Check if this handler should process a specific event
   */
  shouldHandle(event: PluginEvent): boolean {
    const filePath = (
      event.data as StatusChangedEventData | DoneChangedEventData
    ).filePath;
    const processingTypes = this.processingFiles.get(filePath) || new Set();
    const isProcessing = processingTypes.has(event.type);

    // For debugging: always log what we're deciding
    console.log(
      `StatusDoneHandler: shouldHandle ${event.type} for ${filePath}: ${!isProcessing} (processing types: ${Array.from(processingTypes).join(", ")})`,
    );

    return !isProcessing;
  }

  /**
   * Handle status and done change events
   */
  async handle(event: PluginEvent): Promise<void> {
    try {
      switch (event.type) {
        case EventType.STATUS_CHANGED:
          await this.handleStatusChanged(event.data as StatusChangedEventData);
          break;
        case EventType.DONE_CHANGED:
          await this.handleDoneChanged(event.data as DoneChangedEventData);
          break;
        default:
          console.warn(
            `StatusDoneHandler: Unsupported event type: ${event.type}`,
          );
      }
    } catch (error) {
      console.error(`StatusDoneHandler: Error handling ${event.type}:`, error);
    }
  }

  /**
   * Handle status change events
   */
  private async handleStatusChanged(
    data: StatusChangedEventData,
  ): Promise<void> {
    const { filePath, newStatus, frontmatter } = data;

    console.log(
      `StatusDoneHandler: Processing STATUS_CHANGED for ${filePath}: ${data.oldStatus} -> ${newStatus}`,
    );

    // Find the status configuration
    const statusConfig = this.settings.taskStatuses.find(
      (s) => s.name === newStatus,
    );
    if (!statusConfig) {
      console.warn(`StatusDoneHandler: Unknown status "${newStatus}"`);
      return;
    }

    // Check if Done field needs to be updated
    const currentDone = frontmatter.Done;
    const shouldBeDone = statusConfig.isDone;

    console.log(
      `StatusDoneHandler: Status "${newStatus}" isDone=${shouldBeDone}, current Done=${currentDone}`,
    );

    if (currentDone !== shouldBeDone) {
      console.log(
        `StatusDoneHandler: Updating Done field for ${filePath} from ${currentDone} to ${shouldBeDone}`,
      );
      await this.updateDoneField(filePath, shouldBeDone, true); // Allow override when triggered by status change
    } else {
      console.log(
        `StatusDoneHandler: Done field already correct for ${filePath}`,
      );
    }
  }

  /**
   * Handle done change events
   */
  private async handleDoneChanged(data: DoneChangedEventData): Promise<void> {
    const { filePath, newDone, frontmatter } = data;

    console.log(
      `StatusDoneHandler: Processing DONE_CHANGED for ${filePath}: ${data.oldDone} -> ${newDone}`,
    );

    // Get current status
    const currentStatus = frontmatter.Status;
    if (!currentStatus) {
      console.log(
        `StatusDoneHandler: No status field found for ${filePath}, skipping`,
      );
      return; // No status to sync with
    }

    // Find current status configuration
    const currentStatusConfig = this.settings.taskStatuses.find(
      (s) => s.name === currentStatus,
    );
    if (!currentStatusConfig) {
      console.warn(
        `StatusDoneHandler: Unknown current status "${currentStatus}"`,
      );
      return;
    }

    // Check if status needs to be updated based on Done change
    const statusShouldBeDone = currentStatusConfig.isDone;

    console.log(
      `StatusDoneHandler: Current status "${currentStatus}" isDone=${statusShouldBeDone}, new Done=${newDone}`,
    );

    if (newDone !== statusShouldBeDone) {
      // Find an appropriate status to change to
      const targetStatus = this.findAppropriateStatus(newDone);

      if (targetStatus && targetStatus.name !== currentStatus) {
        console.log(
          `StatusDoneHandler: Updating Status field for ${filePath} from ${currentStatus} to ${targetStatus.name}`,
        );
        await this.updateStatusField(filePath, targetStatus.name);
      } else if (!targetStatus) {
        console.warn(
          `StatusDoneHandler: No appropriate status found for Done=${newDone}`,
        );
      } else {
        console.log(
          `StatusDoneHandler: Target status "${targetStatus.name}" is same as current, no change needed`,
        );
      }
    } else {
      console.log(
        `StatusDoneHandler: Status field already correct for ${filePath}`,
      );
    }
  }

  /**
   * Find an appropriate status based on done state
   */
  private findAppropriateStatus(
    isDone: boolean,
  ): { name: string; isDone: boolean } | null {
    // Find the first status that matches the done state
    const matchingStatuses = this.settings.taskStatuses.filter(
      (s) => s.isDone === isDone,
    );

    if (matchingStatuses.length === 0) {
      return null;
    }

    // Prefer certain statuses based on common patterns
    if (isDone) {
      // For done=true, prefer "Done", "Completed", "Finished"
      const preferredDoneStatuses = ["Done", "Completed", "Finished"];
      for (const preferred of preferredDoneStatuses) {
        const found = matchingStatuses.find((s) => s.name === preferred);
        if (found) {
          return found;
        }
      }
      // Return first available done status
      return matchingStatuses[0];
    } else {
      // For done=false, prefer "Backlog", "Todo", "In Progress"
      const preferredNotDoneStatuses = ["Backlog", "Todo", "In Progress"];
      for (const preferred of preferredNotDoneStatuses) {
        const found = matchingStatuses.find((s) => s.name === preferred);
        if (found) {
          return found;
        }
      }
      // Return first available not-done status
      return matchingStatuses[0];
    }
  }

  /**
   * Update the Done field in a file
   */
  private async updateDoneField(
    filePath: string,
    newDone: boolean,
    allowOverride: boolean = false,
  ): Promise<void> {
    await this.updateFrontmatterField(filePath, "Done", newDone, allowOverride);
  }

  /**
   * Update the Status field in a file
   */
  private async updateStatusField(
    filePath: string,
    newStatus: string,
  ): Promise<void> {
    await this.updateFrontmatterField(filePath, "Status", newStatus, true); // Allow override when triggered by done change
  }

  /**
   * Update a frontmatter field in a file
   */
  private async updateFrontmatterField(
    filePath: string,
    fieldName: string,
    newValue: any,
    allowOverride: boolean = false,
  ): Promise<void> {
    // Determine the event type we're processing based on the field being updated
    const eventType =
      fieldName === "Done" ? EventType.DONE_CHANGED : EventType.STATUS_CHANGED;

    // Prevent infinite loops by tracking specific event types being processed for each file
    const processingTypes = this.processingFiles.get(filePath) || new Set();
    if (processingTypes.has(eventType) && !allowOverride) {
      console.log(
        `StatusDoneHandler: Skipping ${fieldName} update for ${filePath} - already processing ${eventType}`,
      );
      return;
    }

    // Add this event type to the processing set for this file
    processingTypes.add(eventType);
    this.processingFiles.set(filePath, processingTypes);

    try {
      const file = this.app.vault.getAbstractFileByPath(filePath);
      if (!(file instanceof TFile)) {
        console.error(`StatusDoneHandler: File not found: ${filePath}`);
        return;
      }

      const content = await this.app.vault.read(file);
      const updatedContent = this.updateFrontmatterInContent(
        content,
        fieldName,
        newValue,
      );

      if (updatedContent !== content) {
        await this.app.vault.modify(file, updatedContent);
        console.log(
          `StatusDoneHandler: Updated ${fieldName} to ${newValue} in ${filePath}`,
        );
      }
    } catch (error) {
      console.error(
        `StatusDoneHandler: Error updating ${fieldName} in ${filePath}:`,
        error,
      );
    } finally {
      // Remove this specific event type from processing set after a shorter delay
      setTimeout(() => {
        const currentProcessingTypes = this.processingFiles.get(filePath);
        if (currentProcessingTypes) {
          currentProcessingTypes.delete(eventType);
          if (currentProcessingTypes.size === 0) {
            this.processingFiles.delete(filePath);
          }
        }
        console.log(
          `StatusDoneHandler: Released processing lock for ${eventType} on ${filePath}`,
        );
      }, 50);
    }
  }

  /**
   * Update a frontmatter field in file content
   */
  private updateFrontmatterInContent(
    content: string,
    fieldName: string,
    newValue: any,
  ): string {
    const frontmatterRegex = /^(---\n)([\s\S]*?)(\n---)/;
    const match = content.match(frontmatterRegex);

    if (!match) {
      // No frontmatter exists, create it
      const frontmatterContent = `${fieldName}: ${this.formatValue(newValue)}`;
      return `---\n${frontmatterContent}\n---\n\n${content}`;
    }

    const [fullMatch, start, frontmatterContent, end] = match;
    const lines = frontmatterContent.split("\n");

    // Find and update the field, or add it if it doesn't exist
    let fieldUpdated = false;
    const updatedLines = lines.map((line) => {
      const colonIndex = line.indexOf(":");
      if (colonIndex !== -1) {
        const key = line.substring(0, colonIndex).trim();
        if (key === fieldName) {
          fieldUpdated = true;
          return `${fieldName}: ${this.formatValue(newValue)}`;
        }
      }
      return line;
    });

    // Add field if it wasn't found
    if (!fieldUpdated) {
      updatedLines.push(`${fieldName}: ${this.formatValue(newValue)}`);
    }

    const updatedFrontmatter = updatedLines.join("\n");
    return content.replace(
      frontmatterRegex,
      `${start}${updatedFrontmatter}${end}`,
    );
  }

  /**
   * Format a value for frontmatter
   */
  private formatValue(value: any): string {
    if (typeof value === "boolean") {
      return value.toString();
    }
    if (typeof value === "string") {
      // Quote strings that contain special characters
      if (
        value.includes(":") ||
        value.includes("#") ||
        value.includes("[") ||
        value.includes("]")
      ) {
        return `"${value}"`;
      }
      return value;
    }
    return String(value);
  }

  /**
   * Get processing statistics
   */
  getStats(): { processingFiles: number } {
    return {
      processingFiles: this.processingFiles.size,
    };
  }
}
