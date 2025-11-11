/**
 * BasesIntegration - Obsidian Bases Integration for NoteKit
 * Automatically creates Obsidian Bases from NoteKit note types
 */

import type { App, Vault } from "obsidian";
import { TFile } from "obsidian";
import type { NoteType, PropertyType } from "./types";
import type { TypeRegistry } from "./registry";
import * as yaml from "js-yaml";

/**
 * Mapping between NoteKit property types and Obsidian Base property types
 */
export const TYPE_NOTE_TO_BASE_TYPE_MAP: Record<
  PropertyType,
  BasePropertyType
> = {
  string: "text",
  number: "number",
  boolean: "checkbox",
  date: "date",
  array: "list",
  enum: "text", // Enums are stored as text in basesm,
  select: "list",
} as const;

/**
 * Base property type definitions
 */
export type BasePropertyType = "text" | "number" | "checkbox" | "date" | "list";

/**
 * Base property definition
 */
export interface BaseProperty {
  name: string;
  type: BasePropertyType;
  source?: string;
  default?: any;
  link?: boolean;
}

/**
 * Base view definition
 */
export interface BaseView {
  type: string;
  name: string;
  filters?: any;
  order?: string[];
  sort?: Array<{ property: string; direction: string }>;
  columnSize?: Record<string, number>;
}

/**
 * Base configuration
 */
export interface BaseConfig {
  formulas?: Record<string, string>;
  properties?: Record<string, BaseProperty>;
  views?: BaseView[];
}

/**
 * Base creation options
 */
export interface BaseCreationOptions {
  generateViews?: boolean;
  viewTypes?: string[];
  folderPath?: string;
  includeFormulas?: boolean;
}

/**
 * Base creation result
 */
export interface BaseCreationResult {
  success: boolean;
  baseFileName?: string;
  baseFilePath?: string;
  viewsGenerated?: number;
  errors?: string[];
}

/**
 * BasesIntegration handles automatic creation of Obsidian Bases from NoteKit note types
 */
export class BasesIntegration {
  private vault: Vault;
  private registry: TypeRegistry;

  constructor(app: App, registry: TypeRegistry) {
    this.vault = app.vault;
    this.registry = registry;
  }

  /**
   * Map NoteKit property type to Base property type
   */
  mapTypeNoteTypeToBaseType(typeNoteType: PropertyType): BasePropertyType {
    return TYPE_NOTE_TO_BASE_TYPE_MAP[typeNoteType];
  }

