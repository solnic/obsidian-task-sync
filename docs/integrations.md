# Obsidian Task Sync Plugin - External Integrations Development Plan

## Overview

This document outlines the development plan for enhancing the existing GitHub integration and adding Linear integration to the Obsidian Task Sync plugin. The plugin leverages Obsidian's Bases feature to provide task and project management with one-way import capabilities from external sources.

## Current Architecture

The Task Sync plugin follows a service-based architecture that provides:
- **Service-based integrations** using concrete service classes in `src/services/`
- **Settings-driven configuration** through the TaskSyncSettings interface
- **Obsidian Bases integration** for task organization and filtering
- **Template-based task creation** using the existing TemplateManager
- **Event-driven updates** through FileChangeListener for real-time sync

## Phase 1: Enhanced GitHub Integration with Task Import ✅ COMPLETED

### Current State Analysis

The plugin already includes a basic GitHub integration:
- **GitHubService** (`src/services/GitHubService.ts`) - Handles GitHub API communication
- **GitHubIssuesView** (`src/views/GitHubIssuesView.ts`) - Displays GitHub issues
- **Settings integration** - GitHub configuration in TaskSyncSettings
- **E2E tests** - Comprehensive testing for GitHub functionality

### Enhancement Goals ✅ COMPLETED

Transform the existing GitHub integration from a read-only issue viewer into a full task import system that:
- ✅ Imports GitHub issues as Obsidian tasks
- ✅ Integrates with the existing Bases system
- ✅ Uses the TemplateManager for task creation
- ✅ Respects Area/Project organization
- ✅ Maintains sync status to avoid duplicates

### Core Types Enhancement ✅ COMPLETED

**File**: `src/types/integrations.ts` ✅ IMPLEMENTED

```typescript
export interface ExternalTaskData {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority?: string;
  assignee?: string;
  labels?: string[];
  createdAt: Date;
  updatedAt: Date;
  externalUrl: string;
  sourceType: 'github' | 'linear';
  sourceData: Record<string, any>; // Raw data from source
}

export interface TaskImportConfig {
  targetArea?: string;
  targetProject?: string;
  taskType?: string;
  importLabelsAsTags?: boolean;
  preserveAssignee?: boolean;
}

export interface ImportResult {
  success: boolean;
  taskPath?: string;
  error?: string;
  skipped?: boolean;
  reason?: string;
}
```

### Enhanced GitHub Service ✅ COMPLETED

**File**: `src/services/GitHubService.ts` ✅ ENHANCED

```typescript
// Add to existing GitHubService class
export class GitHubService {
  // ... existing methods ...

  /**
   * Import GitHub issue as Obsidian task
   */
  async importIssueAsTask(
    issue: GitHubIssue,
    config: TaskImportConfig
  ): Promise<ImportResult> {
    try {
      const taskData = this.transformIssueToTaskData(issue);
      const taskPath = await this.createTaskFromData(taskData, config);

      return {
        success: true,
        taskPath,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Transform GitHub issue to standardized task data
   */
  private transformIssueToTaskData(issue: GitHubIssue): ExternalTaskData {
    return {
      id: `github-${issue.id}`,
      title: issue.title,
      description: issue.body || '',
      status: issue.state === 'open' ? 'Backlog' : 'Done',
      priority: this.extractPriorityFromLabels(issue.labels),
      assignee: issue.assignee?.login,
      labels: issue.labels.map(label => label.name),
      createdAt: new Date(issue.created_at),
      updatedAt: new Date(issue.updated_at),
      externalUrl: issue.html_url,
      sourceType: 'github',
      sourceData: issue,
    };
  }
}
```

### Task Import Manager ✅ COMPLETED

**File**: `src/services/TaskImportManager.ts` ✅ IMPLEMENTED

```typescript
import { App, TFile } from 'obsidian';
import { TemplateManager } from './TemplateManager';
import { ExternalTaskData, TaskImportConfig, ImportResult } from '../types/integrations';
import { TaskSyncSettings } from '../components/ui/settings/types';

export class TaskImportManager {
  constructor(
    private app: App,
    private templateManager: TemplateManager,
    private settings: TaskSyncSettings
  ) {}

  /**
   * Create Obsidian task from external task data
   */
  async createTaskFromData(
    taskData: ExternalTaskData,
    config: TaskImportConfig
  ): Promise<string> {
    const taskName = this.sanitizeTaskName(taskData.title);
    const taskFolder = this.determineTaskFolder(config);
    const taskPath = `${taskFolder}/${taskName}.md`;

    // Check if task already exists
    if (await this.taskExists(taskPath, taskData.id)) {
      throw new Error(`Task already exists: ${taskPath}`);
    }

    // Create task file using template manager
    const frontMatter = this.generateTaskFrontMatter(taskData, config);
    const content = this.generateTaskContent(taskData);

    await this.templateManager.createFileFromTemplate(
      taskPath,
      'Task.md',
      { frontMatter, content }
    );

    return taskPath;
  }
}
```

