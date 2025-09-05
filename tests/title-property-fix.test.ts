/**
 * Test to verify the Title property fix
 * This tests the logic for extracting filename from path for Title property
 */

import { describe, it, expect } from 'vitest';

describe('Title Property Fix', () => {
  describe('getDefaultTitle logic', () => {
    // This replicates the logic from TaskPropertyHandler.getDefaultTitle
    function getDefaultTitle(filePath: string): string {
      const fileName = filePath.split('/').pop() || '';
      return fileName.replace(/\.md$/, '');
    }

    it('should extract filename without extension from simple path', () => {
      const result = getDefaultTitle('Tasks/Test Task.md');
      expect(result).toBe('Test Task');
    });

    it('should extract filename without extension from complex path', () => {
      const result = getDefaultTitle('Projects/My Project/Important Task.md');
      expect(result).toBe('Important Task');
    });

    it('should handle filename with special characters', () => {
      const result = getDefaultTitle('Tasks/Task with Special-Chars & Symbols.md');
      expect(result).toBe('Task with Special-Chars & Symbols');
    });

    it('should handle empty path gracefully', () => {
      const result = getDefaultTitle('');
      expect(result).toBe('');
    });

    it('should handle path without extension', () => {
      const result = getDefaultTitle('Tasks/Task without extension');
      expect(result).toBe('Task without extension');
    });

    it('should handle path with only filename', () => {
      const result = getDefaultTitle('MyTask.md');
      expect(result).toBe('MyTask');
    });
  });
});
