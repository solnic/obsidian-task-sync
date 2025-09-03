/**
 * BaseManager Service
 * Manages Obsidian Bases files - creates, updates, and maintains base configurations
 * with proper properties and views for task management
 */

import { App, Vault, TFile } from 'obsidian';
import { TaskSyncSettings } from '../main';
import * as yaml from 'js-yaml';

export interface BaseProperty {
  displayName: string;
  type?: string;
}

export interface BaseView {
  type: 'table' | 'kanban' | 'calendar';
  name: string;
  filters?: {
    and?: Array<string>;
    or?: Array<string>;
  };
  order?: string[];
  sort?: Array<{
    property: string;
    direction: 'ASC' | 'DESC';
  }>;
  columnSize?: Record<string, number>;
}

export interface BaseConfig {
  properties: Record<string, BaseProperty>;
  views: BaseView[];
}

export interface ProjectAreaInfo {
  name: string;
  path: string;
  type: 'project' | 'area';
}

export class BaseManager {
  constructor(
    private app: App,
    private vault: Vault,
    private settings: TaskSyncSettings
  ) { }

  /**
   * Generate the main Tasks.base file with all task properties and default views
   */
  async generateTasksBase(projectsAndAreas: ProjectAreaInfo[]): Promise<string> {
    const baseConfig: BaseConfig = {
      properties: {
        'file.name': {
          displayName: 'Title'
        },
        'note.Status': {
          displayName: 'Done'
        },
        'file.ctime': {
          displayName: 'Created At'
        },
        'file.mtime': {
          displayName: 'Updated At'
        },
        'note.tags': {
          displayName: 'Tags'
        },
        'note.title': {
          displayName: 'Title'
        },
        'note.Type': {
          displayName: 'Type'
        },
        'note.Areas': {
          displayName: 'Areas'
        },
        'note.Project': {
          displayName: 'Project'
        },
        'note.Priority': {
          displayName: 'Priority'
        },
        'note.Parent task': {
          displayName: 'Parent task'
        },
        'note.Sub-tasks': {
          displayName: 'Sub-tasks'
        }
      },
      views: []
    };

    // Add default "All" view
    baseConfig.views.push({
      type: 'table',
      name: 'All',
      filters: {
        and: [`file.folder == "${this.settings.tasksFolder}"`]
      },
      order: [
        'Done',
        'file.name',
        'Areas',
        'Project',
        'Parent task',
        'Sub-tasks',
        'Type',
        'tags',
        'file.ctime',
        'file.mtime'
      ],
      sort: [
        { property: 'tags', direction: 'ASC' },
        { property: 'file.name', direction: 'DESC' }
      ],
      columnSize: {
        'note.Type': 103,
        'note.tags': 259,
        'file.ctime': 183
      }
    });

    // Add views for each project and area
    for (const item of projectsAndAreas) {
      if (item.type === 'project') {
        baseConfig.views.push(this.createProjectView(item));
      } else if (item.type === 'area') {
        baseConfig.views.push(this.createAreaView(item));
      }
    }

    return this.serializeBaseConfig(baseConfig);
  }

  /**
   * Create a filtered view for a specific project
   */
  private createProjectView(project: ProjectAreaInfo): BaseView {
    return {
      type: 'table',
      name: project.name,
      filters: {
        and: [
          `file.folder == "${this.settings.tasksFolder}"`,
          `Project.contains(link("${project.name}"))`
        ]
      },
      order: [
        'Done',
        'file.name',
        'Type',
        'tags',
        'file.mtime',
        'file.ctime'
      ],
      sort: [
        { property: 'file.ctime', direction: 'DESC' },
        { property: 'file.name', direction: 'ASC' }
      ],
      columnSize: {
        'file.name': 440,
        'note.Type': 103,
        'note.tags': 338,
        'file.ctime': 183
      }
    };
  }

  /**
   * Create a filtered view for a specific area
   */
  private createAreaView(area: ProjectAreaInfo): BaseView {
    return {
      type: 'table',
      name: area.name,
      filters: {
        and: [
          `file.folder == "${this.settings.tasksFolder}"`,
          `Areas.contains(link("${area.path}", "${area.name}"))`
        ]
      },
      order: [
        'Status',
        'file.name',
        'tags',
        'file.mtime',
        'file.ctime',
        'Project'
      ],
      sort: [
        { property: 'file.mtime', direction: 'ASC' },
        { property: 'file.name', direction: 'ASC' }
      ],
      columnSize: {
        'file.name': 382,
        'note.tags': 134,
        'file.mtime': 165,
        'file.ctime': 183
      }
    };
  }

