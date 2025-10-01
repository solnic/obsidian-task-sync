# Extension-Specific Events

The event bus now supports extension-specific domain events, allowing individual extensions to define and trigger their own custom event types.

## Overview

The event system supports two types of events:

1. **Core Domain Events** - Predefined events for standard entity operations (tasks, projects, areas)
2. **Extension Events** - Custom events that extensions can define for their specific needs

## Type System

```typescript
// Core events are strictly typed
export type CoreDomainEvent =
  | { type: "tasks.created"; task: Task; extension?: string }
  | { type: "tasks.updated"; task: Task; changes?: Partial<Task>; extension?: string }
  // ... other core events

// Extension events can have any type string and custom properties
export interface ExtensionEvent {
  type: string;
  [key: string]: any;
}

// DomainEvent is a union of both
export type DomainEvent = CoreDomainEvent | ExtensionEvent;
```

## Using Extension Events

### Triggering Extension Events

Extensions can trigger custom events using the `trigger` method from `EntityOperations`:

```typescript
export class ObsidianEntityOperations<T extends ObsidianEntity> 
  extends EntityOperations<T> {
  
  async createNote(entity: T): Promise<void> {
    const filePath = `${this.folder}/${fileName}.md`;
    
    // Create the note in Obsidian
    await this.app.vault.create(filePath, content);
    
    // Trigger extension-specific event
    // This will emit an event with type "obsidian.notes.created"
    this.trigger("notes.created", { filePath });
  }
}
```

The `trigger` method automatically prefixes the event type with the extension ID:
- Input: `"notes.created"`
- Emitted event type: `"obsidian.notes.created"`

### Subscribing to Extension Events

You can subscribe to extension events just like core events:

```typescript
// Subscribe to a specific extension event
eventBus.on("obsidian.notes.created", (event) => {
  console.log("Note created:", event.filePath);
});

// Subscribe to all events from an extension using patterns
eventBus.onPattern("obsidian.*", (event) => {
  console.log("Obsidian event:", event.type, event);
});

// Subscribe to multiple extension events
eventBus.onMultiple(
  ["obsidian.notes.created", "obsidian.notes.updated"],
  (event) => {
    console.log("Note changed:", event);
  }
);
```

## Example: GitHub Extension Events

Here's how a GitHub extension might define and use custom events:

```typescript
export class GitHubEntityOperations extends EntityOperations<Task> {
  constructor() {
    super({ id: "github" });
  }

  async importIssues(repository: string): Promise<void> {
    // Trigger sync started event
    this.trigger("sync.started", { repository });

    try {
      const issues = await this.fetchIssues(repository);
      
      // Trigger issues imported event
      this.trigger("issues.imported", {
        repository,
        count: issues.length,
        issues: issues.map(i => i.id)
      });
      
    } catch (error) {
      // Trigger sync failed event
      this.trigger("sync.failed", {
        repository,
        error: error.message
      });
    }
  }
}

// Subscribe to GitHub events
eventBus.on("github.sync.started", (event) => {
  console.log(`Starting sync for ${event.repository}`);
});

eventBus.on("github.issues.imported", (event) => {
  console.log(`Imported ${event.count} issues from ${event.repository}`);
});

eventBus.on("github.sync.failed", (event) => {
  console.error(`Sync failed for ${event.repository}: ${event.error}`);
});
```

## Best Practices

### 1. Use Namespaced Event Types

Always namespace your events with your extension ID:
- ✅ `"obsidian.notes.created"`
- ✅ `"github.issues.imported"`
- ❌ `"notes.created"` (conflicts with core events)

The `EntityOperations.trigger()` method handles this automatically.

### 2. Include Relevant Context

Include all relevant information in the event payload:

```typescript
// ✅ Good - includes all context
this.trigger("notes.created", {
  filePath: "/path/to/note.md",
  entityId: entity.id,
  entityType: "task"
});

// ❌ Bad - missing context
this.trigger("notes.created", {});
```

### 3. Use Pattern Matching for Extension Monitoring

When you need to monitor all events from an extension:

```typescript
// Monitor all Obsidian events
eventBus.onPattern("obsidian.*", (event) => {
  logger.debug("Obsidian event:", event);
});
```

### 4. Clean Up Subscriptions

Always unsubscribe when your component/extension is destroyed:

```typescript
class MyComponent {
  private unsubscribe: () => void;

  constructor() {
    this.unsubscribe = eventBus.on("obsidian.notes.created", this.handleNoteCreated);
  }

  destroy() {
    this.unsubscribe();
  }
}
```

## Type Safety

The event bus provides type safety for core events while remaining flexible for extension events:

```typescript
// Core events are fully typed
eventBus.on("tasks.created", (event) => {
  // TypeScript knows event has { type, task, extension? }
  console.log(event.task.title);
});

// Extension events are typed as ExtensionEvent
eventBus.on("obsidian.notes.created", (event) => {
  // TypeScript knows event has { type: string, [key: string]: any }
  console.log(event.filePath); // Access custom properties
});
```

## Migration from Old Event System

If you're migrating from the old event system:

**Old approach:**
```typescript
// Had to define events in central DomainEvent type
export type DomainEvent = 
  | { type: "obsidian.notes.created"; filePath: string }
  | // ... all other events
```

**New approach:**
```typescript
// Extensions can trigger events without modifying core types
this.trigger("notes.created", { filePath });
```

This makes the system more flexible and allows extensions to be truly independent.

