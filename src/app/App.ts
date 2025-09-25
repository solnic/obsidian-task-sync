/**
 * TaskSync App Bootstrap Class
 * Minimal implementation for Phase 6.1 - just basic initialization
 */

export class TaskSyncApp {
  private initialized = false;

  async initialize(obsidianApp: any, plugin: any, settings: any): Promise<void> {
    if (this.initialized) return;

    try {
      console.log('TaskSync app initializing...', {
        hasObsidianApp: !!obsidianApp,
        hasPlugin: !!plugin,
        hasSettings: !!settings
      });

      // For now, just mark as initialized
      // In future phases, this will initialize extensions, event bus, etc.
      this.initialized = true;
      console.log('TaskSync app initialized successfully');
    } catch (error) {
      console.error('Failed to initialize TaskSync app:', error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    if (!this.initialized) return;

    console.log('TaskSync app shutting down...');
    this.initialized = false;
    console.log('TaskSync app shutdown complete');
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

export const taskSyncApp = new TaskSyncApp();
