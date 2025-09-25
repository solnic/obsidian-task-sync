# Svelte App Implementation Plan

> **Comprehensive plan for porting the Obsidian Task Sync plugin to a modern Svelte 5 application architecture**
>
> This plan adapts the conceptual framework from `svelte-app-rework.md` to work with our existing entity definitions, property registry, and current implementation patterns.

## Overview

Transform the current Obsidian plugin into a standalone Svelte 5 application where the Obsidian plugin becomes just one of many possible backends. The core application will be framework-agnostic with clean separation between:

1. **Core Domain Layer** - Immutable entities with Zod validation
2. **Application Layer** - Commands, queries, and business logic
3. **Infrastructure Layer** - Sources (Obsidian, GitHub, etc.)
4. **Presentation Layer** - Svelte 5 SPA with reactive stores

## Current State Analysis

### Existing Strengths
- ✅ Well-defined entity types (`Task`, `Project`, `Area`) with property registry
- ✅ Comprehensive Svelte 5 components already implemented
- ✅ External source integration patterns (GitHub, Apple Reminders)
- ✅ File-based storage with front-matter handling
- ✅ Command pattern with `CommandManager` and `CommandRegistry`

### Current Limitations
- ❌ Tight coupling between Obsidian plugin and business logic
- ❌ No unified event system for cross-component communication
- ❌ Mixed responsibilities in stores and services
- ❌ No clear separation between domain and infrastructure concerns

## Phase 1: Core Domain Layer Foundation

### 1.1 Enhanced Entity Definitions with Zod Validation

**File: `src/core/entities.ts`**

```typescript
import { z } from 'zod';

// Reuse existing property definitions but add Zod validation
export const TaskStatusSchema = z.enum(['Backlog', 'In Progress', 'Done', 'Cancelled']);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const TaskSourceSchema = z.object({
  name: z.string(), // 'github', 'obsidian', 'apple-reminders'
  key: z.string(),
  url: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  data: z.record(z.any()).optional()
});
export type TaskSource = z.infer<typeof TaskSourceSchema>;

export const TaskSchema = z.object({
  // Core identity
  id: z.string(),

  // Front-matter properties (align with existing PROPERTY_REGISTRY)
  title: z.string(),
  type: z.string().default('Task'),
  category: z.string().optional(),
  priority: z.string().optional(),
  status: TaskStatusSchema.default('Backlog'),
  done: z.boolean().default(false),
  parentTask: z.string().optional(),
  project: z.string().optional(),
  areas: z.array(z.string()).default([]),
  doDate: z.date().optional(),
  dueDate: z.date().optional(),
  tags: z.array(z.string()).default([]),

  // System properties
  createdAt: z.date(),
  updatedAt: z.date(),

  // External source tracking
  source: TaskSourceSchema.optional(),

  // File system integration
  filePath: z.string(),

  // Content
  description: z.string().optional()
});

export type Task = Readonly<z.infer<typeof TaskSchema>>;

// Front-matter subset for file operations
export const TaskFrontMatterSchema = TaskSchema.pick({
  title: true,
  type: true,
  category: true,
  priority: true,
  status: true,
  done: true,
  parentTask: true,
  project: true,
  areas: true,
  doDate: true,
  dueDate: true,
  tags: true
});
export type TaskFrontMatter = z.infer<typeof TaskFrontMatterSchema>;
```

### 1.2 Note Abstraction

**File: `src/core/note.ts`**

```typescript
export interface Note {
  filePath: string;
  frontMatter: TaskFrontMatter;
  body: string;
  lastModified: Date;
}

export class NoteUtils {
  static fromTask(task: Task): Note {
    return {
      filePath: task.filePath,
      frontMatter: TaskFrontMatterSchema.parse(task),
      body: task.description || '',
      lastModified: task.updatedAt
    };
  }

  static toTask(note: Note, metadata: { id: string; createdAt: Date; source?: TaskSource }): Task {
    return TaskSchema.parse({
      ...note.frontMatter,
      ...metadata,
      description: note.body,
      filePath: note.filePath,
      updatedAt: note.lastModified
    });
  }
}
```

## Phase 2: Event-Driven Architecture

### 2.1 Domain Events System

**File: `src/core/events.ts`**

```typescript
// Generic entity types for events
export type EntityType = 'task' | 'project' | 'area';

export type DomainEvent =
  // Task events
  | { type: 'tasks.created'; task: Task; source: string }
  | { type: 'tasks.updated'; task: Task; changes: Partial<Task>; source: string }
  | { type: 'tasks.deleted'; taskId: string; source: string }
  | { type: 'tasks.loaded'; tasks: readonly Task[]; source: string }

  // Project events (for future implementation)
  | { type: 'projects.created'; project: Project; source: string }
  | { type: 'projects.updated'; project: Project; changes: Partial<Project>; source: string }
  | { type: 'projects.deleted'; projectId: string; source: string }
  | { type: 'projects.loaded'; projects: readonly Project[]; source: string }

  // Area events (for future implementation)
  | { type: 'areas.created'; area: Area; source: string }
  | { type: 'areas.updated'; area: Area; changes: Partial<Area>; source: string }
  | { type: 'areas.deleted'; areaId: string; source: string }
  | { type: 'areas.loaded'; areas: readonly Area[]; source: string }

  // Source events
  | { type: 'source.connected'; sourceType: string; supportedEntities: EntityType[] }
  | { type: 'source.disconnected'; sourceType: string }
  | { type: 'sync.started'; sourceType: string; entityType: EntityType }
  | { type: 'sync.completed'; sourceType: string; entityType: EntityType; entityCount: number }
  | { type: 'sync.failed'; sourceType: string; entityType: EntityType; error: string };

export class EventBus {
  private handlers = new Map<string, ((event: DomainEvent) => void)[]>();

  on<T extends DomainEvent['type']>(
    eventType: T,
    handler: (event: Extract<DomainEvent, { type: T }>) => void
  ): () => void {
    const handlers = this.handlers.get(eventType) || [];
    handlers.push(handler as any);
    this.handlers.set(eventType, handlers);

    // Return unsubscribe function
    return () => {
      const currentHandlers = this.handlers.get(eventType) || [];
      const index = currentHandlers.indexOf(handler as any);
      if (index > -1) {
        currentHandlers.splice(index, 1);
      }
    };
  }

  trigger(event: DomainEvent): void {
    const handlers = this.handlers.get(event.type) || [];
    handlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        console.error(`Error in event handler for ${event.type}:`, error);
      }
    });
  }

  // Legacy alias for backward compatibility
  emit(event: DomainEvent): void {
    this.trigger(event);
  }
}

export const eventBus = new EventBus();
```

## Phase 3: Source Abstraction Layer

### 3.1 Universal Source Interface

**File: `src/core/source.ts`**