### Import Status Tracking ✅ COMPLETED

**File**: `src/services/ImportStatusService.ts` ✅ IMPLEMENTED

```typescript
export interface ImportedTaskRecord {
  externalId: string;
  externalSource: 'github' | 'linear';
  taskPath: string;
  importedAt: Date;
  lastSyncedAt: Date;
  externalUrl: string;
}

export class ImportStatusService {
  private importedTasks: Map<string, ImportedTaskRecord> = new Map();

  /**
   * Check if external task has already been imported
   */
  isTaskImported(externalId: string, source: string): boolean {
    const key = `${source}-${externalId}`;
    return this.importedTasks.has(key);
  }

  /**
   * Record successful task import
   */
  recordImport(record: ImportedTaskRecord): void {
    const key = `${record.externalSource}-${record.externalId}`;
    this.importedTasks.set(key, record);
  }

  /**
   * Get all imported tasks from a source
   */
  getImportedTasks(source: string): ImportedTaskRecord[] {
    return Array.from(this.importedTasks.values())
      .filter(record => record.externalSource === source);
  }
}
```

### Detailed Tasks for Phase 1

#### Task 1.1: Create Integration Types ✅ COMPLETED (1 hour)
**File**: `src/types/integrations.ts` ✅ IMPLEMENTED
- ✅ Define `ExternalTaskData` interface for standardized external task representation
- ✅ Define `TaskImportConfig` interface for import configuration options
- ✅ Define `ImportResult` interface for import operation results
- ✅ Add type exports to `src/types/index.ts`
- **Success Criteria**: ✅ Types compile without errors and are importable throughout codebase

#### Task 1.2: Enhance GitHubService with Import Methods ✅ COMPLETED (3 hours)
**File**: `src/services/GitHubService.ts` ✅ ENHANCED
- ✅ Add `importIssueAsTask(issue: GitHubIssue, config: TaskImportConfig): Promise<ImportResult>` method
- ✅ Add `transformIssueToTaskData(issue: GitHubIssue): ExternalTaskData` private method
- ✅ Add `extractPriorityFromLabels(labels: Array<{name: string}>): string` private method
- ✅ Add dependency injection for TaskImportManager integration
- **Success Criteria**: ✅ Can import a GitHub issue and create corresponding Obsidian task file

#### Task 1.3: Create TaskImportManager Service ✅ COMPLETED (4 hours)
**File**: `src/services/TaskImportManager.ts` ✅ IMPLEMENTED
- ✅ Implement `createTaskFromData(taskData: ExternalTaskData, config: TaskImportConfig): Promise<string>` method
- ✅ Add `sanitizeTaskName(title: string): string` method using existing file name sanitization
- ✅ Add `determineTaskFolder(config: TaskImportConfig): string` method respecting settings
- ✅ Add `generateTaskFrontMatter(taskData: ExternalTaskData, config: TaskImportConfig): Record<string, any>` method
- ✅ Add `generateTaskContent(taskData: ExternalTaskData): string` method
- ✅ Integration with existing TemplateManager and file creation patterns
- **Success Criteria**: ✅ Can create properly formatted Obsidian task files from external data

#### Task 1.4: Create ImportStatusService ✅ COMPLETED (2 hours)
**File**: `src/services/ImportStatusService.ts` ✅ IMPLEMENTED
- ✅ Implement `ImportedTaskMetadata` interface for tracking imported tasks
- ✅ Add `isTaskImported(externalId: string, source: string): boolean` method
- ✅ Add `recordImport(metadata: ImportedTaskMetadata): void` method
- ✅ Add `getImportMetadata(externalId: string, source: string): ImportedTaskMetadata` method
- ✅ In-memory storage with unique key format: `${source}:${externalId}`
- **Success Criteria**: ✅ Can track and prevent duplicate imports across plugin sessions

#### Task 1.5: Add Import Commands to Main Plugin ✅ COMPLETED (2 hours)
**File**: `src/main.ts` ✅ ENHANCED
- ✅ Add "Import GitHub Issue" command with URL input modal
- ✅ Add "Import All GitHub Issues" command with repository processing
- ✅ Add command registration in `onload()` method
- ✅ Add command handlers that integrate with GitHubService and TaskImportManager
- ✅ Service initialization and dependency injection
- **Success Criteria**: ✅ Commands appear in command palette and execute import operations

