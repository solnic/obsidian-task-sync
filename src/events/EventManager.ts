/**
 * EventManager - Central event coordination for the Task Sync Plugin
 * Manages event handlers, middleware, and event emission
 */

import {
  EventType,
  PluginEvent,
  EventHandler,
  EventMiddleware,
  EventEmissionOptions,
  EventData
} from './EventTypes';

/**
 * Central event manager for the plugin
 */
export class EventManager {
  private handlers: Map<EventType, EventHandler[]> = new Map();
  private middleware: EventMiddleware[] = [];
  private isProcessing: boolean = false;
  private eventQueue: PluginEvent[] = [];

  /**
   * Register an event handler for specific event types
   * @param handler The event handler to register
   */
  registerHandler(handler: EventHandler): void {
    const supportedTypes = handler.getSupportedEventTypes();

    for (const eventType of supportedTypes) {
      if (!this.handlers.has(eventType)) {
        this.handlers.set(eventType, []);
      }

      const handlersForType = this.handlers.get(eventType)!;
      if (!handlersForType.includes(handler)) {
        handlersForType.push(handler);
        console.log(`EventManager: Registered handler for ${eventType}`);
      }
    }
  }

  /**
   * Unregister an event handler
   * @param handler The event handler to unregister
   */
  unregisterHandler(handler: EventHandler): void {
    const supportedTypes = handler.getSupportedEventTypes();

    for (const eventType of supportedTypes) {
      const handlersForType = this.handlers.get(eventType);
      if (handlersForType) {
        const index = handlersForType.indexOf(handler);
        if (index !== -1) {
          handlersForType.splice(index, 1);
          console.log(`EventManager: Unregistered handler for ${eventType}`);
        }
      }
    }
  }

  /**
   * Register middleware for event processing
   * @param middleware The middleware to register
   */
  registerMiddleware(middleware: EventMiddleware): void {
    if (!this.middleware.includes(middleware)) {
      this.middleware.push(middleware);
      console.log('EventManager: Registered middleware');
    }
  }

  /**
   * Unregister middleware
   * @param middleware The middleware to unregister
   */
  unregisterMiddleware(middleware: EventMiddleware): void {
    const index = this.middleware.indexOf(middleware);
    if (index !== -1) {
      this.middleware.splice(index, 1);
      console.log('EventManager: Unregistered middleware');
    }
  }

  /**
   * Emit an event to all registered handlers
   * @param eventType The type of event to emit
   * @param data The event data
   * @param options Optional emission configuration
   */
  async emit(
    eventType: EventType,
    data: EventData,
    options: EventEmissionOptions = {}
  ): Promise<void> {
    const event: PluginEvent = {
      type: eventType,
      timestamp: new Date(),
      data
    };

    const {
      async: isAsync = true,
      continueOnError = true,
      timeout = 5000
    } = options;

    if (isAsync) {
      // Add to queue for async processing
      this.eventQueue.push(event);
      // Don't await this to keep it truly async
      this.processEventQueue(continueOnError, timeout).catch(error => {
        console.error('EventManager: Error in async event processing:', error);
      });
    } else {
      // Process immediately
      await this.processEvent(event, continueOnError, timeout);
    }
  }

  /**
   * Process the event queue asynchronously
   */
  private async processEventQueue(continueOnError: boolean, timeout: number): Promise<void> {
    if (this.isProcessing) {
      return; // Already processing
    }

    this.isProcessing = true;

    try {
      while (this.eventQueue.length > 0) {
        const event = this.eventQueue.shift()!;
        await this.processEvent(event, continueOnError, timeout);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single event through middleware and handlers
   */
  private async processEvent(
    event: PluginEvent,
    continueOnError: boolean,
    timeout: number
  ): Promise<void> {
    try {
      // Process through middleware
      let processedEvent: PluginEvent | null = event;

      for (const middleware of this.middleware) {
        if (processedEvent === null) {
          return; // Event was cancelled by middleware
        }

        try {
          processedEvent = await this.withTimeout(
            middleware.process(processedEvent),
            timeout,
            `Middleware processing timeout for ${event.type}`
          );
        } catch (error) {
          console.error(`EventManager: Middleware error for ${event.type}:`, error);
          if (!continueOnError) {
            throw error;
          }
        }
      }

      if (processedEvent === null) {
        return; // Event was cancelled by middleware
      }

      // Send to handlers
      const handlers = this.handlers.get(processedEvent.type) || [];
      const handlerPromises: Promise<void>[] = [];

      for (const handler of handlers) {
        // Check if handler should process this event
        if (handler.shouldHandle && !handler.shouldHandle(processedEvent)) {
          continue;
        }

        const handlerPromise = this.withTimeout(
          handler.handle(processedEvent as any),
          timeout,
          `Handler timeout for ${processedEvent.type}`
        ).catch(error => {
          console.error(`EventManager: Handler error for ${processedEvent.type}:`, error);
          if (!continueOnError) {
            throw error;
          }
        });

        handlerPromises.push(handlerPromise);
      }

      // Wait for all handlers to complete
      await Promise.all(handlerPromises);

    } catch (error) {
      console.error(`EventManager: Error processing event ${event.type}:`, error);
      if (!continueOnError) {
        throw error;
      }
    }
  }

  /**
   * Wrap a promise with a timeout
   */
  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    errorMessage: string
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
      })
    ]);
  }



  /**
   * Get all registered event types
   */
  getRegisteredEventTypes(): EventType[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Clear all handlers and middleware
   */
  clear(): void {
    this.handlers.clear();
    this.middleware = [];
    this.eventQueue = [];
    this.isProcessing = false;
    console.log('EventManager: Cleared all handlers and middleware');
  }

  /**
   * Get the number of handlers registered for a specific event type
   */
  getHandlerCount(eventType: EventType): number {
    const handlers = this.handlers.get(eventType);
    return handlers ? handlers.length : 0;
  }

  /**
   * Get statistics about the event manager (for debugging/testing)
   */
  getStats(): {
    totalHandlers: number;
    middlewareCount: number;
    queueSize: number;
    isProcessing: boolean;
    handlersByType: Record<string, number>;
  } {
    const handlersByType: Record<string, number> = {};
    let totalHandlers = 0;

    for (const [eventType, handlers] of this.handlers.entries()) {
      handlersByType[eventType] = handlers.length;
      totalHandlers += handlers.length;
    }

    return {
      totalHandlers,
      middlewareCount: this.middleware.length,
      queueSize: this.eventQueue.length,
      isProcessing: this.isProcessing,
      handlersByType
    };
  }

  /**
   * Get current queue size
   */
  getQueueSize(): number {
    return this.eventQueue.length;
  }
}