```typescript
import { Task, Project, Area } from './entities';
import { EntityType, eventBus, DomainEvent } from './events';

// Generic entity union type
export type Entity = Task | Project | Area;

// Entity-specific operations interface
export interface EntityOperations<T extends Entity> {
  loadAll(): Promise<readonly T[]>;
  sync(entity: T): Promise<void>;
  delete(entityId: string): Promise<void>;
  observe(callback: (entities: readonly T[]) => void): () => void;
}

export interface Source {
  readonly name: string;
  readonly type: string;
  readonly isConnected: boolean;
  readonly supportedEntities: readonly EntityType[];

  // Entity-specific operations
  tasks?: EntityOperations<Task>;
  projects?: EntityOperations<Project>;
  areas?: EntityOperations<Area>;

  // Connection management
  connect(): Promise<void>;
  disconnect(): Promise<void>;

  // Health check
  healthCheck(): Promise<boolean>;

  // Check if entity type is supported
  supports(entityType: EntityType): boolean;
}

export abstract class BaseSource implements Source {
  abstract readonly name: string;
  abstract readonly type: string;
  abstract readonly supportedEntities: readonly EntityType[];

  protected _isConnected = false;

  get isConnected(): boolean {
    return this._isConnected;
  }

  protected trigger(event: DomainEvent): void {
    eventBus.trigger(event);
  }

  supports(entityType: EntityType): boolean {
    return this.supportedEntities.includes(entityType);
  }

  async connect(): Promise<void> {
    this._isConnected = true;
    this.trigger({
      type: 'source.connected',
      sourceType: this.type,
      supportedEntities: [...this.supportedEntities]
    });
  }

  async disconnect(): Promise<void> {
    this._isConnected = false;
    this.trigger({ type: 'source.disconnected', sourceType: this.type });
  }

  async healthCheck(): Promise<boolean> {
    return this.isConnected;
  }
}
```

### 3.2 Obsidian Source Implementation

**File: `src/sources/ObsidianSource.ts`**

```typescript
import { App, Plugin, TFile, processFrontMatter } from 'obsidian';
import { BaseSource, EntityOperations } from '../core/source';
import { Task, Project, Area, TaskSchema, TaskFrontMatterSchema } from '../core/entities';
import { EntityType, eventBus } from '../core/events';
import { Note, NoteUtils } from '../core/note';

export class ObsidianSource extends BaseSource {
  readonly name = 'Vault';
  readonly type = 'obsidian';
  readonly supportedEntities: readonly EntityType[] = ['task', 'project', 'area'];

  // Entity operations
  readonly tasks: EntityOperations<Task>;
  readonly projects: EntityOperations<Project>;
  readonly areas: EntityOperations<Area>;

  private unsubscribeFileWatcher?: () => void;

  constructor(
    private app: App,
    private plugin: Plugin,
    private settings: {
      tasksFolder: string;
      projectsFolder: string;
      areasFolder: string;
    }
  ) {
    super();

    // Initialize entity operations
    this.tasks = new ObsidianTaskOperations(app, plugin, settings.tasksFolder);
    this.projects = new ObsidianProjectOperations(app, plugin, settings.projectsFolder);
    this.areas = new ObsidianAreaOperations(app, plugin, settings.areasFolder);
  }
}

class ObsidianTaskOperations implements EntityOperations<Task> {
  constructor(
    private app: App,
    private plugin: Plugin,
    private folder: string
  ) {}

  async loadAll(): Promise<readonly Task[]> {
    const files = this.app.vault.getMarkdownFiles()
      .filter(f => f.path.startsWith(this.folder + '/'));

    const tasks: Task[] = [];

    for (const file of files) {
      try {
        const note = await this.readNote(file);
        if (note) {
          const task = this.noteToTask(note, file);
          tasks.push(task);
        }
      } catch (error) {
        console.warn(`Failed to load task from ${file.path}:`, error);
      }
    }

    eventBus.trigger({ type: 'tasks.loaded', tasks, source: 'obsidian' });
    return tasks;
  }

  async sync(task: Task): Promise<void> {
    const note = NoteUtils.fromTask(task);
    const filePath = `${this.folder}/${task.id}.md`;

    try {
      const file = this.app.vault.getAbstractFileByPath(filePath) as TFile | null;

      if (file) {
        // Update existing file
        await this.app.fileManager.processFrontMatter(file, (frontMatter) => {
          Object.assign(frontMatter, note.frontMatter);
        });

        // Update body if needed
        const currentContent = await this.app.vault.read(file);
        const bodyStart = currentContent.indexOf('---', 3) + 4;
        const newContent = currentContent.substring(0, bodyStart) + '\n' + note.body;
        await this.app.vault.modify(file, newContent);
      } else {
        // Create new file
        const frontMatterYaml = this.serializeFrontMatter(note.frontMatter);
        const content = `---\n${frontMatterYaml}\n---\n\n${note.body}`;
        await this.app.vault.create(filePath, content);
      }

      eventBus.trigger({ type: 'tasks.updated', task, changes: {}, source: 'obsidian' });
    } catch (error) {
      console.error(`Failed to sync task ${task.id}:`, error);
      throw error;
    }
  }

  async delete(taskId: string): Promise<void> {
    const filePath = `${this.folder}/${taskId}.md`;
    const file = this.app.vault.getAbstractFileByPath(filePath);

    if (file instanceof TFile) {
      await this.app.vault.delete(file);
      eventBus.trigger({ type: 'tasks.deleted', taskId, source: 'obsidian' });
    }
  }

  observe(callback: (tasks: readonly Task[]) => void): () => void {
    const handleFileChange = async (file: TFile) => {
      if (file.path.startsWith(this.folder + '/')) {
        try {
          const note = await this.readNote(file);
          if (note) {
            const task = this.noteToTask(note, file);
            callback([task]);
          }
        } catch (error) {
          console.warn(`Failed to process file change for ${file.path}:`, error);
        }
      }
    };

    this.app.vault.on('modify', handleFileChange);
    this.app.vault.on('create', handleFileChange);

    return () => {
      this.app.vault.off('modify', handleFileChange);
      this.app.vault.off('create', handleFileChange);
    };
  }

  // Private helper methods
  private async readNote(file: TFile): Promise<Note | null> {
    try {
      const frontMatter: Record<string, any> = {};
      await this.app.fileManager.processFrontMatter(file, (fm) => {
        Object.assign(frontMatter, fm);
      });

      // Validate that this is a task file
      if (frontMatter.type !== 'Task' || !frontMatter.title) {
        return null;
      }

      const content = await this.app.vault.read(file);
      const body = content.replace(/^---[\s\S]*?---\n?/, '').trim();

      return {
        filePath: file.path,
        frontMatter: TaskFrontMatterSchema.parse(frontMatter),
        body,
        lastModified: new Date(file.stat.mtime)
      };
    } catch (error) {
      console.warn(`Failed to read note ${file.path}:`, error);
      return null;
    }
  }

  private noteToTask(note: Note, file: TFile): Task {
    return TaskSchema.parse({
      ...note.frontMatter,
      id: file.basename,
      description: note.body,
      filePath: note.filePath,
      createdAt: new Date(file.stat.ctime),
      updatedAt: note.lastModified,
      source: {
        name: 'obsidian',
        key: file.path,
        metadata: { folder: this.settings.tasksFolder }
      }
    });
  }

  private serializeFrontMatter(frontMatter: TaskFrontMatter): string {
    return Object.entries(frontMatter)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => {
        if (value instanceof Date) {
          return `${key}: ${value.toISOString()}`;
        }
        if (Array.isArray(value)) {
          return `${key}: [${value.map(v => `"${v}"`).join(', ')}]`;
        }
        if (typeof value === 'string') {
          return `${key}: "${value}"`;
        }
        return `${key}: ${value}`;
      })
      .join('\n');
  }
}

// Placeholder implementations for Project and Area operations
class ObsidianProjectOperations implements EntityOperations<Project> {
  constructor(
    private app: App,
    private plugin: Plugin,
    private folder: string
  ) {}

  async loadAll(): Promise<readonly Project[]> {
    // Implementation similar to tasks but for projects
    const projects: Project[] = [];
    // ... project loading logic
    eventBus.trigger({ type: 'projects.loaded', projects, source: 'obsidian' });
    return projects;
  }

  async sync(project: Project): Promise<void> {
    // Project sync implementation
    eventBus.trigger({ type: 'projects.updated', project, changes: {}, source: 'obsidian' });
  }

  async delete(projectId: string): Promise<void> {
    // Project deletion implementation
    eventBus.trigger({ type: 'projects.deleted', projectId, source: 'obsidian' });
  }

  observe(callback: (projects: readonly Project[]) => void): () => void {
    // Project file watching implementation
    return () => {};
  }
}

class ObsidianAreaOperations implements EntityOperations<Area> {
  constructor(
    private app: App,
    private plugin: Plugin,
    private folder: string
  ) {}

  async loadAll(): Promise<readonly Area[]> {
    // Implementation similar to tasks but for areas
    const areas: Area[] = [];
    // ... area loading logic
    eventBus.trigger({ type: 'areas.loaded', areas, source: 'obsidian' });
    return areas;
  }

  async sync(area: Area): Promise<void> {
    // Area sync implementation
    eventBus.trigger({ type: 'areas.updated', area, changes: {}, source: 'obsidian' });
  }

  async delete(areaId: string): Promise<void> {
    // Area deletion implementation
    eventBus.trigger({ type: 'areas.deleted', areaId, source: 'obsidian' });
  }

  observe(callback: (areas: readonly Area[]) => void): () => void {
    // Area file watching implementation
    return () => {};
  }
}
```

