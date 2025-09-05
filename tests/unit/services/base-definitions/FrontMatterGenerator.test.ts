import { describe, it, expect } from 'vitest';
import { generateTaskFrontMatter } from '../../../../src/services/base-definitions/FrontMatterGenerator';
import { TaskCreateData } from '../../../../src/components/modals/TaskCreateModal';
import { TaskSyncSettings } from '../../../../src/components/ui/settings/types';
import { DEFAULT_SETTINGS } from '../../../../src/components/ui/settings/defaults';

describe('FrontMatterGenerator - Property Ordering', () => {
  const mockTaskData: TaskCreateData = {
    name: 'Test Task',
    type: 'Task',
    priority: 'Medium',
    areas: 'Area1',
    project: 'Project1',
    done: false,
    status: 'Backlog',
    parentTask: '',
    subTasks: [],
    tags: ['tag1']
  };

  it('should respect custom property order when provided in settings', () => {
    // ❌ This test should fail initially because custom property order is not implemented yet
    const customSettings: Partial<TaskSyncSettings> = {
      ...DEFAULT_SETTINGS,
      taskPropertyOrder: ['TYPE', 'TITLE', 'DONE', 'STATUS', 'PRIORITY', 'AREAS', 'PROJECT', 'PARENT_TASK', 'SUB_TASKS', 'TAGS']
    };

    const frontMatter = generateTaskFrontMatter(mockTaskData, { settings: customSettings as TaskSyncSettings });

    // Parse the front-matter to check property order
    const lines = frontMatter.split('\n').filter(line => line.trim() && !line.startsWith('---'));

    // Should start with Type, then Title, then Done, etc.
    expect(lines[0]).toMatch(/^Type:/);
    expect(lines[1]).toMatch(/^Title:/);
    expect(lines[2]).toMatch(/^Done:/);
    expect(lines[3]).toMatch(/^Status:/);
    expect(lines[4]).toMatch(/^Priority:/);
  });

  it('should use default property order when no custom order is provided', () => {
    const frontMatter = generateTaskFrontMatter(mockTaskData);

    // Parse the front-matter to check property order
    const lines = frontMatter.split('\n').filter(line => line.trim() && !line.startsWith('---'));

    // Should start with default order: Title, Type, Priority, etc.
    expect(lines[0]).toMatch(/^Title:/);
    expect(lines[1]).toMatch(/^Type:/);
    expect(lines[2]).toMatch(/^Priority:/);
  });

  it('should fall back to default order when custom order is invalid', () => {
    const invalidSettings: Partial<TaskSyncSettings> = {
      ...DEFAULT_SETTINGS,
      taskPropertyOrder: ['INVALID_PROPERTY', 'TYPE'] // Missing required properties
    };

    const frontMatter = generateTaskFrontMatter(mockTaskData, { settings: invalidSettings as TaskSyncSettings });

    // Should fall back to default order
    const lines = frontMatter.split('\n').filter(line => line.trim() && !line.startsWith('---'));
    expect(lines[0]).toMatch(/^Title:/);
    expect(lines[1]).toMatch(/^Type:/);
  });
});
