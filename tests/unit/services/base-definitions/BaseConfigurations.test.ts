/**
 * Tests for base file generation - verifies correct YAML structure
 */

import { describe, it, expect } from 'vitest';
import {
  generateTasksBase,
  generateAreaBase,
  ProjectAreaInfo
} from '../../../../src/services/base-definitions/BaseConfigurations';
import { TaskSyncSettings } from '../../../../src/main';
import { DEFAULT_SETTINGS } from '../../../../src/components/ui/settings/defaults';
import * as yaml from 'js-yaml';

describe('Base File Generation', () => {
  const mockSettings: TaskSyncSettings = {
    ...DEFAULT_SETTINGS,
    tasksFolder: '5. Bases/Tasks'
  };

  const mockProjectsAndAreas: ProjectAreaInfo[] = [
    { name: 'Task Sync', path: 'Areas/Task Sync.md', type: 'area' }
  ];

  describe('Tasks Base YAML Structure', () => {
    it('should generate base with correct formulas section', () => {
      const result = generateTasksBase(mockSettings, mockProjectsAndAreas);
      const parsed = yaml.load(result) as any;

      expect(parsed.formulas).toBeDefined();
      expect(parsed.formulas.Title).toBe('link(file.name, Title)');
    });

    it('should generate base with numbered properties and metadata properties', () => {
      const result = generateTasksBase(mockSettings, mockProjectsAndAreas);
      const parsed = yaml.load(result) as any;

      expect(parsed.properties).toBeDefined();

      // Should have numbered properties
      expect(parsed.properties['0']).toBeDefined();
      expect(parsed.properties['0'].name).toBe('Title');
      expect(parsed.properties['0'].type).toBe('string');
      expect(parsed.properties['0'].source).toBe('formula.Title');

      // Should have Created At and Updated At as numbered properties
      const createdAtProp = Object.values(parsed.properties).find((p: any) => p.name === 'Created At');
      const updatedAtProp = Object.values(parsed.properties).find((p: any) => p.name === 'Updated At');

      expect(createdAtProp).toBeDefined();
      expect((createdAtProp as any).type).toBe('string');
      expect((createdAtProp as any).source).toBe('file.ctime');

      expect(updatedAtProp).toBeDefined();
      expect((updatedAtProp as any).type).toBe('string');
      expect((updatedAtProp as any).source).toBe('file.mtime');

      // Should have file.ctime and file.mtime metadata entries
      expect(parsed.properties['file.ctime']).toBeDefined();
      expect(parsed.properties['file.ctime'].displayName).toBe('Created At');

      expect(parsed.properties['file.mtime']).toBeDefined();
      expect(parsed.properties['file.mtime'].displayName).toBe('Updated At');
    });

    it('should generate views that reference source values in order and sort', () => {
      const result = generateTasksBase(mockSettings, mockProjectsAndAreas);
      const parsed = yaml.load(result) as any;

      expect(parsed.views).toBeDefined();
      expect(Array.isArray(parsed.views)).toBe(true);

      // Find the main Tasks view
      const tasksView = parsed.views.find((v: any) => v.name === 'Tasks');
      expect(tasksView).toBeDefined();

      // Should reference source values in order
      expect(tasksView.order).toContain('Done');
      expect(tasksView.order).toContain('formula.Title');
      expect(tasksView.order).toContain('file.ctime');
      expect(tasksView.order).toContain('file.mtime');

      // Should reference source values in sort
      expect(tasksView.sort).toBeDefined();
      expect(Array.isArray(tasksView.sort)).toBe(true);

      const sortProperties = tasksView.sort.map((s: any) => s.property);
      expect(sortProperties).toContain('Done');
      expect(sortProperties).toContain('file.mtime');
      expect(sortProperties).toContain('formula.Title');
    });

    it('should generate all required task types and priority views', () => {
      const result = generateTasksBase(mockSettings, mockProjectsAndAreas);
      const parsed = yaml.load(result) as any;

      // Should have views for each task type
      const bugView = parsed.views.find((v: any) => v.name === 'All Bugs');
      const featureView = parsed.views.find((v: any) => v.name === 'All Features');
      const improvementView = parsed.views.find((v: any) => v.name === 'All Improvements');
      const choreView = parsed.views.find((v: any) => v.name === 'All Chores');

      expect(bugView).toBeDefined();
      expect(featureView).toBeDefined();
      expect(improvementView).toBeDefined();
      expect(choreView).toBeDefined();

      // Should have priority-based views
      const bugLowView = parsed.views.find((v: any) => v.name === 'Bugs • Low priority');
      const featureHighView = parsed.views.find((v: any) => v.name === 'Features • High priority');

      expect(bugLowView).toBeDefined();
      expect(featureHighView).toBeDefined();

      // Views should have correct filters
      expect(bugView.filters.and).toContain('Type == "Bug"');
      expect(featureView.filters.and).toContain('Type == "Feature"');
      expect(bugLowView.filters.and).toContain('Type == "Bug"');
      expect(bugLowView.filters.and).toContain('Priority == "Low"');
    });

  });

  describe('Area Base Generation', () => {
    const testArea: ProjectAreaInfo = {
      name: 'Task Sync',
      path: 'Areas/Task Sync.md',
      type: 'area'
    };

    it('should generate valid YAML for area base', () => {
      const result = generateAreaBase(mockSettings, testArea);
      expect(() => yaml.load(result)).not.toThrow();
    });

    it('should include area-specific filters', () => {
      const result = generateAreaBase(mockSettings, testArea);
      const parsed = yaml.load(result) as any;

      const tasksView = parsed.views.find((v: any) => v.name === 'Tasks');
      expect(tasksView.filters.and).toContain('Areas.contains(link("Task Sync"))');
    });
  });

  describe('YAML Structure Verification', () => {
    it('should generate YAML structure that matches the user example format', () => {
      const result = generateTasksBase(mockSettings, mockProjectsAndAreas);
      const parsed = yaml.load(result) as any;

      // Verify formulas section
      expect(parsed.formulas).toBeDefined();
      expect(parsed.formulas.Title).toBe('link(file.name, Title)');

      // Verify properties section has numbered keys
      expect(parsed.properties['0']).toBeDefined();
      expect(parsed.properties['0'].name).toBe('Title');
      expect(parsed.properties['0'].source).toBe('formula.Title');

      // Verify Created At and Updated At are properly numbered
      const createdAtKey = Object.keys(parsed.properties).find(key =>
        parsed.properties[key].name === 'Created At'
      );
      const updatedAtKey = Object.keys(parsed.properties).find(key =>
        parsed.properties[key].name === 'Updated At'
      );

      expect(createdAtKey).toBeDefined();
      expect(updatedAtKey).toBeDefined();
      expect(parsed.properties[createdAtKey!].source).toBe('file.ctime');
      expect(parsed.properties[updatedAtKey!].source).toBe('file.mtime');

      // Verify file.ctime and file.mtime metadata entries
      expect(parsed.properties['file.ctime']).toBeDefined();
      expect(parsed.properties['file.ctime'].displayName).toBe('Created At');
      expect(parsed.properties['file.mtime']).toBeDefined();
      expect(parsed.properties['file.mtime'].displayName).toBe('Updated At');

      // Verify views use source values in order and sort
      const tasksView = parsed.views.find((v: any) => v.name === 'Tasks');
      expect(tasksView.order).toContain('file.ctime');
      expect(tasksView.order).toContain('file.mtime');
      expect(tasksView.order).toContain('formula.Title');

      const sortProperties = tasksView.sort.map((s: any) => s.property);
      expect(sortProperties).toContain('file.mtime');
      expect(sortProperties).toContain('formula.Title');
    });
  });

});