  /**
   * Serialize base configuration to YAML format
   */
  private serializeBaseConfig(config: BaseConfig): string {
    return yaml.dump(config, {
      indent: 2,
      lineWidth: -1,
      noRefs: true,
      sortKeys: false
    });
  }

  /**
   * Parse existing base file content
   */
  async parseBaseFile(content: string): Promise<BaseConfig | null> {
    try {
      return yaml.load(content) as BaseConfig;
    } catch (error) {
      console.error('Failed to parse base file:', error);
      return null;
    }
  }

  /**
   * Create or update the Tasks.base file
   */
  async createOrUpdateTasksBase(projectsAndAreas: ProjectAreaInfo[]): Promise<void> {
    const baseFilePath = `${this.settings.basesFolder}/${this.settings.tasksBaseFile}`;
    const content = await this.generateTasksBase(projectsAndAreas);

    try {
      // Check if file exists
      const existingFile = this.vault.getAbstractFileByPath(baseFilePath);

      if (existingFile instanceof TFile) {
        // Update existing file
        await this.vault.modify(existingFile, content);
        console.log(`Updated Tasks base file: ${baseFilePath}`);
      } else {
        // Create new file
        await this.vault.create(baseFilePath, content);
        console.log(`Created Tasks base file: ${baseFilePath}`);
      }
    } catch (error) {
      console.error(`Failed to create/update Tasks base file: ${error}`);
      throw error;
    }
  }

  /**
   * Ensure the bases folder exists
   */
  async ensureBasesFolder(): Promise<void> {
    const folderExists = await this.vault.adapter.exists(this.settings.basesFolder);
    if (!folderExists) {
      await this.vault.createFolder(this.settings.basesFolder);
      console.log(`Created bases folder: ${this.settings.basesFolder}`);
    }
  }

  /**
   * Add base embedding to project/area files if missing
   */
  async ensureBaseEmbedding(filePath: string): Promise<void> {
    try {
      const file = this.vault.getAbstractFileByPath(filePath);
      if (!(file instanceof TFile)) return;

      const content = await this.vault.read(file);

      // Check if any base embedding already exists
      const anyBasePattern = /!\[\[.*\.base\]\]/;
      if (anyBasePattern.test(content)) {
        return; // Already has some base embedding, don't add another
      }

      // Only add Tasks.base if no base embedding exists at all
      const updatedContent = content.trim() + '\n\n## Tasks\n![[Tasks.base]]';
      await this.vault.modify(file, updatedContent);
      console.log(`Added base embedding to: ${filePath}`);
    } catch (error) {
      console.error(`Failed to add base embedding to ${filePath}:`, error);
    }
  }

  /**
   * Get all projects and areas for base view generation
   */
  async getProjectsAndAreas(): Promise<ProjectAreaInfo[]> {
    const items: ProjectAreaInfo[] = [];

    // Scan projects folder for files with Type: Project
    try {
      const projectsFolder = this.vault.getAbstractFileByPath(this.settings.projectsFolder);
      if (projectsFolder) {
        const projectFiles = this.vault.getMarkdownFiles().filter(file =>
          file.path.startsWith(this.settings.projectsFolder + '/')
        );

        for (const file of projectFiles) {
          const cache = this.app.metadataCache.getFileCache(file);
          const frontmatter = cache?.frontmatter;

          // Only include files with Type: Project
          if (frontmatter?.Type === 'Project') {
            items.push({
              name: file.basename,
              path: file.path,
              type: 'project'
            });
          }
        }
      }
    } catch (error) {
      console.error('Failed to scan projects folder:', error);
    }

    // Scan areas folder for files with Type: Area
    try {
      const areasFolder = this.vault.getAbstractFileByPath(this.settings.areasFolder);
      if (areasFolder) {
        const areaFiles = this.vault.getMarkdownFiles().filter(file =>
          file.path.startsWith(this.settings.areasFolder + '/')
        );

        for (const file of areaFiles) {
          const cache = this.app.metadataCache.getFileCache(file);
          const frontmatter = cache?.frontmatter;

          // Only include files with Type: Area
          if (frontmatter?.Type === 'Area') {
            items.push({
              name: file.basename,
              path: file.path,
              type: 'area'
            });
          }
        }
      }
    } catch (error) {
      console.error('Failed to scan areas folder:', error);
    }

    return items;
  }