#### Task 1.6: Update GitHubIssuesView with Import Functionality ⏸️ DEFERRED (3 hours)
**File**: `src/views/GitHubIssuesView.ts` ⏸️ NOT IMPLEMENTED
- ⏸️ Add import button to each issue item in the issues list
- ⏸️ Add "Import All" button to the view header
- ⏸️ Add import configuration modal for setting target area/project
- ⏸️ Add import status indicators (imported, importing, failed)
- Add progress feedback for import operations
- **Success Criteria**: Users can import issues directly from the GitHub Issues view with visual feedback

## Phase 2: Linear Integration

### Linear Service Implementation

Following the same pattern as the existing GitHubService, create a new LinearService that integrates with Linear's GraphQL API.

#### 2.1 Linear Service

**File**: `src/services/LinearService.ts` (new file)

```typescript
import { LinearClient } from '@linear/sdk';
import { TaskSyncSettings } from '../components/ui/settings/types';
import { ExternalTaskData, TaskImportConfig, ImportResult } from '../types/integrations';

export interface LinearIssue {
  id: string;
  title: string;
  description?: string;
  state: { name: string };
  priority?: number;
  assignee?: { displayName: string };
  labels?: { nodes: Array<{ name: string }> };
  createdAt: string;
  updatedAt: string;
  url: string;
}

export class LinearService {
  private client: LinearClient | null = null;

  constructor(private settings: TaskSyncSettings) {
    this.initializeClient();
  }

  private initializeClient(): void {
    if (this.settings.linearIntegration.enabled && this.settings.linearIntegration.apiKey) {
      this.client = new LinearClient({
        apiKey: this.settings.linearIntegration.apiKey,
      });
    }
  }

  isEnabled(): boolean {
    return this.settings.linearIntegration.enabled && !!this.client;
  }

  async fetchIssues(teamId?: string): Promise<LinearIssue[]> {
    if (!this.client) {
      throw new Error('Linear integration is not enabled or configured');
    }

    try {
      const issues = await this.client.issues({
        filter: teamId ? { team: { id: { eq: teamId } } } : undefined,
        first: 100,
      });

      return issues.nodes as LinearIssue[];
    } catch (error) {
      console.error('Linear API error:', error);
      throw error;
    }
  }

  async importIssueAsTask(
    issue: LinearIssue,
    config: TaskImportConfig
  ): Promise<ImportResult> {
    try {
      const taskData = this.transformIssueToTaskData(issue);
      // Use the same TaskImportManager as GitHub
      const taskPath = await this.createTaskFromData(taskData, config);

      return {
        success: true,
        taskPath,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
```

#### 2.2 Linear Settings Integration

**File**: `src/components/ui/settings/types.ts` (enhance existing)

```typescript
// Add to existing TaskSyncSettings interface
export interface LinearIntegrationSettings {
  enabled: boolean;
  apiKey: string;
  defaultTeamId?: string;
  includeCompleted: boolean;
}

// Update TaskSyncSettings to include:
export interface TaskSyncSettings {
  // ... existing properties ...
  linearIntegration: LinearIntegrationSettings;
}
```

### Detailed Tasks for Phase 2

#### Task 2.1: Install Linear Dependencies (1 hour)
**Files**: `package.json`, `package-lock.json`
- Add `@linear/sdk` to dependencies using npm install
- Verify TypeScript types are included with the SDK
- Update any type definitions if needed
- **Success Criteria**: Linear SDK imports without TypeScript errors

#### Task 2.2: Create LinearService Class (4 hours)
**File**: `src/services/LinearService.ts`
- Implement `LinearService` class following `GitHubService` pattern
- Add `initializeClient()` private method for Linear client setup
- Add `isEnabled(): boolean` method checking settings and client status
- Add `fetchIssues(teamId?: string): Promise<LinearIssue[]>` method
- Add `fetchTeams(): Promise<LinearTeam[]>` method for team selection
- Add `importIssueAsTask(issue: LinearIssue, config: TaskImportConfig): Promise<ImportResult>` method
- Add `transformIssueToTaskData(issue: LinearIssue): ExternalTaskData` private method
- **Success Criteria**: Can authenticate with Linear API and fetch issues

#### Task 2.3: Add Linear Settings to UI (3 hours)
**File**: `src/components/ui/settings/SettingsTab.ts`
- Add `createLinearIntegrationSection(container: HTMLElement): void` method
- Add Linear enable/disable toggle
- Add Linear API key input field
- Add team selection dropdown (populated from API)
- Add settings validation and save functionality
- **Success Criteria**: Linear settings appear in plugin settings and persist correctly

