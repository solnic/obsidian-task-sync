/**
 * SettingsChangeHandler - Base class for handling settings changes
 * Provides a clean way for services to react to specific settings changes
 */

import {
  EventHandler,
  EventType,
  PluginEvent,
  SettingsChangedEventData,
} from "../EventTypes";
import { StatusDoneHandler } from "./StatusDoneHandler";

/**
 * Abstract base class for handling settings changes
 * Services can extend this to react to specific settings sections
 */
export abstract class SettingsChangeHandler
  implements EventHandler<SettingsChangedEventData>
{
  /**
   * The settings sections this handler cares about
   */
  protected abstract getWatchedSections(): string[];

  /**
   * Handle settings changes for watched sections
   */
  abstract handleSettingsChange(
    section: string,
    oldSettings: any,
    newSettings: any
  ): Promise<void>;

  /**
   * Get supported event types
   */
  getSupportedEventTypes(): EventType[] {
    return [EventType.SETTINGS_CHANGED];
  }

  /**
   * Check if this handler should process the event
   */
  shouldHandle(event: PluginEvent): boolean {
    if (event.type !== EventType.SETTINGS_CHANGED) {
      return false;
    }

    const data = event.data as SettingsChangedEventData;
    return data.hasChanges && this.getWatchedSections().includes(data.section);
  }

  /**
   * Handle the settings change event
   */
  async handle(
    event: PluginEvent & { data: SettingsChangedEventData }
  ): Promise<void> {
    const { section, oldSettings, newSettings } = event.data;

    try {
      await this.handleSettingsChange(section, oldSettings, newSettings);
    } catch (error) {
      console.error(
        `SettingsChangeHandler: Error handling settings change for section '${section}':`,
        error
      );
    }
  }
}

/**
 * Task Status Settings Change Handler
 * Handles changes to task status configurations and updates StatusDoneHandler
 */
export class TaskStatusSettingsHandler extends SettingsChangeHandler {
  private statusDoneHandler: StatusDoneHandler;

  constructor(statusDoneHandler: StatusDoneHandler) {
    super();
    this.statusDoneHandler = statusDoneHandler;
  }

  protected getWatchedSections(): string[] {
    return ["taskStatuses"];
  }

  async handleSettingsChange(
    section: string,
    oldSettings: any,
    newSettings: any
  ): Promise<void> {
    if (section === "taskStatuses") {
      console.log(
        "⚙️ Task status settings changed via event system, updating StatusDoneHandler"
      );

      // Update the StatusDoneHandler with the new task status settings
      // We need to reconstruct the full settings object with the new taskStatuses
      const currentSettings = this.statusDoneHandler.getSettings();
      const updatedSettings = {
        ...currentSettings,
        taskStatuses: newSettings,
      };

      this.statusDoneHandler.updateSettings(updatedSettings);

      console.log(
        "TaskStatusSettingsHandler: StatusDoneHandler updated with new task status configuration",
        {
          oldStatuses: oldSettings?.length || 0,
          newStatuses: newSettings?.length || 0,
        }
      );
    }
  }
}
