# Svelte App Implementation Plan

> **Clean architecture for a standalone Svelte 5 task management application with extension system**

## Overview

Build a standalone Svelte 5 application with a clean extension system where Obsidian is just one of many possible extensions. The core application is completely source-agnostic with clear separation between:

1. **Core Domain Layer** - Pure entities with Zod validation (no source-specific concerns)
2. **Application Layer** - Commands, queries, and business logic
3. **Extension Layer** - Pluggable extensions (Obsidian, GitHub, etc.)
4. **Presentation Layer** - Svelte 5 SPA with reactive stores

## Architecture Principles

- **Source Agnostic**: Core domain knows nothing about Obsidian, files, or any specific storage
- **Extension Based**: All source integrations are extensions that register with the core app
- **Clean Boundaries**: No leakage of extension concerns into the core domain
- **Breaking Changes OK**: This is unreleased, we can redesign without migration concerns

## Phase 1: Pure Core Domain Layer

### 1.1 Source-Agnostic Entity Definitions

**File: `src/app/core/entities.ts`**

```typescript
import { z } from 'zod';

// Core domain entities - completely source agnostic
export const TaskStatusSchema = z.enum(['Backlog', 'In Progress', 'Done', 'Cancelled']);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const TaskSourceSchema = z.object({
  extensionId: z.string(), // 'obsidian', 'github', 'apple-reminders'
  sourceId: z.string(), // unique identifier within the extension
  url: z.string().optional(),
  metadata: z.record(z.any()).optional()
});
export type TaskSource = z.infer<typeof TaskSourceSchema>;

export const TaskSchema = z.object({
  // Core identity
  id: z.string(),

  // Core task properties
  title: z.string(),
  description: z.string().optional(),
  status: TaskStatusSchema.default('Backlog'),
  done: z.boolean().default(false),

  // Organization
  category: z.string().optional(),
  priority: z.string().optional(),
  parentTask: z.string().optional(),
  project: z.string().optional(),
  areas: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),

  // Scheduling
  doDate: z.date().optional(),
  dueDate: z.date().optional(),

  // System properties
  createdAt: z.date(),
  updatedAt: z.date(),

  // Source tracking (which extension owns this task)
  source: TaskSourceSchema.optional()
});

export type Task = Readonly<z.infer<typeof TaskSchema>>;

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  areas: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  createdAt: z.date(),
  updatedAt: z.date(),
  source: TaskSourceSchema.optional()
});

export type Project = Readonly<z.infer<typeof ProjectSchema>>;

export const AreaSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  tags: z.array(z.string()).default([]),
  createdAt: z.date(),
  updatedAt: z.date(),
  source: TaskSourceSchema.optional()
});

export type Area = Readonly<z.infer<typeof AreaSchema>>;
```

### 1.2 Extension System Foundation

**File: `src/app/core/extension.ts`**

```typescript
import { Task, Project, Area } from './entities';

// Generic entity union type
export type Entity = Task | Project | Area;
export type EntityType = 'task' | 'project' | 'area';

// Extension interface - completely agnostic to implementation details
export interface Extension {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly supportedEntities: readonly EntityType[];

  // Lifecycle
  initialize(): Promise<void>;
  shutdown(): Promise<void>;

  // Entity operations (optional - extensions can support subset)
  tasks?: EntityOperations<Task>;
  projects?: EntityOperations<Project>;
  areas?: EntityOperations<Area>;

  // Health check
  isHealthy(): Promise<boolean>;
}

// Generic entity operations interface
export interface EntityOperations<T extends Entity> {
  // CRUD operations
  create(entity: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T>;
  update(entity: T): Promise<T>;
  delete(id: string): Promise<void>;

  // Queries
  findById(id: string): Promise<T | null>;
  findAll(): Promise<readonly T[]>;

  // Real-time updates (optional)
  subscribe?(callback: (entities: readonly T[]) => void): () => void;
}

// Extension registry
export class ExtensionRegistry {
  private extensions = new Map<string, Extension>();

  register(extension: Extension): void {
    if (this.extensions.has(extension.id)) {
      throw new Error(`Extension ${extension.id} is already registered`);
    }
    this.extensions.set(extension.id, extension);
  }

  unregister(extensionId: string): void {
    const extension = this.extensions.get(extensionId);
    if (extension) {
      extension.shutdown();
      this.extensions.delete(extensionId);
    }
  }

  get(extensionId: string): Extension | undefined {
    return this.extensions.get(extensionId);
  }

  getAll(): Extension[] {
    return Array.from(this.extensions.values());
  }

  getByEntityType(entityType: EntityType): Extension[] {
    return this.getAll().filter(ext => ext.supportedEntities.includes(entityType));
  }
}

export const extensionRegistry = new ExtensionRegistry();
```

