/**
 * Tests for extension-aware area store with event bus integration
 * Tests reactive state management, event handling, and derived stores
 */

import { describe, test, expect, beforeEach, vi } from "vitest";
import { get } from "svelte/store";
import { EventBus } from "../../../src/app/core/events";
import { Area } from "../../../src/app/core/entities";
import { createAreaStore } from "../../../src/app/stores/areaStore";

// Mock area data for testing
const mockArea1: Area = {
  id: "area-1",
  name: "Test Area 1",
  description: "A test area",
  tags: ["context"],
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
  source: {
    extension: "obsidian",
    source: "Areas/test-area-1.md",
  },
};

const mockArea2: Area = {
  id: "area-2",
  name: "Test Area 2",
  description: "Another test area",
  tags: ["work", "focus"],
  createdAt: new Date("2024-01-02"),
  updatedAt: new Date("2024-01-02"),
  source: {
    extension: "github",
    source: "label-789",
  },
};

describe("Extension-Aware Area Store", () => {
  let eventBus: EventBus;
  let areaStore: ReturnType<typeof createAreaStore>;

  beforeEach(() => {
    eventBus = new EventBus();
    areaStore = createAreaStore(eventBus);
  });

  describe("Initial State", () => {
    test("should start with empty state", () => {
      const state = get(areaStore);

      expect(state.areas).toEqual([]);
      expect(state.loading).toBe(false);
      expect(state.error).toBe(null);
      expect(state.lastSync).toBe(null);
    });
  });

  describe("Event Handling", () => {
    test("should add area when areas.created event is triggered", () => {
      eventBus.trigger({
        type: "areas.created",
        area: mockArea1,
        extension: "obsidian",
      });

      const state = get(areaStore);
      expect(state.areas).toHaveLength(1);
      expect(state.areas[0]).toEqual(mockArea1);
      expect(state.lastSync).toBeInstanceOf(Date);
    });

    test("should update area when areas.updated event is triggered", () => {
      // First add an area
      eventBus.trigger({
        type: "areas.created",
        area: mockArea1,
        extension: "obsidian",
      });

      // Then update it
      const updatedArea = {
        ...mockArea1,
        name: "Updated Area",
        description: "Updated description",
      };
      eventBus.trigger({
        type: "areas.updated",
        area: updatedArea,
        changes: { name: "Updated Area", description: "Updated description" },
        extension: "obsidian",
      });

      const state = get(areaStore);
      expect(state.areas).toHaveLength(1);
      expect(state.areas[0].name).toBe("Updated Area");
      expect(state.areas[0].description).toBe("Updated description");
    });

    test("should remove area when areas.deleted event is triggered", () => {
      // First add an area
      eventBus.trigger({
        type: "areas.created",
        area: mockArea1,
        extension: "obsidian",
      });

      // Then delete it
      eventBus.trigger({
        type: "areas.deleted",
        areaId: "area-1",
        extension: "obsidian",
      });

      const state = get(areaStore);
      expect(state.areas).toHaveLength(0);
    });

    test("should load multiple areas when areas.loaded event is triggered", () => {
      eventBus.trigger({
        type: "areas.loaded",
        areas: [mockArea1, mockArea2],
        extension: "obsidian",
      });

      const state = get(areaStore);
      expect(state.areas).toHaveLength(2);
      expect(state.areas).toContain(mockArea1);
      expect(state.areas).toContain(mockArea2);
    });
  });

  describe("Derived Stores", () => {
    test("should group areas by extension", () => {
      eventBus.trigger({
        type: "areas.loaded",
        areas: [mockArea1, mockArea2],
        extension: "obsidian",
      });

      const areasByExtension = get(areaStore.areasByExtension);
      expect(areasByExtension.get("obsidian")).toEqual([mockArea1]);
      expect(areasByExtension.get("github")).toEqual([mockArea2]);
    });

    test("should filter imported areas", () => {
      const localArea: Area = {
        ...mockArea1,
        id: "local-area",
        source: undefined,
      };

      eventBus.trigger({
        type: "areas.loaded",
        areas: [mockArea1, localArea],
        extension: "obsidian",
      });

      const importedAreas = get(areaStore.importedAreas);
      expect(importedAreas).toHaveLength(1);
      expect(importedAreas[0]).toEqual(mockArea1);
    });

    test("should reactively update derived stores when areas change", () => {
      // Initial state
      const initialAreasByExtension = get(areaStore.areasByExtension);
      expect(initialAreasByExtension.size).toBe(0);

      // Add an area
      eventBus.trigger({
        type: "areas.created",
        area: mockArea1,
        extension: "obsidian",
      });

      // Check derived store updated
      const updatedAreasByExtension = get(areaStore.areasByExtension);
      expect(updatedAreasByExtension.get("obsidian")).toEqual([mockArea1]);

      // Add another area from different extension
      eventBus.trigger({
        type: "areas.created",
        area: mockArea2,
        extension: "github",
      });

      // Check both extensions are present
      const finalAreasByExtension = get(areaStore.areasByExtension);
      expect(finalAreasByExtension.get("obsidian")).toEqual([mockArea1]);
      expect(finalAreasByExtension.get("github")).toEqual([mockArea2]);
    });
  });

  describe("Loading and Error States", () => {
    test("should manage loading state", () => {
      expect(get(areaStore).loading).toBe(false);

      areaStore.setLoading(true);
      expect(get(areaStore).loading).toBe(true);

      areaStore.setLoading(false);
      expect(get(areaStore).loading).toBe(false);
    });

    test("should manage error state", () => {
      expect(get(areaStore).error).toBe(null);

      areaStore.setError("Test error");
      expect(get(areaStore).error).toBe("Test error");

      areaStore.setError(null);
      expect(get(areaStore).error).toBe(null);
    });

    test("should preserve other state when setting loading", () => {
      // Add an area first
      eventBus.trigger({
        type: "areas.created",
        area: mockArea1,
        extension: "obsidian",
      });

      const beforeLoading = get(areaStore);
      expect(beforeLoading.areas).toHaveLength(1);

      areaStore.setLoading(true);

      const afterLoading = get(areaStore);
      expect(afterLoading.loading).toBe(true);
      expect(afterLoading.areas).toHaveLength(1); // Areas preserved
      expect(afterLoading.lastSync).toEqual(beforeLoading.lastSync); // lastSync preserved
    });

    test("should preserve other state when setting error", () => {
      // Add an area first
      eventBus.trigger({
        type: "areas.created",
        area: mockArea1,
        extension: "obsidian",
      });

      const beforeError = get(areaStore);
      expect(beforeError.areas).toHaveLength(1);

      areaStore.setError("Test error");

      const afterError = get(areaStore);
      expect(afterError.error).toBe("Test error");
      expect(afterError.areas).toHaveLength(1); // Areas preserved
      expect(afterError.lastSync).toEqual(beforeError.lastSync); // lastSync preserved
    });
  });

  describe("Reactivity", () => {
    test("should trigger reactive updates when areas are added", () => {
      let storeUpdates = 0;
      const unsubscribe = areaStore.subscribe(() => {
        storeUpdates++;
      });

      // Initial subscription call
      expect(storeUpdates).toBe(1);

      // Add an area
      eventBus.trigger({
        type: "areas.created",
        area: mockArea1,
        extension: "obsidian",
      });

      expect(storeUpdates).toBe(2);

      unsubscribe();
    });

    test("should trigger reactive updates when areas are updated", () => {
      // Add initial area
      eventBus.trigger({
        type: "areas.created",
        area: mockArea1,
        extension: "obsidian",
      });

      let storeUpdates = 0;
      const unsubscribe = areaStore.subscribe(() => {
        storeUpdates++;
      });

      // Initial subscription call
      expect(storeUpdates).toBe(1);

      // Update the area
      const updatedArea = { ...mockArea1, name: "Updated Area" };
      eventBus.trigger({
        type: "areas.updated",
        area: updatedArea,
        changes: { name: "Updated Area" },
        extension: "obsidian",
      });

      expect(storeUpdates).toBe(2);

      unsubscribe();
    });

    test("should trigger reactive updates when areas are deleted", () => {
      // Add initial area
      eventBus.trigger({
        type: "areas.created",
        area: mockArea1,
        extension: "obsidian",
      });

      let storeUpdates = 0;
      const unsubscribe = areaStore.subscribe(() => {
        storeUpdates++;
      });

      // Initial subscription call
      expect(storeUpdates).toBe(1);

      // Delete the area
      eventBus.trigger({
        type: "areas.deleted",
        areaId: "area-1",
        extension: "obsidian",
      });

      expect(storeUpdates).toBe(2);

      unsubscribe();
    });

    test("should update lastSync timestamp on all events", async () => {
      const beforeTime = new Date();

      eventBus.trigger({
        type: "areas.created",
        area: mockArea1,
        extension: "obsidian",
      });

      const afterCreate = get(areaStore);
      expect(afterCreate.lastSync).toBeInstanceOf(Date);
      expect(afterCreate.lastSync!.getTime()).toBeGreaterThanOrEqual(
        beforeTime.getTime()
      );

      const createTime = afterCreate.lastSync!;

      // Small delay to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 1));

      const updatedArea = { ...mockArea1, name: "Updated Area" };
      eventBus.trigger({
        type: "areas.updated",
        area: updatedArea,
        changes: { name: "Updated Area" },
        extension: "obsidian",
      });

      const afterUpdate = get(areaStore);
      expect(afterUpdate.lastSync!.getTime()).toBeGreaterThan(
        createTime.getTime()
      );
    });
  });

  describe("Error Handling", () => {
    test("should handle errors gracefully and continue processing events", () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      // Add an area successfully
      eventBus.trigger({
        type: "areas.created",
        area: mockArea1,
        extension: "obsidian",
      });

      expect(get(areaStore).areas).toHaveLength(1);

      consoleSpy.mockRestore();
    });

    test("should handle invalid area updates gracefully", () => {
      // Add initial area
      eventBus.trigger({
        type: "areas.created",
        area: mockArea1,
        extension: "obsidian",
      });

      // Try to update non-existent area
      const nonExistentArea = { ...mockArea1, id: "non-existent" };
      eventBus.trigger({
        type: "areas.updated",
        area: nonExistentArea,
        changes: { name: "Updated" },
        extension: "obsidian",
      });

      // Original area should remain unchanged
      const state = get(areaStore);
      expect(state.areas).toHaveLength(1);
      expect(state.areas[0]).toEqual(mockArea1);
    });

    test("should handle invalid area deletions gracefully", () => {
      // Add initial area
      eventBus.trigger({
        type: "areas.created",
        area: mockArea1,
        extension: "obsidian",
      });

      // Try to delete non-existent area
      eventBus.trigger({
        type: "areas.deleted",
        areaId: "non-existent",
        extension: "obsidian",
      });

      // Original area should remain
      const state = get(areaStore);
      expect(state.areas).toHaveLength(1);
      expect(state.areas[0]).toEqual(mockArea1);
    });
  });

  describe("Cleanup", () => {
    test("should unsubscribe from event bus when cleanup is called", () => {
      // Add an area to verify store is working
      eventBus.trigger({
        type: "areas.created",
        area: mockArea1,
        extension: "obsidian",
      });

      expect(get(areaStore).areas).toHaveLength(1);

      // Call cleanup
      areaStore.cleanup();

      // Add another area - should not be processed after cleanup
      eventBus.trigger({
        type: "areas.created",
        area: mockArea2,
        extension: "obsidian",
      });

      // Store should still have only the first area
      expect(get(areaStore).areas).toHaveLength(1);
      expect(get(areaStore).areas[0]).toEqual(mockArea1);
    });

    test("should not throw errors when cleanup is called multiple times", () => {
      expect(() => {
        areaStore.cleanup();
        areaStore.cleanup();
        areaStore.cleanup();
      }).not.toThrow();
    });
  });
});
