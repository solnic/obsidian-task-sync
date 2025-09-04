/**
 * Unit tests for settings suggest components
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FileSuggestComponent } from '../../src/components/ui/settings/suggest';
import { TFile } from 'obsidian';

// Mock TFile class that simulates TFile for instanceof checks
class MockTFile {
  path: string;
  name: string;

  constructor(path: string, name: string) {
    this.path = path;
    this.name = name;
  }
}

// Make MockTFile instances pass instanceof TFile check
Object.setPrototypeOf(MockTFile.prototype, TFile.prototype);

// Mock Obsidian App and Vault
const mockFiles = [
  new MockTFile('Templates/task-template.md', 'task-template.md'),
  new MockTFile('Templates/project-template.md', 'project-template.md'),
  new MockTFile('Templates/area-template.md', 'area-template.md'),
  new MockTFile('Templates/subfolder/nested-template.md', 'nested-template.md'),
  new MockTFile('Tasks/some-task.md', 'some-task.md'),
  new MockTFile('Projects/some-project.md', 'some-project.md'),
  new MockTFile('Areas/some-area.md', 'some-area.md'),
  new MockTFile('root-file.md', 'root-file.md')
];

const mockApp = {
  vault: {
    getAllLoadedFiles: vi.fn(() => mockFiles)
  }
};

describe('FileSuggestComponent', () => {
  let inputEl: HTMLInputElement;
  let fileSuggest: FileSuggestComponent;

  beforeEach(() => {
    inputEl = document.createElement('input');
    document.body.appendChild(inputEl);
  });

  afterEach(() => {
    if (fileSuggest) {
      fileSuggest.destroy();
    }
    document.body.removeChild(inputEl);
  });

  describe('folder path filtering', () => {
    it('should show all files when no folder path is specified', () => {
      fileSuggest = new FileSuggestComponent(mockApp as any, inputEl, {
        fileExtensions: ['.md']
      });

      // Access private method for testing
      const suggestions = (fileSuggest as any).getFileSuggestions('');

      expect(suggestions).toContain('task-template.md');
      expect(suggestions).toContain('project-template.md');
      expect(suggestions).toContain('some-task.md');
      expect(suggestions).toContain('some-project.md');
      expect(suggestions).toContain('root-file.md');
    });

    it('should filter files by template folder when folderPath is specified', () => {
      fileSuggest = new FileSuggestComponent(mockApp as any, inputEl, {
        fileExtensions: ['.md'],
        folderPath: 'Templates'
      });

      // Access private method for testing
      const suggestions = (fileSuggest as any).getFileSuggestions('');

      // Should only show files from Templates folder
      expect(suggestions).toContain('task-template.md');
      expect(suggestions).toContain('project-template.md');
      expect(suggestions).toContain('area-template.md');
      expect(suggestions).toContain('nested-template.md'); // subfolder files included

      // Should not show files from other folders
      expect(suggestions).not.toContain('some-task.md');
      expect(suggestions).not.toContain('some-project.md');
      expect(suggestions).not.toContain('some-area.md');
      expect(suggestions).not.toContain('root-file.md');
    });

    it('should filter files by query within template folder', () => {
      fileSuggest = new FileSuggestComponent(mockApp as any, inputEl, {
        fileExtensions: ['.md'],
        folderPath: 'Templates'
      });

      // Access private method for testing
      const suggestions = (fileSuggest as any).getFileSuggestions('task');

      // Should only show template files matching query
      expect(suggestions).toContain('task-template.md');
      expect(suggestions).not.toContain('project-template.md');
      expect(suggestions).not.toContain('area-template.md');

      // Should not show files from other folders even if they match query
      expect(suggestions).not.toContain('some-task.md');
    });

    it('should handle empty folder path (root folder)', () => {
      fileSuggest = new FileSuggestComponent(mockApp as any, inputEl, {
        fileExtensions: ['.md'],
        folderPath: ''
      });

      // Access private method for testing
      const suggestions = (fileSuggest as any).getFileSuggestions('');

      // Should only show files in root (no folder path)
      expect(suggestions).toContain('root-file.md');

      // Should not show files in subfolders
      expect(suggestions).not.toContain('task-template.md');
      expect(suggestions).not.toContain('some-task.md');
    });

    it('should handle non-existent folder path gracefully', () => {
      fileSuggest = new FileSuggestComponent(mockApp as any, inputEl, {
        fileExtensions: ['.md'],
        folderPath: 'NonExistentFolder'
      });

      // Access private method for testing
      const suggestions = (fileSuggest as any).getFileSuggestions('');

      // Should return empty array when no files match folder path
      expect(suggestions).toEqual([]);
    });
  });

  describe('file extension filtering', () => {
    it('should filter by file extensions within template folder', () => {
      fileSuggest = new FileSuggestComponent(mockApp as any, inputEl, {
        fileExtensions: ['.md'],
        folderPath: 'Templates'
      });

      // Access private method for testing
      const suggestions = (fileSuggest as any).getFileSuggestions('');

      // All template files are .md, so should show all
      expect(suggestions.length).toBeGreaterThan(0);
      suggestions.forEach((suggestion: string) => {
        expect(suggestion.endsWith('.md')).toBe(true);
      });
    });
  });
});