  /**
   * Sync area and project bases when settings change
   */
  async syncAreaProjectBases(): Promise<void> {
    if (!this.settings.areaBasesEnabled && !this.settings.projectBasesEnabled) {
      console.log('Area and project bases are disabled, skipping sync');
      return;
    }

    const projectsAndAreas = await this.getProjectsAndAreas();

    // Create individual bases for areas if enabled
    if (this.settings.areaBasesEnabled) {
      const areas = projectsAndAreas.filter(item => item.type === 'area');
      for (const area of areas) {
        await this.createOrUpdateAreaBase(area);
      }
    }

    // Create individual bases for projects if enabled
    if (this.settings.projectBasesEnabled) {
      const projects = projectsAndAreas.filter(item => item.type === 'project');
      for (const project of projects) {
        await this.createOrUpdateProjectBase(project);
      }
    }

    console.log('Area and project bases synced successfully');
  }

  /**
   * Create or update an individual area base file
   */
  async createOrUpdateAreaBase(area: ProjectAreaInfo): Promise<void> {
    const baseFileName = `${area.name}.base`;
    const baseFilePath = `${this.settings.basesFolder}/${baseFileName}`;
    const content = await this.generateAreaBase(area);

    try {
      const existingFile = this.vault.getAbstractFileByPath(baseFilePath);

      if (existingFile instanceof TFile) {
        await this.vault.modify(existingFile, content);
        console.log(`Updated area base file: ${baseFilePath}`);
      } else {
        await this.vault.create(baseFilePath, content);
        console.log(`Created area base file: ${baseFilePath}`);
      }

      // Update the area file to embed the specific base
      await this.ensureSpecificBaseEmbedding(area.path, baseFileName);
    } catch (error) {
      console.error(`Failed to create/update area base file: ${error}`);
      throw error;
    }
  }

  /**
   * Create or update an individual project base file
   */
  async createOrUpdateProjectBase(project: ProjectAreaInfo): Promise<void> {
    const baseFileName = `${project.name}.base`;
    const baseFilePath = `${this.settings.basesFolder}/${baseFileName}`;
    const content = await this.generateProjectBase(project);

    try {
      const existingFile = this.vault.getAbstractFileByPath(baseFilePath);

      if (existingFile instanceof TFile) {
        await this.vault.modify(existingFile, content);
        console.log(`Updated project base file: ${baseFilePath}`);
      } else {
        await this.vault.create(baseFilePath, content);
        console.log(`Created project base file: ${baseFilePath}`);
      }

      // Update the project file to embed the specific base
      await this.ensureSpecificBaseEmbedding(project.path, baseFileName);
    } catch (error) {
      console.error(`Failed to create/update project base file: ${error}`);
      throw error;
    }
  }

  /**
   * Generate base configuration for a specific area
   */
  async generateAreaBase(area: ProjectAreaInfo): Promise<string> {
    const baseConfig: BaseConfig = {
      properties: {
        'file.name': {
          displayName: 'Title'
        },
        'note.Done': {
          displayName: 'Done'
        },
        'note.Type': {
          displayName: 'Type'
        },
        'note.Project': {
          displayName: 'Project'
        },
        'file.ctime': {
          displayName: 'Created At'
        },
        'file.mtime': {
          displayName: 'Updated At'
        }
      },
      views: []
    };

    // Add main Tasks view
    baseConfig.views.push({
      type: 'table',
      name: 'Tasks',
      filters: {
        and: [
          `file.folder == "${this.settings.tasksFolder}"`,
          `Areas.contains(link("${area.path}", "${area.name}"))`
        ]
      },
      order: [
        'Done',
        'file.name',
        'Project',
        'Type',
        'file.ctime',
        'file.mtime'
      ],
      sort: [
        { property: 'file.mtime', direction: 'DESC' },
        { property: 'file.name', direction: 'ASC' }
      ]
    });

    // Add type-specific views
    for (const taskType of this.settings.taskTypes) {
      if (taskType !== 'Task') { // Skip generic 'Task' type for specific views
        baseConfig.views.push({
          type: 'table',
          name: taskType + 's',
          filters: {
            and: [
              `file.folder == "${this.settings.tasksFolder}"`,
              `Areas.contains(link("${area.path}", "${area.name}"))`,
              `Type == "${taskType}"`
            ]
          },
          order: [
            'Done',
            'file.name',
            'Project',
            'file.ctime',
            'file.mtime'
          ],
          sort: [
            { property: 'file.mtime', direction: 'DESC' },
            { property: 'file.name', direction: 'ASC' }
          ]
        });
      }
    }

    return this.serializeBaseConfig(baseConfig);
  }

