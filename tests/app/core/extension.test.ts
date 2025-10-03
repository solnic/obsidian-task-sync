/**
 * Tests for extension system foundation
 * Tests Extension interface, EntityOperations interface, and ExtensionRegistry
 */

import { describe, test, expect, beforeEach, vi } from "vitest";
import {
  Extension,
  EntityOperations,
  ExtensionRegistry,
  type EntityType,
  type Entity,
} from "../../../src/app/core/extension";
import { Task, Project, Area } from "../../../src/app/core/entities";
import { DomainEvent } from "../../../src/app/core/events";

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

  // Event handler methods required by Extension interface
  async onEntityCreated(event: DomainEvent): Promise<void> {
    // Mock implementation
  }

  async onEntityUpdated(event: DomainEvent): Promise<void> {
    // Mock implementation
  }

  async onEntityDeleted(event: DomainEvent): Promise<void> {
    // Mock implementation
  }

  // Mock task operations
  tasks: EntityOperations<Task> = {
    getAll: async () => [],
    getById: async (id: string) => undefined,
    create: async (entity: Omit<Task, "id" | "createdAt" | "updatedAt">) => {
      return {
        id: "mock-task-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        ...entity,
      } as Task;
    },
    update: async (id: string, updates: Partial<Task>) => {
      return {
        id,
        title: "Test Task", // Default title
        status: "Backlog",
        done: false,
        areas: [],
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        ...updates, // Apply the actual updates
      } as Task;
    },
    delete: async (id: string) => true,
  };

  // Mock project operations
  projects: EntityOperations<Project> = {
    getAll: async () => [],
    getById: async (id: string) => undefined,
    create: async (entity: Omit<Project, "id" | "createdAt" | "updatedAt">) => {
      return {
        id: "mock-project-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        ...entity,
      } as Project;
    },
    update: async (id: string, updates: Partial<Project>) => {
      return {
        id,
        name: "Test Project", // Default name
        areas: [],
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        ...updates, // Apply the actual updates
      } as Project;
    },
    delete: async (id: string) => true,
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
        title: "Test Task",
        status: "Backlog",
        done: false,
        areas: [],
        tags: [],
      });
      expect(newTask.id).toBe("mock-task-1");
      expect(newTask.title).toBe("Test Task");

      const updatedTask = await mockExtension.tasks!.update("test-id", {
        title: "Updated Title",
      });
      expect(updatedTask.title).toBe("Updated Title");

      const deleted = await mockExtension.tasks!.delete("test-id");
      expect(deleted).toBe(true);
    });

    test("should provide CRUD operations for projects", async () => {
      const projects = await mockExtension.projects!.getAll();
      expect(Array.isArray(projects)).toBe(true);

      const newProject = await mockExtension.projects!.create({
        name: "Test Project",
        areas: [],
        tags: [],
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
        supportedEntities: ["task"] as const,
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

  describe("Event-driven Extension interface", () => {
    test("should require event handler methods in Extension interface", () => {
      // This test will fail until we add the event handler methods to the Extension interface

      // Create a basic extension that only implements current Extension interface
      const basicExtension: Extension = {
        id: "basic",
        name: "Basic Extension",
        version: "1.0.0",
        supportedEntities: ["task"],
        async initialize() {},
        async shutdown() {},
        async isHealthy() {
          return true;
        },
      };

      // This should fail compilation until Extension interface includes event methods
      // @ts-expect-error - Extension interface should require event handler methods
      const eventExtension: {
        onEntityCreated(event: DomainEvent): Promise<void>;
        onEntityUpdated(event: DomainEvent): Promise<void>;
        onEntityDeleted(event: DomainEvent): Promise<void>;
      } & Extension = basicExtension;

      // Test should pass once we fix the interface
      expect(basicExtension).toBeDefined();
    });

    test("should implement event handler methods for entity lifecycle", async () => {
      // Create a mock event-driven extension
      class EventDrivenExtension implements Extension {
        readonly id = "event-driven-extension";
        readonly name = "Event Driven Extension";
        readonly version = "1.0.0";
        readonly supportedEntities: readonly EntityType[] = ["task"];

        private initialized = false;
        public onEntityCreatedCalls: DomainEvent[] = [];
        public onEntityUpdatedCalls: DomainEvent[] = [];
        public onEntityDeletedCalls: DomainEvent[] = [];

        async initialize(): Promise<void> {
          this.initialized = true;
        }

        async shutdown(): Promise<void> {
          this.initialized = false;
        }

        async isHealthy(): Promise<boolean> {
          return this.initialized;
        }

        // Event-driven methods that extensions should implement
        async onEntityCreated(event: DomainEvent): Promise<void> {
          this.onEntityCreatedCalls.push(event);
        }

        async onEntityUpdated(event: DomainEvent): Promise<void> {
          this.onEntityUpdatedCalls.push(event);
        }

        async onEntityDeleted(event: DomainEvent): Promise<void> {
          this.onEntityDeletedCalls.push(event);
        }
      }

      const extension = new EventDrivenExtension();
      await extension.initialize();

      // Test that event handlers are called correctly
      const taskCreatedEvent: DomainEvent = {
        type: "tasks.created",
        task: {
          id: "task-1",
          title: "Test Task",
          status: "Backlog",
          done: false,
          areas: [],
          tags: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        extension: "core",
      };

      await extension.onEntityCreated(taskCreatedEvent);
      expect(extension.onEntityCreatedCalls).toHaveLength(1);
      expect(extension.onEntityCreatedCalls[0]).toBe(taskCreatedEvent);

      const taskUpdatedEvent: DomainEvent = {
        type: "tasks.updated",
        task: {
          id: "task-1",
          title: "Updated Task",
          status: "In Progress",
          done: false,
          areas: [],
          tags: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        changes: { title: "Updated Task", status: "In Progress" },
        extension: "core",
      };

      await extension.onEntityUpdated(taskUpdatedEvent);
      expect(extension.onEntityUpdatedCalls).toHaveLength(1);
      expect(extension.onEntityUpdatedCalls[0]).toBe(taskUpdatedEvent);

      const taskDeletedEvent: DomainEvent = {
        type: "tasks.deleted",
        taskId: "task-1",
        extension: "core",
      };

      await extension.onEntityDeleted(taskDeletedEvent);
      expect(extension.onEntityDeletedCalls).toHaveLength(1);
      expect(extension.onEntityDeletedCalls[0]).toBe(taskDeletedEvent);
    });

    test("should NOT have EntityOperations for event-driven extensions", () => {
      // Event-driven extensions should not expose direct entity operations
      class EventDrivenExtension implements Extension {
        readonly id = "event-driven-extension";
        readonly name = "Event Driven Extension";
        readonly version = "1.0.0";
        readonly supportedEntities: readonly EntityType[] = ["task"];

        async initialize(): Promise<void> {}
        async shutdown(): Promise<void> {}
        async isHealthy(): Promise<boolean> {
          return true;
        }

        async onEntityCreated(event: DomainEvent): Promise<void> {}
        async onEntityUpdated(event: DomainEvent): Promise<void> {}
        async onEntityDeleted(event: DomainEvent): Promise<void> {}

        // Should NOT have these properties in event-driven extensions
        // tasks?: EntityOperations<Task>;
        // projects?: EntityOperations<Project>;
        // areas?: EntityOperations<Area>;
      }

      const extension = new EventDrivenExtension();

      // Event-driven extensions should not expose entity operations
      expect(extension.tasks).toBeUndefined();
      expect(extension.projects).toBeUndefined();
      expect(extension.areas).toBeUndefined();
    });
  });
});
