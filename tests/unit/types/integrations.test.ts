/**
 * Tests for Integration Types
 * Validates the structure and behavior of external task integration interfaces
 */

import { describe, it, expect } from 'vitest';
import type { ExternalTaskData, TaskImportConfig, ImportResult } from '../../../src/types/integrations';

describe('Integration Types', () => {
  it('should import ExternalTaskData interface', async () => {
    // This test will fail until we create the types
    const integrationTypes = await import('../../../src/types/integrations');

    // Test that the interface exists and has expected structure
    const mockTaskData: ExternalTaskData = {
      id: 'github-123',
      title: 'Test Issue',
      description: 'Test description',
      status: 'open',
      priority: 'high',
      assignee: 'testuser',
      labels: ['bug', 'priority:high'],
      createdAt: new Date('2023-01-01'),
      updatedAt: new Date('2023-01-02'),
      externalUrl: 'https://github.com/owner/repo/issues/123',
      sourceType: 'github',
      sourceData: { number: 123, state: 'open' }
    };

    expect(mockTaskData.id).toBe('github-123');
    expect(mockTaskData.sourceType).toBe('github');
  });

  it('should import TaskImportConfig interface', async () => {
    const integrationTypes = await import('../../../src/types/integrations');

    const mockConfig: TaskImportConfig = {
      targetArea: 'Development',
      targetProject: 'Mobile App',
      taskType: 'Bug',
      importLabelsAsTags: true,
      preserveAssignee: false
    };

    expect(mockConfig.targetArea).toBe('Development');
    expect(mockConfig.importLabelsAsTags).toBe(true);
  });

  it('should import ImportResult interface', async () => {
    const integrationTypes = await import('../../../src/types/integrations');

    const successResult: ImportResult = {
      success: true,
      taskPath: 'Tasks/Test Issue.md'
    };

    const errorResult: ImportResult = {
      success: false,
      error: 'Task already exists',
      skipped: true,
      reason: 'Duplicate task detected'
    };

    expect(successResult.success).toBe(true);
    expect(errorResult.success).toBe(false);
    expect(errorResult.skipped).toBe(true);
  });

  it('should validate ExternalTaskData sourceType values', async () => {
    const integrationTypes = await import('../../../src/types/integrations');

    // Test valid source types
    const githubTask: ExternalTaskData = {
      id: 'github-1',
      title: 'GitHub Issue',
      status: 'open',
      createdAt: new Date(),
      updatedAt: new Date(),
      externalUrl: 'https://github.com/test/repo/issues/1',
      sourceType: 'github',
      sourceData: {}
    };

    const linearTask: ExternalTaskData = {
      id: 'linear-1',
      title: 'Linear Issue',
      status: 'todo',
      createdAt: new Date(),
      updatedAt: new Date(),
      externalUrl: 'https://linear.app/team/issue/1',
      sourceType: 'linear',
      sourceData: {}
    };

    expect(githubTask.sourceType).toBe('github');
    expect(linearTask.sourceType).toBe('linear');
  });
});