#### Task 2.4: Update Settings Types and Defaults (1 hour)
**Files**: `src/components/ui/settings/types.ts`, `src/components/ui/settings/defaults.ts`
- Add `LinearIntegrationSettings` interface to types
- Add `linearIntegration` property to `TaskSyncSettings` interface
- Add Linear defaults to `DEFAULT_SETTINGS`
- Update settings validation functions
- **Success Criteria**: Linear settings integrate seamlessly with existing settings system

#### Task 2.5: Create LinearIssuesView (4 hours)
**File**: `src/views/LinearIssuesView.ts`
- Create `LinearIssuesView` class extending `ItemView`
- Follow `GitHubIssuesView` pattern for consistency
- Add team filtering dropdown
- Add issue list with import buttons
- Add import configuration modal
- Add import status indicators
- Register view type and icon
- **Success Criteria**: Linear Issues view displays issues and supports import operations

#### Task 2.6: Add Linear Commands and Integration (2 hours)
**File**: `src/main.ts`
- Add Linear service initialization in `onload()`
- Add "Open Linear Issues" command
- Add "Import Linear Issue" command
- Add Linear view registration
- Update plugin cleanup to include Linear service
- **Success Criteria**: Linear commands work through command palette and Linear view opens correctly

## Phase 3: Import Management and Optimization

### Bulk Import Operations

Enhance both GitHub and Linear integrations with bulk import capabilities and better management.

#### 3.1 Bulk Import Manager

**File**: `src/services/BulkImportManager.ts` (new file)

```typescript
import { ExternalTaskData, TaskImportConfig, ImportResult } from '../types/integrations';
import { TaskImportManager } from './TaskImportManager';
import { ImportStatusService } from './ImportStatusService';

export interface BulkImportOptions {
  skipExisting: boolean;
  maxConcurrent: number;
  targetArea?: string;
  targetProject?: string;
  dryRun?: boolean;
}

export interface BulkImportResult {
  total: number;
  imported: number;
  skipped: number;
  failed: number;
  results: ImportResult[];
  duration: number;
}

export class BulkImportManager {
  constructor(
    private taskImportManager: TaskImportManager,
    private importStatusService: ImportStatusService
  ) {}

  async importTasks(
    tasks: ExternalTaskData[],
    config: TaskImportConfig,
    options: BulkImportOptions = { skipExisting: true, maxConcurrent: 5 }
  ): Promise<BulkImportResult> {
    const startTime = Date.now();
    const results: ImportResult[] = [];

    // Filter out already imported tasks if requested
    const tasksToImport = options.skipExisting
      ? tasks.filter(task => !this.importStatusService.isTaskImported(task.id, task.sourceType))
      : tasks;

    if (options.dryRun) {
      return {
        total: tasks.length,
        imported: 0,
        skipped: tasks.length - tasksToImport.length,
        failed: 0,
        results: [],
        duration: Date.now() - startTime,
      };
    }

    // Process tasks in batches to avoid overwhelming the system
    const batches = this.createBatches(tasksToImport, options.maxConcurrent);

    for (const batch of batches) {
      const batchResults = await Promise.allSettled(
        batch.map(task => this.taskImportManager.createTaskFromData(task, config))
      );

      batchResults.forEach((result, index) => {
        const task = batch[index];
        if (result.status === 'fulfilled') {
          results.push({ success: true, taskPath: result.value });
          this.importStatusService.recordImport({
            externalId: task.id,
            externalSource: task.sourceType,
            taskPath: result.value,
            importedAt: new Date(),
            lastSyncedAt: new Date(),
            externalUrl: task.externalUrl,
          });
        } else {
          results.push({ success: false, error: result.reason.message });
        }
      });
    }

    return {
      total: tasks.length,
      imported: results.filter(r => r.success).length,
      skipped: tasks.length - tasksToImport.length,
      failed: results.filter(r => !r.success).length,
      results,
      duration: Date.now() - startTime,
    };
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }
}
```

### Detailed Tasks for Phase 3

#### Task 3.1: Create BulkImportManager (3 hours)
**File**: `src/services/BulkImportManager.ts`
- Implement `BulkImportManager` class with batch processing capabilities
- Add `importTasks(tasks: ExternalTaskData[], config: TaskImportConfig, options: BulkImportOptions): Promise<BulkImportResult>` method
- Add `createBatches<T>(items: T[], batchSize: number): T[][]` private method for batch processing
- Add concurrent import limiting to prevent overwhelming the system
- Add dry-run capability for previewing import operations
- Add progress callback support for UI updates
- **Success Criteria**: Can import 100+ tasks efficiently with progress tracking and error handling

