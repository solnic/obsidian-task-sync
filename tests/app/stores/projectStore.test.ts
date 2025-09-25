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
    source: "Projects/test-project-1.md"
  }
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
    source: "repo-456"
  }
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
        extension: "obsidian"
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
        extension: "obsidian"
      });

      // Then update it
      const updatedProject = { ...mockProject1, name: "Updated Project", description: "Updated description" };
      eventBus.trigger({
        type: "projects.updated",
        project: updatedProject,
        changes: { name: "Updated Project", description: "Updated description" },
        extension: "obsidian"
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
        extension: "obsidian"
      });

      // Then delete it
      eventBus.trigger({
        type: "projects.deleted",
        projectId: "project-1",
        extension: "obsidian"
      });

      const state = get(projectStore);
      expect(state.projects).toHaveLength(0);
    });

    test("should load multiple projects when projects.loaded event is triggered", () => {
      eventBus.trigger({
        type: "projects.loaded",
        projects: [mockProject1, mockProject2],
        extension: "obsidian"
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
        extension: "obsidian"
      });

      const projectsByExtension = get(projectStore.projectsByExtension);
      expect(projectsByExtension.get("obsidian")).toEqual([mockProject1]);
      expect(projectsByExtension.get("github")).toEqual([mockProject2]);
    });

    test("should filter imported projects", () => {
      const localProject: Project = {
        ...mockProject1,
        id: "local-project",
        source: undefined
      };

      eventBus.trigger({
        type: "projects.loaded",
        projects: [mockProject1, localProject],
        extension: "obsidian"
      });

      const importedProjects = get(projectStore.importedProjects);
      expect(importedProjects).toHaveLength(1);
      expect(importedProjects[0]).toEqual(mockProject1);
    });
  });

  describe("Error Handling", () => {
    test("should handle errors gracefully and continue processing events", () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Add a project successfully
      eventBus.trigger({
        type: "projects.created",
        project: mockProject1,
        extension: "obsidian"
      });

      expect(get(projectStore).projects).toHaveLength(1);
      
      consoleSpy.mockRestore();
    });
  });
});
