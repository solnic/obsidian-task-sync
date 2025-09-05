/**
 * Service interface types for the Task Sync plugin
 */

import { Task, Project, Area, Template, BaseFile } from './entities';

// Vault scanning service interface
export interface VaultScannerService {
  // Folder scanning
  scanTasksFolder(): Promise<string[]>;
  scanProjectsFolder(): Promise<string[]>;
  scanAreasFolder(): Promise<string[]>;
  scanTemplatesFolder(): Promise<string[]>;

  // File detection
  findTaskFiles(): Promise<TaskFileInfo[]>;
  findProjectFiles(): Promise<ProjectFileInfo[]>;
  findAreaFiles(): Promise<AreaFileInfo[]>;
  findTemplateFiles(): Promise<TemplateFileInfo[]>;
  findBaseFiles(): Promise<BaseFileInfo[]>;

  // Folder validation
  validateFolderStructure(): Promise<FolderValidationResult>;
  createMissingFolders(): Promise<void>;
}

// File information interfaces
export interface TaskFileInfo {
  path: string;
  name: string;
  exists: boolean;
  lastModified: Date;
  size: number;
  frontmatter?: Record<string, any>;
  content?: string;
}

export interface ProjectFileInfo extends TaskFileInfo {
  taskFiles: string[]; // Related task files
}

export interface AreaFileInfo extends TaskFileInfo {
  projectFiles: string[]; // Related project files
}

export interface TemplateFileInfo extends TaskFileInfo {
  templateType: 'task' | 'project' | 'area' | 'parent-task';
  variables: string[]; // Detected template variables
}

export interface BaseFileInfo extends TaskFileInfo {
  viewType: 'kanban' | 'list' | 'calendar' | 'timeline';
  entityType: 'task' | 'project' | 'area';
  isValid: boolean;
  errors: string[];
}

// Folder validation result
export interface FolderValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  missingFolders: string[];
  suggestions: string[];
}

// Data parsing service interface
export interface DataParserService {
  // Entity parsing
  parseTask(content: string, filePath: string): Promise<Task>;
  parseProject(content: string, filePath: string): Promise<Project>;
  parseArea(content: string, filePath: string): Promise<Area>;
  parseTemplate(content: string, filePath: string): Promise<Template>;

  // Base file parsing
  parseBaseFile(content: string, filePath: string): Promise<BaseFile>;

  // Frontmatter extraction
  extractFrontmatter(content: string): Record<string, any>;
  extractContent(content: string): string;

  // Validation
  validateTaskData(data: Partial<Task>): ValidationResult;
  validateProjectData(data: Partial<Project>): ValidationResult;
  validateAreaData(data: Partial<Area>): ValidationResult;
}

// Data generation service interface
export interface DataGeneratorService {
  // Entity generation
  generateTaskFile(task: Task): Promise<string>;
  generateProjectFile(project: Project): Promise<string>;
  generateAreaFile(area: Area): Promise<string>;

  // Base file generation
  generateBaseFile(baseFile: BaseFile, entities: (Task | Project | Area)[]): Promise<string>;

  // Template processing
  processTemplate(template: Template, variables: Record<string, any>): Promise<string>;

  // File creation
  createTaskFile(task: Task, folderPath: string): Promise<string>;
  createProjectFile(project: Project, folderPath: string): Promise<string>;
  createAreaFile(area: Area, folderPath: string): Promise<string>;
}

// Template service interface
export interface TemplateService {
  // Template detection
  detectNativeTemplates(): Promise<TemplateInfo[]>;
  detectTemplaterPlugin(): Promise<boolean>;

  // Template management
  getAvailableTemplates(type: 'task' | 'project' | 'area' | 'parent-task'): Promise<Template[]>;
  loadTemplate(templateId: string): Promise<Template>;

  // Template processing
  processNativeTemplate(templatePath: string, variables: Record<string, any>): Promise<string>;
  processTemplaterTemplate(templatePath: string, variables: Record<string, any>): Promise<string>;

  // Variable extraction
  extractTemplateVariables(content: string): TemplateVariable[];
  validateTemplateVariables(variables: Record<string, any>, template: Template): ValidationResult;
}

// Template information
export interface TemplateInfo {
  name: string;
  path: string;
  type: 'native' | 'templater';
  variables: string[];
  description?: string;
}

// File watcher service interface
export interface FileWatcherService {
  // Watcher management
  startWatching(): Promise<void>;
  stopWatching(): Promise<void>;
  isWatching(): boolean;

  // Event handling
  onFileCreated(callback: (filePath: string) => void): void;
  onFileModified(callback: (filePath: string) => void): void;
  onFileDeleted(callback: (filePath: string) => void): void;
  onFileRenamed(callback: (oldPath: string, newPath: string) => void): void;

  // Folder watching
  watchFolder(folderPath: string): Promise<void>;
  unwatchFolder(folderPath: string): Promise<void>;

  // Batch processing
  processPendingChanges(): Promise<void>;
  getChangeQueue(): FileChangeEvent[];
}

// File change event
export interface FileChangeEvent {
  type: 'created' | 'modified' | 'deleted' | 'renamed';
  filePath: string;
  oldPath?: string; // For rename events
  timestamp: Date;
  processed: boolean;
}

// Validation result
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

// Template variable (imported from entities)
import { TemplateVariable } from './entities';

// Data store service interface
export interface DataStoreService {
  // Entity CRUD operations
  createTask(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task>;
  getTask(id: string): Promise<Task | null>;
  updateTask(id: string, updates: Partial<Task>): Promise<Task>;
  deleteTask(id: string): Promise<boolean>;

  createProject(project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project>;
  getProject(id: string): Promise<Project | null>;
  updateProject(id: string, updates: Partial<Project>): Promise<Project>;
  deleteProject(id: string): Promise<boolean>;

  createArea(area: Omit<Area, 'id' | 'createdAt' | 'updatedAt'>): Promise<Area>;
  getArea(id: string): Promise<Area | null>;
  updateArea(id: string, updates: Partial<Area>): Promise<Area>;
  deleteArea(id: string): Promise<boolean>;

  // Querying
  getAllTasks(): Promise<Task[]>;
  getAllProjects(): Promise<Project[]>;
  getAllAreas(): Promise<Area[]>;

  getTasksByProject(projectId: string): Promise<Task[]>;
  getProjectsByArea(areaId: string): Promise<Project[]>;

  // Search and filtering
  searchTasks(query: string): Promise<Task[]>;
  searchProjects(query: string): Promise<Project[]>;
  searchAreas(query: string): Promise<Area[]>;

  filterTasks(filters: Record<string, any>): Promise<Task[]>;
  filterProjects(filters: Record<string, any>): Promise<Project[]>;

  // Synchronization
  syncWithFileSystem(): Promise<SyncResult>;
  getLastSyncTime(): Promise<Date | null>;
}

// Synchronization result
export interface SyncResult {
  success: boolean;
  tasksProcessed: number;
  projectsProcessed: number;
  areasProcessed: number;
  errors: string[];
  warnings: string[];
  duration: number; // milliseconds
}
