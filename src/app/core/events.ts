/**
 * Domain Events System for the Svelte app architecture
 * Provides event-driven communication between extensions and the core app
 */

import { Task, Project, Area } from "./entities";
import { EntityType } from "./extension";

/**
 * Core domain events - these are the standard events emitted by the core system
 */
export type CoreDomainEvent =
  // Task events
  | { type: "tasks.created"; task: Task; extension?: string }
  | {
      type: "tasks.updated";
      task: Task;
      changes?: Partial<Task>;
      extension?: string;
    }
  | { type: "tasks.deleted"; taskId: string; task: Task; extension?: string }
  | { type: "tasks.loaded"; tasks: readonly Task[]; extension?: string }

  // Project events
  | { type: "projects.created"; project: Project; extension?: string }
  | {
      type: "projects.updated";
      project: Project;
      changes?: Partial<Project>;
      extension?: string;
    }
  | { type: "projects.deleted"; projectId: string; project: Project; extension?: string }
  | {
      type: "projects.loaded";
      projects: readonly Project[];
      extension?: string;
    }

  // Area events
  | { type: "areas.created"; area: Area; extension?: string }
  | {
      type: "areas.updated";
      area: Area;
      changes?: Partial<Area>;
      extension?: string;
    }
  | { type: "areas.deleted"; areaId: string; area: Area; extension?: string }
  | { type: "areas.loaded"; areas: readonly Area[]; extension?: string }

  // Area request events (triggered by stores, handled by extensions)
  | {
      type: "areas.create.requested";
      areaData: Omit<Area, "id" | "createdAt" | "updatedAt">;
    }
  | { type: "areas.update.requested"; area: Area }
  | { type: "areas.delete.requested"; areaId: string }

  // Extension lifecycle events
  | {
      type: "extension.registered";
      extension?: string;
      supportedEntities: readonly EntityType[];
    }
  | {
      type: "extension.loaded";
      extension?: string;
      supportedEntities: readonly EntityType[];
    }
  | { type: "extension.unregistered"; extension?: string }
  | {
      type: "extension.sync.started";
      extension?: string;
      entityType: EntityType;
    }
  | {
      type: "extension.sync.completed";
      extension?: string;
      entityType: EntityType;
      entityCount: number;
    }
  | {
      type: "extension.sync.failed";
      extension?: string;
      entityType: EntityType;
      error: string;
    };

/**
 * Extension-specific event - allows extensions to define their own event types
 * The type field can be any string, allowing for namespaced events like "obsidian.notes.created"
 */
export interface ExtensionEvent {
  type: string;
  [key: string]: any;
}

/**
 * Union of core and extension events
 * This allows the event bus to handle both predefined core events and custom extension events
 */
export type DomainEvent = CoreDomainEvent | ExtensionEvent;

/**
 * EventBus for coordinating events between extensions and the core app
 * Supports subscribing/unsubscribing for hot-loadable extensions
 */
export class EventBus {
  private handlers = new Map<string, ((event: DomainEvent) => void)[]>();
  private compiledPatterns = new Map<string, RegExp>();

  /**
   * Subscribe to events of a specific type
   * Supports both core event types and extension-specific event types (any string)
   * Returns an unsubscribe function for cleanup (crucial for hot-loadable extensions)
   */
  on<T extends string>(
    eventType: T,
    handler: (
      event: T extends CoreDomainEvent["type"]
        ? Extract<CoreDomainEvent, { type: T }>
        : ExtensionEvent
    ) => void
  ): () => void {
    const handlers = this.handlers.get(eventType) || [];
    handlers.push(handler as any);
    this.handlers.set(eventType, handlers);

    // Return unsubscribe function for cleanup
    return () => {
      const currentHandlers = this.handlers.get(eventType) || [];
      const index = currentHandlers.indexOf(handler as any);
      if (index > -1) {
        currentHandlers.splice(index, 1);
      }
    };
  }

  /**
   * Trigger an event to all registered handlers
   * Handles errors gracefully to prevent one handler from breaking others
   */
  trigger(event: DomainEvent): void {
    this.triggerWithPatterns(event);
  }

  /**
   * Get the number of handlers registered for a specific event type
   * Useful for testing and debugging
   */
  getHandlerCount(eventType: string): number {
    const handlers = this.handlers.get(eventType);
    return handlers ? handlers.length : 0;
  }

  /**
   * Get all registered event types
   * Useful for debugging and introspection
   */
  getRegisteredEventTypes(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Clear all handlers for a specific event type
   * Useful for testing and cleanup
   */
  clearHandlers(eventType: string): void {
    this.handlers.delete(eventType);
  }

  /**
   * Clear all handlers for all event types
   * Useful for testing and complete cleanup
   */
  clearAllHandlers(): void {
    this.handlers.clear();
  }

  /**
   * Subscribe to multiple event types with the same handler
   * Returns an unsubscribe function that removes the handler from all event types
   * Uses efficient single handler approach that filters events by type
   * Supports both core and extension event types
   */
  onMultiple<T extends readonly string[]>(
    eventTypes: T,
    handler: (event: DomainEvent) => void
  ): () => void {
    // Create a single filtered handler that only processes matching event types
    const filteredHandler = (event: DomainEvent) => {
      if (eventTypes.includes(event.type)) {
        handler(event);
      }
    };

    // Use pattern matching with a wildcard to catch all events
    const unsubscribe = this.onPattern("*", filteredHandler);

    // Return the unsubscribe function
    return unsubscribe;
  }

  /**
   * Subscribe to all events matching a pattern (e.g., 'tasks.*')
   * Returns an unsubscribe function for cleanup
   */
  onPattern(
    pattern: string,
    handler: (event: DomainEvent) => void
  ): () => void {
    // Cache the compiled regex for performance
    if (!this.compiledPatterns.has(pattern)) {
      this.compiledPatterns.set(
        pattern,
        new RegExp(pattern.replace("*", ".*"))
      );
    }

    // Store pattern handler for future events
    const patternKey = `__pattern__${pattern}`;
    const patternHandlers = this.handlers.get(patternKey) || [];
    patternHandlers.push(handler);
    this.handlers.set(patternKey, patternHandlers);

    return () => {
      // Remove from pattern handlers
      const currentPatternHandlers = this.handlers.get(patternKey) || [];
      const index = currentPatternHandlers.indexOf(handler);
      if (index > -1) {
        currentPatternHandlers.splice(index, 1);
        // Clean up empty pattern handler arrays
        if (currentPatternHandlers.length === 0) {
          this.handlers.delete(patternKey);
          this.compiledPatterns.delete(pattern);
        }
      }
    };
  }

  /**
   * Override trigger to handle pattern matching
   */
  private triggerWithPatterns(event: DomainEvent): void {
    // Trigger normal handlers
    const handlers = this.handlers.get(event.type) || [];
    handlers.forEach((handler) => {
      try {
        handler(event);
      } catch (error) {
        console.error(`Error in event handler for ${event.type}:`, error);
      }
    });

    // Trigger pattern handlers
    for (const [key, patternHandlers] of this.handlers.entries()) {
      if (key.startsWith("__pattern__")) {
        const pattern = key.replace("__pattern__", "");
        const regex = this.compiledPatterns.get(pattern);
        if (regex && regex.test(event.type)) {
          patternHandlers.forEach((handler) => {
            try {
              handler(event);
            } catch (error) {
              console.error(`Error in pattern handler for ${pattern}:`, error);
            }
          });
        }
      }
    }
  }
}

export const eventBus = new EventBus();