  /**
   * Generate base configuration for a specific project
   */
  async generateProjectBase(project: ProjectAreaInfo): Promise<string> {
    const baseConfig: BaseConfig = {
      properties: {
        'file.name': {
          displayName: 'Title'
        },
        'note.Done': {
          displayName: 'Done'
        },
        'note.Type': {
          displayName: 'Type'
        },
        'note.Areas': {
          displayName: 'Areas'
        },
        'file.ctime': {
          displayName: 'Created At'
        },
        'file.mtime': {
          displayName: 'Updated At'
        }
      },
      views: []
    };

    // Add main Tasks view
    baseConfig.views.push({
      type: 'table',
      name: 'Tasks',
      filters: {
        and: [
          `file.folder == "${this.settings.tasksFolder}"`,
          `Project.contains(link("${project.path}", "${project.name}"))`
        ]
      },
      order: [
        'Done',
        'file.name',
        'Areas',
        'Type',
        'file.ctime',
        'file.mtime'
      ],
      sort: [
        { property: 'file.mtime', direction: 'DESC' },
        { property: 'file.name', direction: 'ASC' }
      ]
    });

    // Add type-specific views
    for (const taskType of this.settings.taskTypes) {
      if (taskType !== 'Task') { // Skip generic 'Task' type for specific views
        baseConfig.views.push({
          type: 'table',
          name: taskType + 's',
          filters: {
            and: [
              `file.folder == "${this.settings.tasksFolder}"`,
              `Project.contains(link("${project.path}", "${project.name}"))`,
              `Type == "${taskType}"`
            ]
          },
          order: [
            'Done',
            'file.name',
            'Areas',
            'file.ctime',
            'file.mtime'
          ],
          sort: [
            { property: 'file.mtime', direction: 'DESC' },
            { property: 'file.name', direction: 'ASC' }
          ]
        });
      }
    }

    return this.serializeBaseConfig(baseConfig);
  }

  /**
   * Ensure specific base embedding in area/project files
   */
  async ensureSpecificBaseEmbedding(filePath: string, baseFileName: string): Promise<void> {
    try {
      const file = this.vault.getAbstractFileByPath(filePath);
      if (!(file instanceof TFile)) return;

      const content = await this.vault.read(file);
      const specificBasePattern = new RegExp(`!\\[\\[${baseFileName}\\]\\]`);

      // If the specific base embed already exists, we're done
      if (specificBasePattern.test(content)) {
        return;
      }

      let updatedContent = content;

      // Remove any existing base embeds to prevent duplicates
      const allBasePatterns = [
        /!\[\[Tasks\.base\]\]/g,
        /!\[\[.*\.base\]\]/g
      ];

      for (const pattern of allBasePatterns) {
        updatedContent = updatedContent.replace(pattern, '');
      }

      // Clean up any empty "## Tasks" sections that might be left
      updatedContent = updatedContent.replace(/## Tasks\s*\n\s*\n/g, '');

      // Add the specific base embedding
      if (!updatedContent.trim().endsWith('## Tasks')) {
        updatedContent = updatedContent.trim() + `\n\n## Tasks\n![[${baseFileName}]]`;
      } else {
        updatedContent = updatedContent.trim() + `\n![[${baseFileName}]]`;
      }

      await this.vault.modify(file, updatedContent);
      console.log(`Updated base embedding to ${baseFileName} in: ${filePath}`);
    } catch (error) {
      console.error(`Failed to update base embedding in ${filePath}:`, error);
    }
  }
}
