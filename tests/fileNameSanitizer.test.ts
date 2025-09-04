/**
 * Tests for File Name Sanitizer Utility
 * Verifies behavior specifications for file name sanitization and validation
 */

import { describe, it, expect } from 'vitest';
import {
  sanitizeFileName,
  createSafeFileName,
  validateFileName,
  previewSanitization
} from '../src/utils/fileNameSanitizer';

describe('File Name Sanitizer', () => {
  describe('sanitizeFileName', () => {
    describe('when sanitizing invalid characters', () => {
      it('should replace all invalid Obsidian characters with default replacement', () => {
        const input = 'Project: Website/Mobile App*Test"File\\Path<>|?';
        const result = sanitizeFileName(input);

        expect(result).toBe('Project- Website-Mobile App-Test-File-Path');
      });

      it('should use custom replacement character when specified', () => {
        const input = 'Project: Website/Mobile App';
        const result = sanitizeFileName(input, { replacement: '_' });

        expect(result).toBe('Project_ Website_Mobile App');
      });

      it('should remove invalid characters when replacement is empty string', () => {
        const input = 'Project: Website/Mobile App';
        const result = sanitizeFileName(input, { replacement: '' });

        expect(result).toBe('Project WebsiteMobile App');
      });
    });

    describe('when handling edge cases', () => {
      it('should collapse multiple consecutive replacement characters', () => {
        const input = 'Project::/Website//Mobile';
        const result = sanitizeFileName(input);

        expect(result).toBe('Project-Website-Mobile');
      });

      it('should not collapse replacements when disabled', () => {
        const input = 'Project::/Website//Mobile';
        const result = sanitizeFileName(input, { collapseReplacements: false });

        expect(result).toBe('Project---Website--Mobile');
      });

      it('should trim leading and trailing whitespace', () => {
        const input = '  Project: Website  ';
        const result = sanitizeFileName(input);

        expect(result).toBe('Project- Website');
      });

      it('should remove leading and trailing replacement characters', () => {
        const input = ':Project Website:';
        const result = sanitizeFileName(input);

        expect(result).toBe('Project Website');
      });

      it('should handle empty string after sanitization', () => {
        const input = ':::///';
        const result = sanitizeFileName(input);

        expect(result).toBe('untitled');
      });

      it('should truncate long file names', () => {
        const input = 'A'.repeat(300);
        const result = sanitizeFileName(input, { maxLength: 50 });

        expect(result).toHaveLength(50);
        expect(result).toBe('A'.repeat(50));
      });
    });

    describe('when preserving valid characters', () => {
      it('should preserve valid characters and spaces', () => {
        const input = 'Valid Project Name 123';
        const result = sanitizeFileName(input);

        expect(result).toBe('Valid Project Name 123');
      });

      it('should preserve special characters that are valid', () => {
        const input = 'Project (v2.0) - Final [DONE]';
        const result = sanitizeFileName(input);

        expect(result).toBe('Project (v2.0) - Final [DONE]');
      });
    });

    describe('when handling invalid input', () => {
      it('should throw error for null or undefined input', () => {
        expect(() => sanitizeFileName(null as any)).toThrow('File name must be a non-empty string');
        expect(() => sanitizeFileName(undefined as any)).toThrow('File name must be a non-empty string');
      });

      it('should throw error for empty string input', () => {
        expect(() => sanitizeFileName('')).toThrow('File name must be a non-empty string');
      });

      it('should throw error for non-string input', () => {
        expect(() => sanitizeFileName(123 as any)).toThrow('File name must be a non-empty string');
      });
    });
  });

  describe('createSafeFileName', () => {
    it('should create file name with default .md extension', () => {
      const result = createSafeFileName('Project: Website');

      expect(result).toBe('Project- Website.md');
    });

    it('should create file name with custom extension', () => {
      const result = createSafeFileName('Project: Website', 'base');

      expect(result).toBe('Project- Website.base');
    });

    it('should handle extension with leading dot', () => {
      const result = createSafeFileName('Project: Website', '.txt');

      expect(result).toBe('Project- Website.txt');
    });
  });

  describe('validateFileName', () => {
    it('should return valid for file names without invalid characters', () => {
      const result = validateFileName('Valid Project Name');

      expect(result.isValid).toBe(true);
      expect(result.invalidCharacters).toEqual([]);
    });

    it('should return invalid and list invalid characters', () => {
      const result = validateFileName('Project: Website/Mobile*');

      expect(result.isValid).toBe(false);
      expect(result.invalidCharacters).toEqual([':', '/', '*']);
    });

    it('should handle duplicate invalid characters', () => {
      const result = validateFileName('Project::Website//Mobile');

      expect(result.isValid).toBe(false);
      expect(result.invalidCharacters).toEqual([':', '/']);
    });

    it('should handle empty or invalid input', () => {
      expect(validateFileName('').isValid).toBe(false);
      expect(validateFileName(null as any).isValid).toBe(false);
    });
  });

  describe('previewSanitization', () => {
    it('should show preview of sanitization changes', () => {
      const result = previewSanitization('Project: Website/Mobile');

      expect(result.original).toBe('Project: Website/Mobile');
      expect(result.sanitized).toBe('Project- Website-Mobile');
      expect(result.hasChanges).toBe(true);
      expect(result.invalidCharacters).toEqual([':', '/']);
    });

    it('should show no changes for valid file names', () => {
      const result = previewSanitization('Valid Project Name');

      expect(result.original).toBe('Valid Project Name');
      expect(result.sanitized).toBe('Valid Project Name');
      expect(result.hasChanges).toBe(false);
      expect(result.invalidCharacters).toEqual([]);
    });
  });
});