## Phase 4: Reactive State Management

### 4.1 Enhanced Task Store with Event Integration

**File: `src/stores/taskStore.ts`**

```typescript
import { writable, derived, type Writable } from 'svelte/store';
import { Task } from '../core/entities';
import { eventBus } from '../core/events';

interface TaskStoreState {
  tasks: readonly Task[];
  loading: boolean;
  error: string | null;
  lastSync: Date | null;
}

function createTaskStore(): Writable<TaskStoreState> & {
  // Query methods
  getById: (id: string) => Task | undefined;
  getByProject: (project: string) => Task[];
  getByArea: (area: string) => Task[];
  getScheduledForToday: () => Task[];

  // Command methods
  add: (task: Task) => void;
  update: (task: Task) => void;
  remove: (id: string) => void;
  setAll: (tasks: readonly Task[]) => void;

  // State management
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
} {
  const initialState: TaskStoreState = {
    tasks: [],
    loading: false,
    error: null,
    lastSync: null
  };

  const { subscribe, update } = writable(initialState);

  // Subscribe to domain events
  eventBus.on('tasks.created', (event) => {
    update(state => ({
      ...state,
      tasks: [...state.tasks, event.task],
      lastSync: new Date()
    }));
  });

  eventBus.on('tasks.updated', (event) => {
    update(state => ({
      ...state,
      tasks: state.tasks.map(t => t.id === event.task.id ? event.task : t),
      lastSync: new Date()
    }));
  });

  eventBus.on('tasks.deleted', (event) => {
    update(state => ({
      ...state,
      tasks: state.tasks.filter(t => t.id !== event.taskId),
      lastSync: new Date()
    }));
  });

  eventBus.on('tasks.loaded', (event) => {
    update(state => ({
      ...state,
      tasks: event.tasks,
      loading: false,
      error: null,
      lastSync: new Date()
    }));
  });

  return {
    subscribe,

    // Query methods
    getById: (id: string) => {
      let result: Task | undefined;
      subscribe(state => {
        result = state.tasks.find(t => t.id === id);
      })();
      return result;
    },

    getByProject: (project: string) => {
      let result: Task[] = [];
      subscribe(state => {
        result = state.tasks.filter(t =>
          t.project === project || t.project === `[[${project}]]`
        );
      })();
      return result;
    },

    getByArea: (area: string) => {
      let result: Task[] = [];
      subscribe(state => {
        result = state.tasks.filter(t =>
          t.areas?.includes(area) || t.areas?.includes(`[[${area}]]`)
        );
      })();
      return result;
    },

    getScheduledForToday: () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      let result: Task[] = [];
      subscribe(state => {
        result = state.tasks.filter(t =>
          t.doDate && t.doDate >= today && t.doDate < tomorrow
        );
      })();
      return result;
    },

    // Command methods
    add: (task: Task) => {
      eventBus.trigger({ type: 'tasks.created', task, source: 'ui' });
    },

    update: (task: Task) => {
      eventBus.trigger({ type: 'tasks.updated', task, changes: {}, source: 'ui' });
    },

    remove: (id: string) => {
      eventBus.trigger({ type: 'tasks.deleted', taskId: id, source: 'ui' });
    },

    setAll: (tasks: readonly Task[]) => {
      update(state => ({ ...state, tasks, lastSync: new Date() }));
    },

    // State management
    setLoading: (loading: boolean) => {
      update(state => ({ ...state, loading }));
    },

    setError: (error: string | null) => {
      update(state => ({ ...state, error }));
    }
  };
}

export const taskStore = createTaskStore();

// Derived stores for common queries
export const importedTasks = derived(taskStore, $store =>
  $store.tasks.filter(task => task.source && task.source.name !== 'obsidian')
);

export const localTasks = derived(taskStore, $store =>
  $store.tasks.filter(task => !task.source || task.source.name === 'obsidian')
);

export const todayTasks = derived(taskStore, $store => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return $store.tasks.filter(t =>
    t.doDate && t.doDate >= today && t.doDate < tomorrow
  );
});
```

## Phase 5: Command/Query Separation (CQS)

### 5.1 Command Handlers

**File: `src/commands/TaskCommands.ts`**

```typescript
import { Task, TaskSchema } from '../core/entities';
import { eventBus } from '../core/events';
import { taskStore } from '../stores/taskStore';

export interface CreateTaskCommand {
  title: string;
  description?: string;
  project?: string;
  areas?: string[];
  priority?: string;
  doDate?: Date;
  dueDate?: Date;
}

export interface UpdateTaskCommand {
  id: string;
  changes: Partial<Task>;
}

export class TaskCommands {
  static async create(command: CreateTaskCommand): Promise<Task> {
    const now = new Date();
    const task = TaskSchema.parse({
      id: crypto.randomUUID(),
      ...command,
      type: 'Task',
      status: 'Backlog',
      done: false,
      tags: [],
      areas: command.areas || [],
      createdAt: now,
      updatedAt: now,
      filePath: `Tasks/${command.title}.md`
    });

    taskStore.add(task);
    return task;
  }

  static async update(command: UpdateTaskCommand): Promise<Task | null> {
    const existing = taskStore.getById(command.id);
    if (!existing) {
      throw new Error(`Task ${command.id} not found`);
    }

    const updated = TaskSchema.parse({
      ...existing,
      ...command.changes,
      updatedAt: new Date()
    });

    taskStore.update(updated);
    return updated;
  }

  static async delete(id: string): Promise<void> {
    const existing = taskStore.getById(id);
    if (!existing) {
      throw new Error(`Task ${id} not found`);
    }

    taskStore.remove(id);
  }

  static async markDone(id: string): Promise<Task | null> {
    return this.update({
      id,
      changes: { done: true, status: 'Done', updatedAt: new Date() }
    });
  }

  static async schedule(id: string, doDate: Date): Promise<Task | null> {
    return this.update({
      id,
      changes: { doDate, updatedAt: new Date() }
    });
  }
}
```

