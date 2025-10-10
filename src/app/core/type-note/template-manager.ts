/**
 * TemplateManager - Advanced Template Management for TypeNote
 * Handles core Templates and Templater support, template detection, preference system,
 * template folder management, and template application with property pre-filling
 */

import type { App, Vault } from "obsidian";
import { TFile, TFolder } from "obsidian";
import type { NoteType, Template, TemplateVariable } from "./types";
import type { TypeRegistry } from "./registry";
import { TemplateEngine } from "./template-engine";
import { PropertyProcessor } from "./property-processor";
import type { ValidationResult } from "./validation";
import {
  createValidResult,
  createInvalidResult,
  createValidationError,
} from "./validation";

/**
 * Template provider types
 */
export type TemplateProvider = "core" | "templater";

/**
 * Template detection result
 */
export interface TemplateDetectionResult {
  /** Available template providers */
  providers: TemplateProvider[];

  /** Preferred provider based on settings and availability */
  preferredProvider: TemplateProvider;

  /** Whether Templater plugin is available */
  templaterAvailable: boolean;

  /** Template folder exists */
  templateFolderExists: boolean;

  /** Available template files */
  templateFiles: TFile[];
}

/**
 * Template application options
 */
export interface TemplateApplicationOptions {
  /** Template provider to use */
  provider?: TemplateProvider;

  /** Properties to pre-fill */
  properties?: Record<string, any>;

  /** Target file path for the new note */
  targetPath?: string;

  /** Whether to validate properties before application */
  validateProperties?: boolean;

  /** Whether to apply transformations */
  applyTransformations?: boolean;
}

/**
 * Template application result
 */
export interface TemplateApplicationResult {
  /** Whether application was successful */
  success: boolean;

  /** Generated content */
  content?: string;

  /** File path where content was created */
  filePath?: string;

  /** Provider used for template processing */
  providerUsed?: TemplateProvider;

  /** Validation errors */
  errors?: string[];

  /** Warnings */
  warnings?: string[];
}

/**
 * Template preference settings
 */
export interface TemplatePreferences {
  /** Preferred template provider */
  preferredProvider: TemplateProvider;

  /** Whether to use Templater when available */
  useTemplaterWhenAvailable: boolean;

  /** Template folder path */
  templateFolder: string;

  /** Whether to auto-detect templates */
  autoDetectTemplates: boolean;

  /** Whether to show template update notifications */
  showUpdateNotifications: boolean;
}

/**
 * TemplateManager handles advanced template management with support for
 * both core Templates and Templater plugin
 */
export class TemplateManager {
  private app: App;
  private vault: Vault;
  private registry: TypeRegistry;
  private templateEngine: TemplateEngine;
  private propertyProcessor: PropertyProcessor;
  private preferences: TemplatePreferences;

  constructor(
    app: App,
    registry: TypeRegistry,
    preferences: TemplatePreferences
  ) {
    this.app = app;
    this.vault = app.vault;
    this.registry = registry;
    this.templateEngine = new TemplateEngine();
    this.propertyProcessor = new PropertyProcessor();
    this.preferences = preferences;
  }

  /**
   * Detect available template providers and capabilities
   */
  async detectTemplateProviders(): Promise<TemplateDetectionResult> {
    const providers: TemplateProvider[] = ["core"];

    // Check if Templater plugin is available
    const templaterPlugin = (this.app as any).plugins?.getPlugin(
      "templater-obsidian"
    );
    const templaterAvailable =
      templaterPlugin !== null && templaterPlugin?.enabled;

    if (templaterAvailable) {
      providers.push("templater");
    }

    // Check template folder
    const templateFolder = this.vault.getAbstractFileByPath(
      this.preferences.templateFolder
    );
    const templateFolderExists = templateFolder instanceof TFolder;

    // Get template files
    const templateFiles: TFile[] = [];
    if (templateFolderExists) {
      const files = this.vault.getMarkdownFiles();
      templateFiles.push(
        ...files.filter((file) =>
          file.path.startsWith(this.preferences.templateFolder)
        )
      );
    }

    // Determine preferred provider
    let preferredProvider: TemplateProvider =
      this.preferences.preferredProvider;
    if (this.preferences.useTemplaterWhenAvailable && templaterAvailable) {
      preferredProvider = "templater";
    } else if (!providers.includes(preferredProvider)) {
      preferredProvider = "core";
    }

    return {
      providers,
      preferredProvider,
      templaterAvailable,
      templateFolderExists,
      templateFiles,
    };
  }

