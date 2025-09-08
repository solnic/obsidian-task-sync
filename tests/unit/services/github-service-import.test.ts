/**
 * Tests for GitHubService Import Functionality - Pure Logic Only
 * Tests transformation and import logic without Obsidian APIs
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ExternalTaskData, TaskImportConfig, ImportResult } from '../../../src/types/integrations';
import type { GitHubIssue } from '../../../src/services/GitHubService';

// Mock TaskImportManager for testing
const mockTaskImportManager = {
  createTaskFromData: vi.fn()
};

// Mock ImportStatusService for testing
const mockImportStatusService = {
  isTaskImported: vi.fn(),
  recordImport: vi.fn()
};

// Mock settings - using full TaskSyncSettings structure
const mockSettings = {
  tasksFolder: 'Tasks',
  projectsFolder: 'Projects',
  areasFolder: 'Areas',
  templateFolder: 'Templates',
  useTemplater: false,
  defaultTaskTemplate: 'Task.md',
  defaultProjectTemplate: 'project-template.md',
  defaultAreaTemplate: 'area-template.md',
  defaultParentTaskTemplate: 'parent-task-template.md',
  basesFolder: 'Bases',
  tasksBaseFile: 'Tasks.base',
  autoGenerateBases: true,
  autoUpdateBaseViews: true,
  taskTypes: [
    { name: 'Bug', color: '#ff4444' },
    { name: 'Feature', color: '#44ff44' },
    { name: 'Improvement', color: '#4444ff' },
    { name: 'Chore', color: '#ffff44' },
    { name: 'Task', color: '#888888' }
  ],
  taskPriorities: [
    { name: 'Low', color: 'green' },
    { name: 'Medium', color: 'yellow' },
    { name: 'High', color: 'orange' },
    { name: 'Urgent', color: 'red' }
  ],
  taskStatuses: [
    { name: 'Backlog', color: 'gray', isDone: false, isInProgress: false },
    { name: 'In Progress', color: 'blue', isDone: false, isInProgress: true },
    { name: 'Done', color: 'green', isDone: true, isInProgress: false }
  ],
  areaBasesEnabled: true,
  projectBasesEnabled: true,
  autoSyncAreaProjectBases: true,
  taskPropertyOrder: ['TITLE', 'TYPE', 'PRIORITY', 'AREAS', 'PROJECT', 'DONE', 'STATUS', 'PARENT_TASK', 'TAGS'],
  githubIntegration: {
    enabled: true,
    personalAccessToken: 'test-token',
    repositories: ['owner/repo'],
    defaultRepository: 'owner/repo',
    issueFilters: {
      state: 'open' as const,
      assignee: '',
      labels: [] as string[]
    },
    labelTypeMapping: {
      'bug': 'Bug',
      'enhancement': 'Feature'
    }
  }
};

describe('GitHubService Import Functionality - Pure Logic', () => {
  let githubService: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Import the service fresh for each test
    const { GitHubService } = await import('../../../src/services/GitHubService');
    githubService = new GitHubService(mockSettings);

    // Inject mock dependencies for testing import functionality
    githubService.taskImportManager = mockTaskImportManager;
    githubService.importStatusService = mockImportStatusService;
  });

  it('should transform GitHub issue to ExternalTaskData', () => {
    const githubIssue: GitHubIssue = {
      id: 123,
      number: 456,
      title: 'Fix login bug',
      body: 'Users cannot login with special characters',
      state: 'open',
      assignee: { login: 'developer' },
      labels: [{ name: 'bug' }, { name: 'priority:high' }],
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-02T00:00:00Z',
      html_url: 'https://github.com/owner/repo/issues/456'
    };

    const taskData = githubService.transformIssueToTaskData(githubIssue);

    expect(taskData.id).toBe('github-123');
    expect(taskData.title).toBe('Fix login bug');
    expect(taskData.description).toBe('Users cannot login with special characters');
    expect(taskData.status).toBe('open');
    expect(taskData.assignee).toBe('developer');
    expect(taskData.labels).toEqual(['bug', 'priority:high']);
    expect(taskData.externalUrl).toBe('https://github.com/owner/repo/issues/456');
    expect(taskData.sourceType).toBe('github');
    expect(taskData.sourceData).toEqual({
      number: 456,
      state: 'open',
      id: 123
    });
  });

  it('should handle GitHub issue with null body and assignee', () => {
    const githubIssue: GitHubIssue = {
      id: 789,
      number: 101,
      title: 'Update documentation',
      body: null,
      state: 'closed',
      assignee: null,
      labels: [],
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z',
      html_url: 'https://github.com/owner/repo/issues/101'
    };

    const taskData = githubService.transformIssueToTaskData(githubIssue);

    expect(taskData.description).toBeUndefined();
    expect(taskData.assignee).toBeUndefined();
    expect(taskData.labels).toEqual([]);
  });

  it('should extract priority from GitHub labels', () => {
    const labelsWithPriority = [
      { name: 'bug' },
      { name: 'priority:urgent' },
      { name: 'frontend' }
    ];

    const priority = githubService.extractPriorityFromLabels(labelsWithPriority);
    expect(priority).toBe('Urgent');
  });

  it('should handle labels without priority', () => {
    const labelsWithoutPriority = [
      { name: 'bug' },
      { name: 'frontend' },
      { name: 'enhancement' }
    ];

    const priority = githubService.extractPriorityFromLabels(labelsWithoutPriority);
    expect(priority).toBeUndefined();
  });

  it('should import GitHub issue as task successfully', async () => {
    const githubIssue: GitHubIssue = {
      id: 999,
      number: 888,
      title: 'New feature request',
      body: 'Add user dashboard functionality',
      state: 'open',
      assignee: { login: 'product-manager' },
      labels: [{ name: 'enhancement' }, { name: 'priority:medium' }],
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z',
      html_url: 'https://github.com/owner/repo/issues/888'
    };

    const config: TaskImportConfig = {
      targetArea: 'Product',
      taskType: 'Feature',
      importLabelsAsTags: true
    };

    // Mock successful task creation
    mockTaskImportManager.createTaskFromData.mockResolvedValue('Areas/Product/Tasks/New feature request.md');
    mockImportStatusService.isTaskImported.mockReturnValue(false);

    const result = await githubService.importIssueAsTask(githubIssue, config);

    expect(result.success).toBe(true);
    expect(result.taskPath).toBe('Areas/Product/Tasks/New feature request.md');
    expect(result.error).toBeUndefined();

    // Verify TaskImportManager was called with correct data
    expect(mockTaskImportManager.createTaskFromData).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'github-999',
        title: 'New feature request',
        sourceType: 'github'
      }),
      config
    );

    // Verify import was recorded
    expect(mockImportStatusService.recordImport).toHaveBeenCalledWith(
      expect.objectContaining({
        externalId: 'github-999',
        externalSource: 'github',
        taskPath: 'Areas/Product/Tasks/New feature request.md'
      })
    );
  });

  it('should map GitHub labels to task types', async () => {
    const githubIssue: GitHubIssue = {
      id: 555,
      number: 666,
      title: 'Bug fix needed',
      body: 'Fix critical bug',
      state: 'open',
      assignee: null,
      labels: [{ name: 'bug' }, { name: 'priority:high' }],
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z',
      html_url: 'https://github.com/owner/repo/issues/666'
    };

    // Mock label mapping configuration
    const labelMapping = { 'bug': 'Bug', 'enhancement': 'Feature' };
    githubService.setLabelTypeMapping(labelMapping);

    const config: TaskImportConfig = {
      targetArea: 'Development'
    };

    mockTaskImportManager.createTaskFromData.mockResolvedValue('Areas/Development/Tasks/Bug fix needed.md');
    mockImportStatusService.isTaskImported.mockReturnValue(false);

    const result = await githubService.importIssueAsTask(githubIssue, config);

    expect(result.success).toBe(true);

    // Verify TaskImportManager was called with mapped task type
    expect(mockTaskImportManager.createTaskFromData).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'github-555',
        title: 'Bug fix needed',
        sourceType: 'github'
      }),
      expect.objectContaining({
        taskType: 'Bug', // Should be mapped from 'bug' label
        targetArea: 'Development'
      })
    );
  });

  it('should handle import failure gracefully', async () => {
    const githubIssue: GitHubIssue = {
      id: 111,
      number: 222,
      title: 'Failing task',
      body: 'This will fail',
      state: 'open',
      assignee: null,
      labels: [],
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z',
      html_url: 'https://github.com/owner/repo/issues/222'
    };

    const config: TaskImportConfig = {
      taskType: 'Task'
    };

    // Mock task creation failure
    mockTaskImportManager.createTaskFromData.mockRejectedValue(new Error('Task already exists'));
    mockImportStatusService.isTaskImported.mockReturnValue(false);

    const result = await githubService.importIssueAsTask(githubIssue, config);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Task already exists');
    expect(result.taskPath).toBeUndefined();

    // Verify import was not recorded on failure
    expect(mockImportStatusService.recordImport).not.toHaveBeenCalled();
  });

  it('should skip already imported tasks', async () => {
    const githubIssue: GitHubIssue = {
      id: 333,
      number: 444,
      title: 'Already imported',
      body: 'This task was already imported',
      state: 'open',
      assignee: null,
      labels: [],
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z',
      html_url: 'https://github.com/owner/repo/issues/444'
    };

    const config: TaskImportConfig = {
      taskType: 'Task'
    };

    // Mock task already imported
    mockImportStatusService.isTaskImported.mockReturnValue(true);

    const result = await githubService.importIssueAsTask(githubIssue, config);

    expect(result.success).toBe(true);
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('Task already imported');

    // Verify TaskImportManager was not called
    expect(mockTaskImportManager.createTaskFromData).not.toHaveBeenCalled();
  });

  it('should handle different GitHub issue states', () => {
    const openIssue: GitHubIssue = {
      id: 1, number: 1, title: 'Open', body: null, state: 'open',
      assignee: null, labels: [], created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z', html_url: 'https://github.com/test'
    };

    const closedIssue: GitHubIssue = {
      ...openIssue, id: 2, state: 'closed'
    };

    const openTaskData = githubService.transformIssueToTaskData(openIssue);
    const closedTaskData = githubService.transformIssueToTaskData(closedIssue);

    expect(openTaskData.status).toBe('open');
    expect(closedTaskData.status).toBe('closed');
  });
});