#### Task 3.2: Add Import Progress Tracking (2 hours)
**File**: `src/components/modals/ImportProgressModal.ts`
- Create progress modal for bulk import operations
- Add real-time progress bar and status updates
- Add cancellation capability with cleanup
- Add detailed results display (imported, skipped, failed)
- Integrate with BulkImportManager progress callbacks
- **Success Criteria**: Users see real-time progress during bulk imports and can cancel if needed

#### Task 3.3: Enhance Import Configuration (2 hours)
**Files**: `src/components/modals/ImportConfigModal.ts`, `src/types/integrations.ts`
- Create import configuration modal for advanced options
- Add import templates for common scenarios (bugs to specific area, features to project)
- Add label-to-tag mapping configuration
- Add custom field mapping options (assignee to custom property)
- Add import preview functionality
- **Success Criteria**: Users can configure complex import scenarios with preview

#### Task 3.4: Add Import History and Management (3 hours)
**Files**: `src/views/ImportHistoryView.ts`, `src/services/ImportStatusService.ts`
- Create import history view showing all past imports
- Add filtering by source, date, status
- Add ability to re-sync imported tasks (update from external source)
- Add cleanup functionality for deleted external tasks
- Add import statistics and reporting
- **Success Criteria**: Users can view and manage all imported tasks with full history

#### Task 3.5: Performance Optimization (2 hours)
**Files**: Various service files
- Add caching for frequently accessed data (teams, repositories, labels)
- Optimize API calls with proper pagination
- Add rate limiting for API requests to respect service limits
- Add connection pooling and request batching where possible
- Add performance metrics and monitoring
- **Success Criteria**: Import operations are fast and don't hit API rate limits

#### Task 3.6: Add Comprehensive Error Handling (2 hours)
**Files**: All service files
- Add retry logic for failed imports with exponential backoff
- Add detailed error reporting with actionable messages
- Add recovery mechanisms for partial failures
- Add error categorization (network, auth, validation, etc.)
- Add error logging and debugging capabilities
- **Success Criteria**: Import operations handle errors gracefully with clear user feedback

## Integration with Existing Plugin Features

### Obsidian Bases Integration

The import system leverages the plugin's core Bases feature for automatic task organization and filtering:

#### Automatic Base Inclusion

When tasks are imported, they automatically appear in relevant bases:

```typescript
// Example: Importing GitHub issues for "Mobile App" project
const importConfig: TaskImportConfig = {
  targetProject: "Mobile App",
  targetArea: "Development",
  taskType: "Bug",
  importLabelsAsTags: true
};

// Results in tasks that automatically appear in:
// 1. Bases/Tasks.base (main task list)
// 2. Bases/Mobile App Tasks.base (project-specific base)
// 3. Bases/Development Tasks.base (area-specific base)
```

#### Base Synchronization

The import system integrates with the existing BaseManager:

```typescript
// In TaskImportManager.createTaskFromData()
async createTaskFromData(taskData: ExternalTaskData, config: TaskImportConfig): Promise<string> {
  // 1. Create task file using TemplateManager
  const taskPath = await this.templateManager.createFileFromTemplate(/*...*/);

  // 2. Trigger base synchronization if enabled
  if (this.settings.autoSyncAreaProjectBases) {
    await this.baseManager.syncAreaProjectBases();
  }

  // 3. Update base views if auto-update is enabled
  if (this.settings.autoUpdateBaseViews) {
    await this.baseManager.updateBaseViews();
  }

  return taskPath;
}
```

#### Base Filtering Integration

Imported tasks respect existing base filtering logic:

```typescript
// Imported tasks include proper front-matter for base filtering
const frontMatter = {
  Title: taskData.title,
  Type: config.taskType || 'Task',
  Priority: taskData.priority || 'Medium',
  Areas: config.targetArea ? [config.targetArea] : [],
  Project: config.targetProject || '',
  Done: false,
  Status: this.mapExternalStatus(taskData.status),
  'External Source': taskData.sourceType,
  'External ID': taskData.id,
  'External URL': taskData.externalUrl,
  tags: config.importLabelsAsTags ? taskData.labels : []
};
```

#### External Task Tracking in Bases

The plugin adds special properties to track external task origins:

```yaml
# Example imported task front-matter
---
Title: Fix login bug on mobile
Type: Bug
Priority: High
Areas: [Development]
Project: "[[Mobile App]]"
Done: false
Status: In Progress
External Source: github
External ID: github-12345
External URL: https://github.com/owner/repo/issues/123
tags: [bug, mobile, authentication]
---
```

