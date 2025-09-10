/**
 * Vault Scanner Service
 * Scans the Obsidian vault for task, project, and area files
 */

import { TFile, TFolder, Vault } from "obsidian";
import {
  VaultScannerService,
  TaskFileInfo,
  ProjectFileInfo,
  AreaFileInfo,
  TemplateFileInfo,
  BaseFileInfo,
  FolderValidationResult,
} from "../types";
import { TaskSyncSettings } from "../main";

export class VaultScanner implements VaultScannerService {
  constructor(
    private vault: Vault,
    private settings: TaskSyncSettings,
  ) {}

  async scanTasksFolder(): Promise<string[]> {
    return this.scanFolder(this.settings.tasksFolder);
  }

  async scanProjectsFolder(): Promise<string[]> {
    return this.scanFolder(this.settings.projectsFolder);
  }

  async scanAreasFolder(): Promise<string[]> {
    return this.scanFolder(this.settings.areasFolder);
  }

  async scanTemplatesFolder(): Promise<string[]> {
    return this.scanFolder(this.settings.templateFolder);
  }

  private async scanFolder(folderPath: string): Promise<string[]> {
    if (!folderPath) return [];

    try {
      const folder = this.vault.getAbstractFileByPath(folderPath);
      if (!folder || !this.isFolder(folder)) {
        return [];
      }

      const files: string[] = [];
      this.collectMarkdownFiles(folder, files);
      return files;
    } catch (error) {
      console.error(`Failed to scan folder ${folderPath}:`, error);
      return [];
    }
  }

  private collectMarkdownFiles(folder: any, files: string[]): void {
    for (const child of folder.children) {
      if (this.isFile(child) && child.extension === "md") {
        files.push(child.path);
      } else if (this.isFolder(child)) {
        this.collectMarkdownFiles(child, files);
      }
    }
  }

  private isFolder(obj: any): boolean {
    return (
      obj &&
      (obj instanceof TFolder ||
        obj.constructor?.name === "TFolder" ||
        obj.children !== undefined)
    );
  }

  private isFile(obj: any): boolean {
    return (
      obj &&
      (obj instanceof TFile ||
        obj.constructor?.name === "TFile" ||
        obj.extension !== undefined)
    );
  }

  async findTaskFiles(): Promise<TaskFileInfo[]> {
    const taskPaths = await this.scanTasksFolder();
    const taskFiles: TaskFileInfo[] = [];

    for (const path of taskPaths) {
      try {
        const fileInfo = await this.getFileInfo(path);
        if (fileInfo) {
          taskFiles.push(fileInfo as TaskFileInfo);
        }
      } catch (error) {
        console.error(`Failed to process task file ${path}:`, error);
      }
    }

    return taskFiles;
  }

  async findProjectFiles(): Promise<ProjectFileInfo[]> {
    const projectPaths = await this.scanProjectsFolder();
    const projectFiles: ProjectFileInfo[] = [];

    for (const path of projectPaths) {
      try {
        const fileInfo = await this.getFileInfo(path);
        if (fileInfo) {
          const projectFile: ProjectFileInfo = {
            ...fileInfo,
            taskFiles: await this.findRelatedTaskFiles(path),
          };
          projectFiles.push(projectFile);
        }
      } catch (error) {
        console.error(`Failed to process project file ${path}:`, error);
      }
    }

    return projectFiles;
  }

  async findAreaFiles(): Promise<AreaFileInfo[]> {
    const areaPaths = await this.scanAreasFolder();
    const areaFiles: AreaFileInfo[] = [];

    for (const path of areaPaths) {
      try {
        const fileInfo = await this.getFileInfo(path);
        if (fileInfo) {
          const areaFile: AreaFileInfo = {
            ...fileInfo,
            projectFiles: await this.findRelatedProjectFiles(path),
          };
          areaFiles.push(areaFile);
        }
      } catch (error) {
        console.error(`Failed to process area file ${path}:`, error);
      }
    }

    return areaFiles;
  }

  async findTemplateFiles(): Promise<TemplateFileInfo[]> {
    const templatePaths = await this.scanTemplatesFolder();
    const templateFiles: TemplateFileInfo[] = [];

    for (const path of templatePaths) {
      try {
        const fileInfo = await this.getFileInfo(path);
        if (fileInfo) {
          const templateFile: TemplateFileInfo = {
            ...fileInfo,
            templateType: this.detectTemplateType(path, fileInfo.content || ""),
            variables: this.extractTemplateVariables(fileInfo.content || ""),
          };
          templateFiles.push(templateFile);
        }
      } catch (error) {
        console.error(`Failed to process template file ${path}:`, error);
      }
    }

    return templateFiles;
  }

  async findBaseFiles(): Promise<BaseFileInfo[]> {
    const allFiles = this.vault.getMarkdownFiles();
    const baseFiles: BaseFileInfo[] = [];

    for (const file of allFiles) {
      if (file.extension === "base" || file.name.endsWith(".base.md")) {
        try {
          const content = await this.vault.read(file);
          const baseFile: BaseFileInfo = {
            path: file.path,
            name: file.name,
            exists: true,
            lastModified: new Date(file.stat.mtime),
            size: file.stat.size,
            content,
            frontmatter: this.extractFrontmatter(content),
            viewType: this.detectBaseViewType(content),
            entityType: this.detectBaseEntityType(content),
            isValid: this.validateBaseFile(content),
            errors: this.getBaseFileErrors(content),
          };
          baseFiles.push(baseFile);
        } catch (error) {
          console.error(`Failed to process base file ${file.path}:`, error);
        }
      }
    }

    return baseFiles;
  }