## Phase 2: Event-Driven Architecture

### 2.1 Domain Events System

**File: `src/app/core/events.ts`**

```typescript
import { Task, Project, Area } from './entities';
import { EntityType } from './extension';

export type DomainEvent =
  // Task events
  | { type: 'tasks.created'; task: Task; extensionId: string }
  | { type: 'tasks.updated'; task: Task; changes: Partial<Task>; extensionId: string }
  | { type: 'tasks.deleted'; taskId: string; extensionId: string }
  | { type: 'tasks.loaded'; tasks: readonly Task[]; extensionId: string }

  // Project events
  | { type: 'projects.created'; project: Project; extensionId: string }
  | { type: 'projects.updated'; project: Project; changes: Partial<Project>; extensionId: string }
  | { type: 'projects.deleted'; projectId: string; extensionId: string }
  | { type: 'projects.loaded'; projects: readonly Project[]; extensionId: string }

  // Area events
  | { type: 'areas.created'; area: Area; extensionId: string }
  | { type: 'areas.updated'; area: Area; changes: Partial<Area>; extensionId: string }
  | { type: 'areas.deleted'; areaId: string; extensionId: string }
  | { type: 'areas.loaded'; areas: readonly Area[]; extensionId: string }

  // Extension events
  | { type: 'extension.registered'; extensionId: string; supportedEntities: EntityType[] }
  | { type: 'extension.unregistered'; extensionId: string }
  | { type: 'extension.sync.started'; extensionId: string; entityType: EntityType }
  | { type: 'extension.sync.completed'; extensionId: string; entityType: EntityType; entityCount: number }
  | { type: 'extension.sync.failed'; extensionId: string; entityType: EntityType; error: string };

export class EventBus {
  private handlers = new Map<string, ((event: DomainEvent) => void)[]>();

  on<T extends DomainEvent['type']>(
    eventType: T,
    handler: (event: Extract<DomainEvent, { type: T }>) => void
  ): () => void {
    const handlers = this.handlers.get(eventType) || [];
    handlers.push(handler as any);
    this.handlers.set(eventType, handlers);

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
}

export const eventBus = new EventBus();
```

## Phase 3: Obsidian Extension Implementation

### 3.1 Obsidian Extension

**File: `src/app/extensions/ObsidianExtension.ts`**

```typescript
import { App, Plugin, TFile, getFrontMatterInfo, parseYaml, stringifyYaml } from 'obsidian';
import { Extension, EntityOperations, extensionRegistry } from '../core/extension';
import { Task, Project, Area, TaskSchema, ProjectSchema, AreaSchema } from '../core/entities';
import { EntityType, eventBus } from '../core/events';

export class ObsidianExtension implements Extension {
  readonly id = 'obsidian';
  readonly name = 'Obsidian Vault';
  readonly version = '1.0.0';
  readonly supportedEntities: readonly EntityType[] = ['task', 'project', 'area'];

  readonly tasks: EntityOperations<Task>;
  readonly projects: EntityOperations<Project>;
  readonly areas: EntityOperations<Area>;

  constructor(
    private app: App,
    private plugin: Plugin,
    private settings: {
      tasksFolder: string;
      projectsFolder: string;
      areasFolder: string;
    }
  ) {
    this.tasks = new ObsidianTaskOperations(app, settings.tasksFolder);
    this.projects = new ObsidianProjectOperations(app, settings.projectsFolder);
    this.areas = new ObsidianAreaOperations(app, settings.areasFolder);
  }

  async initialize(): Promise<void> {
    // Register with the core app
    extensionRegistry.register(this);

    // Trigger extension registered event
    eventBus.trigger({
      type: 'extension.registered',
      extensionId: this.id,
      supportedEntities: [...this.supportedEntities]
    });

    // Load initial data
    await this.loadAllEntities();
  }

  async shutdown(): Promise<void> {
    eventBus.trigger({
      type: 'extension.unregistered',
      extensionId: this.id
    });
  }

  async isHealthy(): Promise<boolean> {
    return this.app.vault !== null;
  }

  private async loadAllEntities(): Promise<void> {
    try {
      const [tasks, projects, areas] = await Promise.all([
        this.tasks.findAll(),
        this.projects.findAll(),
        this.areas.findAll()
      ]);

      eventBus.trigger({ type: 'tasks.loaded', tasks, extensionId: this.id });
      eventBus.trigger({ type: 'projects.loaded', projects, extensionId: this.id });
      eventBus.trigger({ type: 'areas.loaded', areas, extensionId: this.id });
    } catch (error) {
      console.error('Failed to load entities from Obsidian:', error);
    }
  }
}
```

