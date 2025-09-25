/**
 * ProjectFileManager Service
 * Concrete implementation of FileManager for project-specific file operations
 * Handles project file creation, property updates, and project-specific operations
 */

import { App, Vault, TFile } from "obsidian";
import { TaskSyncSettings } from "../main-old";
import { FileManager } from "./FileManager";
import { generateProjectFrontMatter } from "./base-definitions/BaseConfigurations";
import { Project } from "../types/entities";
import { generateProjectFrontMatter as getProjectPropertyDefinitions } from "./base-definitions/BaseConfigurations";

/**
 * Interface for project creation data
 */
export interface ProjectCreationData {
  name: string;
  areas?: string | string[];
  description?: string;
}

/**
 * ProjectFileManager - Handles all project file operations
 * Extends the abstract FileManager with project-specific functionality
 */
export class ProjectFileManager extends FileManager {
  constructor(app: App, vault: Vault, settings: TaskSyncSettings) {
    super(app, vault, settings);
  }

  /**
   * Create a project file with proper front-matter structure
   * @param data - Project creation data
   * @param content - Optional file content. If not provided, reads from template.
   * @returns Path of the created project file
   */
  async createProjectFile(
    data: ProjectCreationData,
    content?: string
  ): Promise<string> {
    const projectFolder = this.settings.projectsFolder;

    // Get content from template if not provided
    let fileContent = content;
    let rawTemplateContent: string | undefined;
    if (!fileContent) {
      // Read raw template content for front-matter extraction
      try {
        rawTemplateContent = await this.readProjectTemplate();
      } catch (error) {
        // Template doesn't exist, use default content
      }
      fileContent = await this.getProjectTemplateContent(data);
    }

    // Process {{tasks}} variable in content
    const processedContent = this.processTasksVariable(fileContent, data.name);

    const filePath = await this.createFile(
      projectFolder,
      data.name,
      processedContent
    );
    const frontMatterData = this.generateProjectFrontMatterObject(
      data,
      rawTemplateContent
    );
    await this.updateFrontMatter(filePath, frontMatterData);

    // Wait for the metadata cache to be updated after front-matter changes
    const file = this.app.vault.getAbstractFileByPath(filePath) as TFile;
    await this.waitForMetadataCache(file);

    return filePath;
  }

  /**
   * Get template content for project creation
   * @param data - Project creation data
   * @returns Template content or default content if template not found
   */
  private async getProjectTemplateContent(
    data: ProjectCreationData
  ): Promise<string> {
    // Try to read template content
    try {
      const templateContent = await this.readProjectTemplate();
      // Extract only the body content (after front-matter) from template
      const bodyContent = this.extractBodyContent(templateContent);
      // Process {{description}} variable in template content
      return this.processDescriptionVariable(bodyContent, data.description);
    } catch (error) {
      // Template doesn't exist - use default content
      return [
        "",
        "## Notes",
        "",
        data.description || "",
        "",
        "## Tasks",
        "",
        "{{tasks}}",
        "",
      ].join("\n");
    }
  }

  /**
   * Extract body content from template (content after front-matter)
   * @param content - Full template content including front-matter
   * @returns Body content without front-matter
   */
  private extractBodyContent(content: string): string {
    // Check if content starts with front-matter
    const frontMatterMatch = content.match(
      /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/
    );
    if (frontMatterMatch) {
      // Return content after front-matter
      return frontMatterMatch[2] || "";
    }
    // No front-matter found, return entire content
    return content;
  }

  /**
   * Read project template content from file
   * @returns Template content
   * @throws Error if template file is not found
   */
  private async readProjectTemplate(): Promise<string> {
    const templateFileName = this.settings.defaultProjectTemplate;
    return await this.readTemplate(templateFileName);
  }

  /**
   * Process {{description}} variable in content and replace with actual description
   * @param content - Content that may contain {{description}} variable
   * @param description - Description to replace the variable with
   * @returns Processed content with {{description}} replaced
   */
  private processDescriptionVariable(
    content: string,
    description?: string
  ): string {
    if (!content.includes("{{description}}")) {
      return content;
    }

    return content.replace(/\{\{description\}\}/g, description || "");
  }

  /**
   * Load a Project entity from an Obsidian TFile
   * @param file - The TFile to load
   * @param cache - Optional metadata cache to use instead of waiting for cache
   * @returns Project entity
   * @throws Error if file is not a valid project
   */
  async loadEntity(file: TFile, cache?: any): Promise<Project> {
    const frontMatter =
      cache?.frontmatter || (await this.waitForMetadataCache(file));

    if (frontMatter.Type !== "Project") {
      return;
    }

    return {
      id: this.generateId(),
      file,
      filePath: file.path,
      name: frontMatter.Name,
      type: frontMatter.Type,
      areas: frontMatter.Areas,
      tags: frontMatter.tags,
    };
  }

