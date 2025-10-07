/**
 * TypeNote - Main TypeNote API encapsulation
 * Provides a single entry point for all TypeNote functionality
 */

import type { App } from "obsidian";
import { TypeRegistry } from "./registry";
import { NoteProcessor } from "./note-processor";
import { ObsidianPropertyManager } from "./obsidian-property-manager";
import { PropertyProcessor } from "./property-processor";
import { TemplateEngine } from "./template-engine";

/**
 * TypeNote main class that encapsulates all TypeNote functionality
 * Provides a clean API for integrating TypeNote with Obsidian plugins
 */
export class TypeNote {
  public readonly registry: TypeRegistry;
  public readonly propertyProcessor: PropertyProcessor;
  public readonly templateEngine: TemplateEngine;
  public readonly noteProcessor: NoteProcessor;
  public readonly obsidianPropertyManager: ObsidianPropertyManager;

  constructor(app: App) {
    // Initialize core components
    this.registry = new TypeRegistry();
    this.propertyProcessor = new PropertyProcessor();
    this.templateEngine = new TemplateEngine();
    
    // Initialize composite components that depend on core components
    this.noteProcessor = new NoteProcessor(
      this.propertyProcessor,
      this.templateEngine,
      this.registry
    );
    
    // Initialize Obsidian-specific components
    this.obsidianPropertyManager = new ObsidianPropertyManager(app);
  }

  /**
   * Initialize TypeNote system
   * Can be used for any async initialization if needed in the future
   */
  async initialize(): Promise<void> {
    // Currently no async initialization needed
    // This method is provided for future extensibility
  }

  /**
   * Cleanup TypeNote system
   * Can be used for cleanup when plugin is unloaded
   */
  async cleanup(): Promise<void> {
    // Currently no cleanup needed
    // This method is provided for future extensibility
  }
}
