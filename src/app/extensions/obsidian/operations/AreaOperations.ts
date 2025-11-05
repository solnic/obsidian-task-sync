/**
 * Obsidian Area Operations
 * Reactive note manager that responds to area domain events by managing corresponding Obsidian notes
 */

import { App, TFile } from "obsidian";
import { get } from "svelte/store";
import { Area } from "../../../core/entities";
import { ObsidianEntityOperations } from "./EntityOperations";
import { PROPERTY_REGISTRY } from "../utils/PropertyRegistry";
import type { TaskSyncSettings } from "../../../types/settings";
import type { TypeNote } from "../../../core/type-note/TypeNote";
import { areaStore } from "../../../stores/areaStore";
import { Areas } from "../../../entities/Areas";
import { EntitiesOperations } from "../../../core/entities-base";

export class ObsidianAreaOperations extends ObsidianEntityOperations<Area> {
  private typeNote?: TypeNote;
  private areaOperations: EntitiesOperations;

  constructor(app: App, private settings: TaskSyncSettings) {
    super(app, settings.areasFolder);
    this.areaOperations = new Areas.Operations(settings);
  }

  /**
   * Set TypeNote instance for creating typed notes
   * This is called by ObsidianExtension after TypeNote is initialized
   */
  setTypeNote(typeNote: TypeNote): void {
    this.typeNote = typeNote;
  }

  // Implement abstract method to get entity display name for file naming
  protected getEntityDisplayName(area: Area): string {
    return area.name;
  }

  // Implement abstract methods for area-specific behavior
  protected generateFrontMatter(area: Area): Record<string, any> {
    return {
      [PROPERTY_REGISTRY.NAME.name]: area.name, // Use property name from registry
      [PROPERTY_REGISTRY.TYPE.name]: "Area", // Always "Area" for area entities
      [PROPERTY_REGISTRY.TAGS.name]:
        area.tags && area.tags.length > 0 ? area.tags : undefined,
    };
  }

  protected getEntityType(): string {
    return "Area";
  }

  /**
   * Override createNote to use parent implementation
   * TypeNote integration is disabled for entity notes because:
   * 1. Entity notes need description in content, not front-matter
   * 2. ObsidianEntityOperations already handles front-matter correctly
   */
  async createNote(area: Area): Promise<string> {
    // Always use the parent implementation which handles front-matter correctly
    return await super.createNote(area);
  }

  /**
   * Create an area note using TypeNote
   */
  private async createNoteWithTypeNote(area: Area): Promise<string> {
    const fileName = this.sanitizeFileName(area.name);
    const filePath = `${this.folder}/${fileName}.md`;

    // Prepare properties for TypeNote
    const properties = this.prepareTypeNoteProperties(area);

    // Create the note using TypeNote
    const result = await this.typeNote!.fileManager.createTypedNote("area", {
      folder: this.folder,
      fileName: area.name,
      properties,
      validateProperties: true,
      overwrite: true, // Allow overwriting existing files
    });

    if (!result.success) {
      throw new Error(
        `Failed to create area note: ${
          result.errors?.join(", ") || "Unknown error"
        }`
      );
    }

    // Trigger appropriate event
    const existingFile = this.app.vault.getAbstractFileByPath(filePath);
    if (existingFile) {
      this.trigger("notes.updated", {
        entityId: area.id,
        filePath: result.filePath!,
      });
    } else {
      this.trigger("notes.created", {
        entityId: area.id,
        filePath: result.filePath!,
      });
    }

    return result.filePath!;
  }

  /**
   * Prepare area properties for TypeNote
   * Converts Area entity to TypeNote property format
   */
  private prepareTypeNoteProperties(area: Area): Record<string, any> {
    return {
      name: area.name,
      type: "Area",
      tags: area.tags || [],
      description: area.description || "",
    };
  }

  /**
   * Scan existing area files in the vault
   * Returns array of Area entities parsed from markdown files
   */
  async scanExistingAreas(): Promise<readonly Area[]> {
    console.log(`Scanning areas folder: ${this.folder}`);
    const folder = this.app.vault.getFolderByPath(this.folder);

    if (!folder) {
      console.warn(
        `Areas folder '${this.folder}' does not exist, returning empty array`
      );
      return [];
    }

    const areaFiles = folder.children
      .filter((child) => child instanceof TFile && child.extension === "md")
      .map((child) => child as TFile);

    console.log(
      `Found ${areaFiles.length} .md files in areas folder: ${areaFiles.map(
        (f) => f.path
      )}`
    );

    const areas: Area[] = [];
    const existingAreas = get(areaStore).areas;

    for (const file of areaFiles) {
      try {
        console.log(`Parsing area file: ${file.path}`);
        const areaData = await this.parseFileToAreaData(
          file,
          undefined,
          existingAreas
        );
        if (areaData) {
          console.log(`Successfully parsed area: ${areaData.name}`);
          areas.push(areaData);
        } else {
          console.log(`Skipped file (not an area): ${file.path}`);
        }
      } catch (error) {
        console.error(`Failed to parse area file ${file.path}:`, error);
      }
    }

    console.log(`Scan complete. Found ${areas.length} valid areas`);
    return areas;
  }

