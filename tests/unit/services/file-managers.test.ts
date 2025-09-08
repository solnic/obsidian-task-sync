import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AreaFileManager } from '../../../src/services/AreaFileManager';
import { ProjectFileManager } from '../../../src/services/ProjectFileManager';
import { TaskFileManager } from '../../../src/services/TaskFileManager';

// Mock Obsidian API
const mockApp = {
  vault: {
    getAbstractFileByPath: vi.fn(),
    read: vi.fn(),
    create: vi.fn(),
    modify: vi.fn(),
    adapter: {
      exists: vi.fn()
    }
  },
  fileManager: {
    processFrontMatter: vi.fn()
  }
};

const mockSettings = {
  areasFolder: 'Areas',
  projectsFolder: 'Projects', 
  tasksFolder: 'Tasks',
  taskPropertyOrder: ['TITLE', 'TYPE', 'CATEGORY', 'PRIORITY', 'AREAS', 'PROJECT', 'DONE', 'STATUS', 'PARENT_TASK', 'SUB_TASKS', 'TAGS']
};

describe('File Managers Property Ordering', () => {
  let areaFileManager: AreaFileManager;
  let projectFileManager: ProjectFileManager;
  let taskFileManager: TaskFileManager;

  beforeEach(() => {
    vi.clearAllMocks();
    areaFileManager = new AreaFileManager(mockApp as any, mockApp.vault as any, mockSettings as any);
    projectFileManager = new ProjectFileManager(mockApp as any, mockApp.vault as any, mockSettings as any);
    taskFileManager = new TaskFileManager(mockApp as any, mockApp.vault as any, mockSettings as any);
  });

  describe('AreaFileManager', () => {
    it('should update area file properties with correct ordering', async () => {
      const filePath = 'Areas/Test Area.md';
      const fileContent = `---
Type: Area
Name: Test Area
---

Area content here.`;

      mockApp.vault.getAbstractFileByPath.mockReturnValue({ path: filePath });
      mockApp.vault.read.mockResolvedValue(fileContent);

      const result = await areaFileManager.updateFileProperties(filePath);

      expect(result.hasChanges).toBe(true);
      expect(result.propertiesChanged).toBeGreaterThan(0);
    });

    it('should get area properties in correct order', () => {
      const properties = areaFileManager.getPropertiesInOrder();
      
      expect(properties).toBeDefined();
      expect(properties.length).toBeGreaterThan(0);
      expect(properties[0].name).toBe('Name');
      expect(properties[1].name).toBe('Type');
    });
  });

  describe('ProjectFileManager', () => {
    it('should update project file properties with correct ordering', async () => {
      const filePath = 'Projects/Test Project.md';
      const fileContent = `---
Type: Project
Name: Test Project
Areas: []
---

Project content here.`;

      mockApp.vault.getAbstractFileByPath.mockReturnValue({ path: filePath });
      mockApp.vault.read.mockResolvedValue(fileContent);

      const result = await projectFileManager.updateFileProperties(filePath);

      expect(result.hasChanges).toBe(true);
      expect(result.propertiesChanged).toBeGreaterThan(0);
    });

    it('should get project properties in correct order', () => {
      const properties = projectFileManager.getPropertiesInOrder();
      
      expect(properties).toBeDefined();
      expect(properties.length).toBeGreaterThan(0);
      expect(properties[0].name).toBe('Name');
      expect(properties[1].name).toBe('Type');
    });
  });

  describe('TaskFileManager', () => {
    it('should use base class property ordering functionality', async () => {
      const filePath = 'Tasks/Test Task.md';
      const fileContent = `---
Type: Task
Title: Test Task
Priority: Low
---

Task content here.`;

      mockApp.vault.getAbstractFileByPath.mockReturnValue({ path: filePath });
      mockApp.vault.read.mockResolvedValue(fileContent);

      const result = await taskFileManager.updateTaskFileProperties(filePath);

      expect(result.hasChanges).toBe(true);
      expect(result.propertiesChanged).toBeGreaterThan(0);
    });
  });
});