### 3.2 Obsidian Task Operations

**File: `src/app/extensions/ObsidianTaskOperations.ts`**

```typescript
import { App, TFile, getFrontMatterInfo, parseYaml, stringifyYaml } from 'obsidian';
import { EntityOperations } from '../core/extension';
import { Task, TaskSchema } from '../core/entities';
import { eventBus } from '../core/events';

export class ObsidianTaskOperations implements EntityOperations<Task> {
  constructor(
    private app: App,
    private folder: string
  ) {}

  async create(taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task> {
    const now = new Date();
    const task: Task = {
      ...taskData,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      source: {
        extensionId: 'obsidian',
        sourceId: `${this.folder}/${taskData.title}.md`
      }
    };

    await this.saveTaskToFile(task);
    eventBus.trigger({ type: 'tasks.created', task, extensionId: 'obsidian' });
    return task;
  }

  async update(task: Task): Promise<Task> {
    const updatedTask = { ...task, updatedAt: new Date() };
    await this.saveTaskToFile(updatedTask);
    eventBus.trigger({ type: 'tasks.updated', task: updatedTask, changes: {}, extensionId: 'obsidian' });
    return updatedTask;
  }

  async delete(id: string): Promise<void> {
    const filePath = `${this.folder}/${id}.md`;
    const file = this.app.vault.getAbstractFileByPath(filePath);

    if (file instanceof TFile) {
      await this.app.vault.delete(file);
      eventBus.trigger({ type: 'tasks.deleted', taskId: id, extensionId: 'obsidian' });
    }
  }

  async findById(id: string): Promise<Task | null> {
    const filePath = `${this.folder}/${id}.md`;
    const file = this.app.vault.getAbstractFileByPath(filePath) as TFile;

    if (!file) return null;

    return this.loadTaskFromFile(file);
  }

  async findAll(): Promise<readonly Task[]> {
    const files = this.app.vault.getMarkdownFiles()
      .filter(f => f.path.startsWith(this.folder + '/'));

    const tasks: Task[] = [];

    for (const file of files) {
      try {
        const task = await this.loadTaskFromFile(file);
        if (task) {
          tasks.push(task);
        }
      } catch (error) {
        console.warn(`Failed to load task from ${file.path}:`, error);
      }
    }

    return tasks;
  }

  subscribe(callback: (tasks: readonly Task[]) => void): () => void {
    const handleFileChange = async (file: TFile) => {
      if (file.path.startsWith(this.folder + '/')) {
        const tasks = await this.findAll();
        callback(tasks);
      }
    };

    this.app.vault.on('modify', handleFileChange);
    this.app.vault.on('create', handleFileChange);
    this.app.vault.on('delete', handleFileChange);

    return () => {
      this.app.vault.off('modify', handleFileChange);
      this.app.vault.off('create', handleFileChange);
      this.app.vault.off('delete', handleFileChange);
    };
  }

  // Private helper methods
  private async saveTaskToFile(task: Task): Promise<void> {
    const filePath = `${this.folder}/${task.id}.md`;

    // Convert task to front-matter (exclude core system properties)
    const frontMatter = {
      title: task.title,
      status: task.status,
      done: task.done,
      category: task.category,
      priority: task.priority,
      parentTask: task.parentTask,
      project: task.project,
      areas: task.areas,
      tags: task.tags,
      doDate: task.doDate?.toISOString(),
      dueDate: task.dueDate?.toISOString()
    };

    // Remove undefined values
    Object.keys(frontMatter).forEach(key => {
      if (frontMatter[key] === undefined) {
        delete frontMatter[key];
      }
    });

    const frontMatterYaml = stringifyYaml(frontMatter);
    const content = `---\n${frontMatterYaml}---\n\n${task.description || ''}`;

    const existingFile = this.app.vault.getAbstractFileByPath(filePath) as TFile;

    if (existingFile) {
      await this.app.vault.modify(existingFile, content);
    } else {
      await this.app.vault.create(filePath, content);
    }
  }

  private async loadTaskFromFile(file: TFile): Promise<Task | null> {
    try {
      const content = await this.app.vault.read(file);
      const frontMatterInfo = getFrontMatterInfo(content);

      if (!frontMatterInfo.exists) {
        return null;
      }

      const frontMatter = parseYaml(frontMatterInfo.frontmatter);

      // Validate this is a task file
      if (!frontMatter.title) {
        return null;
      }

      const body = content.substring(frontMatterInfo.contentStart).trim();

      return TaskSchema.parse({
        id: file.basename,
        title: frontMatter.title,
        description: body,
        status: frontMatter.status || 'Backlog',
        done: frontMatter.done || false,
        category: frontMatter.category,
        priority: frontMatter.priority,
        parentTask: frontMatter.parentTask,
        project: frontMatter.project,
        areas: frontMatter.areas || [],
        tags: frontMatter.tags || [],
        doDate: frontMatter.doDate ? new Date(frontMatter.doDate) : undefined,
        dueDate: frontMatter.dueDate ? new Date(frontMatter.dueDate) : undefined,
        createdAt: new Date(file.stat.ctime),
        updatedAt: new Date(file.stat.mtime),
        source: {
          extensionId: 'obsidian',
          sourceId: file.path
        }
      });
    } catch (error) {
      console.warn(`Failed to load task from ${file.path}:`, error);
      return null;
    }
  }
}

// Similar implementations for Project and Area operations
export class ObsidianProjectOperations implements EntityOperations<Project> {
  constructor(private app: App, private folder: string) {}

  // Implementation follows same pattern as ObsidianTaskOperations
  // but works with Project entities and project-specific front-matter
}

export class ObsidianAreaOperations implements EntityOperations<Area> {
  constructor(private app: App, private folder: string) {}

  // Implementation follows same pattern as ObsidianTaskOperations
  // but works with Area entities and area-specific front-matter
}
```

