/**
 * Tests for BaseManager Formula Structure
 * Verifies behavior specifications for enhanced base formula structure and file name handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BaseManager, ProjectAreaInfo } from '../src/services/BaseManager';
import { TaskSyncSettings } from '../src/main';

// Mock Obsidian dependencies
const mockApp = {
  vault: {
    adapter: {
      exists: vi.fn()
    },
    createFolder: vi.fn(),
    create: vi.fn(),
    modify: vi.fn(),
    getAbstractFileByPath: vi.fn()
  }
} as any;

const mockVault = mockApp.vault;

const mockSettings: TaskSyncSettings = {
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
  autoUpdateBaseViews: true,
  taskTypes: [
    { name: 'Task', color: 'blue' },
    { name: 'Bug', color: 'red' },
    { name: 'Feature', color: 'green' }
  ],
  areaBasesEnabled: true,
  projectBasesEnabled: true,
  autoSyncAreaProjectBases: true
};

describe('BaseManager Formula Structure', () => {
  let baseManager: BaseManager;

  beforeEach(() => {
    vi.clearAllMocks();
    baseManager = new BaseManager(mockApp, mockVault, mockSettings);
  });

  describe('when generating task base with new formula structure', () => {
    it('should include Title formula with link function', async () => {
      const projectsAndAreas: ProjectAreaInfo[] = [
        { name: 'Test Project', path: 'Projects/Test Project.md', type: 'project' },
        { name: 'Test Area', path: 'Areas/Test Area.md', type: 'area' }
      ];

      const result = await baseManager.generateTasksBase(projectsAndAreas);

      expect(result).toContain('formulas:');
      expect(result).toContain('Title: link(file.name, Title)');
      expect(result).toContain('note.Type:');
      expect(result).toContain('displayName: Type');
    });

    it('should use formula.Title in view order instead of file.name', async () => {
      const projectsAndAreas: ProjectAreaInfo[] = [];
      const result = await baseManager.generateTasksBase(projectsAndAreas);

      expect(result).toContain('formula.Title');
      // file.name should only appear in the formula definition, not in view configurations
      expect(result).toContain('link(file.name, Title)');
      expect(result).not.toMatch(/order:[\s\S]*?file\.name/);
    });

    it('should include note.Title property for frontmatter access', async () => {
      const projectsAndAreas: ProjectAreaInfo[] = [];
      const result = await baseManager.generateTasksBase(projectsAndAreas);

      expect(result).toContain('file.name:');
      expect(result).toContain('displayName: Title');
    });
  });

  describe('when generating area base with new formula structure', () => {
    it('should include Title formula with link function', async () => {
      const area: ProjectAreaInfo = {
        name: 'Test Area',
        path: 'Areas/Test Area.md',
        type: 'area'
      };

      const result = await baseManager.generateAreaBase(area);

      expect(result).toContain('formulas:');
      expect(result).toContain('Title: link(file.name, Title)');
      expect(result).toContain('note.Type:');
      expect(result).toContain('displayName: Type');
    });

    it('should use formula.Title in view configurations', async () => {
      const area: ProjectAreaInfo = {
        name: 'Test Area',
        path: 'Areas/Test Area.md',
        type: 'area'
      };

      const result = await baseManager.generateAreaBase(area);

      expect(result).toContain('formula.Title');
      // file.name should only appear in the formula definition, not in view configurations
      expect(result).toContain('link(file.name, Title)');
      expect(result).not.toMatch(/order:[\s\S]*?file\.name/);
    });
  });

  describe('when generating project base with new formula structure', () => {
    it('should include Title formula with link function', async () => {
      const project: ProjectAreaInfo = {
        name: 'Test Project',
        path: 'Projects/Test Project.md',
        type: 'project'
      };

      const result = await baseManager.generateProjectBase(project);

      expect(result).toContain('formulas:');
      expect(result).toContain('Title: link(file.name, Title)');
      expect(result).toContain('note.Type:');
      expect(result).toContain('displayName: Type');
    });

    it('should use formula.Title in view configurations', async () => {
      const project: ProjectAreaInfo = {
        name: 'Test Project',
        path: 'Projects/Test Project.md',
        type: 'project'
      };

      const result = await baseManager.generateProjectBase(project);

      expect(result).toContain('formula.Title');
      // file.name should only appear in the formula definition, not in view configurations
      expect(result).toContain('link(file.name, Title)');
      expect(result).not.toMatch(/order:[\s\S]*?file\.name/);
    });
  });

  describe('when handling file names with invalid characters', () => {
    it('should sanitize area base file names', async () => {
      const area: ProjectAreaInfo = {
        name: 'Test: Area/With*Invalid?Chars',
        path: 'Areas/Test- Area-With-Invalid-Chars.md',
        type: 'area'
      };

      mockVault.adapter.exists.mockResolvedValue(false);

      await baseManager.createOrUpdateAreaBase(area);

      expect(mockVault.create).toHaveBeenCalledWith(
        'Bases/Test- Area-With-Invalid-Chars.base',
        expect.any(String)
      );
    });

    it('should sanitize project base file names', async () => {
      const project: ProjectAreaInfo = {
        name: 'Project: Website/Mobile*App',
        path: 'Projects/Project- Website-Mobile-App.md',
        type: 'project'
      };

      mockVault.adapter.exists.mockResolvedValue(false);

      await baseManager.createOrUpdateProjectBase(project);

      expect(mockVault.create).toHaveBeenCalledWith(
        'Bases/Project- Website-Mobile-App.base',
        expect.any(String)
      );
    });
  });

  describe('when validating YAML structure', () => {
    it('should generate valid YAML for task base', async () => {
      const projectsAndAreas: ProjectAreaInfo[] = [];
      const result = await baseManager.generateTasksBase(projectsAndAreas);

      // Should not throw when parsing YAML
      expect(() => {
        const yaml = require('js-yaml');
        yaml.load(result);
      }).not.toThrow();
    });

    it('should generate valid YAML for area base', async () => {
      const area: ProjectAreaInfo = {
        name: 'Test Area',
        path: 'Areas/Test Area.md',
        type: 'area'
      };

      const result = await baseManager.generateAreaBase(area);

      // Should not throw when parsing YAML
      expect(() => {
        const yaml = require('js-yaml');
        yaml.load(result);
      }).not.toThrow();
    });

    it('should generate valid YAML for project base', async () => {
      const project: ProjectAreaInfo = {
        name: 'Test Project',
        path: 'Projects/Test Project.md',
        type: 'project'
      };

      const result = await baseManager.generateProjectBase(project);

      // Should not throw when parsing YAML
      expect(() => {
        const yaml = require('js-yaml');
        yaml.load(result);
      }).not.toThrow();
    });
  });
});