### 5.2 Query Handlers

**File: `src/queries/TaskQueries.ts`**

```typescript
import { derived, type Readable } from 'svelte/store';
import { taskStore } from '../stores/taskStore';
import { Task } from '../core/entities';

export class TaskQueries {
  // Real-time reactive queries
  static getAll(): Readable<readonly Task[]> {
    return derived(taskStore, $store => $store.tasks);
  }

  static getByProject(project: string): Readable<Task[]> {
    return derived(taskStore, $store =>
      $store.tasks.filter(t =>
        t.project === project || t.project === `[[${project}]]`
      )
    );
  }

  static getByArea(area: string): Readable<Task[]> {
    return derived(taskStore, $store =>
      $store.tasks.filter(t =>
        t.areas?.includes(area) || t.areas?.includes(`[[${area}]]`)
      )
    );
  }

  static getScheduledForDate(date: Date): Readable<Task[]> {
    return derived(taskStore, $store => {
      const targetDate = new Date(date);
      targetDate.setHours(0, 0, 0, 0);
      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);

      return $store.tasks.filter(t =>
        t.doDate && t.doDate >= targetDate && t.doDate < nextDay
      );
    });
  }

  static getOverdue(): Readable<Task[]> {
    return derived(taskStore, $store => {
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      return $store.tasks.filter(t =>
        t.dueDate && t.dueDate < now && !t.done
      );
    });
  }

  static getByStatus(status: string): Readable<Task[]> {
    return derived(taskStore, $store =>
      $store.tasks.filter(t => t.status === status)
    );
  }

  // Snapshot queries (for one-time data access)
  static async findById(id: string): Promise<Task | null> {
    return taskStore.getById(id) || null;
  }

  static async search(query: string): Promise<Task[]> {
    const searchTerm = query.toLowerCase();
    let results: Task[] = [];

    taskStore.subscribe($store => {
      results = $store.tasks.filter(t =>
        t.title.toLowerCase().includes(searchTerm) ||
        t.description?.toLowerCase().includes(searchTerm) ||
        t.project?.toLowerCase().includes(searchTerm) ||
        t.areas?.some(area => area.toLowerCase().includes(searchTerm))
      );
    })();

    return results;
  }
}
```

## Phase 6: Source Registry and Multi-Source Coordination

### 6.1 Source Registry

**File: `src/core/SourceRegistry.ts`**

```typescript
import { Source } from './source';
import { eventBus } from './events';

export class SourceRegistry {
  private sources = new Map<string, Source>();
  private activeSources = new Set<string>();

  register(source: Source): void {
    this.sources.set(source.type, source);

    // Subscribe to source events for each supported entity type
    if (source.tasks) {
      source.tasks.observe((tasks) => {
        eventBus.trigger({
          type: 'tasks.loaded',
          tasks,
          source: source.type
        });
      });
    }

    if (source.projects) {
      source.projects.observe((projects) => {
        eventBus.trigger({
          type: 'projects.loaded',
          projects,
          source: source.type
        });
      });
    }

    if (source.areas) {
      source.areas.observe((areas) => {
        eventBus.trigger({
          type: 'areas.loaded',
          areas,
          source: source.type
        });
      });
    }
  }

  unregister(sourceType: string): void {
    const source = this.sources.get(sourceType);
    if (source && source.isConnected) {
      source.disconnect();
    }
    this.sources.delete(sourceType);
    this.activeSources.delete(sourceType);
  }

  async activateSource(sourceType: string): Promise<void> {
    const source = this.sources.get(sourceType);
    if (!source) {
      throw new Error(`Source ${sourceType} not registered`);
    }

    if (!source.isConnected) {
      await source.connect();
    }

    this.activeSources.add(sourceType);

    // Load initial data for all supported entity types
    for (const entityType of source.supportedEntities) {
      try {
        eventBus.trigger({ type: 'sync.started', sourceType, entityType });

        let entityCount = 0;
        if (entityType === 'task' && source.tasks) {
          const tasks = await source.tasks.loadAll();
          entityCount = tasks.length;
        } else if (entityType === 'project' && source.projects) {
          const projects = await source.projects.loadAll();
          entityCount = projects.length;
        } else if (entityType === 'area' && source.areas) {
          const areas = await source.areas.loadAll();
          entityCount = areas.length;
        }

        eventBus.trigger({
          type: 'sync.completed',
          sourceType,
          entityType,
          entityCount
        });
      } catch (error) {
        eventBus.trigger({
          type: 'sync.failed',
          sourceType,
          entityType,
          error: error.message
        });
      }
    }
  }

  async deactivateSource(sourceType: string): Promise<void> {
    const source = this.sources.get(sourceType);
    if (source && source.isConnected) {
      await source.disconnect();
    }
    this.activeSources.delete(sourceType);
  }

  getSource(sourceType: string): Source | undefined {
    return this.sources.get(sourceType);
  }

  getActiveSources(): Source[] {
    return Array.from(this.activeSources)
      .map(type => this.sources.get(type))
      .filter(Boolean) as Source[];
  }

  getAllSources(): Source[] {
    return Array.from(this.sources.values());
  }

  async syncEntity(entityType: EntityType, entity: Entity): Promise<void> {
    const sourceType = entity.source?.name || 'obsidian';
    const source = this.sources.get(sourceType);

    if (!source) {
      throw new Error(`Source ${sourceType} not available for sync`);
    }

    if (!source.supports(entityType)) {
      throw new Error(`Source ${sourceType} does not support ${entityType} entities`);
    }

    // Route to appropriate entity operations
    if (entityType === 'task' && source.tasks) {
      await source.tasks.sync(entity as Task);
    } else if (entityType === 'project' && source.projects) {
      await source.projects.sync(entity as Project);
    } else if (entityType === 'area' && source.areas) {
      await source.areas.sync(entity as Area);
    } else {
      throw new Error(`Source ${sourceType} does not have ${entityType} operations available`);
    }
  }

  async deleteEntity(entityType: EntityType, entityId: string): Promise<void> {
    // Find the source that owns this entity (simplified - could be more sophisticated)
    const sources = this.getActiveSources();

    for (const source of sources) {
      if (!source.supports(entityType)) continue;

      try {
        if (entityType === 'task' && source.tasks) {
          await source.tasks.delete(entityId);
          return;
        } else if (entityType === 'project' && source.projects) {
          await source.projects.delete(entityId);
          return;
        } else if (entityType === 'area' && source.areas) {
          await source.areas.delete(entityId);
          return;
        }
      } catch (error) {
        // Continue to next source if this one fails
        console.warn(`Failed to delete ${entityType} ${entityId} from ${source.type}:`, error);
      }
    }

    throw new Error(`No source available to delete ${entityType} ${entityId}`);
  }
}

export const sourceRegistry = new SourceRegistry();
```