## Phase 4: Reactive State Management

### 4.1 Extension-Aware Store System

**File: `src/app/stores/taskStore.ts`**

```typescript
import { writable, derived } from 'svelte/store';
import { Task } from '../core/entities';
import { eventBus } from '../core/events';
import { extensionRegistry } from '../core/extension';

interface TaskStoreState {
  tasks: readonly Task[];
  loading: boolean;
  error: string | null;
  lastSync: Date | null;
}

function createTaskStore() {
  const initialState: TaskStoreState = {
    tasks: [],
    loading: false,
    error: null,
    lastSync: null
  };

  const { subscribe, update } = writable(initialState);

  // Subscribe to extension events
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
    update(state => {
      // Merge tasks from different extensions
      const existingTasks = state.tasks.filter(t =>
        t.source?.extensionId !== event.extensionId
      );
      return {
        ...state,
        tasks: [...existingTasks, ...event.tasks],
        loading: false,
        error: null,
        lastSync: new Date()
      };
    });
  });

  return {
    subscribe,

    // Command methods that delegate to appropriate extensions
    async createTask(taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) {
      const extension = extensionRegistry.get('obsidian'); // Default to Obsidian
      if (extension?.tasks) {
        return extension.tasks.create(taskData);
      }
      throw new Error('No extension available to create tasks');
    },

    async updateTask(task: Task) {
      const extensionId = task.source?.extensionId || 'obsidian';
      const extension = extensionRegistry.get(extensionId);
      if (extension?.tasks) {
        return extension.tasks.update(task);
      }
      throw new Error(`Extension ${extensionId} not available`);
    },

    async deleteTask(taskId: string) {
      // Find which extension owns this task
      let task: Task | undefined;
      subscribe(state => {
        task = state.tasks.find(t => t.id === taskId);
      })();

      if (task) {
        const extensionId = task.source?.extensionId || 'obsidian';
        const extension = extensionRegistry.get(extensionId);
        if (extension?.tasks) {
          return extension.tasks.delete(taskId);
        }
      }
      throw new Error('Task not found or extension not available');
    }
  };
}

export const taskStore = createTaskStore();

// Derived stores for common queries
export const tasksByExtension = derived(taskStore, $store => {
  const grouped = new Map<string, Task[]>();
  for (const task of $store.tasks) {
    const extensionId = task.source?.extensionId || 'unknown';
    if (!grouped.has(extensionId)) {
      grouped.set(extensionId, []);
    }
    grouped.get(extensionId)!.push(task);
  }
  return grouped;
});

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

## Phase 5: Application Layer

### 5.1 Application Services

**File: `src/app/services/TaskService.ts`**

```typescript
import { Task } from '../core/entities';
import { extensionRegistry } from '../core/extension';
import { taskStore } from '../stores/taskStore';

