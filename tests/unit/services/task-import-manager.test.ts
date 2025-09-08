/**
 * Tests for TaskImportManager Service - Pure Logic Only
 * Tests sanitization, folder determination, and content generation without Obsidian APIs
 */

import { describe, it, expect } from 'vitest';
import type { ExternalTaskData, TaskImportConfig } from '../../../src/types/integrations';
import { TaskImportManager } from '../../../src/services/TaskImportManager';

// Mock settings for testing pure logic
const mockSettings = {
  tasksFolder: 'Tasks',
  areasFolder: 'Areas',
  projectsFolder: 'Projects',
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
    { name: 'Task', color: 'blue' },
    { name: 'Bug', color: 'red' },
    { name: 'Feature', color: 'green' }
  ],
  taskPropertyOrder: ['TITLE', 'TYPE', 'PRIORITY', 'AREAS', 'PROJECT', 'DONE', 'STATUS', 'PARENT_TASK', 'TAGS'],
  areaBasesEnabled: true,
  projectBasesEnabled: true,
  autoSyncAreaProjectBases: true,
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
  githubIntegration: {
    enabled: false,
    personalAccessToken: '',
    repositories: [] as string[],
    defaultRepository: '',
    issueFilters: {
      state: 'open' as const,
      assignee: '',
      labels: [] as string[]
    },
    labelTypeMapping: {}
  }
};

describe('TaskImportManager - Pure Logic', () => {
  // Create instance with null app/vault since we're only testing pure functions
  const taskImportManager = new TaskImportManager(null as any, null as any, mockSettings);

  it('should sanitize task names for file system', () => {
    const unsafeTitle = 'Fix: Bug with <special> characters / and \\ slashes';
    const sanitized = taskImportManager.sanitizeTaskName(unsafeTitle);

    // Should remove or replace unsafe characters
    expect(sanitized).not.toContain('<');
    expect(sanitized).not.toContain('>');
    expect(sanitized).not.toContain('/');
    expect(sanitized).not.toContain('\\');
    expect(sanitized).not.toContain(':');
  });

  it('should always use configured tasks folder regardless of context', () => {
    const configWithArea: TaskImportConfig = {
      targetArea: 'Development'
    };

    const configWithProject: TaskImportConfig = {
      targetProject: 'Mobile App'
    };

    const configWithBoth: TaskImportConfig = {
      targetArea: 'Development',
      targetProject: 'Mobile App'
    };

    const areaFolder = taskImportManager.determineTaskFolder(configWithArea);
    const projectFolder = taskImportManager.determineTaskFolder(configWithProject);
    const bothFolder = taskImportManager.determineTaskFolder(configWithBoth);

    // All tasks should go in the configured tasks folder
    expect(areaFolder).toBe('Tasks');
    expect(projectFolder).toBe('Tasks');
    expect(bothFolder).toBe('Tasks');
  });

  it('should generate proper front matter for external task', () => {
    const taskData: ExternalTaskData = {
      id: 'github-123',
      title: 'Fix login bug',
      description: 'Users cannot login with special characters',
      status: 'open',
      priority: 'high',
      assignee: 'developer',
      labels: ['bug', 'priority:high'],
      createdAt: new Date('2023-01-01'),
      updatedAt: new Date('2023-01-02'),
      externalUrl: 'https://github.com/owner/repo/issues/123',
      sourceType: 'github',
      sourceData: { number: 123 }
    };

    const config: TaskImportConfig = {
      targetArea: 'Development',
      taskType: 'Bug',
      importLabelsAsTags: true
    };

    const frontMatter = taskImportManager.generateTaskFrontMatter(taskData, config);

    expect(frontMatter.Title).toBe('Fix login bug');
    expect(frontMatter.Type).toBe('Task');
    expect(frontMatter.Category).toBe('Bug');
    expect(frontMatter.Priority).toBe('High');
    expect(frontMatter.Areas).toEqual(['[[Development]]']);
    expect(frontMatter.Done).toBe(false);
    expect(frontMatter.tags).toEqual(['bug', 'priority:high']);
  });

  it('should extract priority from external task data', () => {
    const taskDataWithPriority: ExternalTaskData = {
      id: 'test-1',
      title: 'Test Task',
      status: 'open',
      priority: 'high',
      createdAt: new Date(),
      updatedAt: new Date(),
      externalUrl: 'https://example.com',
      sourceType: 'github',
      sourceData: {}
    };

    const taskDataWithLabels: ExternalTaskData = {
      id: 'test-2',
      title: 'Test Task',
      status: 'open',
      labels: ['bug', 'priority:urgent', 'frontend'],
      createdAt: new Date(),
      updatedAt: new Date(),
      externalUrl: 'https://example.com',
      sourceType: 'github',
      sourceData: {}
    };

    const config: TaskImportConfig = {};

    const frontMatter1 = taskImportManager.generateTaskFrontMatter(taskDataWithPriority, config);
    const frontMatter2 = taskImportManager.generateTaskFrontMatter(taskDataWithLabels, config);

    expect(frontMatter1.Priority).toBe('High');
    expect(frontMatter2.Priority).toBe('Urgent');
  });

  it('should generate task content with external reference', () => {
    const taskData: ExternalTaskData = {
      id: 'linear-123',
      title: 'Update documentation',
      description: 'Update API documentation for v2.0',
      status: 'todo',
      createdAt: new Date(),
      updatedAt: new Date(),
      externalUrl: 'https://linear.app/team/issue/123',
      sourceType: 'linear',
      sourceData: {}
    };

    const content = taskImportManager.generateTaskContent(taskData);

    expect(content).toContain('Update API documentation for v2.0');
    expect(content).toContain('External Reference');
    expect(content).toContain('https://linear.app/team/issue/123');
    expect(content).toContain('**Source:** linear');
  });
});