  /**
   * Create Obsidian Base from NoteKit note type
   */
  async createBaseFromNoteType(
    noteTypeId: string,
    options: BaseCreationOptions = {}
  ): Promise<BaseCreationResult> {
    try {
      // Get the note type from registry
      const noteType = this.registry.get(noteTypeId);
      if (!noteType) {
        return {
          success: false,
          errors: [`Note type "${noteTypeId}" not found in registry`],
        };
      }

      // Generate base configuration
      const baseConfig = this.generateBaseConfig(noteType, options);

      // Create base file
      const baseFileName = `${noteTypeId}.base`;
      const baseFilePath = options.folderPath
        ? `${options.folderPath}/${baseFileName}`
        : baseFileName;

      // Convert config to YAML
      const yamlContent = yaml.dump(baseConfig, {
        indent: 2,
        lineWidth: -1,
        noRefs: true,
      });

      // Create or update the base file
      const existingFile = this.vault.getAbstractFileByPath(baseFilePath);
      if (existingFile && existingFile instanceof TFile) {
        await this.vault.modify(existingFile, yamlContent);
      } else {
        await this.vault.create(baseFilePath, yamlContent);
      }

      return {
        success: true,
        baseFileName,
        baseFilePath,
        viewsGenerated: baseConfig.views?.length || 0,
      };
    } catch (error) {
      return {
        success: false,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  /**
   * Generate base configuration from note type
   */
  private generateBaseConfig(
    noteType: NoteType,
    options: BaseCreationOptions
  ): BaseConfig {
    const config: BaseConfig = {
      properties: {},
    };

    // Add formulas if requested
    if (options.includeFormulas) {
      config.formulas = {
        Title: `link(file.name, Title)`,
      };
    }

    // Convert NoteKit properties to base properties
    for (const [, propertyDef] of Object.entries(noteType.properties)) {
      const baseType = this.mapTypeNoteTypeToBaseType(propertyDef.type);

      const baseProperty: BaseProperty = {
        name: propertyDef.name,
        type: baseType,
      };

      // Add optional fields from PropertyDefinition
      if (propertyDef.source !== undefined) {
        baseProperty.source = propertyDef.source;
      }

      if (propertyDef.link !== undefined) {
        baseProperty.link = propertyDef.link;
      }

      if (propertyDef.defaultValue !== undefined) {
        baseProperty.default = propertyDef.defaultValue;
      }

      config.properties![propertyDef.frontMatterKey] = baseProperty;
    }

    // Add standard metadata properties
    config.properties!["file.ctime"] = {
      name: "Created At",
      type: "date",
      source: "file.ctime",
    };

    config.properties!["file.mtime"] = {
      name: "Updated At",
      type: "date",
      source: "file.mtime",
    };

    // Generate views if requested
    if (options.generateViews) {
      config.views = this.generateViews(noteType, options);
    }

    return config;
  }

  /**
   * Generate views for the base
   */
  private generateViews(
    noteType: NoteType,
    options: BaseCreationOptions
  ): BaseView[] {
    const views: BaseView[] = [];
    const viewTypes = options.viewTypes || ["table"];

    // Get property names for ordering
    const propertyNames = Object.values(noteType.properties).map(
      (p) => p.frontMatterKey
    );

    if (viewTypes.includes("table")) {
      // Main table view
      views.push({
        type: "table",
        name: noteType.name,
        order: ["Title", ...propertyNames, "Created At", "Updated At"],
        sort: [{ property: "Created At", direction: "desc" }],
      });
    }

    if (viewTypes.includes("priority-filtered")) {
      // Look for priority-like properties to create filtered views
      const priorityProperty = Object.values(noteType.properties).find(
        (p) =>
          p.key.toLowerCase().includes("priority") ||
          p.name.toLowerCase().includes("priority")
      );

      if (priorityProperty) {
        const priorities = ["Low", "Medium", "High", "Urgent"];
        for (const priority of priorities) {
          views.push({
            type: "table",
            name: `${noteType.name} • ${priority} priority`,
            filters: {
              and: [
                {
                  [`note["${priorityProperty.frontMatterKey}"]`]: `== "${priority}"`,
                },
              ],
            },
            order: ["Title", ...propertyNames, "Created At", "Updated At"],
            sort: [
              { property: priorityProperty.frontMatterKey, direction: "asc" },
              { property: "Created At", direction: "desc" },
            ],
          });
        }
      }
    }

    return views;
  }

  /**
   * Update existing base from note type
   */
  async updateBaseFromNoteType(
    noteTypeId: string,
    options: BaseCreationOptions = {}
  ): Promise<BaseCreationResult> {
    // For now, updating is the same as creating (overwrites)
    return this.createBaseFromNoteType(noteTypeId, options);
  }

  /**
   * Delete base file for note type
   */
  async deleteBaseForNoteType(
    noteTypeId: string,
    folderPath?: string
  ): Promise<boolean> {
    try {
      const baseFileName = `${noteTypeId}.base`;
      const baseFilePath = folderPath
        ? `${folderPath}/${baseFileName}`
        : baseFileName;

      const file = this.vault.getAbstractFileByPath(baseFilePath);
      if (file) {
        await this.vault.delete(file);
        return true;
      }

      return false; // File didn't exist
    } catch (error) {
      console.error(
        `Failed to delete base for note type ${noteTypeId}:`,
        error
      );
      return false;
    }
  }
}