export class TaskService {
  async createTask(taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task> {
    return taskStore.createTask(taskData);
  }

  async updateTask(task: Task): Promise<Task> {
    return taskStore.updateTask(task);
  }

  async deleteTask(taskId: string): Promise<void> {
    return taskStore.deleteTask(taskId);
  }

  async markTaskDone(taskId: string): Promise<void> {
    // Find the task and update it
    let task: Task | undefined;
    taskStore.subscribe(state => {
      task = state.tasks.find(t => t.id === taskId);
    })();

    if (task) {
      await this.updateTask({
        ...task,
        done: true,
        status: 'Done'
      });
    }
  }

  async scheduleTask(taskId: string, doDate: Date): Promise<void> {
    let task: Task | undefined;
    taskStore.subscribe(state => {
      task = state.tasks.find(t => t.id === taskId);
    })();

    if (task) {
      await this.updateTask({
        ...task,
        doDate
      });
    }
  }

  // Query methods
  getTasksByProject(project: string): Task[] {
    let result: Task[] = [];
    taskStore.subscribe(state => {
      result = state.tasks.filter(t => t.project === project);
    })();
    return result;
  }

  getTasksByArea(area: string): Task[] {
    let result: Task[] = [];
    taskStore.subscribe(state => {
      result = state.tasks.filter(t => t.areas.includes(area));
    })();
    return result;
  }

  getTasksForToday(): Task[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let result: Task[] = [];
    taskStore.subscribe(state => {
      result = state.tasks.filter(t =>
        t.doDate && t.doDate >= today && t.doDate < tomorrow
      );
    })();
    return result;
  }
}

export const taskService = new TaskService();
```

## Phase 6: Application Initialization

### 6.1 App Bootstrap

**File: `src/app/App.ts`**

```typescript
import { extensionRegistry } from './core/extension';
import { ObsidianExtension } from './extensions/ObsidianExtension';
import { eventBus } from './core/events';

export class TaskSyncApp {
  private initialized = false;