#### Base Query Enhancement

Bases can filter by external source:

```yaml
# In Bases/GitHub Tasks.base
query: |
  TABLE WITHOUT ID
    link(file.name, Title) as Task,
    Type,
    Priority,
    Status,
    "External URL"
  FROM "Tasks"
  WHERE External Source = "github"
  SORT Priority DESC, file.ctime ASC
```

### Template System Integration

The import system seamlessly integrates with the existing TemplateManager:

```typescript
// In TaskImportManager
async createTaskFromData(taskData: ExternalTaskData, config: TaskImportConfig): Promise<string> {
  // 1. Use existing template system
  const templateName = this.determineTemplate(config.taskType);

  // 2. Generate front-matter respecting property order
  const frontMatter = this.generateTaskFrontMatter(taskData, config);

  // 3. Create task using TemplateManager
  await this.templateManager.createFileFromTemplate(
    taskPath,
    templateName,
    { frontMatter, content: this.generateTaskContent(taskData) }
  );

  // 4. Trigger property handlers for additional processing
  // (existing FileChangeListener will handle this automatically)
}
```

#### Template Customization Support

Users can customize import behavior through templates:

```markdown
<!-- In Templates/Task.md -->
---
Title: {{title}}
Type: {{type}}
Priority: {{priority}}
Areas: {{areas}}
Project: {{project}}
Done: false
Status: {{status}}
External Source: {{externalSource}}
External ID: {{externalId}}
External URL: {{externalUrl}}
tags: {{tags}}
---

# {{title}}

{{description}}

## External Information
- **Source**: {{externalSource}}
- **Original URL**: [View on {{externalSource}}]({{externalUrl}})
- **Imported**: {{importedAt}}

{{content}}
```

### Settings Integration

All import functionality leverages the existing settings system:

```typescript
// Import configuration respects existing settings
interface TaskImportConfig {
  targetArea?: string;           // Uses settings.areasFolder
  targetProject?: string;        // Uses settings.projectsFolder
  taskType?: string;            // Uses settings.taskTypes
  importLabelsAsTags?: boolean; // Configurable per import
  preserveAssignee?: boolean;   // Configurable per import
}

// Settings determine behavior
const taskFolder = config.targetArea
  ? `${this.settings.areasFolder}/${config.targetArea}/${this.settings.tasksFolder}`
  : this.settings.tasksFolder;
```

## UI Enhancements

### Enhanced GitHub Issues View
- Add import buttons to each issue
- Add bulk import selection
- Add import configuration modal
- Add import status indicators

### New Linear Issues View
- Follow GitHub Issues View pattern
- Add team filtering
- Add import functionality
- Integrate with command palette

### Import Management Dashboard
- View import history
- Manage imported tasks
- Re-sync capabilities
- Cleanup tools

## Testing Strategy

Following the plugin's existing testing framework with vitest and Playwright:

### Unit Tests (`tests/unit/`)

#### Service Layer Tests
```typescript
// tests/unit/services/github-service.test.ts
describe('GitHubService Import Functionality', () => {
  test('should transform GitHub issue to ExternalTaskData', () => {
    const issue = createMockGitHubIssue();
    const taskData = githubService.transformIssueToTaskData(issue);

    expect(taskData.id).toBe(`github-${issue.id}`);
    expect(taskData.title).toBe(issue.title);
    expect(taskData.sourceType).toBe('github');
  });

  test('should extract priority from labels correctly', () => {
    const labels = [{ name: 'priority:high' }, { name: 'bug' }];
    const priority = githubService.extractPriorityFromLabels(labels);

    expect(priority).toBe('High');
  });
});

// tests/unit/services/task-import-manager.test.ts
describe('TaskImportManager', () => {
  test('should sanitize task names for file system', () => {
    const unsafeName = 'Fix: Issue with "quotes" and /slashes/';
    const safeName = taskImportManager.sanitizeTaskName(unsafeName);

    expect(safeName).toBe('Fix Issue with quotes and slashes');
  });

  test('should generate correct front-matter from external data', () => {
    const taskData = createMockExternalTaskData();
    const config = { targetProject: 'Test Project', taskType: 'Bug' };
    const frontMatter = taskImportManager.generateTaskFrontMatter(taskData, config);

    expect(frontMatter.Title).toBe(taskData.title);
    expect(frontMatter.Project).toBe('[[Test Project]]');
    expect(frontMatter['External Source']).toBe(taskData.sourceType);
  });
});
```