  /**
   * Get project properties in the correct order
   * @returns Array of property definitions in the correct order
   */
  getPropertiesInOrder(): any[] {
    return generateProjectFrontMatter();
  }

  /**
   * Update a project file's properties to match current schema and property order
   * @param filePath - Path to the project file
   * @returns Object with hasChanges and propertiesChanged count
   */
  async updateFileProperties(
    filePath: string
  ): Promise<{ hasChanges: boolean; propertiesChanged: number }> {
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (!file) {
      throw new Error(`File not found: ${filePath}`);
    }

    const fullContent = await this.vault.read(file as any);

    // Extract existing front-matter using Obsidian's metadata cache
    const existingFrontMatter = this.app.metadataCache.getFileCache(
      file as TFile
    )?.frontmatter;
    if (!existingFrontMatter) {
      throw new Error(`File ${filePath} has no front-matter`);
    }

    // Check if file has correct Type property for projects
    if (existingFrontMatter.Type && existingFrontMatter.Type !== "Project") {
      throw new Error(
        `File ${filePath} is not a project (Type: ${existingFrontMatter.Type})`
      );
    }

    // Get current schema for projects
    const properties = this.getPropertiesInOrder();
    const currentSchema: Record<string, any> = {};
    const propertyOrder: string[] = [];

    properties.forEach((prop: any) => {
      currentSchema[prop.name] = {
        type: prop.type,
        ...(prop.default !== undefined && { default: prop.default }),
        ...(prop.link && { link: prop.link }),
      };
      propertyOrder.push(prop.name);
    });

    let hasChanges = false;
    let propertiesChanged = 0;
    const updatedFrontMatter = { ...existingFrontMatter };

    // Add missing fields with default values
    for (const [fieldName, fieldConfig] of Object.entries(currentSchema)) {
      if (!(fieldName in updatedFrontMatter)) {
        const config = fieldConfig as any;
        if (config.default === undefined) {
          throw new Error(`Property ${fieldName} has no default value defined`);
        }
        updatedFrontMatter[fieldName] = config.default;
        hasChanges = true;
        propertiesChanged++;
      }
    }

    // Remove obsolete fields (fields not in current schema) - but be conservative
    const validFields = new Set(Object.keys(currentSchema));
    for (const fieldName of Object.keys(updatedFrontMatter)) {
      // Only remove fields that are clearly not part of the schema
      // Keep common fields that might be used by other plugins
      const commonFields = ["tags", "aliases", "cssclass", "publish"];
      if (!validFields.has(fieldName) && !commonFields.includes(fieldName)) {
        delete updatedFrontMatter[fieldName];
        hasChanges = true;
        propertiesChanged++;
      }
    }

    // Check if property order matches schema
    if (
      !hasChanges &&
      !this.isPropertyOrderCorrect(fullContent, currentSchema, propertyOrder)
    ) {
      hasChanges = true;
      propertiesChanged++; // Count order change as one property change
    }

    // Only update the file if there are changes
    if (hasChanges) {
      // Use Obsidian's native processFrontMatter to update with correct order
      await this.app.fileManager.processFrontMatter(
        file as TFile,
        (frontmatter) => {
          // Clear existing properties
          Object.keys(frontmatter).forEach((key) => delete frontmatter[key]);

          // Add properties in correct order
          for (const fieldName of propertyOrder) {
            const value = updatedFrontMatter[fieldName];
            if (value !== undefined) {
              frontmatter[fieldName] = value;
            }
          }

          // Add any additional fields that aren't in the schema but exist in the file
          for (const [key, value] of Object.entries(updatedFrontMatter)) {
            if (!propertyOrder.includes(key)) {
              frontmatter[key] = value;
            }
          }
        }
      );
    }

    return { hasChanges, propertiesChanged };
  }

  /**
   * Generate front-matter object for project files
   * @param data - Project creation data
   * @param templateContent - Template content to extract front-matter from
   * @returns Front-matter object
   */
  private generateProjectFrontMatterObject(
    data: ProjectCreationData,
    templateContent?: string
  ): Record<string, any> {
    const areas = Array.isArray(data.areas)
      ? data.areas
      : data.areas
      ? data.areas.split(",").map((s) => s.trim())
      : [];

    // Start with basic properties
    const frontMatterData: Record<string, any> = {
      Name: data.name,
      Type: "Project",
      Areas: areas,
    };

    // If template content is provided, extract and merge front-matter from it
    if (templateContent) {
      const templateFrontMatter =
        this.extractTemplateFrontMatter(templateContent);
      if (templateFrontMatter) {
        // Merge template front-matter with basic properties
        // Basic properties take precedence over template properties
        Object.assign(templateFrontMatter, frontMatterData);
        return templateFrontMatter;
      }
    }

    return frontMatterData;
  }