### 6.2 Multi-Source Coordination Service

**File: `src/services/SyncCoordinator.ts`**

```typescript
import { sourceRegistry } from '../core/SourceRegistry';
import { eventBus } from '../core/events';
import { taskStore } from '../stores/taskStore';

export class SyncCoordinator {
  private syncInProgress = new Set<string>();

  constructor() {
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Handle task commands and route to appropriate sources
    eventBus.on('tasks.created', async (event) => {
      if (event.source === 'ui') {
        await this.syncEntityToSource('task', event.task);
      }
    });

    eventBus.on('tasks.updated', async (event) => {
      if (event.source === 'ui') {
        await this.syncEntityToSource('task', event.task);
      }
    });

    eventBus.on('tasks.deleted', async (event) => {
      if (event.source === 'ui') {
        await this.deleteEntityFromSource('task', event.taskId);
      }
    });

    // Handle project commands
    eventBus.on('projects.created', async (event) => {
      if (event.source === 'ui') {
        await this.syncEntityToSource('project', event.project);
      }
    });

    eventBus.on('projects.updated', async (event) => {
      if (event.source === 'ui') {
        await this.syncEntityToSource('project', event.project);
      }
    });

    eventBus.on('projects.deleted', async (event) => {
      if (event.source === 'ui') {
        await this.deleteEntityFromSource('project', event.projectId);
      }
    });

    // Handle area commands
    eventBus.on('areas.created', async (event) => {
      if (event.source === 'ui') {
        await this.syncEntityToSource('area', event.area);
      }
    });

    eventBus.on('areas.updated', async (event) => {
      if (event.source === 'ui') {
        await this.syncEntityToSource('area', event.area);
      }
    });

    eventBus.on('areas.deleted', async (event) => {
      if (event.source === 'ui') {
        await this.deleteEntityFromSource('area', event.areaId);
      }
    });
  }

  async syncAll(): Promise<void> {
    const sources = sourceRegistry.getActiveSources();

    for (const source of sources) {
      // Sync each supported entity type
      for (const entityType of source.supportedEntities) {
        const syncKey = `${source.type}-${entityType}`;

        if (this.syncInProgress.has(syncKey)) {
          continue; // Skip if already syncing
        }

        try {
          this.syncInProgress.add(syncKey);
          eventBus.trigger({
            type: 'sync.started',
            sourceType: source.type,
            entityType
          });

          let entities: readonly Entity[] = [];
          let entityCount = 0;

          // Load entities based on type
          if (entityType === 'task' && source.tasks) {
            entities = await source.tasks.loadAll();
            entityCount = entities.length;
          } else if (entityType === 'project' && source.projects) {
            entities = await source.projects.loadAll();
            entityCount = entities.length;
          } else if (entityType === 'area' && source.areas) {
            entities = await source.areas.loadAll();
            entityCount = entities.length;
          }

          eventBus.trigger({
            type: 'sync.completed',
            sourceType: source.type,
            entityType,
            entityCount
          });
        } catch (error) {
          eventBus.trigger({
            type: 'sync.failed',
            sourceType: source.type,
            entityType,
            error: error.message
          });
        } finally {
          this.syncInProgress.delete(syncKey);
        }
      }
    }
  }

  private async syncEntityToSource(entityType: EntityType, entity: Entity): Promise<void> {
    try {
      await sourceRegistry.syncEntity(entityType, entity);
    } catch (error) {
      console.error(`Failed to sync ${entityType} ${entity.id}:`, error);
    }
  }

  private async deleteEntityFromSource(entityType: EntityType, entityId: string): Promise<void> {
    try {
      await sourceRegistry.deleteEntity(entityType, entityId);
    } catch (error) {
      console.error(`Failed to delete ${entityType} ${entityId}:`, error);
    }
  }

  async healthCheck(): Promise<Record<string, boolean>> {
    const sources = sourceRegistry.getAllSources();
    const results: Record<string, boolean> = {};

    for (const source of sources) {
      try {
        results[source.type] = await source.healthCheck();
      } catch (error) {
        results[source.type] = false;
      }
    }

    return results;
  }
}

export const syncCoordinator = new SyncCoordinator();
```

### 6.3 Example: GitHub Source (Task-Only)

**File: `src/sources/GitHubSource.ts`**

```typescript
import { BaseSource, EntityOperations } from '../core/source';
import { Task, TaskSchema } from '../core/entities';
import { EntityType } from '../core/events';

export class GitHubSource extends BaseSource {
  readonly name = 'GitHub';
  readonly type = 'github';
  readonly supportedEntities: readonly EntityType[] = ['task']; // Only supports tasks

  // Only task operations available
  readonly tasks: EntityOperations<Task>;

  // Projects and areas are undefined - not supported
  readonly projects = undefined;
  readonly areas = undefined;

  constructor(private settings: { token: string; repositories: string[] }) {
    super();
    this.tasks = new GitHubTaskOperations(settings);
  }
}

class GitHubTaskOperations implements EntityOperations<Task> {
  constructor(private settings: { token: string; repositories: string[] }) {}

  async loadAll(): Promise<readonly Task[]> {
    // Load GitHub issues as tasks
    const tasks: Task[] = [];

    for (const repo of this.settings.repositories) {
      try {
        const issues = await this.fetchIssues(repo);
        const repoTasks = issues.map(issue => this.issueToTask(issue, repo));
        tasks.push(...repoTasks);
      } catch (error) {
        console.warn(`Failed to load issues from ${repo}:`, error);
      }
    }

    eventBus.trigger({ type: 'tasks.loaded', tasks, source: 'github' });
    return tasks;
  }

  async sync(task: Task): Promise<void> {
    // GitHub is read-only in this example
    throw new Error('GitHub source is read-only');
  }

  async delete(taskId: string): Promise<void> {
    // GitHub is read-only in this example
    throw new Error('GitHub source is read-only');
  }

  observe(callback: (tasks: readonly Task[]) => void): () => void {
    // Could implement webhooks or polling here
    return () => {}; // No-op for now
  }

  private async fetchIssues(repo: string): Promise<any[]> {
    // GitHub API implementation
    return [];
  }

  private issueToTask(issue: any, repo: string): Task {
    return TaskSchema.parse({
      id: `github-${repo}-${issue.number}`,
      title: issue.title,
      description: issue.body,
      status: issue.state === 'open' ? 'Backlog' : 'Done',
      type: 'Task',
      done: issue.state === 'closed',
      areas: [],
      tags: issue.labels?.map((l: any) => l.name) || [],
      createdAt: new Date(issue.created_at),
      updatedAt: new Date(issue.updated_at),
      filePath: `GitHub/${repo}/${issue.number}.md`,
      source: {
        name: 'github',
        key: `${repo}#${issue.number}`,
        url: issue.html_url,
        data: issue
      }
    });
  }
}
```

## Phase 7: Enhanced Svelte Components

### 7.1 Application Root Component

**File: `src/app/App.svelte`**

```typescript
<script lang="ts">
  import { onMount } from 'svelte';
  import { taskStore } from '../stores/taskStore';
  import { sourceRegistry } from '../core/SourceRegistry';
  import { syncCoordinator } from '../services/SyncCoordinator';
  import { eventBus } from '../core/events';

  // Import existing components
  import TasksView from '../components/svelte/TasksView.svelte';
  import ContextTabView from '../components/svelte/ContextTabView.svelte';
  import { setPluginContext } from '../components/svelte/context';

  interface Props {
    plugin: any; // Obsidian plugin instance
    initialView?: 'tasks' | 'context';
  }

  let { plugin, initialView = 'tasks' }: Props = $props();

  let currentView = $state(initialView);
  let isInitialized = $state(false);
  let initError = $state<string | null>(null);

  onMount(async () => {
    try {
      // Set plugin context for child components
      setPluginContext({ plugin });

      // Initialize sources
      await initializeSources();

      // Perform initial sync
      await syncCoordinator.syncAll();

      isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize app:', error);
      initError = error.message;
    }
  });

  async function initializeSources(): Promise<void> {
    // Register Obsidian source
    const { ObsidianSource } = await import('../sources/ObsidianSource');
    const obsidianSource = new ObsidianSource(
      plugin.app,
      plugin,
      { tasksFolder: plugin.settings.tasksFolder }
    );
    sourceRegistry.register(obsidianSource);
    await sourceRegistry.activateSource('obsidian');

    // Register other sources based on settings
    if (plugin.settings.integrations?.github?.enabled) {
      const { GitHubSource } = await import('../sources/GitHubSource');
      const githubSource = new GitHubSource(plugin.settings.integrations.github);
      sourceRegistry.register(githubSource);
      await sourceRegistry.activateSource('github');
    }

    // Add more sources as needed...
  }

  function switchView(view: 'tasks' | 'context'): void {
    currentView = view;
  }
