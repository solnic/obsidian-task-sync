/**
 * StatusDoneHandler - Synchronizes Status and Done fields
 * Handles STATUS_CHANGED and DONE_CHANGED events to keep fields in sync
 */

import { App, TFile } from 'obsidian';
import {
  EventHandler,
  EventType,
  PluginEvent,
  StatusChangedEventData,
  DoneChangedEventData
} from '../EventTypes';
import { TaskSyncSettings } from '../../components/ui/settings';

/**
 * Handler that synchronizes Status and Done fields based on configuration
 */
export class StatusDoneHandler implements EventHandler {
  private processingFiles: Set<string> = new Set();

  constructor(
    private app: App,
    private settings: TaskSyncSettings
  ) { }

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
    // Don't process if we're already processing this file to prevent loops
    const filePath = (event.data as StatusChangedEventData | DoneChangedEventData).filePath;
    return !this.processingFiles.has(filePath);
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
          console.warn(`StatusDoneHandler: Unsupported event type: ${event.type}`);
      }
    } catch (error) {
      console.error(`StatusDoneHandler: Error handling ${event.type}:`, error);
    }
  }

  /**
   * Handle status change events
   */
  private async handleStatusChanged(data: StatusChangedEventData): Promise<void> {
    const { filePath, newStatus, frontmatter } = data;

    // Find the status configuration
    const statusConfig = this.settings.taskStatuses.find(s => s.name === newStatus);
    if (!statusConfig) {
      console.warn(`StatusDoneHandler: Unknown status "${newStatus}"`);
      return;
    }

    // Check if Done field needs to be updated
    const currentDone = frontmatter.Done;
    const shouldBeDone = statusConfig.isDone;

    if (currentDone !== shouldBeDone) {
      console.log(`StatusDoneHandler: Updating Done field for ${filePath} from ${currentDone} to ${shouldBeDone}`);
      await this.updateDoneField(filePath, shouldBeDone);
    }
  }

  /**
   * Handle done change events
   */
  private async handleDoneChanged(data: DoneChangedEventData): Promise<void> {
    const { filePath, newDone, frontmatter } = data;

    // Get current status
    const currentStatus = frontmatter.Status;
    if (!currentStatus) {
      return; // No status to sync with
    }

    // Find current status configuration
    const currentStatusConfig = this.settings.taskStatuses.find(s => s.name === currentStatus);
    if (!currentStatusConfig) {
      console.warn(`StatusDoneHandler: Unknown current status "${currentStatus}"`);
      return;
    }

    // Check if status needs to be updated based on Done change
    const statusShouldBeDone = currentStatusConfig.isDone;

    if (newDone !== statusShouldBeDone) {
      // Find an appropriate status to change to
      const targetStatus = this.findAppropriateStatus(newDone);

      if (targetStatus && targetStatus.name !== currentStatus) {
        console.log(`StatusDoneHandler: Updating Status field for ${filePath} from ${currentStatus} to ${targetStatus.name}`);
        await this.updateStatusField(filePath, targetStatus.name);
      }
    }
  }

  /**
   * Find an appropriate status based on done state
   */
  private findAppropriateStatus(isDone: boolean): { name: string; isDone: boolean } | null {
    // Find the first status that matches the done state
    const matchingStatuses = this.settings.taskStatuses.filter(s => s.isDone === isDone);

    if (matchingStatuses.length === 0) {
      return null;
    }

    // Prefer certain statuses based on common patterns
    if (isDone) {
      // For done=true, prefer "Done", "Completed", "Finished"
      const preferredDoneStatuses = ['Done', 'Completed', 'Finished'];
      for (const preferred of preferredDoneStatuses) {
        const found = matchingStatuses.find(s => s.name === preferred);
        if (found) {
          return found;
        }
      }
      // Return first available done status
      return matchingStatuses[0];
    } else {
      // For done=false, prefer "Backlog", "Todo", "In Progress"
      const preferredNotDoneStatuses = ['Backlog', 'Todo', 'In Progress'];
      for (const preferred of preferredNotDoneStatuses) {
        const found = matchingStatuses.find(s => s.name === preferred);
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
  private async updateDoneField(filePath: string, newDone: boolean): Promise<void> {
    await this.updateFrontmatterField(filePath, 'Done', newDone);
  }

  /**
   * Update the Status field in a file
   */
  private async updateStatusField(filePath: string, newStatus: string): Promise<void> {
    await this.updateFrontmatterField(filePath, 'Status', newStatus);
  }

  /**
   * Update a frontmatter field in a file
   */
  private async updateFrontmatterField(filePath: string, fieldName: string, newValue: any): Promise<void> {
    // Prevent infinite loops by tracking files being processed
    if (this.processingFiles.has(filePath)) {
      return;
    }

    this.processingFiles.add(filePath);

    try {
      const file = this.app.vault.getAbstractFileByPath(filePath);
      if (!(file instanceof TFile)) {
        console.error(`StatusDoneHandler: File not found: ${filePath}`);
        return;
      }

      const content = await this.app.vault.read(file);
      const updatedContent = this.updateFrontmatterInContent(content, fieldName, newValue);

      if (updatedContent !== content) {
        await this.app.vault.modify(file, updatedContent);
        console.log(`StatusDoneHandler: Updated ${fieldName} to ${newValue} in ${filePath}`);
      }

    } catch (error) {
      console.error(`StatusDoneHandler: Error updating ${fieldName} in ${filePath}:`, error);
    } finally {
      // Remove from processing set after a short delay to allow event propagation
      setTimeout(() => {
        this.processingFiles.delete(filePath);
      }, 100);
    }
  }

  /**
   * Update a frontmatter field in file content
   */
  private updateFrontmatterInContent(content: string, fieldName: string, newValue: any): string {
    const frontmatterRegex = /^(---\n)([\s\S]*?)(\n---)/;
    const match = content.match(frontmatterRegex);

    if (!match) {
      // No frontmatter exists, create it
      const frontmatterContent = `${fieldName}: ${this.formatValue(newValue)}`;
      return `---\n${frontmatterContent}\n---\n\n${content}`;
    }

    const [fullMatch, start, frontmatterContent, end] = match;
    const lines = frontmatterContent.split('\n');

    // Find and update the field, or add it if it doesn't exist
    let fieldUpdated = false;
    const updatedLines = lines.map(line => {
      const colonIndex = line.indexOf(':');
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

    const updatedFrontmatter = updatedLines.join('\n');
    return content.replace(frontmatterRegex, `${start}${updatedFrontmatter}${end}`);
  }

  /**
   * Format a value for frontmatter
   */
  private formatValue(value: any): string {
    if (typeof value === 'boolean') {
      return value.toString();
    }
    if (typeof value === 'string') {
      // Quote strings that contain special characters
      if (value.includes(':') || value.includes('#') || value.includes('[') || value.includes(']')) {
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
      processingFiles: this.processingFiles.size
    };
  }
}
