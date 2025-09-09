/**
 * ImportStatusService
 * Tracks imported tasks to prevent duplicates and manage sync status
 */

import { Plugin } from 'obsidian';
import { ImportedTaskMetadata } from '../types/integrations';

export class ImportStatusService {
  private imports: Map<string, ImportedTaskMetadata> = new Map();
  private plugin: Plugin;
  private readonly STORAGE_KEY = 'importStatus';

  constructor(plugin: Plugin) {
    this.plugin = plugin;
  }

  /**
   * Initialize the service by loading persisted import data
   */
  async initialize(): Promise<void> {
    try {
      const data = await this.plugin.loadData();
      if (data && data[this.STORAGE_KEY]) {
        this.importImports(data[this.STORAGE_KEY]);
        console.log(`🔧 ImportStatusService: Loaded ${this.getImportCount()} import records from storage`);
      } else {
        console.log('🔧 ImportStatusService: No existing import data found');
      }
    } catch (error) {
      console.error('❌ ImportStatusService: Failed to load import data:', error);
    }
  }

  /**
   * Save import data to plugin storage
   */
  private async saveData(): Promise<void> {
    const existingData = await this.plugin.loadData() || {};
    const exportedImports = this.exportImports();

    const updatedData = {
      ...existingData,
      [this.STORAGE_KEY]: exportedImports
    };

    await this.plugin.saveData(updatedData);
  }

  /**
   * Save import data on plugin unload (public method for main.ts)
   */
  async onUnload(): Promise<void> {
    await this.saveData();
  }

  /**
   * Record a new import or update existing import metadata
   */
  recordImport(metadata: ImportedTaskMetadata): void {
    const key = this.generateImportKey(metadata.externalId, metadata.externalSource);
    this.imports.set(key, { ...metadata });
    // Auto-save after recording import
    this.saveData().catch(error =>
      console.error('❌ ImportStatusService: Failed to auto-save after recordImport:', error)
    );
  }

  /**
   * Check if a task has already been imported
   */
  isTaskImported(externalId: string, externalSource: 'github' | 'linear'): boolean {
    const key = this.generateImportKey(externalId, externalSource);
    return this.imports.has(key);
  }

  /**
   * Get import metadata for a specific task
   */
  getImportMetadata(externalId: string, externalSource: 'github' | 'linear'): ImportedTaskMetadata | null {
    const key = this.generateImportKey(externalId, externalSource);
    return this.imports.get(key) || null;
  }

  /**
   * Update the last sync time for an imported task
   */
  updateSyncTime(externalId: string, externalSource: 'github' | 'linear', syncTime: Date): void {
    const key = this.generateImportKey(externalId, externalSource);
    const existing = this.imports.get(key);

    if (existing) {
      existing.lastSyncedAt = syncTime;
      this.imports.set(key, existing);
      // Auto-save after updating sync time
      this.saveData().catch(error =>
        console.error('❌ ImportStatusService: Failed to auto-save after updateSyncTime:', error)
      );
    }
  }

  /**
   * Get all imported tasks
   */
  getAllImports(): ImportedTaskMetadata[] {
    return Array.from(this.imports.values());
  }

  /**
   * Get imports filtered by source
   */
  getImportsBySource(externalSource: 'github' | 'linear'): ImportedTaskMetadata[] {
    return this.getAllImports().filter(metadata => metadata.externalSource === externalSource);
  }

  /**
   * Remove an import record
   */
  removeImport(externalId: string, externalSource: 'github' | 'linear'): void {
    const key = this.generateImportKey(externalId, externalSource);
    this.imports.delete(key);
    // Auto-save after removing import
    this.saveData().catch(error =>
      console.error('❌ ImportStatusService: Failed to auto-save after removeImport:', error)
    );
  }

  /**
   * Clear all import records
   */
  clearAllImports(): void {
    this.imports.clear();
    // Auto-save after clearing all imports
    this.saveData().catch(error =>
      console.error('❌ ImportStatusService: Failed to auto-save after clearAllImports:', error)
    );
  }

  /**
   * Generate a unique key for import tracking
   */
  generateImportKey(externalId: string, externalSource: 'github' | 'linear'): string {
    return `${externalSource}:${externalId}`;
  }

  /**
   * Get imports that need syncing (older than specified time)
   */
  getImportsNeedingSync(olderThan: Date): ImportedTaskMetadata[] {
    return this.getAllImports().filter(metadata =>
      metadata.lastSyncedAt < olderThan
    );
  }

  /**
   * Get import statistics
   */
  getImportStats(): {
    total: number;
    bySource: Record<string, number>;
    oldestImport?: Date;
    newestImport?: Date;
  } {
    const allImports = this.getAllImports();
    const stats = {
      total: allImports.length,
      bySource: {} as Record<string, number>,
      oldestImport: undefined as Date | undefined,
      newestImport: undefined as Date | undefined
    };

    // Count by source
    for (const metadata of allImports) {
      stats.bySource[metadata.externalSource] = (stats.bySource[metadata.externalSource] || 0) + 1;
    }

    // Find oldest and newest imports
    if (allImports.length > 0) {
      const sortedByImportDate = allImports.sort((a, b) => a.importedAt.getTime() - b.importedAt.getTime());
      stats.oldestImport = sortedByImportDate[0].importedAt;
      stats.newestImport = sortedByImportDate[sortedByImportDate.length - 1].importedAt;
    }

    return stats;
  }

  /**
   * Find imports by task path (useful for cleanup when files are deleted)
   */
  findImportsByTaskPath(taskPath: string): ImportedTaskMetadata[] {
    return this.getAllImports().filter(metadata => metadata.taskPath === taskPath);
  }

  /**
   * Update task path for an import (useful when files are moved)
   */
  updateTaskPath(externalId: string, externalSource: 'github' | 'linear', newTaskPath: string): boolean {
    const key = this.generateImportKey(externalId, externalSource);
    const existing = this.imports.get(key);

    if (existing) {
      existing.taskPath = newTaskPath;
      this.imports.set(key, existing);
      // Auto-save after updating task path
      this.saveData().catch(error =>
        console.error('❌ ImportStatusService: Failed to auto-save after updateTaskPath:', error)
      );
      return true;
    }

    return false;
  }

  /**
   * Validate import metadata
   */
  private validateMetadata(metadata: ImportedTaskMetadata): boolean {
    return !!(
      metadata.externalId &&
      metadata.externalSource &&
      metadata.taskPath &&
      metadata.importedAt &&
      metadata.lastSyncedAt &&
      metadata.externalUrl
    );
  }

  /**
   * Export import data for backup/persistence
   */
  exportImports(): Record<string, ImportedTaskMetadata> {
    const exported: Record<string, ImportedTaskMetadata> = {};

    for (const [key, metadata] of this.imports.entries()) {
      exported[key] = { ...metadata };
    }

    return exported;
  }

  /**
   * Import data from backup/persistence
   */
  importImports(data: Record<string, ImportedTaskMetadata>): void {
    this.imports.clear();

    for (const [key, metadata] of Object.entries(data)) {
      if (this.validateMetadata(metadata)) {
        // Ensure dates are Date objects (in case they were serialized as strings)
        metadata.importedAt = new Date(metadata.importedAt);
        metadata.lastSyncedAt = new Date(metadata.lastSyncedAt);

        this.imports.set(key, metadata);
      }
    }
  }

  /**
   * Get the number of imports
   */
  getImportCount(): number {
    return this.imports.size;
  }

  /**
   * Check if any imports exist
   */
  hasImports(): boolean {
    return this.imports.size > 0;
  }
}