  /**
   * Extract front-matter from template content using existing parsing utilities
   * @param content - Template content
   * @returns Parsed front-matter object or null if not found
   */
  private extractTemplateFrontMatter(
    content: string
  ): Record<string, any> | null {
    return this.extractFrontMatterData(content);
  }

  // ============================================================================
  // TEMPLATE MANAGEMENT IMPLEMENTATION
  // ============================================================================

  /**
   * Implementation of abstract method from FileManager
   * Creates project template files
   */
  async createTemplate(filename?: string): Promise<void> {
    await this.createProjectTemplate(filename);
  }

  /**
   * Implementation of abstract method from FileManager
   * Ensures project template exists
   */
  async ensureTemplateExists(): Promise<void> {
    await this.ensureProjectTemplateExists();
  }

  /**
   * Implementation of abstract method from FileManager
   * Projects don't need template property reordering, so return content as-is
   */
  async updateTemplateProperties(content: string): Promise<string> {
    // Projects don't modify existing templates to preserve their structure
    return content;
  }

  /**
   * Create a Project template file with proper front-matter and content
   */
  async createProjectTemplate(filename?: string): Promise<void> {
    const templateFileName = filename || this.settings.defaultProjectTemplate;
    const templatePath = `${this.settings.templateFolder}/${templateFileName}`;

    // Check if file already exists
    const fileExists = await this.vault.adapter.exists(templatePath);
    if (fileExists) {
      throw new Error(
        `Template file ${templateFileName} already exists. Please configure a different file or overwrite the current one.`
      );
    }

    // Generate template content
    const templateContent = this.generateProjectTemplateWithDefaults();

    // Create the template file (Obsidian will create the folder automatically if needed)
    await this.vault.create(templatePath, templateContent);
    console.log(`Created project template: ${templatePath}`);
  }

  /**
   * Ensure project template exists, creating it if missing
   */
  async ensureProjectTemplateExists(): Promise<void> {
    const projectTemplatePath = `${this.settings.templateFolder}/${this.settings.defaultProjectTemplate}`;
    const projectTemplateExists = await this.app.vault.adapter.exists(
      projectTemplatePath
    );

    if (!projectTemplateExists) {
      console.log(
        `Task Sync: Project template '${this.settings.defaultProjectTemplate}' not found, creating it...`
      );
      try {
        await this.createProjectTemplate(this.settings.defaultProjectTemplate);
        console.log(
          `Task Sync: Created project template: ${projectTemplatePath}`
        );
      } catch (error) {
        console.error(`Task Sync: Failed to create project template:`, error);
      }
    }
  }

  /**
   * Generate a project template with default values
   */
  private generateProjectTemplateWithDefaults(): string {
    // Create front-matter structure using property definitions with defaults
    const frontMatterData: Record<string, any> = {};

    // Get project property definitions in the correct order
    const projectProperties = getProjectPropertyDefinitions();

    for (const prop of projectProperties) {
      // Use default values from property definitions
      if (prop.default !== undefined) {
        frontMatterData[prop.name] = prop.default;
      } else if (prop.type === "array") {
        frontMatterData[prop.name] = [];
      } else {
        // Use empty string for properties without defaults
        frontMatterData[prop.name] = "";
      }
    }

    // Always set Type to 'Project' for project templates
    frontMatterData.Type = "Project";

    const baseContent = this.generateFrontMatter(frontMatterData);

    // Add content section with description and tasks variables
    return baseContent + "\n\n{{description}}\n\n## Tasks\n\n{{tasks}}";
  }

  /**
   * Generate front-matter string from data object
   */
  private generateFrontMatter(frontMatterData: Record<string, any>): string {
    const frontMatterLines = ["---"];
    for (const [key, value] of Object.entries(frontMatterData)) {
      if (Array.isArray(value)) {
        frontMatterLines.push(
          `${key}: [${value.map((v) => `"${v}"`).join(", ")}]`
        );
      } else {
        frontMatterLines.push(`${key}: ${value}`);
      }
    }
    frontMatterLines.push("---");
    return frontMatterLines.join("\n");
  }
}
