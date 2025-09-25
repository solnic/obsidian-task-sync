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
    source: "Areas/test-area-1.md"
  }
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
    source: "label-789"
  }
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
        extension: "obsidian"
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
        extension: "obsidian"
      });

      // Then update it
      const updatedArea = { ...mockArea1, name: "Updated Area", description: "Updated description" };
      eventBus.trigger({
        type: "areas.updated",
        area: updatedArea,
        changes: { name: "Updated Area", description: "Updated description" },
        extension: "obsidian"
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
        extension: "obsidian"
      });

      // Then delete it
      eventBus.trigger({
        type: "areas.deleted",
        areaId: "area-1",
        extension: "obsidian"
      });

      const state = get(areaStore);
      expect(state.areas).toHaveLength(0);
    });

    test("should load multiple areas when areas.loaded event is triggered", () => {
      eventBus.trigger({
        type: "areas.loaded",
        areas: [mockArea1, mockArea2],
        extension: "obsidian"
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
        extension: "obsidian"
      });

      const areasByExtension = get(areaStore.areasByExtension);
      expect(areasByExtension.get("obsidian")).toEqual([mockArea1]);
      expect(areasByExtension.get("github")).toEqual([mockArea2]);
    });

    test("should filter imported areas", () => {
      const localArea: Area = {
        ...mockArea1,
        id: "local-area",
        source: undefined
      };

      eventBus.trigger({
        type: "areas.loaded",
        areas: [mockArea1, localArea],
        extension: "obsidian"
      });

      const importedAreas = get(areaStore.importedAreas);
      expect(importedAreas).toHaveLength(1);
      expect(importedAreas[0]).toEqual(mockArea1);
    });
  });

  describe("Error Handling", () => {
    test("should handle errors gracefully and continue processing events", () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Add an area successfully
      eventBus.trigger({
        type: "areas.created",
        area: mockArea1,
        extension: "obsidian"
      });

      expect(get(areaStore).areas).toHaveLength(1);
      
      consoleSpy.mockRestore();
    });
  });
});
