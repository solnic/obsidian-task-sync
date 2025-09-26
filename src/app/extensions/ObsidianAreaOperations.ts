/**
 * Obsidian Area Operations
 * Implements EntityOperations interface for Area entities in Obsidian vault
 */

import {
  App,
  TFile,
  getFrontMatterInfo,
  parseYaml,
  stringifyYaml,
} from "obsidian";
import { EntityOperations } from "../core/extension";
import { Area, AreaSchema } from "../core/entities";
import { eventBus } from "../core/events";
import { generateId } from "../utils/idGenerator";

export class ObsidianAreaOperations implements EntityOperations<Area> {
  constructor(private app: App, private folder: string) {}

  async getAll(): Promise<Area[]> {
    const files = this.app.vault
      .getMarkdownFiles()
      .filter((f) => f.path.startsWith(this.folder + "/"));

    const areas: Area[] = [];

    for (const file of files) {
      try {
        const area = await this.loadAreaFromFile(file);
        if (area) {
          areas.push(area);
        }
      } catch (error) {
        console.warn(`Failed to load area from ${file.path}:`, error);
      }
    }

    return areas;
  }

  async getById(id: string): Promise<Area | undefined> {
    // Since IDs are generated fresh each time, we need to find by file path
    // The ID lookup is not reliable in this system - use getByFilePath instead
    // This method is kept for interface compatibility but may not work as expected
    const areas = await this.getAll();
    return areas.find((area) => area.id === id);
  }

  async getByFilePath(filePath: string): Promise<Area | undefined> {
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (file instanceof this.app.vault.adapter.constructor) {
      return undefined;
    }

    try {
      return await this.loadAreaFromFile(file as any);
    } catch (error) {
      console.warn(`Failed to load area from ${filePath}:`, error);
      return undefined;
    }
  }

  async create(
    areaData: Omit<Area, "id" | "createdAt" | "updatedAt">
  ): Promise<Area> {
    const now = new Date();
    const area: Area = {
      ...areaData,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
      source: {
        extension: "obsidian",
        source: `${this.folder}/${areaData.name}.md`,
      },
    };

    await this.saveAreaToFile(area);
    eventBus.trigger({ type: "areas.created", area, extension: "obsidian" });
    return area;
  }

  async update(id: string, updates: Partial<Area>): Promise<Area> {
    // Find the area by checking all areas (since IDs are transient)
    const areas = await this.getAll();
    const existingArea = areas.find((area) => area.id === id);

    if (!existingArea) {
      throw new Error(`Area with id ${id} not found`);
    }

    const updatedArea: Area = {
      ...existingArea,
      ...updates,
      id: generateId(), // Generate fresh ID as per old system pattern
      updatedAt: new Date(),
    };

    await this.saveAreaToFile(updatedArea);
    eventBus.trigger({
      type: "areas.updated",
      area: updatedArea,
      changes: updates,
      extension: "obsidian",
    });
    return updatedArea;
  }

  async delete(id: string): Promise<boolean> {
    // Find the area by checking all areas (since IDs are transient)
    const areas = await this.getAll();
    const area = areas.find((area) => area.id === id);

    if (!area) {
      return false;
    }

    const filePath = area.source?.source || `${this.folder}/${area.name}.md`;
    const file = this.app.vault.getAbstractFileByPath(filePath);

    if (file instanceof TFile) {
      await this.app.vault.delete(file);
      eventBus.trigger({
        type: "areas.deleted",
        areaId: id,
        extension: "obsidian",
      });
      return true;
    }

    return false;
  }

  // Private helper methods
  private async saveAreaToFile(area: Area): Promise<void> {
    const fileName = this.sanitizeFileName(area.name);
    const filePath = `${this.folder}/${fileName}.md`;

    // Convert area to front-matter (only store user-visible properties)
    const frontMatter = {
      Name: area.name,
      Type: "Area",
      tags: area.tags.length > 0 ? area.tags : undefined,
    };

    // Remove undefined values safely
    const cleanedFrontMatter = Object.fromEntries(
      Object.entries(frontMatter).filter(([_, value]) => value !== undefined)
    );

    const frontMatterYaml = stringifyYaml(cleanedFrontMatter);
    const content = `---\n${frontMatterYaml}---\n\n${area.description || ""}`;

    const existingFile = this.app.vault.getAbstractFileByPath(
      filePath
    ) as TFile;

    if (existingFile) {
      await this.app.vault.modify(existingFile, content);
    } else {
      await this.app.vault.create(filePath, content);
    }
  }

  private async loadAreaFromFile(file: TFile): Promise<Area | null> {
    try {
      const content = await this.app.vault.read(file);
      const frontMatterInfo = getFrontMatterInfo(content);

      if (!frontMatterInfo.exists) {
        return null;
      }

      const frontMatter = parseYaml(frontMatterInfo.frontmatter);

      // Validate this is an area file
      if (frontMatter.Type !== "Area" || !frontMatter.Name) {
        return null;
      }

      const body = content.substring(frontMatterInfo.contentStart).trim();

      // Generate a fresh ULID each time (following old system pattern)
      // File path in source.source is used for mapping back to the file
      return AreaSchema.parse({
        id: generateId(), // Fresh ULID generated each time entity is loaded
        name: frontMatter.Name,
        description: body || undefined,
        tags: frontMatter.tags || [],
        createdAt: new Date(file.stat.ctime),
        updatedAt: new Date(file.stat.mtime),
        source: {
          extension: "obsidian",
          source: file.path,
        },
      });
    } catch (error) {
      console.warn(`Failed to load area from ${file.path}:`, error);
      return null;
    }
  }

  private sanitizeFileName(name: string): string {
    // Basic sanitization - remove invalid characters
    return name.replace(/[<>:"/\\|?*]/g, "").trim();
  }
}
