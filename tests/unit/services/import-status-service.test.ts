/**
 * Tests for ImportStatusService - Pure Logic Only
 * Tests import tracking and duplicate prevention without Obsidian APIs
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { ImportedTaskMetadata } from '../../../src/types/integrations';

describe('ImportStatusService - Pure Logic', () => {
  let importStatusService: any;

  beforeEach(async () => {
    // Import the service fresh for each test
    const { ImportStatusService } = await import('../../../src/services/ImportStatusService');
    importStatusService = new ImportStatusService();
  });

  it('should track imported tasks', () => {
    const metadata: ImportedTaskMetadata = {
      externalId: 'github-123',
      externalSource: 'github',
      taskPath: 'Tasks/Test Task.md',
      importedAt: new Date('2023-01-01'),
      lastSyncedAt: new Date('2023-01-01'),
      externalUrl: 'https://github.com/owner/repo/issues/123'
    };

    importStatusService.recordImport(metadata);

    expect(importStatusService.isTaskImported('github-123', 'github')).toBe(true);
    expect(importStatusService.isTaskImported('github-456', 'github')).toBe(false);
  });

  it('should get import metadata for existing tasks', () => {
    const metadata: ImportedTaskMetadata = {
      externalId: 'linear-456',
      externalSource: 'linear',
      taskPath: 'Tasks/Linear Task.md',
      importedAt: new Date('2023-01-02'),
      lastSyncedAt: new Date('2023-01-02'),
      externalUrl: 'https://linear.app/team/issue/456'
    };

    importStatusService.recordImport(metadata);

    const retrieved = importStatusService.getImportMetadata('linear-456', 'linear');
    expect(retrieved).toEqual(metadata);

    const notFound = importStatusService.getImportMetadata('linear-999', 'linear');
    expect(notFound).toBeNull();
  });

  it('should update sync timestamp for existing imports', () => {
    const metadata: ImportedTaskMetadata = {
      externalId: 'github-789',
      externalSource: 'github',
      taskPath: 'Tasks/Updated Task.md',
      importedAt: new Date('2023-01-01'),
      lastSyncedAt: new Date('2023-01-01'),
      externalUrl: 'https://github.com/owner/repo/issues/789'
    };

    importStatusService.recordImport(metadata);

    const newSyncTime = new Date('2023-01-03');
    importStatusService.updateSyncTime('github-789', 'github', newSyncTime);

    const updated = importStatusService.getImportMetadata('github-789', 'github');
    expect(updated?.lastSyncedAt).toEqual(newSyncTime);
    expect(updated?.importedAt).toEqual(metadata.importedAt); // Should not change
  });

  it('should list all imported tasks', () => {
    const metadata1: ImportedTaskMetadata = {
      externalId: 'github-1',
      externalSource: 'github',
      taskPath: 'Tasks/Task 1.md',
      importedAt: new Date('2023-01-01'),
      lastSyncedAt: new Date('2023-01-01'),
      externalUrl: 'https://github.com/owner/repo/issues/1'
    };

    const metadata2: ImportedTaskMetadata = {
      externalId: 'linear-2',
      externalSource: 'linear',
      taskPath: 'Tasks/Task 2.md',
      importedAt: new Date('2023-01-02'),
      lastSyncedAt: new Date('2023-01-02'),
      externalUrl: 'https://linear.app/team/issue/2'
    };

    importStatusService.recordImport(metadata1);
    importStatusService.recordImport(metadata2);

    const allImports = importStatusService.getAllImports();
    expect(allImports).toHaveLength(2);
    expect(allImports).toContainEqual(metadata1);
    expect(allImports).toContainEqual(metadata2);
  });

  it('should filter imports by source', () => {
    const githubMetadata: ImportedTaskMetadata = {
      externalId: 'github-1',
      externalSource: 'github',
      taskPath: 'Tasks/GitHub Task.md',
      importedAt: new Date('2023-01-01'),
      lastSyncedAt: new Date('2023-01-01'),
      externalUrl: 'https://github.com/owner/repo/issues/1'
    };

    const linearMetadata: ImportedTaskMetadata = {
      externalId: 'linear-1',
      externalSource: 'linear',
      taskPath: 'Tasks/Linear Task.md',
      importedAt: new Date('2023-01-02'),
      lastSyncedAt: new Date('2023-01-02'),
      externalUrl: 'https://linear.app/team/issue/1'
    };

    importStatusService.recordImport(githubMetadata);
    importStatusService.recordImport(linearMetadata);

    const githubImports = importStatusService.getImportsBySource('github');
    const linearImports = importStatusService.getImportsBySource('linear');

    expect(githubImports).toHaveLength(1);
    expect(githubImports[0]).toEqual(githubMetadata);

    expect(linearImports).toHaveLength(1);
    expect(linearImports[0]).toEqual(linearMetadata);
  });

  it('should remove import records', () => {
    const metadata: ImportedTaskMetadata = {
      externalId: 'github-remove',
      externalSource: 'github',
      taskPath: 'Tasks/To Remove.md',
      importedAt: new Date('2023-01-01'),
      lastSyncedAt: new Date('2023-01-01'),
      externalUrl: 'https://github.com/owner/repo/issues/remove'
    };

    importStatusService.recordImport(metadata);
    expect(importStatusService.isTaskImported('github-remove', 'github')).toBe(true);

    importStatusService.removeImport('github-remove', 'github');
    expect(importStatusService.isTaskImported('github-remove', 'github')).toBe(false);
    expect(importStatusService.getImportMetadata('github-remove', 'github')).toBeNull();
  });

  it('should clear all imports', () => {
    const metadata1: ImportedTaskMetadata = {
      externalId: 'github-1',
      externalSource: 'github',
      taskPath: 'Tasks/Task 1.md',
      importedAt: new Date(),
      lastSyncedAt: new Date(),
      externalUrl: 'https://github.com/owner/repo/issues/1'
    };

    const metadata2: ImportedTaskMetadata = {
      externalId: 'linear-1',
      externalSource: 'linear',
      taskPath: 'Tasks/Task 2.md',
      importedAt: new Date(),
      lastSyncedAt: new Date(),
      externalUrl: 'https://linear.app/team/issue/1'
    };

    importStatusService.recordImport(metadata1);
    importStatusService.recordImport(metadata2);

    expect(importStatusService.getAllImports()).toHaveLength(2);

    importStatusService.clearAllImports();

    expect(importStatusService.getAllImports()).toHaveLength(0);
    expect(importStatusService.isTaskImported('github-1', 'github')).toBe(false);
    expect(importStatusService.isTaskImported('linear-1', 'linear')).toBe(false);
  });

  it('should generate unique import keys', () => {
    const key1 = importStatusService.generateImportKey('github-123', 'github');
    const key2 = importStatusService.generateImportKey('linear-123', 'linear');
    const key3 = importStatusService.generateImportKey('github-123', 'linear');

    expect(key1).toBe('github:github-123');
    expect(key2).toBe('linear:linear-123');
    expect(key3).toBe('linear:github-123');

    // Same external ID but different sources should have different keys
    expect(key1).not.toBe(key3);
  });
});