  async validateFolderStructure(): Promise<FolderValidationResult> {
    const result: FolderValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      missingFolders: [],
      suggestions: [],
    };

    const foldersToCheck = [
      { path: this.settings.tasksFolder, name: "Tasks" },
      { path: this.settings.projectsFolder, name: "Projects" },
      { path: this.settings.areasFolder, name: "Areas" },
      { path: this.settings.templateFolder, name: "Templates" },
    ];

    for (const folder of foldersToCheck) {
      if (!folder.path) {
        result.warnings.push(`${folder.name} folder path is not configured`);
        continue;
      }

      const exists = await this.folderExists(folder.path);
      if (!exists) {
        result.missingFolders.push(folder.path);
        result.errors.push(
          `${folder.name} folder does not exist: ${folder.path}`,
        );
        result.isValid = false;
      }
    }

    // Check for conflicting folder paths
    const paths = foldersToCheck.map((f) => f.path).filter(Boolean);
    const duplicates = paths.filter(
      (path, index) => paths.indexOf(path) !== index,
    );
    if (duplicates.length > 0) {
      result.errors.push(
        `Duplicate folder paths detected: ${duplicates.join(", ")}`,
      );
      result.isValid = false;
    }

    // Add suggestions
    if (result.missingFolders.length > 0) {
      result.suggestions.push(
        "Create missing folders manually in Obsidian - the plugin will work once folders exist",
      );
    }

    return result;
  }

  async createMissingFolders(): Promise<void> {
    // Note: Folder creation removed - Obsidian handles this automatically when files are created
    console.log(
      "Folder creation is handled automatically by Obsidian when files are created",
    );
  }

  private async getFileInfo(path: string): Promise<TaskFileInfo | null> {
    try {
      const file = this.vault.getAbstractFileByPath(path);
      if (!file || !this.isFile(file)) {
        return null;
      }

      const tfile = file as TFile;
      const content = await this.vault.read(tfile);
      return {
        path: tfile.path,
        name: tfile.name,
        exists: true,
        lastModified: new Date(tfile.stat.mtime),
        size: tfile.stat.size,
        content,
        frontmatter: this.extractFrontmatter(content),
      };
    } catch (error) {
      console.error(`Failed to get file info for ${path}:`, error);
      return null;
    }
  }

  private async findRelatedTaskFiles(projectPath: string): Promise<string[]> {
    // Implementation would scan for tasks that reference this project
    // For now, return empty array
    return [];
  }

  private async findRelatedProjectFiles(areaPath: string): Promise<string[]> {
    // Implementation would scan for projects that reference this area
    // For now, return empty array
    return [];
  }

  private detectTemplateType(
    path: string,
    content: string,
  ): "task" | "project" | "area" | "parent-task" {
    const pathLower = path.toLowerCase();
    if (pathLower.includes("parent-task") || pathLower.includes("parent_task"))
      return "parent-task";
    if (pathLower.includes("task")) return "task";
    if (pathLower.includes("project")) return "project";
    if (pathLower.includes("area")) return "area";

    // Analyze content for clues
    const contentLower = content.toLowerCase();
    if (contentLower.includes("sub-tasks") || contentLower.includes("subtasks"))
      return "parent-task";
    if (contentLower.includes("deadline") || contentLower.includes("status"))
      return "task";
    if (
      contentLower.includes("objectives") ||
      contentLower.includes("milestones")
    )
      return "project";

    return "task"; // Default
  }

  private extractTemplateVariables(content: string): string[] {
    const variables: string[] = [];
    const variableRegex = /\{\{([^}]+)\}\}/g;
    let match;

    while ((match = variableRegex.exec(content)) !== null) {
      const variable = match[1].trim();
      if (!variables.includes(variable)) {
        variables.push(variable);
      }
    }

    return variables;
  }

  private detectBaseViewType(
    content: string,
  ): "kanban" | "list" | "calendar" | "timeline" {
    // Analyze content to detect view type
    // For now, default to kanban
    return "kanban";
  }

  private detectBaseEntityType(content: string): "task" | "project" | "area" {
    // Analyze content to detect entity type
    // For now, default to task
    return "task";
  }

  private validateBaseFile(content: string): boolean {
    // Basic validation - check if it has proper base file structure
    return content.includes("```base") || content.includes("view:");
  }

  private getBaseFileErrors(content: string): string[] {
    const errors: string[] = [];

    if (!this.validateBaseFile(content)) {
      errors.push("Invalid base file format");
    }

    return errors;
  }

  private extractFrontmatter(content: string): Record<string, any> {
    const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
    const match = content.match(frontmatterRegex);

    if (!match) return {};

    try {
      // Simple YAML parsing - in production, use a proper YAML parser
      const frontmatterText = match[1];
      const lines = frontmatterText.split("\n");
      const result: Record<string, any> = {};

      for (const line of lines) {
        const colonIndex = line.indexOf(":");
        if (colonIndex > 0) {
          const key = line.substring(0, colonIndex).trim();
          const value = line.substring(colonIndex + 1).trim();
          result[key] = value;
        }
      }

      return result;
    } catch (error) {
      console.error("Failed to parse frontmatter:", error);
      return {};
    }
  }

  private async folderExists(path: string): Promise<boolean> {
    try {
      const folder = this.vault.getAbstractFileByPath(path);
      return this.isFolder(folder);
    } catch {
      return false;
    }
  }
}