  /**
   * Parse a file to Area entity data
   * Returns null if file is not a valid area
   */
  async parseFileToAreaData(
    file: TFile,
    cache?: any,
    existingAreas?: readonly Area[]
  ): Promise<Area | null> {
    const frontMatter =
      cache?.frontmatter || (await this.waitForMetadataCache(file));

    if (frontMatter.Type !== "Area") {
      return null;
    }

    const existingArea = existingAreas?.find(
      (a) => a.source.keys.obsidian === file.path
    );

    const areaData: Omit<Area, "id" | "createdAt" | "updatedAt"> = {
      name: frontMatter.Name || file.basename,
      description: frontMatter.Description || "",
      tags: Array.isArray(frontMatter.Tags) ? frontMatter.Tags : [],
      source: {
        extension: "obsidian",
        keys: {
          obsidian: file.path,
        },
      },
    };

    if (existingArea) {
      return {
        ...this.areaOperations.buildEntity(areaData),
        id: existingArea.id,
        createdAt: existingArea.createdAt,
      } as Area;
    }

    return this.areaOperations.buildEntity(areaData) as Area;
  }

  /**
   * Wait for metadata cache to have front-matter for the given file
   * Uses event-driven approach with periodic polling fallback for robustness
   */
  private async waitForMetadataCache(file: TFile): Promise<any> {
    // Helper function to check if frontmatter is complete (has non-null values)
    const isCompleteFrontmatter = (frontmatter: any): boolean => {
      if (!frontmatter || Object.keys(frontmatter).length === 0) {
        return false;
      }
      // Check if essential properties have non-null values
      // For areas, we expect at least Name and Type to have values
      if (frontmatter.Type === "Area") {
        return frontmatter.Name !== null && frontmatter.Name !== undefined;
      }
      // For other entity types, just check that we have some non-null values
      return Object.values(frontmatter).some(
        (value) => value !== null && value !== undefined
      );
    };

    // First check if metadata is already available and complete
    const existingCache = this.app.metadataCache.getFileCache(file);
    if (
      existingCache?.frontmatter &&
      isCompleteFrontmatter(existingCache.frontmatter)
    ) {
      return existingCache.frontmatter;
    }

    // Use event-driven approach with periodic polling fallback
    return new Promise((resolve, reject) => {
      let resolved = false;
      const pollInterval = 200; // Poll every 200ms
      const maxWaitTime = 10000; // 10 second timeout
      const startTime = Date.now();

      const cleanup = () => {
        resolved = true;
        this.app.metadataCache.off("changed", onMetadataChanged);
        if (pollingTimer) clearInterval(pollingTimer);
      };

      const checkCache = (): boolean => {
        const cache = this.app.metadataCache.getFileCache(file);
        if (cache?.frontmatter && isCompleteFrontmatter(cache.frontmatter)) {
          cleanup();
          resolve(cache.frontmatter);
          return true;
        }
        return false;
      };

      const onMetadataChanged = (
        changedFile: TFile,
        _data: string,
        cache: any
      ) => {
        if (resolved) return;

        if (
          changedFile.path === file.path &&
          cache?.frontmatter &&
          isCompleteFrontmatter(cache.frontmatter)
        ) {
          cleanup();
          resolve(cache.frontmatter);
        }
      };

      // Listen for metadata changes
      this.app.metadataCache.on("changed", onMetadataChanged);

      // Periodic polling as fallback
      const pollingTimer = setInterval(() => {
        if (resolved) return;

        // Check if we've exceeded max wait time
        if (Date.now() - startTime > maxWaitTime) {
          cleanup();
          reject(new Error(`Metadata cache timeout for file: ${file.path}`));
          return;
        }

        // Try to get the cache
        checkCache();
      }, pollInterval);

      // Initial check after a short delay
      setTimeout(() => {
        if (!resolved) checkCache();
      }, 100);
    });
  }
}
