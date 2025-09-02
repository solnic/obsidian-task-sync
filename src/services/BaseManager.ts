/**
 * BaseManager Service
 * Manages Obsidian Bases files - creates, updates, and maintains base configurations
 * with proper properties and views for task management
 */

import { Vault, TFile } from 'obsidian';
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
    private vault: Vault,
    private settings: TaskSyncSettings
  ) {}

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
      const baseEmbedPattern = /!\[\[Tasks\.base\]\]/;
      
      if (!baseEmbedPattern.test(content)) {
        // Add base embedding at the end
        const updatedContent = content.trim() + '\n\n## Tasks\n![[Tasks.base]]';
        await this.vault.modify(file, updatedContent);
        console.log(`Added base embedding to: ${filePath}`);
      }
    } catch (error) {
      console.error(`Failed to add base embedding to ${filePath}:`, error);
    }
  }

  /**
   * Get all projects and areas for base view generation
   */
  async getProjectsAndAreas(): Promise<ProjectAreaInfo[]> {
    const items: ProjectAreaInfo[] = [];

    // Scan projects folder
    try {
      const projectsFolder = this.vault.getAbstractFileByPath(this.settings.projectsFolder);
      if (projectsFolder) {
        const projectFiles = this.vault.getMarkdownFiles().filter(file => 
          file.path.startsWith(this.settings.projectsFolder + '/')
        );
        
        for (const file of projectFiles) {
          items.push({
            name: file.basename,
            path: file.path,
            type: 'project'
          });
        }
      }
    } catch (error) {
      console.error('Failed to scan projects folder:', error);
    }

    // Scan areas folder
    try {
      const areasFolder = this.vault.getAbstractFileByPath(this.settings.areasFolder);
      if (areasFolder) {
        const areaFiles = this.vault.getMarkdownFiles().filter(file => 
          file.path.startsWith(this.settings.areasFolder + '/')
        );
        
        for (const file of areaFiles) {
          items.push({
            name: file.basename,
            path: file.path,
            type: 'area'
          });
        }
      }
    } catch (error) {
      console.error('Failed to scan areas folder:', error);
    }

    return items;
  }
}