</script>

<div class="task-sync-app" data-initialized={isInitialized}>
  {#if !isInitialized}
    <div class="app-loading">
      {#if initError}
        <div class="error-state">
          <h3>Initialization Failed</h3>
          <p>{initError}</p>
          <button onclick={() => window.location.reload()}>Retry</button>
        </div>
      {:else}
        <div class="loading-state">
          <div class="task-sync-spinner"></div>
          <p>Initializing Task Sync...</p>
        </div>
      {/if}
    </div>
  {:else}
    <!-- Main Application -->
    <div class="app-content">
      {#if currentView === 'tasks'}
        <TasksView />
      {:else if currentView === 'context'}
        <ContextTabView context={plugin.getCurrentContext()} />
      {/if}
    </div>
  {/if}
</div>

<style>
  .task-sync-app {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .app-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 2rem;
  }

  .loading-state, .error-state {
    text-align: center;
  }

  .app-content {
    flex: 1;
    overflow: hidden;
  }
</style>
```

## Phase 8: Plugin Integration Layer

### 8.1 Lightweight Obsidian Plugin Wrapper

**File: `src/main.ts` (Updated)**

```typescript
import { Plugin } from 'obsidian';
import { mount, unmount } from 'svelte';
import App from './app/App.svelte';
import { TaskSyncSettings, DEFAULT_SETTINGS } from './settings';

export default class TaskSyncPlugin extends Plugin {
  settings: TaskSyncSettings;
  private appComponent: any = null;

  async onload() {
    // Load settings
    await this.loadSettings();

    // Register views
    this.registerView('task-sync-main', (leaf) => {
      return new TaskSyncView(leaf, this);
    });

    // Add ribbon icon
    this.addRibbonIcon('checkbox', 'Task Sync', () => {
      this.activateView();
    });

    // Register commands
    this.addCommand({
      id: 'open-task-sync',
      name: 'Open Task Sync',
      callback: () => this.activateView()
    });

    // Initialize on layout ready
    this.app.workspace.onLayoutReady(() => {
      this.activateView();
    });
  }

  onunload() {
    // Cleanup is handled by the view
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async activateView() {
    const { workspace } = this.app;

    let leaf = workspace.getLeavesOfType('task-sync-main')[0];

    if (!leaf) {
      leaf = workspace.getRightLeaf(false);
      await leaf.setViewState({ type: 'task-sync-main', active: true });
    }

    workspace.revealLeaf(leaf);
  }
}

class TaskSyncView extends ItemView {
  private plugin: TaskSyncPlugin;
  private appComponent: any = null;

  constructor(leaf: WorkspaceLeaf, plugin: TaskSyncPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return 'task-sync-main';
  }

  getDisplayText(): string {
    return 'Task Sync';
  }

  getIcon(): string {
    return 'checkbox';
  }

  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass('task-sync-view-container');

    // Mount Svelte app
    this.appComponent = mount(App, {
      target: container,
      props: {
        plugin: this.plugin,
        initialView: 'tasks'
      }
    });
  }

  async onClose() {
    if (this.appComponent) {
      unmount(this.appComponent);
      this.appComponent = null;
    }
  }
}
```

### 8.2 Settings Integration

**File: `src/settings/index.ts`**

```typescript
export interface TaskSyncSettings {
  // Folder settings
  tasksFolder: string;
  projectsFolder: string;
  areasFolder: string;
  templateFolder: string;

  // Integration settings
  integrations: {
    github: {
      enabled: boolean;
      token?: string;
      repositories: string[];
    };
    appleReminders: {
      enabled: boolean;
      lists: string[];
    };
  };

  // UI settings
  defaultView: 'tasks' | 'context';
  enableRealTimeSync: boolean;
  syncInterval: number; // minutes
}

export const DEFAULT_SETTINGS: TaskSyncSettings = {
  tasksFolder: 'Tasks',
  projectsFolder: 'Projects',
  areasFolder: 'Areas',
  templateFolder: 'Templates',
  integrations: {
    github: {
      enabled: false,
      repositories: []
    },
    appleReminders: {
      enabled: false,
      lists: []
    }
  },
  defaultView: 'tasks',
  enableRealTimeSync: true,
  syncInterval: 5
};
```

## Phase 9: Migration Strategy

### 9.1 Incremental Migration Plan

**Step 1: Parallel Implementation (Week 1-2)**
- Create new core architecture alongside existing code
- Implement basic Task entity with Zod validation
- Set up event bus and basic source interface
- No breaking changes to existing functionality

**Step 2: Store Migration (Week 3)**
- Replace existing taskStore with new reactive implementation
- Migrate existing Svelte components to use new store API
- Maintain backward compatibility with existing services

**Step 3: Source Abstraction (Week 4)**
- Implement ObsidianSource using existing TaskFileManager logic
- Gradually migrate file operations to use Source interface
- Test thoroughly with existing data

**Step 4: Command/Query Migration (Week 5)**
- Replace direct store mutations with Command pattern
- Migrate existing command handlers to new CQS architecture
- Update UI components to use new command/query APIs

**Step 5: External Source Migration (Week 6)**
- Migrate GitHub integration to new Source interface
- Migrate Apple Reminders integration
- Test multi-source coordination

**Step 6: Cleanup and Optimization (Week 7)**
- Remove old architecture code
- Optimize performance
- Update documentation

### 9.2 Migration Utilities

**File: `src/migration/DataMigrator.ts`**

```typescript
import { Task, TaskSchema } from '../core/entities';
import { Task as LegacyTask } from '../types/entities';

export class DataMigrator {
  static migrateTask(legacyTask: LegacyTask): Task {
    return TaskSchema.parse({
      id: legacyTask.id,
      title: legacyTask.title,
      type: legacyTask.type || 'Task',
      category: legacyTask.category,
      priority: legacyTask.priority,
      status: legacyTask.status || 'Backlog',
      done: legacyTask.done || false,
      parentTask: legacyTask.parentTask,
      project: legacyTask.project,
      areas: legacyTask.areas || [],
      doDate: legacyTask.doDate,
      dueDate: legacyTask.dueDate,
      tags: legacyTask.tags || [],
      createdAt: legacyTask.createdAt || new Date(),
      updatedAt: legacyTask.updatedAt || new Date(),
      source: legacyTask.source,
      filePath: legacyTask.filePath,
      description: '' // Extract from file content if needed
    });
  }

  static async migrateAllTasks(legacyTasks: LegacyTask[]): Promise<Task[]> {
    const migratedTasks: Task[] = [];

    for (const legacyTask of legacyTasks) {
      try {
        const migratedTask = this.migrateTask(legacyTask);
        migratedTasks.push(migratedTask);
      } catch (error) {
        console.warn(`Failed to migrate task ${legacyTask.id}:`, error);
      }
    }

    return migratedTasks;
  }
}
```

## Phase 10: Testing Strategy

### 10.1 Unit Tests for Core Architecture

**File: `tests/core/entities.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { TaskSchema, TaskFrontMatterSchema } from '../../src/core/entities';

describe('Task Entity', () => {
  it('should validate a complete task', () => {
    const task = {
      id: 'test-id',
      title: 'Test Task',
      type: 'Task',
      status: 'Backlog',
      done: false,
      areas: [],
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      filePath: 'Tasks/test.md'
    };

    const result = TaskSchema.parse(task);
    expect(result).toEqual(expect.objectContaining(task));
  });

  it('should reject invalid task data', () => {
    const invalidTask = {
      // Missing required fields
      title: 'Test Task'
    };

    expect(() => TaskSchema.parse(invalidTask)).toThrow();
  });

  it('should extract front matter correctly', () => {
    const task = {
      id: 'test-id',
      title: 'Test Task',
      type: 'Task',
      category: 'Work',
      priority: 'High',
      status: 'In Progress',
      done: false,
      project: 'Test Project',
      areas: ['Area1'],
      doDate: new Date(),
      tags: ['tag1'],
      createdAt: new Date(),
      updatedAt: new Date(),
      filePath: 'Tasks/test.md',
      description: 'Task description'
    };

    const frontMatter = TaskFrontMatterSchema.parse(task);

    expect(frontMatter).not.toHaveProperty('id');
    expect(frontMatter).not.toHaveProperty('createdAt');
    expect(frontMatter).not.toHaveProperty('filePath');
    expect(frontMatter).not.toHaveProperty('description');
    expect(frontMatter).toHaveProperty('title');
    expect(frontMatter).toHaveProperty('status');
  });
});
```

### 10.2 Integration Tests for Sources

**File: `tests/sources/ObsidianSource.test.ts`**

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ObsidianSource } from '../../src/sources/ObsidianSource';
import { Task } from '../../src/core/entities';

// Mock Obsidian API
const mockApp = {
  vault: {
    getMarkdownFiles: vi.fn(),
    getAbstractFileByPath: vi.fn(),
    read: vi.fn(),
    create: vi.fn(),
    modify: vi.fn(),
    delete: vi.fn(),
    on: vi.fn(),
    off: vi.fn()
  },
  fileManager: {
    processFrontMatter: vi.fn()
  }
};

const mockPlugin = {
  app: mockApp,
  loadData: vi.fn(),
  saveData: vi.fn()
};

describe('ObsidianSource', () => {
  let source: ObsidianSource;

  beforeEach(() => {
    source = new ObsidianSource(
      mockApp as any,
      mockPlugin as any,
      { tasksFolder: 'Tasks' }
    );
  });

  it('should load tasks from vault', async () => {
    const mockFile = {
      path: 'Tasks/test-task.md',
      basename: 'test-task',
      stat: { ctime: Date.now(), mtime: Date.now() }
    };

    mockApp.vault.getMarkdownFiles.mockReturnValue([mockFile]);
    mockApp.vault.read.mockResolvedValue('---\ntitle: Test Task\ntype: Task\n---\n\nTask content');
    mockApp.fileManager.processFrontMatter.mockImplementation((file, callback) => {
      callback({ title: 'Test Task', type: 'Task', status: 'Backlog' });
      return Promise.resolve();
    });

    const tasks = await source.loadAll();

    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe('Test Task');
    expect(tasks[0].type).toBe('Task');
  });

  it('should sync task to vault', async () => {
    const task: Task = {
      id: 'test-task',
      title: 'Test Task',
      type: 'Task',
      status: 'Backlog',
      done: false,
      areas: [],
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      filePath: 'Tasks/test-task.md'
    };

    mockApp.vault.getAbstractFileByPath.mockReturnValue(null);
    mockApp.vault.create.mockResolvedValue(undefined);

    await source.sync(task);

    expect(mockApp.vault.create).toHaveBeenCalledWith(
      'Tasks/test-task.md',
      expect.stringContaining('title: "Test Task"')
    );
  });
});
```

### 10.3 E2E Tests for New Architecture

**File: `e2e/specs/playwright/svelte-app-architecture.spec.ts`**

```typescript
import { test, expect } from '@playwright/test';
import { setupObsidianTest } from '../../helpers/obsidian-setup';

test.describe('Svelte App Architecture', () => {
  test.beforeEach(async ({ page }) => {
    await setupObsidianTest(page);
  });

  test('should initialize app with new architecture', async ({ page }) => {
    // Wait for app to initialize
    await page.waitForSelector('[data-initialized="true"]');

    // Verify core components are loaded
    await expect(page.locator('.task-sync-app')).toBeVisible();
    await expect(page.locator('[data-testid="tasks-view"]')).toBeVisible();
  });

  test('should handle task creation through new command system', async ({ page }) => {
    // Create a task using new command system
    await page.click('[data-testid="create-task-button"]');
    await page.fill('[data-testid="task-title-input"]', 'New Architecture Task');
    await page.click('[data-testid="save-task-button"]');

    // Verify task appears in UI
    await expect(page.locator('text=New Architecture Task')).toBeVisible();

    // Verify task was synced to Obsidian source
    await page.waitForTimeout(1000); // Allow sync to complete
    // Additional verification that file was created...
  });

  test('should handle multi-source coordination', async ({ page }) => {
    // Enable GitHub integration
    await page.click('[data-testid="settings-button"]');
    await page.check('[data-testid="github-integration-enabled"]');
    await page.fill('[data-testid="github-token-input"]', 'test-token');
    await page.click('[data-testid="save-settings-button"]');

    // Verify GitHub source is activated
    await expect(page.locator('[data-testid="github-service-tab"]')).toBeVisible();

    // Test source switching
    await page.click('[data-testid="github-service-tab"]');
    await expect(page.locator('[data-testid="github-service-content"]')).toBeVisible();
  });
});
```

## Implementation Roadmap

### Immediate Actions (Phase 1-2)
1. **Set up core domain layer** with Zod validation
2. **Implement event bus** for decoupled communication
3. **Create basic Source interface** and ObsidianSource implementation
4. **Write comprehensive tests** for core architecture

### Short-term Goals (Phase 3-5)
1. **Migrate existing stores** to new reactive architecture
2. **Implement Command/Query separation**
3. **Set up Source Registry** for multi-source coordination
4. **Update existing Svelte components** to use new APIs

### Medium-term Goals (Phase 6-8)
1. **Complete source abstraction** for all integrations
2. **Implement enhanced Svelte components**
3. **Create lightweight plugin wrapper**
4. **Comprehensive testing coverage**

### Long-term Goals (Phase 9-10)
1. **Complete migration** from old architecture
2. **Performance optimization**
3. **Documentation and deployment**
4. **Community feedback and iteration**

This plan provides a comprehensive roadmap for transforming the Obsidian Task Sync plugin into a modern, maintainable Svelte 5 application with clean architecture principles.

---

## Actionable Implementation Tasks

### Priority 1: Foundation (Start Immediately)

#### Task 1.1: Core Domain Setup
- [ ] Create `src/core/entities.ts` with Zod-validated Task, Project, Area schemas
- [ ] Create `src/core/note.ts` with Note abstraction and utilities
- [ ] Create `src/core/events.ts` with EventBus and dot-notation event types
- [ ] Write unit tests for all core domain types

#### Task 1.2: Generic Source Interface Foundation
- [ ] Create `src/core/source.ts` with generic Source interface supporting multiple entity types
- [ ] Implement entity-specific operations interfaces (EntityOperations<T>)
- [ ] Create BaseSource with `this.trigger()` method and entity type support checking
- [ ] Write unit tests for source interface and base implementation

#### Task 1.3: Obsidian Source Implementation
- [ ] Implement `src/sources/ObsidianSource.ts` with support for tasks, projects, and areas
- [ ] Create separate operation classes for each entity type (ObsidianTaskOperations, etc.)
- [ ] Migrate existing TaskFileManager, ProjectFileManager, AreaFileManager logic
- [ ] Write integration tests for all entity types in ObsidianSource

#### Task 1.4: Enhanced Store Architecture
- [ ] Create `src/stores/taskStore.ts` with event-driven reactive store using dot-notation events
- [ ] Create similar stores for projects and areas (`projectStore.ts`, `areaStore.ts`)
- [ ] Implement derived stores for common queries (today, imported, etc.)
- [ ] Add comprehensive error handling and loading states
- [ ] Write tests for store operations and reactivity

### Priority 2: Command/Query Architecture (Week 2-3)

#### Task 2.1: Command System
- [ ] Create `src/commands/TaskCommands.ts` with CRUD operations
- [ ] Implement validation and error handling for all commands
- [ ] Add support for batch operations
- [ ] Write unit tests for command handlers

#### Task 2.2: Query System
- [ ] Create `src/queries/TaskQueries.ts` with reactive and snapshot queries
- [ ] Implement advanced filtering and search capabilities
- [ ] Add performance optimization for large datasets
- [ ] Write tests for query accuracy and performance

#### Task 2.3: Multi-Entity Source Registry
- [ ] Create `src/core/SourceRegistry.ts` for multi-source, multi-entity management
- [ ] Implement entity-type-aware sync operations (syncEntity, deleteEntity)
- [ ] Implement `src/services/SyncCoordinator.ts` with support for all entity types
- [ ] Add health checking and error recovery for each entity type
- [ ] Write integration tests for multi-source, multi-entity scenarios

### Priority 3: Application Layer (Week 3-4)

#### Task 3.1: Svelte App Root
- [ ] Create `src/app/App.svelte` as main application component
- [ ] Implement initialization and error handling
- [ ] Add loading states and user feedback
- [ ] Write E2E tests for app initialization

#### Task 3.2: Component Migration
- [ ] Update existing Svelte components to use new stores and commands
- [ ] Ensure all components use new reactive patterns
- [ ] Maintain existing UI/UX while upgrading internals
- [ ] Write component tests for new architecture

#### Task 3.3: Plugin Integration
- [ ] Update `src/main.ts` to use lightweight plugin wrapper
- [ ] Implement proper cleanup and lifecycle management
- [ ] Add settings integration for new architecture
- [ ] Write E2E tests for plugin integration

### Priority 4: External Sources (Week 4-5)

#### Task 4.1: GitHub Source Migration (Task-Only)
- [ ] Migrate existing GitHub integration to new Source interface with task-only support
- [ ] Implement `supportedEntities: ['task']` and only provide `tasks` operations
- [ ] Implement proper error handling and rate limiting
- [ ] Add support for real-time updates via webhooks
- [ ] Write integration tests with mocked GitHub API

#### Task 4.2: Apple Reminders Migration (Task-Only)
- [ ] Migrate Apple Reminders integration to new Source interface with task-only support
- [ ] Implement `supportedEntities: ['task']` and only provide `tasks` operations
- [ ] Implement proper platform detection and error handling
- [ ] Add support for bidirectional sync
- [ ] Write platform-specific tests

#### Task 4.3: Source Coordination Testing
- [ ] Write comprehensive E2E tests for multi-source scenarios
- [ ] Test conflict resolution and data consistency
- [ ] Verify performance with multiple active sources
- [ ] Add monitoring and debugging capabilities

### Priority 5: Migration and Cleanup (Week 5-6)

#### Task 5.1: Data Migration
- [ ] Create `src/migration/DataMigrator.ts` for safe data migration
- [ ] Implement backup and rollback mechanisms
- [ ] Add validation for migrated data integrity
- [ ] Write migration tests with real user data

#### Task 5.2: Legacy Code Removal
- [ ] Gradually remove old architecture components
- [ ] Update all imports and dependencies
- [ ] Clean up unused files and dependencies
- [ ] Verify no functionality regression

#### Task 5.3: Performance Optimization
- [ ] Profile new architecture for performance bottlenecks
- [ ] Optimize reactive store updates and queries
- [ ] Implement lazy loading for large datasets
- [ ] Add performance monitoring and metrics

### Priority 6: Testing and Documentation (Week 6-7)

#### Task 6.1: Comprehensive Testing
- [ ] Achieve 90%+ test coverage for core architecture
- [ ] Write E2E tests for all major user workflows
- [ ] Add performance and stress tests
- [ ] Implement automated testing in CI/CD

#### Task 6.2: Documentation
- [ ] Update README with new architecture overview
- [ ] Create developer documentation for new patterns
- [ ] Add migration guide for users
- [ ] Document troubleshooting and debugging

#### Task 6.3: User Validation
- [ ] Beta test with existing users
- [ ] Gather feedback on performance and usability
- [ ] Fix any critical issues discovered
- [ ] Prepare for stable release

---

## Success Metrics

- **Architecture Quality**: Clean separation of concerns, testable code, maintainable structure
- **Performance**: No regression in UI responsiveness, improved sync performance
- **Reliability**: Reduced error rates, better error handling, data consistency
- **Maintainability**: Easier to add new sources, cleaner codebase, better test coverage
- **User Experience**: Seamless migration, no feature loss, improved stability

This implementation plan ensures a systematic, low-risk migration to the new Svelte 5 architecture while maintaining all existing functionality.