#### Import Status Tracking Tests
```typescript
// tests/unit/services/import-status-service.test.ts
describe('ImportStatusService', () => {
  test('should track imported tasks correctly', () => {
    const record = createMockImportRecord();
    importStatusService.recordImport(record);

    expect(importStatusService.isTaskImported(record.externalId, record.externalSource)).toBe(true);
  });

  test('should persist import records across sessions', async () => {
    const record = createMockImportRecord();
    await importStatusService.recordImport(record);

    // Simulate plugin reload
    const newService = new ImportStatusService(pluginStorageService);
    await newService.initialize();

    expect(newService.isTaskImported(record.externalId, record.externalSource)).toBe(true);
  });
});
```

### Integration Tests (`tests/integration/`)

#### Template Integration Tests
```typescript
// tests/integration/import-template-integration.test.ts
describe('Import Template Integration', () => {
  test('should create task using existing template system', async () => {
    const taskData = createMockExternalTaskData();
    const config = { targetProject: 'Test Project' };

    const taskPath = await taskImportManager.createTaskFromData(taskData, config);

    // Verify file was created
    expect(await vault.adapter.exists(taskPath)).toBe(true);

    // Verify front-matter is correct
    const file = await vault.getAbstractFileByPath(taskPath);
    const content = await vault.read(file);
    const parsed = matter(content);

    expect(parsed.data.Title).toBe(taskData.title);
    expect(parsed.data.Project).toBe('[[Test Project]]');
  });
});
```

#### Base System Integration Tests
```typescript
// tests/integration/import-base-integration.test.ts
describe('Import Base Integration', () => {
  test('should trigger base sync after task import', async () => {
    const baseManagerSpy = vi.spyOn(baseManager, 'syncAreaProjectBases');

    await taskImportManager.createTaskFromData(mockTaskData, mockConfig);

    expect(baseManagerSpy).toHaveBeenCalled();
  });

  test('should make imported tasks appear in relevant bases', async () => {
    const config = { targetProject: 'Mobile App', targetArea: 'Development' };
    await taskImportManager.createTaskFromData(mockTaskData, config);

    // Check main tasks base
    const tasksBase = await vault.read(await vault.getAbstractFileByPath('Bases/Tasks.base'));
    expect(tasksBase).toContain(mockTaskData.title);

    // Check project-specific base
    const projectBase = await vault.read(await vault.getAbstractFileByPath('Bases/Mobile App Tasks.base'));
    expect(projectBase).toContain(mockTaskData.title);
  });
});
```

### E2E Tests (`e2e/specs/`)

Following the plugin's existing E2E testing patterns with Playwright:

#### GitHub Integration E2E Tests
```typescript
// e2e/specs/github-import.e2e.ts
describe('GitHub Import E2E', () => {
  const context = setupE2ETestHooks();

  test('should import GitHub issue through UI', async () => {
    await createTestFolders(context.page);

    // Configure GitHub integration
    await configureGitHubIntegration(context.page, {
      enabled: true,
      repository: 'solnic/obsidian-task-sync'
    });

    // Open GitHub Issues view
    await openGitHubIssuesView(context.page);
    await waitForGitHubViewContent(context.page);

    // Click import button on first issue
    await context.page.click('[data-test="issue-import-button"]:first-child');

    // Configure import
    await context.page.fill('[data-test="target-project"]', 'Test Project');
    await context.page.click('[data-test="confirm-import"]');

    // Verify task was created
    await context.page.waitForSelector('[data-test="import-success"]');

    // Verify task appears in vault
    const taskExists = await context.page.evaluate(async () => {
      const app = (window as any).app;
      return app.vault.adapter.exists('Tasks/Fix login bug on mobile.md');
    });
    expect(taskExists).toBe(true);
  });

  test('should prevent duplicate imports', async () => {
    // Import same issue twice
    await importGitHubIssue(context.page, 'issue-123');
    await importGitHubIssue(context.page, 'issue-123');

    // Verify only one task was created
    const taskCount = await context.page.evaluate(async () => {
      const app = (window as any).app;
      const files = app.vault.getMarkdownFiles();
      return files.filter(f => f.path.includes('issue-123')).length;
    });
    expect(taskCount).toBe(1);
  });
});
```

#### Test Data Management
```typescript
// e2e/helpers/test-data-setup.ts
export async function setupTestData() {
  // Use real GitHub/Linear APIs with test tokens from environment
  // Create consistent test issues for reliable testing
  // Clean up previous test data
}

// Environment configuration for E2E tests
// GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
// LINEAR_TOKEN=lin_api_xxxxxxxxxxxxxxxxxxxx
// TEST_GITHUB_REPO=solnic/obsidian-task-sync
```

## Dependencies

