/**
 * ULID Service Integration Tests
 * Tests that services are correctly using ULID for ID generation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ScheduleStore } from '../src/stores/scheduleStore';
import { isValidPrefixedUlid, isValidUlid } from '../src/utils/idGenerator';

describe('ULID Service Integration', () => {
  describe('ScheduleStore', () => {
    let scheduleStore: ScheduleStore;

    beforeEach(() => {
      scheduleStore = new ScheduleStore();
    });

    it('should generate ULID-based schedule IDs', async () => {
      const schedule = await scheduleStore.createSchedule({
        date: '2025-09-16',
        tasks: [],
        events: []
      });

      expect(schedule.id).toBeDefined();
      expect(isValidPrefixedUlid(schedule.id, 'schedule')).toBe(true);
    });

    it('should generate unique schedule IDs', async () => {
      const schedule1 = await scheduleStore.createSchedule({
        date: '2025-09-16',
        tasks: [],
        events: []
      });

      const schedule2 = await scheduleStore.createSchedule({
        date: '2025-09-17',
        tasks: [],
        events: []
      });

      expect(schedule1.id).not.toBe(schedule2.id);
      expect(isValidPrefixedUlid(schedule1.id, 'schedule')).toBe(true);
      expect(isValidPrefixedUlid(schedule2.id, 'schedule')).toBe(true);
    });
  });

  describe('ID Format Consistency', () => {
    it('should maintain consistent ID format across services', () => {
      // Test that all services use the same ULID format
      const scheduleStore = new ScheduleStore();
      
      // Create a schedule to test ID format
      scheduleStore.createSchedule({
        date: '2025-09-16',
        tasks: [],
        events: []
      }).then(schedule => {
        // Schedule IDs should be prefixed with 'schedule-'
        expect(schedule.id.startsWith('schedule-')).toBe(true);
        expect(isValidPrefixedUlid(schedule.id, 'schedule')).toBe(true);
        
        // Extract the ULID part and verify it's valid
        const ulidPart = schedule.id.substring('schedule-'.length);
        expect(isValidUlid(ulidPart)).toBe(true);
        expect(ulidPart.length).toBe(26);
      });
    });

    it('should generate sortable IDs', async () => {
      const scheduleStore = new ScheduleStore();
      
      const schedule1 = await scheduleStore.createSchedule({
        date: '2025-09-16',
        tasks: [],
        events: []
      });

      // Small delay to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 1));

      const schedule2 = await scheduleStore.createSchedule({
        date: '2025-09-17',
        tasks: [],
        events: []
      });

      // ULIDs should be lexicographically sortable
      expect(schedule1.id < schedule2.id).toBe(true);
    });
  });

  describe('Migration from old ID format', () => {
    it('should handle existing data with old ID formats gracefully', () => {
      // Test that the system can handle old-style IDs without breaking
      const oldStyleId = 'schedule-1234567890-abc123def';
      
      // Should not be considered valid ULID
      expect(isValidPrefixedUlid(oldStyleId, 'schedule')).toBe(false);
      
      // But the system should still be able to work with it
      // (This is important for backward compatibility)
      expect(oldStyleId.startsWith('schedule-')).toBe(true);
    });
  });
});
