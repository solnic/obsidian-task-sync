/**
 * Tests for extension system foundation
 * Tests Extension interface, EntityOperations interface, and ExtensionRegistry
 */

import { describe, test, expect, beforeEach } from "vitest";
import { 
  Extension,
  EntityOperations,
  ExtensionRegistry,
  type EntityType,
  type Entity
} from "../../src/app/core/extension";
import { Task, Project, Area } from "../../src/app/core/entities";

// Mock extension for testing
class MockExtension implements Extension {
  readonly id = "mock-extension";
  readonly name = "Mock Extension";
  readonly version = "1.0.0";
  readonly supportedEntities: readonly EntityType[] = ["task", "project"];

  private initialized = false;

  async initialize(): Promise<void> {
    this.initialized = true;
  }

  async shutdown(): Promise<void> {
    this.initialized = false;
  }

  async isHealthy(): Promise<boolean> {
    return this.initialized;
  }

  // Mock task operations
  tasks: EntityOperations<Task> = {
    getAll: async () => [],
    getById: async (id: string) => undefined,
    create: async (entity: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
      return {
        id: "mock-task-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        ...entity
      } as Task;
    },
    update: async (id: string, updates: Partial<Task>) => {
      return {
        id,
        title: "Updated Task",
        createdAt: new Date(),
        updatedAt: new Date()
      } as Task;
    },
    delete: async (id: string) => true
  };

  // Mock project operations
  projects: EntityOperations<Project> = {
    getAll: async () => [],
    getById: async (id: string) => undefined,
    create: async (entity: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => {
      return {
        id: "mock-project-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        ...entity
      } as Project;
    },
    update: async (id: string, updates: Partial<Project>) => {
      return {
        id,
        name: "Updated Project",
        createdAt: new Date(),
        updatedAt: new Date()
      } as Project;
    },
    delete: async (id: string) => true
  };
}

describe("Extension System Foundation", () => {
  let registry: ExtensionRegistry;
  let mockExtension: MockExtension;

  beforeEach(() => {
    registry = new ExtensionRegistry();
    mockExtension = new MockExtension();
  });

  describe("Extension interface", () => {
    test("should have required properties", () => {
      expect(mockExtension.id).toBe("mock-extension");
      expect(mockExtension.name).toBe("Mock Extension");
      expect(mockExtension.version).toBe("1.0.0");
      expect(mockExtension.supportedEntities).toEqual(["task", "project"]);
    });

    test("should implement lifecycle methods", async () => {
      expect(await mockExtension.isHealthy()).toBe(false);
      
      await mockExtension.initialize();
      expect(await mockExtension.isHealthy()).toBe(true);
      
      await mockExtension.shutdown();
      expect(await mockExtension.isHealthy()).toBe(false);
    });

    test("should provide entity operations for supported entities", () => {
      expect(mockExtension.tasks).toBeDefined();
      expect(mockExtension.projects).toBeDefined();
      expect(mockExtension.areas).toBeUndefined();
    });
  });

  describe("EntityOperations interface", () => {
    test("should provide CRUD operations for tasks", async () => {
      const tasks = await mockExtension.tasks!.getAll();
      expect(Array.isArray(tasks)).toBe(true);

      const task = await mockExtension.tasks!.getById("test-id");
      expect(task).toBeUndefined();

      const newTask = await mockExtension.tasks!.create({
        title: "Test Task"
      });
      expect(newTask.id).toBe("mock-task-1");
      expect(newTask.title).toBe("Test Task");

      const updatedTask = await mockExtension.tasks!.update("test-id", {
        title: "Updated Title"
      });
      expect(updatedTask.title).toBe("Updated Task");

      const deleted = await mockExtension.tasks!.delete("test-id");
      expect(deleted).toBe(true);
    });

    test("should provide CRUD operations for projects", async () => {
      const projects = await mockExtension.projects!.getAll();
      expect(Array.isArray(projects)).toBe(true);

      const newProject = await mockExtension.projects!.create({
        name: "Test Project"
      });
      expect(newProject.id).toBe("mock-project-1");
      expect(newProject.name).toBe("Test Project");
    });
  });

  describe("ExtensionRegistry", () => {
    test("should register and retrieve extensions", () => {
      registry.register(mockExtension);
      
      const retrieved = registry.getById("mock-extension");
      expect(retrieved).toBe(mockExtension);
      
      const all = registry.getAll();
      expect(all).toContain(mockExtension);
      expect(all.length).toBe(1);
    });

    test("should prevent duplicate registration", () => {
      registry.register(mockExtension);
      
      expect(() => registry.register(mockExtension)).toThrow(
        "Extension with id 'mock-extension' is already registered"
      );
    });

    test("should unregister extensions", () => {
      registry.register(mockExtension);
      expect(registry.getById("mock-extension")).toBe(mockExtension);
      
      registry.unregister("mock-extension");
      expect(registry.getById("mock-extension")).toBeUndefined();
      expect(registry.getAll().length).toBe(0);
    });

    test("should filter extensions by entity type", () => {
      const taskOnlyExtension = {
        ...mockExtension,
        id: "task-only",
        supportedEntities: ["task"] as const
      };
      
      registry.register(mockExtension);
      registry.register(taskOnlyExtension);
      
      const taskExtensions = registry.getByEntityType("task");
      expect(taskExtensions.length).toBe(2);
      expect(taskExtensions).toContain(mockExtension);
      expect(taskExtensions).toContain(taskOnlyExtension);
      
      const projectExtensions = registry.getByEntityType("project");
      expect(projectExtensions.length).toBe(1);
      expect(projectExtensions).toContain(mockExtension);
      
      const areaExtensions = registry.getByEntityType("area");
      expect(areaExtensions.length).toBe(0);
    });

    test("should handle non-existent extension gracefully", () => {
      expect(registry.getById("non-existent")).toBeUndefined();
      
      // Should not throw when unregistering non-existent extension
      expect(() => registry.unregister("non-existent")).not.toThrow();
    });
  });
});
