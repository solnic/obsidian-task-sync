/**
 * Test type definitions for Obsidian API interactions
 * Provides typed wrappers and interfaces for common Obsidian test patterns
 */

import type {
  App,
  Vault,
  MetadataCache,
  Workspace,
  TFile,
  TFolder,
  TAbstractFile,
  Notice,
} from "obsidian";

/**
 * Obsidian test context - represents the Obsidian app in test environment
 */
export interface ObsidianTestContext {
  app: App;
  vault: Vault;
  metadataCache: MetadataCache;
  workspace: Workspace;
}

/**
 * Obsidian plugin context - includes plugin instance
 */
export interface ObsidianPluginContext extends ObsidianTestContext {
  plugin: any; // Plugin instance type varies by implementation
}

/**
 * Re-export commonly used Obsidian types for convenience
 */
export type { App, Vault, MetadataCache, Workspace, TFile, TFolder, TAbstractFile, Notice };