### Required Dependencies
```json
{
  "dependencies": {
    "@octokit/rest": "^20.0.0",
    "@linear/sdk": "^58.1.0"
  }
}
```

### Existing Dependencies (already in project)
- `obsidian` - Core Obsidian API
- `gray-matter` - Front-matter parsing
- `vitest` - Testing framework
- `playwright` - E2E testing

## Success Criteria

### Phase 1 Complete When: ✅ COMPLETED

#### Code Implementation ✅ COMPLETED
- ✅ `src/types/integrations.ts` exists with ExternalTaskData, TaskImportConfig, and ImportResult interfaces
- ✅ `src/services/TaskImportManager.ts` exists and can create Obsidian tasks from external data
- ✅ `src/services/ImportStatusService.ts` exists and prevents duplicate imports
- ✅ GitHubService has `importIssueAsTask()` and `transformIssueToTaskData()` methods
- ✅ Main plugin has "Import GitHub Issue" and "Import All GitHub Issues" commands registered

#### Functionality Tests ✅ COMPLETED
- ✅ Can import a GitHub issue and create corresponding `.md` file in correct folder
- ✅ Imported task has proper front-matter with all required properties
- ✅ Imported task appears in relevant Bases (main, area-specific, project-specific)
- ✅ Duplicate import attempts are prevented and show appropriate message
- ✅ Import commands work through command palette and execute successfully

#### UI Integration ⏸️ PARTIALLY COMPLETED
- ⏸️ GitHubIssuesView shows import buttons on each issue (DEFERRED)
- ⏸️ Import configuration modal allows setting target area/project (DEFERRED)
- ⏸️ Import status indicators show success/failure/in-progress states (DEFERRED)
- ✅ Import operations provide user feedback and error messages (via command palette)

### Phase 2 Complete When:

#### Code Implementation
- [ ] `src/services/LinearService.ts` exists following GitHubService pattern
- [ ] Linear settings added to TaskSyncSettings interface and SettingsTab UI
- [ ] `src/views/LinearIssuesView.ts` exists and displays Linear issues
- [ ] Linear commands registered in main plugin
- [ ] Linear dependencies (@linear/sdk) installed and configured

#### Functionality Tests
- [ ] LinearService can authenticate with Linear API using API key
- [ ] Can fetch Linear issues and transform to ExternalTaskData format
- [ ] Can import Linear issues as Obsidian tasks with proper front-matter
- [ ] Linear and GitHub imports can target same Areas/Projects without conflicts
- [ ] Import status tracking works for both GitHub and Linear sources

#### UI Integration
- [ ] Linear settings section appears in plugin settings
- [ ] LinearIssuesView opens through command palette
- [ ] Linear import functionality matches GitHub import UX
- [ ] Both integrations work simultaneously without interference

### Phase 3 Complete When:

#### Code Implementation
- [ ] `src/services/BulkImportManager.ts` exists with batch processing capabilities
- [ ] `src/components/modals/ImportProgressModal.ts` exists for progress tracking
- [ ] `src/views/ImportHistoryView.ts` exists for import management
- [ ] Error handling and retry logic implemented across all services

#### Performance Tests
- [ ] Can import 100+ tasks in under 2 minutes with progress feedback
- [ ] Bulk import operations don't block UI or cause performance issues
- [ ] API rate limiting is respected and handled gracefully
- [ ] Memory usage remains stable during large import operations

#### User Experience
- [ ] Bulk import shows real-time progress with cancel capability
- [ ] Import history view shows all past imports with filtering
- [ ] Error scenarios provide clear, actionable error messages
- [ ] Users can retry failed imports and resume interrupted operations

#### Test Coverage
- [ ] Unit tests cover all service methods with >90% coverage
- [ ] Integration tests verify template and base system integration
- [ ] E2E tests cover complete import workflows for both GitHub and Linear
- [ ] Error scenario tests verify graceful handling of API failures

## Implementation Notes

This plan builds incrementally on the existing plugin architecture:

**Key Principles:**
- **Enhance, don't replace** - Build on existing GitHubService rather than creating new abstractions
- **Follow existing patterns** - Use the same service-based architecture throughout
- **Integrate with Bases** - Leverage the plugin's core feature for task organization
- **Respect user configuration** - Use existing settings, templates, and folder structure
- **Test thoroughly** - Maintain the plugin's high test coverage standards

**Architectural Decisions:**
- Service-based design following existing GitHubService pattern
- Integration with existing TemplateManager for task creation
- Use of TaskSyncSettings for all configuration
- Import status tracking to prevent duplicates
- Bulk operations for efficiency
- Real API integration in tests for reliability
