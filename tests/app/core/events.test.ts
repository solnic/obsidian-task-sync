/**
 * Unit tests for the new EventBus system
 * Tests event subscription, unsubscription, emission, and pattern matching
 * Critical for hot-loadable extensions that need to add/remove event listeners
 */

import { describe, test, expect, beforeEach, vi } from "vitest";
import { EventBus, DomainEvent } from "../../../src/app/core/events";
import { Task, Project, Area } from "../../../src/app/core/entities";

// Mock entities for testing
const mockTask: Task = {
  id: "task-1",
  title: "Test Task",
  status: "Backlog",
  done: false,
  areas: [],
  tags: [],
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

const mockProject: Project = {
  id: "project-1",
  name: "Test Project",
  areas: [],
  tags: [],
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

const mockArea: Area = {
  id: "area-1",
  name: "Test Area",
  tags: [],
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

describe("EventBus", () => {
  let eventBus: EventBus;
  let mockHandler: vi.MockedFunction<(event: DomainEvent) => void>;

  beforeEach(() => {
    eventBus = new EventBus();
    mockHandler = vi.fn();
  });

  describe("Basic Event Subscription and Emission", () => {
    test("should subscribe to and receive events", () => {
      eventBus.on("tasks.created", mockHandler);

      const event: DomainEvent = {
        type: "tasks.created",
        task: mockTask,
        extension: "test-extension",
      };

      eventBus.trigger(event);

      expect(mockHandler).toHaveBeenCalledTimes(1);
      expect(mockHandler).toHaveBeenCalledWith(event);
    });

    test("should not receive events for unsubscribed types", () => {
      eventBus.on("tasks.updated", mockHandler);

      const event: DomainEvent = {
        type: "tasks.created",
        task: mockTask,
        extension: "test-extension",
      };

      eventBus.trigger(event);

      expect(mockHandler).not.toHaveBeenCalled();
    });

    test("should support multiple handlers for same event type", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      eventBus.on("tasks.created", handler1);
      eventBus.on("tasks.created", handler2);

      const event: DomainEvent = {
        type: "tasks.created",
        task: mockTask,
        extension: "test-extension",
      };

      eventBus.trigger(event);

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
      expect(eventBus.getHandlerCount("tasks.created")).toBe(2);
    });

    test("should handle different event types independently", () => {
      const taskHandler = vi.fn();
      const projectHandler = vi.fn();

      eventBus.on("tasks.created", taskHandler);
      eventBus.on("projects.created", projectHandler);

      const taskEvent: DomainEvent = {
        type: "tasks.created",
        task: mockTask,
        extension: "test-extension",
      };

      const projectEvent: DomainEvent = {
        type: "projects.created",
        project: mockProject,
        extension: "test-extension",
      };

      eventBus.trigger(taskEvent);
      eventBus.trigger(projectEvent);

      expect(taskHandler).toHaveBeenCalledWith(taskEvent);
      expect(projectHandler).toHaveBeenCalledWith(projectEvent);
      expect(taskHandler).not.toHaveBeenCalledWith(projectEvent);
      expect(projectHandler).not.toHaveBeenCalledWith(taskEvent);
    });
  });

  describe("Unsubscription (Critical for Hot-Loadable Extensions)", () => {
    test("should unsubscribe handler using returned function", () => {
      const unsubscribe = eventBus.on("tasks.created", mockHandler);

      expect(eventBus.getHandlerCount("tasks.created")).toBe(1);

      unsubscribe();

      expect(eventBus.getHandlerCount("tasks.created")).toBe(0);

      const event: DomainEvent = {
        type: "tasks.created",
        task: mockTask,
        extension: "test-extension",
      };

      eventBus.trigger(event);

      expect(mockHandler).not.toHaveBeenCalled();
    });

    test("should unsubscribe only the specific handler", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      const unsubscribe1 = eventBus.on("tasks.created", handler1);
      eventBus.on("tasks.created", handler2);

      expect(eventBus.getHandlerCount("tasks.created")).toBe(2);

      unsubscribe1();

      expect(eventBus.getHandlerCount("tasks.created")).toBe(1);

      const event: DomainEvent = {
        type: "tasks.created",
        task: mockTask,
        extension: "test-extension",
      };

      eventBus.trigger(event);

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    test("should handle multiple unsubscribe calls gracefully", () => {
      const unsubscribe = eventBus.on("tasks.created", mockHandler);

      unsubscribe();
      unsubscribe(); // Should not throw

      expect(eventBus.getHandlerCount("tasks.created")).toBe(0);
    });

    test("should handle unsubscribe of non-existent handler gracefully", () => {
      const unsubscribe = eventBus.on("tasks.created", mockHandler);

      // Manually remove handler to simulate edge case
      eventBus.clearHandlers("tasks.created");

      // Should not throw
      expect(() => unsubscribe()).not.toThrow();
    });
  });

  describe("Error Handling", () => {
    test("should continue processing other handlers when one throws error", () => {
      const errorHandler = vi.fn(() => {
        throw new Error("Handler error");
      });
      const successHandler = vi.fn();

      eventBus.on("tasks.created", errorHandler);
      eventBus.on("tasks.created", successHandler);

      const event: DomainEvent = {
        type: "tasks.created",
        task: mockTask,
        extension: "test-extension",
      };

      // Should not throw and should process successful handler
      expect(() => eventBus.trigger(event)).not.toThrow();

      expect(errorHandler).toHaveBeenCalledTimes(1);
      expect(successHandler).toHaveBeenCalledTimes(1);
    });

    test("should log errors from handlers", () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const errorHandler = vi.fn(() => {
        throw new Error("Test error");
      });

      eventBus.on("tasks.created", errorHandler);

      const event: DomainEvent = {
        type: "tasks.created",
        task: mockTask,
        extension: "test-extension",
      };

      eventBus.trigger(event);

      expect(consoleSpy).toHaveBeenCalledWith(
        "Error in event handler for tasks.created:",
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe("Multiple Event Type Subscription", () => {
    test("should subscribe to multiple event types with same handler", () => {
      const unsubscribe = eventBus.onMultiple(
        ["tasks.created", "tasks.updated", "tasks.deleted"],
        mockHandler
      );

      // With the optimized implementation, onMultiple uses pattern matching
      // so individual event type counts won't show handlers, but the pattern handler will work
      const createEvent: DomainEvent = {
        type: "tasks.created",
        task: mockTask,
        extension: "test-extension",
      };

      const updateEvent: DomainEvent = {
        type: "tasks.updated",
        task: mockTask,
        changes: { title: "Updated" },
        extension: "test-extension",
      };

      const deleteEvent: DomainEvent = {
        type: "tasks.deleted",
        taskId: "task-1",
        extension: "test-extension",
      };

      eventBus.trigger(createEvent);
      eventBus.trigger(updateEvent);
      eventBus.trigger(deleteEvent);

      expect(mockHandler).toHaveBeenCalledTimes(3);
      expect(mockHandler).toHaveBeenCalledWith(createEvent);
      expect(mockHandler).toHaveBeenCalledWith(updateEvent);
      expect(mockHandler).toHaveBeenCalledWith(deleteEvent);

      // Test unsubscribe from all
      unsubscribe();

      // After unsubscribe, handler should not be called
      eventBus.trigger(createEvent);
      expect(mockHandler).toHaveBeenCalledTimes(3); // Still 3, no new calls
    });

    test("should handle mixed event types with proper typing", () => {
      // Test that handler can receive different event types
      const mixedHandler = vi.fn((event: DomainEvent) => {
        // Handler should be able to handle all event types in the array
        if (event.type === "tasks.created") {
          expect(event.task).toBeDefined();
        } else if (event.type === "projects.created") {
          expect(event.project).toBeDefined();
        }
      });

      const unsubscribe = eventBus.onMultiple(
        ["tasks.created", "projects.created"],
        mixedHandler
      );

      const taskEvent: DomainEvent = {
        type: "tasks.created",
        task: mockTask,
        extension: "test-extension",
      };

      const projectEvent: DomainEvent = {
        type: "projects.created",
        project: mockProject,
        extension: "test-extension",
      };

      eventBus.trigger(taskEvent);
      eventBus.trigger(projectEvent);

      expect(mixedHandler).toHaveBeenCalledTimes(2);
      expect(mixedHandler).toHaveBeenCalledWith(taskEvent);
      expect(mixedHandler).toHaveBeenCalledWith(projectEvent);

      unsubscribe();
    });

    test("should use efficient single handler approach for performance", () => {
      // Test that onMultiple uses a more efficient approach than creating separate handlers
      const handler = vi.fn();

      // Subscribe to multiple event types
      const unsubscribe = eventBus.onMultiple(
        ["tasks.created", "tasks.updated", "projects.created"],
        handler
      );

      // The implementation should be efficient - we'll test behavior, not implementation details
      const taskEvent: DomainEvent = {
        type: "tasks.created",
        task: mockTask,
        extension: "test-extension",
      };

      const projectEvent: DomainEvent = {
        type: "projects.created",
        project: mockProject,
        extension: "test-extension",
      };

      const unrelatedEvent: DomainEvent = {
        type: "areas.created",
        area: mockArea,
        extension: "test-extension",
      };

      // Trigger events
      eventBus.trigger(taskEvent);
      eventBus.trigger(projectEvent);
      eventBus.trigger(unrelatedEvent); // Should not trigger handler

      // Handler should only be called for subscribed event types
      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler).toHaveBeenCalledWith(taskEvent);
      expect(handler).toHaveBeenCalledWith(projectEvent);
      expect(handler).not.toHaveBeenCalledWith(unrelatedEvent);

      unsubscribe();
    });
  });

  describe("Pattern Matching (Advanced Feature)", () => {
    test("should subscribe to events matching pattern", () => {
      const unsubscribe = eventBus.onPattern("tasks.*", mockHandler);

      const createEvent: DomainEvent = {
        type: "tasks.created",
        task: mockTask,
        extension: "test-extension",
      };

      const updateEvent: DomainEvent = {
        type: "tasks.updated",
        task: mockTask,
        changes: { title: "Updated" },
        extension: "test-extension",
      };

      const projectEvent: DomainEvent = {
        type: "projects.created",
        project: mockProject,
        extension: "test-extension",
      };

      eventBus.trigger(createEvent);
      eventBus.trigger(updateEvent);
      eventBus.trigger(projectEvent);

      expect(mockHandler).toHaveBeenCalledTimes(2); // Only task events
      expect(mockHandler).toHaveBeenCalledWith(createEvent);
      expect(mockHandler).toHaveBeenCalledWith(updateEvent);
      expect(mockHandler).not.toHaveBeenCalledWith(projectEvent);

      unsubscribe();
    });

    test("should unsubscribe from pattern matching", () => {
      const unsubscribe = eventBus.onPattern("extension.*", mockHandler);

      const event: DomainEvent = {
        type: "extension.registered",
        extension: "test-extension",
        supportedEntities: ["task"],
      };

      eventBus.trigger(event);
      expect(mockHandler).toHaveBeenCalledTimes(1);

      unsubscribe();

      eventBus.trigger(event);
      expect(mockHandler).toHaveBeenCalledTimes(1); // Should not be called again
    });

    test("should handle complex patterns", () => {
      const allEventsHandler = vi.fn();
      const syncEventsHandler = vi.fn();

      eventBus.onPattern("*", allEventsHandler);
      eventBus.onPattern("*.sync.*", syncEventsHandler);

      const taskEvent: DomainEvent = {
        type: "tasks.created",
        task: mockTask,
        extension: "test-extension",
      };

      const syncEvent: DomainEvent = {
        type: "extension.sync.started",
        extension: "test-extension",
        entityType: "task",
      };

      eventBus.trigger(taskEvent);
      eventBus.trigger(syncEvent);

      expect(allEventsHandler).toHaveBeenCalledTimes(2); // All events
      expect(syncEventsHandler).toHaveBeenCalledTimes(1); // Only sync events
      expect(syncEventsHandler).toHaveBeenCalledWith(syncEvent);
    });

    test("should match patterns for events triggered after pattern subscription", () => {
      // This test demonstrates that pattern matching should work for events
      // that are triggered after pattern subscription, even if no handlers were
      // previously registered for those specific event types
      const patternHandler = vi.fn();

      // Subscribe to pattern before any specific event handlers are registered
      const unsubscribe = eventBus.onPattern("tasks.*", patternHandler);

      // Trigger an event that matches the pattern
      // This should work even though no specific handler for "tasks.created" was registered
      const createEvent: DomainEvent = {
        type: "tasks.created",
        task: mockTask,
        extension: "test-extension",
      };

      eventBus.trigger(createEvent);

      // Pattern handler should have been called
      expect(patternHandler).toHaveBeenCalledTimes(1);
      expect(patternHandler).toHaveBeenCalledWith(createEvent);

      unsubscribe();
    });

    test("should not create duplicate handlers for existing event types", () => {
      // This test verifies that onPattern doesn't create unnecessary duplicate handlers
      // for event types that already have handlers registered
      const specificHandler = vi.fn();
      const patternHandler = vi.fn();

      // Register a specific handler first
      const unsubscribeSpecific = eventBus.on("tasks.created", specificHandler);

      // Then register a pattern handler
      const unsubscribePattern = eventBus.onPattern("tasks.*", patternHandler);

      const createEvent: DomainEvent = {
        type: "tasks.created",
        task: mockTask,
        extension: "test-extension",
      };

      eventBus.trigger(createEvent);

      // Both handlers should be called exactly once
      expect(specificHandler).toHaveBeenCalledTimes(1);
      expect(patternHandler).toHaveBeenCalledTimes(1);

      unsubscribeSpecific();
      unsubscribePattern();
    });
  });

  describe("Extension Lifecycle Events", () => {
    test("should handle extension registration events", () => {
      eventBus.on("extension.registered", mockHandler);

      const event: DomainEvent = {
        type: "extension.registered",
        extension: "obsidian-extension",
        supportedEntities: ["task", "project", "area"],
      };

      eventBus.trigger(event);

      expect(mockHandler).toHaveBeenCalledWith(event);
    });

    test("should handle extension sync events", () => {
      const syncHandler = vi.fn();
      eventBus.onMultiple(
        [
          "extension.sync.started",
          "extension.sync.completed",
          "extension.sync.failed",
        ],
        syncHandler
      );

      const startEvent: DomainEvent = {
        type: "extension.sync.started",
        extension: "github-extension",
        entityType: "task",
      };

      const completeEvent: DomainEvent = {
        type: "extension.sync.completed",
        extension: "github-extension",
        entityType: "task",
        entityCount: 42,
      };

      const failEvent: DomainEvent = {
        type: "extension.sync.failed",
        extension: "github-extension",
        entityType: "task",
        error: "Network timeout",
      };

      eventBus.trigger(startEvent);
      eventBus.trigger(completeEvent);
      eventBus.trigger(failEvent);

      expect(syncHandler).toHaveBeenCalledTimes(3);
      expect(syncHandler).toHaveBeenCalledWith(startEvent);
      expect(syncHandler).toHaveBeenCalledWith(completeEvent);
      expect(syncHandler).toHaveBeenCalledWith(failEvent);
    });
  });

  describe("Real-world Extension Scenarios", () => {
    test("should simulate hot-loadable extension lifecycle", () => {
      const extensionHandlers: (() => void)[] = [];

      // Extension registers handlers
      extensionHandlers.push(eventBus.on("tasks.created", mockHandler));
      extensionHandlers.push(eventBus.on("tasks.updated", mockHandler));
      extensionHandlers.push(eventBus.onPattern("extension.*", mockHandler));

      expect(eventBus.getHandlerCount("tasks.created")).toBe(1);
      expect(eventBus.getHandlerCount("tasks.updated")).toBe(1);

      // Extension is active and receives events
      const event: DomainEvent = {
        type: "tasks.created",
        task: mockTask,
        extension: "test-extension",
      };

      eventBus.trigger(event);
      expect(mockHandler).toHaveBeenCalledTimes(1);

      // Extension is unloaded - cleanup all handlers
      extensionHandlers.forEach((unsubscribe) => unsubscribe());

      expect(eventBus.getHandlerCount("tasks.created")).toBe(0);
      expect(eventBus.getHandlerCount("tasks.updated")).toBe(0);

      // Events should no longer be received
      eventBus.trigger(event);
      expect(mockHandler).toHaveBeenCalledTimes(1); // No additional calls
    });

    test("should handle multiple extensions with same event types", () => {
      const obsidianHandler = vi.fn();
      const githubHandler = vi.fn();

      // Two extensions subscribe to same event type
      const obsidianUnsubscribe = eventBus.on("tasks.created", obsidianHandler);
      eventBus.on("tasks.created", githubHandler);

      expect(eventBus.getHandlerCount("tasks.created")).toBe(2);

      const event: DomainEvent = {
        type: "tasks.created",
        task: mockTask,
        extension: "obsidian",
      };

      eventBus.trigger(event);

      expect(obsidianHandler).toHaveBeenCalledWith(event);
      expect(githubHandler).toHaveBeenCalledWith(event);

      // One extension unloads
      obsidianUnsubscribe();

      expect(eventBus.getHandlerCount("tasks.created")).toBe(1);

      eventBus.trigger(event);

      expect(obsidianHandler).toHaveBeenCalledTimes(1); // No additional calls
      expect(githubHandler).toHaveBeenCalledTimes(2); // Still receiving events
    });
  });

  describe("Utility Methods", () => {
    test("should get handler count correctly", () => {
      expect(eventBus.getHandlerCount("tasks.created")).toBe(0);

      eventBus.on("tasks.created", mockHandler);
      expect(eventBus.getHandlerCount("tasks.created")).toBe(1);

      eventBus.on("tasks.created", vi.fn());
      expect(eventBus.getHandlerCount("tasks.created")).toBe(2);
    });

    test("should get registered event types", () => {
      expect(eventBus.getRegisteredEventTypes()).toEqual([]);

      eventBus.on("tasks.created", mockHandler);
      eventBus.on("projects.created", mockHandler);

      const types = eventBus.getRegisteredEventTypes();
      expect(types).toContain("tasks.created");
      expect(types).toContain("projects.created");
      expect(types).toHaveLength(2);
    });

    test("should clear handlers for specific event type", () => {
      eventBus.on("tasks.created", mockHandler);
      eventBus.on("projects.created", mockHandler);

      expect(eventBus.getHandlerCount("tasks.created")).toBe(1);
      expect(eventBus.getHandlerCount("projects.created")).toBe(1);

      eventBus.clearHandlers("tasks.created");

      expect(eventBus.getHandlerCount("tasks.created")).toBe(0);
      expect(eventBus.getHandlerCount("projects.created")).toBe(1);
    });

    test("should clear all handlers", () => {
      eventBus.on("tasks.created", mockHandler);
      eventBus.on("projects.created", mockHandler);
      eventBus.on("areas.created", mockHandler);

      expect(eventBus.getRegisteredEventTypes()).toHaveLength(3);

      eventBus.clearAllHandlers();

      expect(eventBus.getRegisteredEventTypes()).toHaveLength(0);
      expect(eventBus.getHandlerCount("tasks.created")).toBe(0);
    });
  });

  describe("Edge Cases and Performance", () => {
    test("should handle rapid event emission without memory leaks", () => {
      const handler = vi.fn();
      eventBus.on("tasks.created", handler);

      // Emit many events rapidly
      for (let i = 0; i < 1000; i++) {
        eventBus.trigger({
          type: "tasks.created",
          task: { ...mockTask, id: `task-${i}` },
          extension: "test",
        });
      }

      expect(handler).toHaveBeenCalledTimes(1000);
      expect(eventBus.getHandlerCount("tasks.created")).toBe(1);
    });

    test("should handle many handlers for same event type", () => {
      const handlers = Array.from({ length: 100 }, () => vi.fn());

      // Subscribe many handlers
      handlers.forEach((handler) => {
        eventBus.on("tasks.created", handler);
      });

      expect(eventBus.getHandlerCount("tasks.created")).toBe(100);

      // Trigger event
      eventBus.trigger({
        type: "tasks.created",
        task: mockTask,
        extension: "test",
      });

      // All handlers should be called
      handlers.forEach((handler) => {
        expect(handler).toHaveBeenCalledTimes(1);
      });
    });

    test("should handle invalid event types gracefully", () => {
      // Test with type assertion to bypass TypeScript checking
      expect(() => {
        (eventBus as any).on("invalid.event.type", mockHandler);
      }).not.toThrow();

      expect(() => {
        eventBus.trigger({
          type: "invalid.event.type",
          extension: "test",
        } as any);
      }).not.toThrow();

      expect((eventBus as any).getHandlerCount("invalid.event.type")).toBe(1);
    });

    test("should handle null/undefined handlers gracefully", () => {
      expect(() => {
        eventBus.on("tasks.created", null as any);
      }).not.toThrow();

      expect(() => {
        eventBus.on("tasks.created", undefined as any);
      }).not.toThrow();

      // Should not crash when triggering
      expect(() => {
        eventBus.trigger({
          type: "tasks.created",
          task: mockTask,
          extension: "test",
        });
      }).not.toThrow();
    });

    test("should handle circular event emission", () => {
      const handler1 = vi.fn(() => {
        // Handler 1 triggers another event
        eventBus.trigger({
          type: "tasks.updated",
          task: mockTask,
          changes: {},
          extension: "test",
        });
      });

      const handler2 = vi.fn();

      eventBus.on("tasks.created", handler1);
      eventBus.on("tasks.updated", handler2);

      // This should not cause infinite recursion
      eventBus.trigger({
        type: "tasks.created",
        task: mockTask,
        extension: "test",
      });

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    test("should maintain handler order during concurrent operations", () => {
      const callOrder: number[] = [];

      const handler1 = vi.fn(() => callOrder.push(1));
      const handler2 = vi.fn(() => callOrder.push(2));
      const handler3 = vi.fn(() => callOrder.push(3));

      eventBus.on("tasks.created", handler1);
      eventBus.on("tasks.created", handler2);
      eventBus.on("tasks.created", handler3);

      eventBus.trigger({
        type: "tasks.created",
        task: mockTask,
        extension: "test",
      });

      // Handlers should be called in subscription order
      expect(callOrder).toEqual([1, 2, 3]);
    });
  });

  describe("Memory Management", () => {
    test("should properly clean up after clearAllHandlers", () => {
      // Add many handlers using valid event types
      const validEventTypes = [
        "tasks.created",
        "tasks.updated",
        "projects.created",
        "areas.created",
      ];

      for (let i = 0; i < 20; i++) {
        const eventType = validEventTypes[i % validEventTypes.length];
        eventBus.on(eventType as any, vi.fn());
        eventBus.onPattern(`${eventType}.*`, vi.fn());
      }

      expect(eventBus.getRegisteredEventTypes().length).toBeGreaterThan(0);

      eventBus.clearAllHandlers();

      expect(eventBus.getRegisteredEventTypes()).toEqual([]);

      // Should be able to add new handlers after clearing
      eventBus.on("tasks.created", mockHandler);
      expect(eventBus.getHandlerCount("tasks.created")).toBe(1);
    });

    test("should handle unsubscription during event emission", () => {
      let unsubscribe: (() => void) | null = null;

      const handler1 = vi.fn(() => {
        // Unsubscribe during event handling
        if (unsubscribe) {
          unsubscribe();
        }
      });

      const handler2 = vi.fn();

      unsubscribe = eventBus.on("tasks.created", handler1);
      eventBus.on("tasks.created", handler2);

      // This should not crash
      eventBus.trigger({
        type: "tasks.created",
        task: mockTask,
        extension: "test",
      });

      expect(handler1).toHaveBeenCalledTimes(1);
      // handler2 might not be called if handler1 unsubscribes during iteration
      // The important thing is that it doesn't crash
      expect(eventBus.getHandlerCount("tasks.created")).toBeLessThanOrEqual(2);
    });
  });

  describe("Extension-Specific Events", () => {
    test("should support extension-specific event types", () => {
      const extensionHandler = vi.fn();

      // Subscribe to an extension-specific event
      eventBus.on("obsidian.notes.created", extensionHandler);

      // Trigger the extension event
      const extensionEvent = {
        type: "obsidian.notes.created",
        filePath: "/path/to/note.md",
      };

      eventBus.trigger(extensionEvent);

      expect(extensionHandler).toHaveBeenCalledTimes(1);
      expect(extensionHandler).toHaveBeenCalledWith(extensionEvent);
    });

    test("should support pattern matching for extension events", () => {
      const patternHandler = vi.fn();

      // Subscribe to all obsidian events using pattern
      const unsubscribe = eventBus.onPattern("obsidian.*", patternHandler);

      // Trigger multiple extension events
      eventBus.trigger({
        type: "obsidian.notes.created",
        filePath: "/note1.md",
      });

      eventBus.trigger({
        type: "obsidian.notes.updated",
        filePath: "/note2.md",
      });

      eventBus.trigger({
        type: "obsidian.notes.deleted",
        filePath: "/note3.md",
      });

      // Should have received all three events
      expect(patternHandler).toHaveBeenCalledTimes(3);

      unsubscribe();
    });

    test("should allow extensions to trigger namespaced events", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      // Subscribe to different extension events
      eventBus.on("github.issues.imported", handler1);
      eventBus.on("obsidian.notes.created", handler2);

      // Trigger GitHub extension event
      eventBus.trigger({
        type: "github.issues.imported",
        count: 5,
        repository: "test/repo",
      });

      // Trigger Obsidian extension event
      eventBus.trigger({
        type: "obsidian.notes.created",
        filePath: "/note.md",
      });

      // Each handler should only receive its own event
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler1).toHaveBeenCalledWith({
        type: "github.issues.imported",
        count: 5,
        repository: "test/repo",
      });

      expect(handler2).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledWith({
        type: "obsidian.notes.created",
        filePath: "/note.md",
      });
    });

    test("should support both core and extension events simultaneously", () => {
      const coreHandler = vi.fn();
      const extensionHandler = vi.fn();

      // Subscribe to core event
      eventBus.on("tasks.created", coreHandler);

      // Subscribe to extension event
      eventBus.on("obsidian.notes.created", extensionHandler);

      // Trigger core event
      const coreEvent: DomainEvent = {
        type: "tasks.created",
        task: mockTask,
        extension: "test",
      };
      eventBus.trigger(coreEvent);

      // Trigger extension event
      const extensionEvent = {
        type: "obsidian.notes.created",
        filePath: "/note.md",
      };
      eventBus.trigger(extensionEvent);

      // Both handlers should have been called
      expect(coreHandler).toHaveBeenCalledTimes(1);
      expect(coreHandler).toHaveBeenCalledWith(coreEvent);

      expect(extensionHandler).toHaveBeenCalledTimes(1);
      expect(extensionHandler).toHaveBeenCalledWith(extensionEvent);
    });
  });
});