  /**
   * Get template for note type with provider preference
   */
  async getTemplateForNoteType(
    noteTypeId: string,
    provider?: TemplateProvider
  ): Promise<Template | null> {
    const noteType = this.registry.get(noteTypeId);
    if (!noteType) {
      return null;
    }

    const detection = await this.detectTemplateProviders();
    const useProvider = provider || detection.preferredProvider;

    // For now, return the note type's built-in template
    // In the future, this could check for external template files
    return noteType.template;
  }

  /**
   * Apply template to create new note with property pre-filling
   */
  async applyTemplate(
    noteTypeId: string,
    options: TemplateApplicationOptions = {}
  ): Promise<TemplateApplicationResult> {
    const {
      provider,
      properties = {},
      targetPath,
      validateProperties = true,
      applyTransformations = true,
    } = options;

    try {
      // Get note type
      const noteType = this.registry.get(noteTypeId);
      if (!noteType) {
        return {
          success: false,
          errors: [`Note type "${noteTypeId}" not found`],
        };
      }

      // Get template
      const template = await this.getTemplateForNoteType(noteTypeId, provider);
      if (!template) {
        return {
          success: false,
          errors: [`No template found for note type "${noteTypeId}"`],
        };
      }

      // Process properties if provided
      let processedProperties = properties;
      if (Object.keys(properties).length > 0) {
        const propertyResult = this.propertyProcessor.process(
          noteType,
          properties,
          {
            validateRequired: validateProperties,
            applyTransformations,
            useDefaults: true,
          }
        );

        if (!propertyResult.valid) {
          return {
            success: false,
            errors: propertyResult.errors.map((e) => e.message),
            warnings: propertyResult.warnings.map((w) => w.message),
          };
        }

        processedProperties = propertyResult.properties;
      }

      // Determine provider to use
      const detection = await this.detectTemplateProviders();
      const useProvider = provider || detection.preferredProvider;

      // Apply template based on provider
      let content: string;
      if (useProvider === "templater" && detection.templaterAvailable) {
        content = await this.applyTemplaterTemplate(
          template,
          processedProperties
        );
      } else {
        content = await this.applyCoreTemplate(template, processedProperties);
      }

      // Create file if target path is provided
      let filePath: string | undefined;
      if (targetPath) {
        await this.vault.create(targetPath, content);
        filePath = targetPath;
      }

      return {
        success: true,
        content,
        filePath,
        providerUsed: useProvider,
      };
    } catch (error) {
      return {
        success: false,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  /**
   * Apply template using core template engine
   */
  private async applyCoreTemplate(
    template: Template,
    properties: Record<string, any>
  ): Promise<string> {
    const result = this.templateEngine.process(template, {
      variables: properties,
      noteType: undefined, // Will be set by caller if needed
    });

    if (!result.success) {
      throw new Error(
        `Template processing failed: ${result.errors
          .map((e) => e.message)
          .join(", ")}`
      );
    }

    return result.content;
  }

  /**
   * Apply template using Templater plugin
   */
  private async applyTemplaterTemplate(
    template: Template,
    properties: Record<string, any>
  ): Promise<string> {
    // Get Templater plugin
    const templaterPlugin = (this.app as any).plugins?.getPlugin(
      "templater-obsidian"
    );
    if (!templaterPlugin) {
      throw new Error("Templater plugin not available");
    }

    // For now, fall back to core template processing
    // In a full implementation, this would use Templater's API
    return this.applyCoreTemplate(template, properties);
  }

  /**
   * Update template preferences
   */
  updatePreferences(preferences: Partial<TemplatePreferences>): void {
    this.preferences = { ...this.preferences, ...preferences };
  }

  /**
   * Get current template preferences
   */
  getPreferences(): TemplatePreferences {
    return { ...this.preferences };
  }

  /**
   * Create or update template file for a note type
   * Generates a template file with front-matter based on note type properties
   * Also creates a versioned copy in .versions/{key}/{version}/ directory
   */
  async createTemplateFile(noteType: NoteType): Promise<void> {
    // Generate template file path
    const templatePath = `${this.preferences.templateFolder}/${noteType.name}.md`;

    // Generate template content with front-matter
    const templateContent = this.generateTemplateContent(noteType);

    // Check if template file already exists
    const existingFile = this.vault.getAbstractFileByPath(templatePath);

    if (existingFile instanceof TFile) {
      // Update existing template file
      await this.vault.modify(existingFile, templateContent);
    } else {
      // Create new template file (vault.create will create parent folders automatically)
      await this.vault.create(templatePath, templateContent);
    }

    // Create versioned copy
    try {
      await this.createVersionedTemplate(noteType, templateContent);
    } catch (error) {
      console.error("Failed to create versioned template:", error);
      // Don't throw - versioned template is optional
    }
  }

  /**
   * Create a versioned copy of the template
   * Stores template in .versions/{key}/{version}/ directory
   */
  private async createVersionedTemplate(
    noteType: NoteType,
    templateContent: string
  ): Promise<void> {
    // Generate key from id (lowercase)
    const key = noteType.id.toLowerCase();

    // Generate versioned template path
    const versionedPath = `${this.preferences.templateFolder}/.versions/${key}/${noteType.version}/${noteType.name}.md`;

    // Check if versioned template already exists
    const existingVersionedFile =
      this.vault.getAbstractFileByPath(versionedPath);

    if (existingVersionedFile instanceof TFile) {
      // Update existing versioned template
      await this.vault.modify(existingVersionedFile, templateContent);
    } else {
      // Ensure parent directories exist
      const versionedDir = `${this.preferences.templateFolder}/.versions/${key}/${noteType.version}`;
      await this.ensureDirectoryExists(versionedDir);

      // Create new versioned template
      await this.vault.create(versionedPath, templateContent);
    }
  }

  /**
   * Ensure a directory exists, creating it and parent directories if needed
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    const existingDir = this.vault.getAbstractFileByPath(dirPath);
    if (existingDir) {
      return; // Directory already exists
    }

    // Split path and create directories from root to leaf
    const parts = dirPath.split("/");
    let currentPath = "";

    for (const part of parts) {
      if (!part) continue; // Skip empty parts

      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const existing = this.vault.getAbstractFileByPath(currentPath);

      if (!existing) {
        try {
          await this.vault.createFolder(currentPath);
        } catch (error) {
          // Ignore error if folder already exists (race condition)
          if (!error.message?.includes("already exists")) {
            throw error;
          }
        }
      }
    }
  }

  /**
   * Generate template content with front-matter for a note type
   */
  private generateTemplateContent(noteType: NoteType): string {
    const frontMatterLines: string[] = ["---"];

    // Add properties to front-matter
    Object.entries(noteType.properties).forEach(([key, property]) => {
      const frontMatterKey = property.frontMatterKey || property.name;
      // Use template variable syntax for property values
      frontMatterLines.push(`${frontMatterKey}: {{${key}}}`);
    });

    frontMatterLines.push("---");
    frontMatterLines.push("");

    // Add empty content section
    frontMatterLines.push("# {{title}}");
    frontMatterLines.push("");

    return frontMatterLines.join("\n");
  }

  /**
   * Scan template folder for changes and update notifications
   */
  async scanTemplateFolder(): Promise<{
    newTemplates: TFile[];
    updatedTemplates: TFile[];
    removedTemplates: string[];
  }> {
    const detection = await this.detectTemplateProviders();

    // For now, return empty results
    // In a full implementation, this would track template changes
    return {
      newTemplates: [],
      updatedTemplates: [],
      removedTemplates: [],
    };
  }

  /**
   * Validate template folder structure
   */
  async validateTemplateFolder(): Promise<ValidationResult> {
    const templateFolder = this.vault.getAbstractFileByPath(
      this.preferences.templateFolder
    );

    if (!templateFolder) {
      return createInvalidResult([
        createValidationError(
          `Template folder "${this.preferences.templateFolder}" does not exist`,
          "TEMPLATE_FOLDER_NOT_FOUND"
        ),
      ]);
    }

    if (!(templateFolder instanceof TFolder)) {
      return createInvalidResult([
        createValidationError(
          `Template path "${this.preferences.templateFolder}" is not a folder`,
          "TEMPLATE_PATH_NOT_FOLDER"
        ),
      ]);
    }

    return createValidResult({});
  }
}
