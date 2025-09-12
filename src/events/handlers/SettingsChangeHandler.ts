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

/**
 * Abstract base class for handling settings changes
 * Services can extend this to react to specific settings sections
 */
export abstract class SettingsChangeHandler implements EventHandler<SettingsChangedEventData> {
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
    return (
      data.hasChanges && 
      this.getWatchedSections().includes(data.section)
    );
  }

  /**
   * Handle the settings change event
   */
  async handle(event: PluginEvent & { data: SettingsChangedEventData }): Promise<void> {
    const { section, oldSettings, newSettings } = event.data;
    
    try {
      await this.handleSettingsChange(section, oldSettings, newSettings);
    } catch (error) {
      console.error(`SettingsChangeHandler: Error handling settings change for section '${section}':`, error);
    }
  }
}

/**
 * GitHub Settings Change Handler
 * Handles changes to GitHub integration settings
 */
export class GitHubSettingsHandler extends SettingsChangeHandler {
  private githubService: any; // Will be injected

  constructor(githubService: any) {
    super();
    this.githubService = githubService;
  }

  protected getWatchedSections(): string[] {
    return ['githubIntegration'];
  }

  async handleSettingsChange(section: string, oldSettings: any, newSettings: any): Promise<void> {
    if (section === 'githubIntegration') {
      console.log("🐙 GitHub settings changed via event system, clearing cache");
      
      // Update the service's internal settings
      if (this.githubService && this.githubService.updateSettingsInternal) {
        this.githubService.updateSettingsInternal(newSettings);
      }
      
      // Clear cache
      if (this.githubService && this.githubService.clearCache) {
        this.githubService.clearCache();
      }
    }
  }
}

/**
 * Apple Reminders Settings Change Handler
 * Handles changes to Apple Reminders integration settings
 */
export class AppleRemindersSettingsHandler extends SettingsChangeHandler {
  private appleRemindersService: any; // Will be injected

  constructor(appleRemindersService: any) {
    super();
    this.appleRemindersService = appleRemindersService;
  }

  protected getWatchedSections(): string[] {
    return ['appleRemindersIntegration'];
  }

  async handleSettingsChange(section: string, oldSettings: any, newSettings: any): Promise<void> {
    if (section === 'appleRemindersIntegration') {
      console.log("🍎 Apple Reminders settings changed via event system, clearing cache");
      
      // Update the service's internal settings
      if (this.appleRemindersService && this.appleRemindersService.updateSettingsInternal) {
        this.appleRemindersService.updateSettingsInternal(newSettings);
      }
      
      // Clear cache
      if (this.appleRemindersService && this.appleRemindersService.clearCache) {
        this.appleRemindersService.clearCache();
      }
    }
  }
}
