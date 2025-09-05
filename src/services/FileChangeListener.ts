/**
 * FileChangeListener Service
 * Monitors file changes using Obsidian's vault API and emits relevant events
 */

import { App, TFile, Vault, parseFrontMatterEntry } from 'obsidian';
import { EventManager, EventType, StatusChangedEventData, DoneChangedEventData, TaskEventData } from '../events';
import { TaskSyncSettings } from '../components/ui/settings';

/**
 * Interface for tracking file state
 */
interface FileState {
  path: string;
  frontmatter: Record<string, any>;
  lastModified: number;
}

/**
 * Service that listens for file changes and emits appropriate events
 */
export class FileChangeListener {
  private fileStates: Map<string, FileState> = new Map();
  private isInitialized: boolean = false;
  private processingFiles: Set<string> = new Set();

  constructor(
    private app: App,
    private vault: Vault,
    private eventManager: EventManager,
    private settings: TaskSyncSettings
  ) { }

  /**
   * Initialize the file change listener
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    console.log('FileChangeListener: Initializing...');

    // Register vault event listeners
    this.vault.on('modify', this.onFileModified.bind(this));
    this.vault.on('create', this.onFileCreated.bind(this));
    this.vault.on('delete', this.onFileDeleted.bind(this));
    this.vault.on('rename', this.onFileRenamed.bind(this));

    // Initialize file states for existing files
    await this.initializeFileStates();

    this.isInitialized = true;
    console.log('FileChangeListener: Initialized successfully');
  }

  /**
   * Cleanup the file change listener
   */
  cleanup(): void {
    if (!this.isInitialized) {
      return;
    }

    console.log('FileChangeListener: Cleaning up...');

    // Remove vault event listeners
    this.vault.off('modify', this.onFileModified.bind(this));
    this.vault.off('create', this.onFileCreated.bind(this));
    this.vault.off('delete', this.onFileDeleted.bind(this));
    this.vault.off('rename', this.onFileRenamed.bind(this));

    // Clear state
    this.fileStates.clear();
    this.processingFiles.clear();
    this.isInitialized = false;

    console.log('FileChangeListener: Cleanup complete');
  }

  /**
   * Initialize file states for existing files
   */
  private async initializeFileStates(): Promise<void> {
    const relevantFiles = this.getRelevantFiles();

    for (const file of relevantFiles) {
      try {
        const fileState = await this.createFileState(file);
        if (fileState) {
          this.fileStates.set(file.path, fileState);
        }
      } catch (error) {
        console.error(`FileChangeListener: Error initializing state for ${file.path}:`, error);
      }
    }

    console.log(`FileChangeListener: Initialized ${this.fileStates.size} file states`);
  }

  /**
   * Get all files that are relevant for monitoring
   */
  private getRelevantFiles(): TFile[] {
    const allFiles = this.vault.getMarkdownFiles();

    return allFiles.filter(file => {
      // Ensure we only process actual files, not directories
      if (!(file instanceof TFile)) {
        return false;
      }

      const path = file.path;
      return (
        path.startsWith(this.settings.tasksFolder + '/') ||
        path.startsWith(this.settings.projectsFolder + '/') ||
        path.startsWith(this.settings.areasFolder + '/')
      );
    });
  }

  /**
   * Create a file state object for a file
   */
  private async createFileState(file: TFile): Promise<FileState | null> {
    try {
      // Additional check for file extension
      if (!file.path.endsWith('.md')) {
        console.warn(`FileChangeListener: Skipping non-markdown file: ${file.path}`);
        return null;
      }

      const content = await this.vault.read(file);
      const frontmatter = this.parseFrontmatter(content);

      return {
        path: file.path,
        frontmatter,
        lastModified: file.stat.mtime
      };
    } catch (error) {
      // Check if this is a directory error
      if (error.code === 'EISDIR') {
        console.warn(`FileChangeListener: Skipping directory: ${file.path}`);
        return null;
      }
      console.error(`FileChangeListener: Error creating file state for ${file.path}:`, error);
      return null;
    }
  }

  /**
   * Parse frontmatter from file content
   */
  private parseFrontmatter(content: string): Record<string, any> {
    try {
      const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
      const match = content.match(frontmatterRegex);

      if (!match) {
        return {};
      }

      const frontmatterText = match[1];
      const frontmatter: Record<string, any> = {};

      // Parse each line of frontmatter
      const lines = frontmatterText.split('\n');
      for (const line of lines) {
        const colonIndex = line.indexOf(':');
        if (colonIndex !== -1) {
          const key = line.substring(0, colonIndex).trim();
          const value = line.substring(colonIndex + 1).trim();

          // Simple parsing instead of using parseFrontMatterEntry which seems to be problematic
          let parsedValue: any = value;

          // Handle boolean values
          if (value === 'true') {
            parsedValue = true;
          } else if (value === 'false') {
            parsedValue = false;
          } else if (value === '') {
            parsedValue = '';
          } else {
            parsedValue = value;
          }

          frontmatter[key] = parsedValue;
        }
      }
      return frontmatter;
    } catch (error) {
      console.error('FileChangeListener: Error parsing frontmatter:', error);
      return {};
    }
  }