  async initialize(obsidianApp: any, plugin: any, settings: any): Promise<void> {
    if (this.initialized) return;

    try {
      // Initialize Obsidian extension
      const obsidianExtension = new ObsidianExtension(obsidianApp, plugin, {
        tasksFolder: settings.tasksFolder,
        projectsFolder: settings.projectsFolder,
        areasFolder: settings.areasFolder
      });

      await obsidianExtension.initialize();

      // Register additional extensions here as needed
      // await this.registerGitHubExtension(settings.github);
      // await this.registerAppleRemindersExtension(settings.appleReminders);

      this.initialized = true;
      console.log('TaskSync app initialized successfully');
    } catch (error) {
      console.error('Failed to initialize TaskSync app:', error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    if (!this.initialized) return;

    // Shutdown all extensions
    const extensions = extensionRegistry.getAll();
    await Promise.all(extensions.map(ext => ext.shutdown()));

    this.initialized = false;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getExtensions() {
    return extensionRegistry.getAll();
  }

  // Future extension registration methods
  private async registerGitHubExtension(settings: any): Promise<void> {
    if (!settings?.enabled) return;

    // const { GitHubExtension } = await import('./extensions/GitHubExtension');
    // const githubExtension = new GitHubExtension(settings);
    // await githubExtension.initialize();
  }

  private async registerAppleRemindersExtension(settings: any): Promise<void> {
    if (!settings?.enabled) return;

    // const { AppleRemindersExtension } = await import('./extensions/AppleRemindersExtension');
    // const appleExtension = new AppleRemindersExtension(settings);
    // await appleExtension.initialize();
  }
}

export const taskSyncApp = new TaskSyncApp();
```

## Phase 7: Svelte Application

### 7.1 Main App Component

**File: `src/app/App.svelte`**

```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { taskStore, tasksByExtension } from './stores/taskStore';
  import { taskSyncApp } from './App';

  // Import existing components
  import TasksView from '../components/svelte/TasksView.svelte';

  interface Props {
    obsidianApp: any;
    plugin: any;
    settings: any;
  }

  let { obsidianApp, plugin, settings }: Props = $props();

  let isInitialized = $state(false);
  let initError = $state<string | null>(null);

  onMount(async () => {
    try {
      await taskSyncApp.initialize(obsidianApp, plugin, settings);
      isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize TaskSync app:', error);
      initError = error.message;
    }
  });

  onDestroy(async () => {
    await taskSyncApp.shutdown();
  });
</script>

<div class="task-sync-app">
  {#if !isInitialized}
    <div class="app-loading">
      {#if initError}
        <div class="error-state">
          <h3>Initialization Failed</h3>
          <p>{initError}</p>
        </div>
      {:else}
        <div class="loading-state">
          <p>Initializing TaskSync...</p>
        </div>
      {/if}
    </div>
  {:else}
    <TasksView />
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
</style>
```

## Phase 8: Obsidian Plugin Integration

### 8.1 Lightweight Plugin Wrapper

**File: `src/main.ts` (Updated)**

```typescript
import { Plugin, ItemView, WorkspaceLeaf } from 'obsidian';
import { mount, unmount } from 'svelte';
import App from './app/App.svelte';
import { TaskSyncSettings, DEFAULT_SETTINGS } from './settings';

export default class TaskSyncPlugin extends Plugin {
  settings: TaskSyncSettings;

  async onload() {
    await this.loadSettings();

    this.registerView('task-sync-main', (leaf) => {
      return new TaskSyncView(leaf, this);
    });

    this.addRibbonIcon('checkbox', 'Task Sync', () => {
      this.activateView();
    });

    this.app.workspace.onLayoutReady(() => {
      this.activateView();
    });
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

    this.appComponent = mount(App, {
      target: container,
      props: {
        obsidianApp: this.app,
        plugin: this.plugin,
        settings: this.plugin.settings
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

## Summary

This clean architecture provides:

### ✅ **Core Benefits**

1. **Source Agnostic Core**: Pure domain entities with no Obsidian coupling
2. **Extension System**: Pluggable extensions for different sources (Obsidian, GitHub, etc.)
3. **Clean Boundaries**: No leakage of extension concerns into core domain
4. **Event-Driven**: Reactive updates across the application
5. **Breaking Changes OK**: No migration complexity since this is unreleased

### ✅ **Key Design Decisions**

- **No `filePath` in Task entity**: File paths are Obsidian-specific, handled by ObsidianExtension
- **No front-matter coupling**: Core entities are pure data structures
- **Extension-based architecture**: Each source (Obsidian, GitHub) is a separate extension
- **Proper Obsidian API usage**: Leverages `processFrontMatter`, `getFrontMatterInfo`, `parseYaml`, `stringifyYaml`

### ✅ **Implementation Flow**

1. **Core Domain**: Pure entities with Zod validation
2. **Extension System**: Register extensions with the core app
3. **Event Bus**: Coordinate between extensions and UI
4. **Reactive Stores**: Svelte stores that listen to extension events
5. **Svelte App**: Clean UI that knows nothing about sources
6. **Plugin Wrapper**: Minimal Obsidian plugin that bootstraps the Svelte app

This architecture makes it trivial to add new sources (GitHub, Linear, Apple Reminders) without touching the core application or existing extensions.

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

**File: `src/app/migration/DataMigrator.ts`**

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
import { TaskSchema, TaskFrontMatterSchema } from '../../src/app/core/entities';

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
import { ObsidianSource } from '../../src/app/sources/ObsidianSource';
import { Task } from '../../src/app/core/entities';

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
- [ ] Create `src/app/core/entities.ts` with Zod-validated Task, Project, Area schemas
- [ ] Create `src/app/core/note.ts` with Note abstraction and utilities
- [ ] Create `src/app/core/events.ts` with EventBus and dot-notation event types
- [ ] Write unit tests for all core domain types

#### Task 1.2: Generic Source Interface Foundation
- [ ] Create `src/app/core/source.ts` with generic Source interface supporting multiple entity types
- [ ] Implement entity-specific operations interfaces (EntityOperations<T>)
- [ ] Create BaseSource with `this.trigger()` method and entity type support checking
- [ ] Write unit tests for source interface and base implementation

#### Task 1.3: Obsidian Source Implementation
- [ ] Implement `src/app/sources/ObsidianSource.ts` with support for tasks, projects, and areas
- [ ] Create separate operation classes for each entity type (ObsidianTaskOperations, etc.)
- [ ] Migrate existing TaskFileManager, ProjectFileManager, AreaFileManager logic
- [ ] Write integration tests for all entity types in ObsidianSource

#### Task 1.4: Enhanced Store Architecture
- [ ] Create `src/app/stores/taskStore.ts` with event-driven reactive store using dot-notation events
- [ ] Create similar stores for projects and areas (`projectStore.ts`, `areaStore.ts`)
- [ ] Implement derived stores for common queries (today, imported, etc.)
- [ ] Add comprehensive error handling and loading states
- [ ] Write tests for store operations and reactivity

### Priority 2: Command/Query Architecture (Week 2-3)

#### Task 2.1: Command System
- [ ] Create `src/app/commands/TaskCommands.ts` with CRUD operations
- [ ] Implement validation and error handling for all commands
- [ ] Add support for batch operations
- [ ] Write unit tests for command handlers

#### Task 2.2: Query System
- [ ] Create `src/app/queries/TaskQueries.ts` with reactive and snapshot queries
- [ ] Implement advanced filtering and search capabilities
- [ ] Add performance optimization for large datasets
- [ ] Write tests for query accuracy and performance

#### Task 2.3: Multi-Entity Source Registry
- [ ] Create `src/app/core/SourceRegistry.ts` for multi-source, multi-entity management
- [ ] Implement entity-type-aware sync operations (syncEntity, deleteEntity)
- [ ] Implement `src/app/services/SyncCoordinator.ts` with support for all entity types
- [ ] Add health checking and error recovery for each entity type
- [ ] Write integration tests for multi-source, multi-entity scenarios

### Priority 3: Application Layer (Week 3-4)

#### Task 3.1: Svelte App Root
- [ ] Create `src/app/app/App.svelte` as main application component
- [ ] Implement initialization and error handling
- [ ] Add loading states and user feedback
- [ ] Write E2E tests for app initialization

#### Task 3.2: Component Migration
- [ ] Update existing Svelte components to use new stores and commands
- [ ] Ensure all components use new reactive patterns
- [ ] Maintain existing UI/UX while upgrading internals
- [ ] Write component tests for new architecture

#### Task 3.3: Plugin Integration
- [ ] Update `src/app/main.ts` to use lightweight plugin wrapper
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
- [ ] Create `src/app/migration/DataMigrator.ts` for safe data migration
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
