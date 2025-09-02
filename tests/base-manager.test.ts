/**
 * Tests for BaseManager service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('js-yaml', () => ({
  dump: vi.fn((obj) => `properties:\n  file.name:\n    displayName: Title\nviews:\n  - type: table\n    name: All`),
  load: vi.fn((content) => {
    if (content.includes('invalid')) {
      throw new Error('Invalid YAML');
    }
    return {
      properties: { 'file.name': { displayName: 'Title' } },
      views: [{ type: 'table', name: 'All' }]
    };
  })
}));

import { BaseManager, ProjectAreaInfo } from '../src/services/BaseManager';
import { TaskSyncSettings } from '../src/main';

// Mock Obsidian Vault
const mockVault = {
  getAbstractFileByPath: vi.fn(),
  getMarkdownFiles: vi.fn(),
  create: vi.fn(),
  modify: vi.fn(),
  read: vi.fn(),
  createFolder: vi.fn(),
  adapter: {
    exists: vi.fn()
  }
};

// Mock TFile
const mockTFile = {
  path: 'test.md',
  basename: 'test'
};

describe('BaseManager', () => {
  let baseManager: BaseManager;
  let settings: TaskSyncSettings;

  beforeEach(() => {
    settings = {
      tasksFolder: 'Tasks',
      projectsFolder: 'Projects',
      areasFolder: 'Areas',
      templateFolder: 'Templates',
      useTemplater: false,
      defaultTaskTemplate: '',
      defaultProjectTemplate: '',
      defaultAreaTemplate: '',
      basesFolder: 'Bases',
      tasksBaseFile: 'Tasks.base',
      autoGenerateBases: true,
      autoUpdateBaseViews: true
    };

    baseManager = new BaseManager(mockVault as any, settings);

    // Reset mocks
    vi.clearAllMocks();
  });

  describe('generateTasksBase', () => {
    it('should generate a valid Tasks.base file with default properties', async () => {
      const projectsAndAreas: ProjectAreaInfo[] = [
        { name: 'Test Project', path: 'Projects/Test Project.md', type: 'project' },
        { name: 'Test Area', path: 'Areas/Test Area.md', type: 'area' }
      ];

      const result = await baseManager.generateTasksBase(projectsAndAreas);

      expect(result).toContain('properties:');
      expect(result).toContain('file.name:');
      expect(result).toContain('displayName: Title');
      expect(result).toContain('note.Status:');
      expect(result).toContain('displayName: Done');
      expect(result).toContain('views:');
      expect(result).toContain('- type: table');
      expect(result).toContain('name: All');
    });

    it('should include project and area views', async () => {
      const projectsAndAreas: ProjectAreaInfo[] = [
        { name: 'Ghost Plugin', path: 'Projects/Ghost Plugin.md', type: 'project' },
        { name: 'Sentry', path: 'Areas/Sentry.md', type: 'area' }
      ];

      const result = await baseManager.generateTasksBase(projectsAndAreas);

      expect(result).toContain('name: Ghost Plugin');
      expect(result).toContain('Project.contains(link("Ghost Plugin"))');
      expect(result).toContain('name: Sentry');
      expect(result).toContain('Areas.contains(link("Areas/Sentry.md", "Sentry"))');
    });

    it('should handle empty projects and areas list', async () => {
      const result = await baseManager.generateTasksBase([]);

      expect(result).toContain('properties:');
      expect(result).toContain('views:');
      expect(result).toContain('name: All');
      // Should only have the default "All" view
      const viewMatches = result.match(/name: /g);
      expect(viewMatches).toHaveLength(1);
    });
  });

  describe('ensureBasesFolder', () => {
    it('should create bases folder if it does not exist', async () => {
      mockVault.adapter.exists.mockResolvedValue(false);

      await baseManager.ensureBasesFolder();

      expect(mockVault.createFolder).toHaveBeenCalledWith('Bases');
    });

    it('should not create bases folder if it already exists', async () => {
      mockVault.adapter.exists.mockResolvedValue(true);

      await baseManager.ensureBasesFolder();

      expect(mockVault.createFolder).not.toHaveBeenCalled();
    });
  });

  describe('createOrUpdateTasksBase', () => {
    it('should create new base file if it does not exist', async () => {
      const projectsAndAreas: ProjectAreaInfo[] = [];
      mockVault.getAbstractFileByPath.mockReturnValue(null);

      await baseManager.createOrUpdateTasksBase(projectsAndAreas);

      expect(mockVault.create).toHaveBeenCalledWith(
        'Bases/Tasks.base',
        expect.stringContaining('properties:')
      );
    });

    it('should update existing base file', async () => {
      const projectsAndAreas: ProjectAreaInfo[] = [];
      mockVault.getAbstractFileByPath.mockReturnValue(mockTFile);

      await baseManager.createOrUpdateTasksBase(projectsAndAreas);

      expect(mockVault.modify).toHaveBeenCalledWith(
        mockTFile,
        expect.stringContaining('properties:')
      );
    });
  });

  describe('ensureBaseEmbedding', () => {
    it('should add base embedding if missing', async () => {
      const filePath = 'Projects/Test Project.md';
      const content = '# Test Project\n\nSome content';

      mockVault.getAbstractFileByPath.mockReturnValue(mockTFile);
      mockVault.read.mockResolvedValue(content);

      await baseManager.ensureBaseEmbedding(filePath);

      expect(mockVault.modify).toHaveBeenCalledWith(
        mockTFile,
        expect.stringContaining('![[Tasks.base]]')
      );
    });

    it('should not modify file if base embedding already exists', async () => {
      const filePath = 'Projects/Test Project.md';
      const content = '# Test Project\n\n![[Tasks.base]]';

      mockVault.getAbstractFileByPath.mockReturnValue(mockTFile);
      mockVault.read.mockResolvedValue(content);

      await baseManager.ensureBaseEmbedding(filePath);

      expect(mockVault.modify).not.toHaveBeenCalled();
    });
  });

  describe('getProjectsAndAreas', () => {
    it('should scan and return projects and areas', async () => {
      const mockFiles = [
        { path: 'Projects/Project1.md', basename: 'Project1' },
        { path: 'Projects/Project2.md', basename: 'Project2' },
        { path: 'Areas/Area1.md', basename: 'Area1' },
        { path: 'Areas/Area2.md', basename: 'Area2' }
      ];

      mockVault.getAbstractFileByPath.mockReturnValue(true); // folders exist
      mockVault.getMarkdownFiles.mockReturnValue(mockFiles);

      const result = await baseManager.getProjectsAndAreas();

      expect(result).toHaveLength(4);
      expect(result.filter(item => item.type === 'project')).toHaveLength(2);
      expect(result.filter(item => item.type === 'area')).toHaveLength(2);
      expect(result[0]).toEqual({
        name: 'Project1',
        path: 'Projects/Project1.md',
        type: 'project'
      });
    });

    it('should handle missing folders gracefully', async () => {
      mockVault.getAbstractFileByPath.mockReturnValue(null); // folders don't exist
      mockVault.getMarkdownFiles.mockReturnValue([]);

      const result = await baseManager.getProjectsAndAreas();

      expect(result).toHaveLength(0);
    });
  });

  describe('parseBaseFile', () => {
    it('should parse valid YAML base file content', async () => {
      const yamlContent = `
properties:
  file.name:
    displayName: Title
views:
  - type: table
    name: All
`;

      const result = await baseManager.parseBaseFile(yamlContent);

      expect(result).toBeDefined();
      expect(result?.properties).toBeDefined();
      expect(result?.views).toBeDefined();
      expect(result?.views).toHaveLength(1);
    });

    it('should return null for invalid YAML', async () => {
      const invalidYaml = 'invalid: yaml: content: [';

      const result = await baseManager.parseBaseFile(invalidYaml);

      expect(result).toBeNull();
    });
  });
});