  /**
   * Handle file modification events
   */
  private async onFileModified(file: TFile): Promise<void> {
    if (!this.isRelevantFile(file)) {
      return;
    }

    if (this.processingFiles.has(file.path)) {
      return;
    }

    this.processingFiles.add(file.path);

    try {
      const newFileState = await this.createFileState(file);
      if (!newFileState) {
        return;
      }

      const oldFileState = this.fileStates.get(file.path);

      if (oldFileState) {
        // Compare states and emit events for changes
        await this.compareAndEmitEvents(oldFileState, newFileState);
      }

      // Update stored state
      this.fileStates.set(file.path, newFileState);

    } catch (error) {
      console.error(`FileChangeListener: Error processing file modification for ${file.path}:`, error);
    } finally {
      this.processingFiles.delete(file.path);
    }
  }

  /**
   * Handle file creation events
   */
  private async onFileCreated(file: TFile): Promise<void> {
    if (!this.isRelevantFile(file)) {
      return;
    }

    try {
      const fileState = await this.createFileState(file);
      if (fileState) {
        this.fileStates.set(file.path, fileState);

        // Emit creation event
        const entityType = this.getEntityType(file.path);
        const eventData: TaskEventData = {
          filePath: file.path,
          taskName: file.basename,
          frontmatter: fileState.frontmatter
        };

        await this.eventManager.emit(
          entityType === 'task' ? EventType.TASK_CREATED :
            entityType === 'project' ? EventType.PROJECT_CREATED :
              EventType.AREA_CREATED,
          eventData
        );
      }
    } catch (error) {
      console.error(`FileChangeListener: Error processing file creation for ${file.path}:`, error);
    }
  }

  /**
   * Handle file deletion events
   */
  private async onFileDeleted(file: TFile): Promise<void> {
    if (!this.isRelevantFile(file)) {
      return;
    }

    try {
      const oldFileState = this.fileStates.get(file.path);
      if (oldFileState) {
        // Emit deletion event
        const entityType = this.getEntityType(file.path);
        const eventData: TaskEventData = {
          filePath: file.path,
          taskName: file.basename,
          frontmatter: oldFileState.frontmatter
        };

        await this.eventManager.emit(
          entityType === 'task' ? EventType.TASK_DELETED :
            entityType === 'project' ? EventType.PROJECT_DELETED :
              EventType.AREA_DELETED,
          eventData
        );

        // Remove from state
        this.fileStates.delete(file.path);
      }
    } catch (error) {
      console.error(`FileChangeListener: Error processing file deletion for ${file.path}:`, error);
    }
  }

  /**
   * Handle file rename events
   */
  private async onFileRenamed(file: TFile, oldPath: string): Promise<void> {
    if (!this.isRelevantFile(file) && !this.isRelevantPath(oldPath)) {
      return;
    }

    try {
      // Update file state with new path
      const oldFileState = this.fileStates.get(oldPath);
      if (oldFileState) {
        this.fileStates.delete(oldPath);

        if (this.isRelevantFile(file)) {
          const newFileState = await this.createFileState(file);
          if (newFileState) {
            this.fileStates.set(file.path, newFileState);
          }
        }
      }
    } catch (error) {
      console.error(`FileChangeListener: Error processing file rename from ${oldPath} to ${file.path}:`, error);
    }
  }

  /**
   * Compare old and new file states and emit appropriate events
   */
  private async compareAndEmitEvents(oldState: FileState, newState: FileState): Promise<void> {
    const oldFrontmatter = oldState.frontmatter;
    const newFrontmatter = newState.frontmatter;

    // Check for Status changes
    const oldStatus = oldFrontmatter.Status;
    const newStatus = newFrontmatter.Status;

    if (oldStatus !== newStatus) {
      const eventData: StatusChangedEventData = {
        filePath: newState.path,
        oldStatus,
        newStatus,
        frontmatter: newFrontmatter,
        entityType: this.getEntityType(newState.path)
      };

      await this.eventManager.emit(EventType.STATUS_CHANGED, eventData);
    }

    // Check for Done changes
    const oldDone = oldFrontmatter.Done;
    const newDone = newFrontmatter.Done;

    if (oldDone !== newDone) {
      console.log(`FileChangeListener: Done changed in ${newState.path} from ${oldDone} to ${newDone}`);
      const eventData: DoneChangedEventData = {
        filePath: newState.path,
        oldDone,
        newDone,
        frontmatter: newFrontmatter,
        entityType: this.getEntityType(newState.path)
      };

      await this.eventManager.emit(EventType.DONE_CHANGED, eventData);
    }
  }

  /**
   * Check if a file is relevant for monitoring
   */
  private isRelevantFile(file: TFile): boolean {
    return this.isRelevantPath(file.path);
  }

  /**
   * Check if a path is relevant for monitoring
   */
  private isRelevantPath(path: string): boolean {
    return (
      path.startsWith(this.settings.tasksFolder + '/') ||
      path.startsWith(this.settings.projectsFolder + '/') ||
      path.startsWith(this.settings.areasFolder + '/')
    );
  }

  /**
   * Get the entity type based on file path
   */
  private getEntityType(path: string): 'task' | 'project' | 'area' {
    if (path.startsWith(this.settings.tasksFolder + '/')) {
      return 'task';
    } else if (path.startsWith(this.settings.projectsFolder + '/')) {
      return 'project';
    } else {
      return 'area';
    }
  }

  /**
   * Get statistics about the file change listener (for debugging/testing)
   */
  getStats(): { trackedFiles: number; processingFiles: number } {
    return {
      trackedFiles: this.fileStates.size,
      processingFiles: this.processingFiles.size
    };
  }


}
