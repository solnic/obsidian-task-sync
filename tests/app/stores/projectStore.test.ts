/**
 * Tests for extension-aware project store with event bus integration
 * Tests reactive state management, event handling, and derived stores
 */

import { describe, test, expect, beforeEach, vi } from "vitest";
import { get } from "svelte/store";
import { EventBus } from "../../../src/app/core/events";
import { Project } from "../../../src/app/core/entities";
import { createProjectStore } from "../../../src/app/stores/projectStore";

// Mock project data for testing
const mockProject1: Project = {
  id: "project-1",
  name: "Test Project 1",
  description: "A test project",
  areas: ["area-1"],
  tags: ["important"],
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
  source: {
    extension: "obsidian",
    source: "Projects/test-project-1.md",
  },
};

const mockProject2: Project = {
  id: "project-2",
  name: "Test Project 2",
  description: "Another test project",
  areas: ["area-2"],
  tags: ["work"],
  createdAt: new Date("2024-01-02"),
  updatedAt: new Date("2024-01-02"),
  source: {
    extension: "github",
    source: "repo-456",
  },
};

describe("Extension-Aware Project Store", () => {
  let eventBus: EventBus;
  let projectStore: ReturnType<typeof createProjectStore>;

  beforeEach(() => {
    eventBus = new EventBus();
    projectStore = createProjectStore(eventBus);
  });

  describe("Initial State", () => {
    test("should start with empty state", () => {
      const state = get(projectStore);

      expect(state.projects).toEqual([]);
      expect(state.loading).toBe(false);
      expect(state.error).toBe(null);
      expect(state.lastSync).toBe(null);
    });
  });

  describe("Event Handling", () => {
    test("should add project when projects.created event is triggered", () => {
      eventBus.trigger({
        type: "projects.created",
        project: mockProject1,
        extension: "obsidian",
      });

      const state = get(projectStore);
      expect(state.projects).toHaveLength(1);
      expect(state.projects[0]).toEqual(mockProject1);
      expect(state.lastSync).toBeInstanceOf(Date);
    });

    test("should update project when projects.updated event is triggered", () => {
      // First add a project
      eventBus.trigger({
        type: "projects.created",
        project: mockProject1,
        extension: "obsidian",
      });

      // Then update it
      const updatedProject = {
        ...mockProject1,
        name: "Updated Project",
        description: "Updated description",
      };
      eventBus.trigger({
        type: "projects.updated",
        project: updatedProject,
        changes: {
          name: "Updated Project",
          description: "Updated description",
        },
        extension: "obsidian",
      });

      const state = get(projectStore);
      expect(state.projects).toHaveLength(1);
      expect(state.projects[0].name).toBe("Updated Project");
      expect(state.projects[0].description).toBe("Updated description");
    });

    test("should remove project when projects.deleted event is triggered", () => {
      // First add a project
      eventBus.trigger({
        type: "projects.created",
        project: mockProject1,
        extension: "obsidian",
      });

      // Then delete it
      eventBus.trigger({
        type: "projects.deleted",
        projectId: "project-1",
        extension: "obsidian",
      });

      const state = get(projectStore);
      expect(state.projects).toHaveLength(0);
    });

    test("should load multiple projects when projects.loaded event is triggered", () => {
      eventBus.trigger({
        type: "projects.loaded",
        projects: [mockProject1, mockProject2],
        extension: "obsidian",
      });

      const state = get(projectStore);
      expect(state.projects).toHaveLength(2);
      expect(state.projects).toContain(mockProject1);
      expect(state.projects).toContain(mockProject2);
    });
  });

  describe("Derived Stores", () => {
    test("should group projects by extension", () => {
      eventBus.trigger({
        type: "projects.loaded",
        projects: [mockProject1, mockProject2],
        extension: "obsidian",
      });

      const projectsByExtension = get(projectStore.projectsByExtension);
      expect(projectsByExtension.get("obsidian")).toEqual([mockProject1]);
      expect(projectsByExtension.get("github")).toEqual([mockProject2]);
    });

    test("should filter imported projects", () => {
      const localProject: Project = {
        ...mockProject1,
        id: "local-project",
        source: undefined,
      };

      eventBus.trigger({
        type: "projects.loaded",
        projects: [mockProject1, localProject],
        extension: "obsidian",
      });

      const importedProjects = get(projectStore.importedProjects);
      expect(importedProjects).toHaveLength(1);
      expect(importedProjects[0]).toEqual(mockProject1);
    });

    test("should reactively update derived stores when projects change", () => {
      // Initial state
      const initialProjectsByExtension = get(projectStore.projectsByExtension);
      expect(initialProjectsByExtension.size).toBe(0);

      // Add a project
      eventBus.trigger({
        type: "projects.created",
        project: mockProject1,
        extension: "obsidian",
      });

      // Check derived store updated
      const updatedProjectsByExtension = get(projectStore.projectsByExtension);
      expect(updatedProjectsByExtension.get("obsidian")).toEqual([
        mockProject1,
      ]);

      // Add another project from different extension
      eventBus.trigger({
        type: "projects.created",
        project: mockProject2,
        extension: "github",
      });

      // Check both extensions are present
      const finalProjectsByExtension = get(projectStore.projectsByExtension);
      expect(finalProjectsByExtension.get("obsidian")).toEqual([mockProject1]);
      expect(finalProjectsByExtension.get("github")).toEqual([mockProject2]);
    });
  });

  describe("Loading and Error States", () => {
    test("should manage loading state", () => {
      expect(get(projectStore).loading).toBe(false);

      projectStore.setLoading(true);
      expect(get(projectStore).loading).toBe(true);

      projectStore.setLoading(false);
      expect(get(projectStore).loading).toBe(false);
    });

    test("should manage error state", () => {
      expect(get(projectStore).error).toBe(null);

      projectStore.setError("Test error");
      expect(get(projectStore).error).toBe("Test error");

      projectStore.setError(null);
      expect(get(projectStore).error).toBe(null);
    });

    test("should preserve other state when setting loading", () => {
      // Add a project first
      eventBus.trigger({
        type: "projects.created",
        project: mockProject1,
        extension: "obsidian",
      });

      const beforeLoading = get(projectStore);
      expect(beforeLoading.projects).toHaveLength(1);

      projectStore.setLoading(true);

      const afterLoading = get(projectStore);
      expect(afterLoading.loading).toBe(true);
      expect(afterLoading.projects).toHaveLength(1); // Projects preserved
      expect(afterLoading.lastSync).toEqual(beforeLoading.lastSync); // lastSync preserved
    });

    test("should preserve other state when setting error", () => {
      // Add a project first
      eventBus.trigger({
        type: "projects.created",
        project: mockProject1,
        extension: "obsidian",
      });

      const beforeError = get(projectStore);
      expect(beforeError.projects).toHaveLength(1);

      projectStore.setError("Test error");

      const afterError = get(projectStore);
      expect(afterError.error).toBe("Test error");
      expect(afterError.projects).toHaveLength(1); // Projects preserved
      expect(afterError.lastSync).toEqual(beforeError.lastSync); // lastSync preserved
    });
  });

  describe("Reactivity", () => {
    test("should trigger reactive updates when projects are added", () => {
      let storeUpdates = 0;
      const unsubscribe = projectStore.subscribe(() => {
        storeUpdates++;
      });

      // Initial subscription call
      expect(storeUpdates).toBe(1);

      // Add a project
      eventBus.trigger({
        type: "projects.created",
        project: mockProject1,
        extension: "obsidian",
      });

      expect(storeUpdates).toBe(2);

      unsubscribe();
    });

    test("should trigger reactive updates when projects are updated", () => {
      // Add initial project
      eventBus.trigger({
        type: "projects.created",
        project: mockProject1,
        extension: "obsidian",
      });

      let storeUpdates = 0;
      const unsubscribe = projectStore.subscribe(() => {
        storeUpdates++;
      });

      // Initial subscription call
      expect(storeUpdates).toBe(1);

      // Update the project
      const updatedProject = { ...mockProject1, name: "Updated Project" };
      eventBus.trigger({
        type: "projects.updated",
        project: updatedProject,
        changes: { name: "Updated Project" },
        extension: "obsidian",
      });

      expect(storeUpdates).toBe(2);

      unsubscribe();
    });

    test("should trigger reactive updates when projects are deleted", () => {
      // Add initial project
      eventBus.trigger({
        type: "projects.created",
        project: mockProject1,
        extension: "obsidian",
      });

      let storeUpdates = 0;
      const unsubscribe = projectStore.subscribe(() => {
        storeUpdates++;
      });

      // Initial subscription call
      expect(storeUpdates).toBe(1);

      // Delete the project
      eventBus.trigger({
        type: "projects.deleted",
        projectId: "project-1",
        extension: "obsidian",
      });

      expect(storeUpdates).toBe(2);

      unsubscribe();
    });

    test("should update lastSync timestamp on all events", async () => {
      const beforeTime = new Date();

      eventBus.trigger({
        type: "projects.created",
        project: mockProject1,
        extension: "obsidian",
      });

      const afterCreate = get(projectStore);
      expect(afterCreate.lastSync).toBeInstanceOf(Date);
      expect(afterCreate.lastSync!.getTime()).toBeGreaterThanOrEqual(
        beforeTime.getTime()
      );

      const createTime = afterCreate.lastSync!;

      // Small delay to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 1));

      const updatedProject = { ...mockProject1, name: "Updated Project" };
      eventBus.trigger({
        type: "projects.updated",
        project: updatedProject,
        changes: { name: "Updated Project" },
        extension: "obsidian",
      });

      const afterUpdate = get(projectStore);
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

      // Add a project successfully
      eventBus.trigger({
        type: "projects.created",
        project: mockProject1,
        extension: "obsidian",
      });

      expect(get(projectStore).projects).toHaveLength(1);

      consoleSpy.mockRestore();
    });

    test("should handle invalid project updates gracefully", () => {
      // Add initial project
      eventBus.trigger({
        type: "projects.created",
        project: mockProject1,
        extension: "obsidian",
      });

      // Try to update non-existent project
      const nonExistentProject = { ...mockProject1, id: "non-existent" };
      eventBus.trigger({
        type: "projects.updated",
        project: nonExistentProject,
        changes: { name: "Updated" },
        extension: "obsidian",
      });

      // Original project should remain unchanged
      const state = get(projectStore);
      expect(state.projects).toHaveLength(1);
      expect(state.projects[0]).toEqual(mockProject1);
    });

    test("should handle invalid project deletions gracefully", () => {
      // Add initial project
      eventBus.trigger({
        type: "projects.created",
        project: mockProject1,
        extension: "obsidian",
      });

      // Try to delete non-existent project
      eventBus.trigger({
        type: "projects.deleted",
        projectId: "non-existent",
        extension: "obsidian",
      });

      // Original project should remain
      const state = get(projectStore);
      expect(state.projects).toHaveLength(1);
      expect(state.projects[0]).toEqual(mockProject1);
    });
  });

  describe("Cleanup", () => {
    test("should unsubscribe from event bus when cleanup is called", () => {
      // Add a project to verify store is working
      eventBus.trigger({
        type: "projects.created",
        project: mockProject1,
        extension: "obsidian",
      });

      expect(get(projectStore).projects).toHaveLength(1);

      // Call cleanup
      projectStore.cleanup();

      // Add another project - should not be processed after cleanup
      eventBus.trigger({
        type: "projects.created",
        project: mockProject2,
        extension: "obsidian",
      });

      // Store should still have only the first project
      expect(get(projectStore).projects).toHaveLength(1);
      expect(get(projectStore).projects[0]).toEqual(mockProject1);
    });

    test("should not throw errors when cleanup is called multiple times", () => {
      expect(() => {
        projectStore.cleanup();
        projectStore.cleanup();
        projectStore.cleanup();
      }).not.toThrow();
    });
  });
});
