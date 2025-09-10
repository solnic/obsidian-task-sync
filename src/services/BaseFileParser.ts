/**
 * Base File Parser Service
 * Parses and creates .base files for Obsidian Bases plugin integration
 * Uses gray-matter for frontmatter parsing and js-yaml for YAML parsing
 */

import { BaseFile } from "../types";
import matter from "gray-matter";
import * as yaml from "js-yaml";

export class BaseFileParser {
  /**
   * Parse a .base file content into a BaseFile object
   */
  parseBaseFile(content: string, filePath: string): BaseFile {
    // Use gray-matter to parse frontmatter and content
    const parsed = matter(content);

    const baseFile: Partial<BaseFile> = {
      id: this.generateId(),
      filePath,
      fileExists: true,
      entityIds: [],
      autoGenerate: false,
      autoUpdate: false,
    };

    // Parse frontmatter data
    this.parseFrontmatterData(parsed.data, baseFile);

    // Parse markdown content for code blocks and inline properties
    this.parseMarkdownContent(parsed.content, baseFile);

    // Set defaults
    baseFile.viewType = baseFile.viewType || "kanban";
    baseFile.entityType = baseFile.entityType || "task";
    baseFile.filters = baseFile.filters || [];
    baseFile.sorting = baseFile.sorting || { field: "name", direction: "asc" };

    return baseFile as BaseFile;
  }

  /**
   * Generate a .base file content from a BaseFile object
   */
  generateBaseFile(baseFile: BaseFile, entities: any[]): string {
    const lines: string[] = [];

    // Add frontmatter
    lines.push("---");
    lines.push(`view: ${baseFile.viewType}`);
    lines.push(`type: ${baseFile.entityType}`);
    if (baseFile.autoGenerate) {
      lines.push("auto-generate: true");
    }
    if (baseFile.autoUpdate) {
      lines.push("auto-update: true");
    }
    lines.push("---");
    lines.push("");

    // Build base configuration object
    const config: Record<string, any> = {
      view: baseFile.viewType,
      type: baseFile.entityType,
    };

    // Add filters if present
    if (baseFile.filters && baseFile.filters.length > 0) {
      config.filters = baseFile.filters
        .filter((filter) => filter.enabled)
        .map((filter) => ({
          field: filter.field,
          operator: filter.operator,
          value: filter.value,
        }));
    }

    // Add sorting if present
    if (baseFile.sorting) {
      config.sort = {
        field: baseFile.sorting.field,
        direction: baseFile.sorting.direction,
      };

      if (baseFile.sorting.secondary) {
        config.sort.secondary = {
          field: baseFile.sorting.secondary.field,
          direction: baseFile.sorting.secondary.direction,
        };
      }
    }

    // Add grouping if present
    if (baseFile.grouping) {
      config.group = {
        field: baseFile.grouping.field,
        showEmpty: baseFile.grouping.showEmpty,
      };

      if (baseFile.grouping.customOrder) {
        config.group.customOrder = baseFile.grouping.customOrder;
      }
    }

    // Generate YAML for the base configuration
    lines.push("```base");
    const yamlContent = yaml.dump(config, {
      indent: 2,
      lineWidth: -1,
      noRefs: true,
    });
    lines.push(yamlContent.trim());
    lines.push("```");
    lines.push("");

    // Add entity references
    if (entities && entities.length > 0) {
      lines.push("## Items");
      lines.push("");
      for (const entity of entities) {
        if (entity.filePath) {
          lines.push(`- [[${entity.name}]]`);
        }
      }
    }

    return lines.join("\n");
  }

  /**
   * Validate a .base file content
   */
  validateBaseFile(content: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for required sections
    if (!content.includes("```base")) {
      errors.push("Missing base configuration block");
    }

    // Check for valid view type
    const viewMatch = content.match(/view:\s*([^\s\n]+)/);
    if (viewMatch) {
      const viewType = viewMatch[1];
      if (!["kanban", "list", "calendar", "timeline"].includes(viewType)) {
        errors.push(`Invalid view type: ${viewType}`);
      }
    }

    // Check for valid entity type
    const typeMatch = content.match(/type:\s*([^\s\n]+)/);
    if (typeMatch) {
      const entityType = typeMatch[1];
      if (!["task", "project", "area"].includes(entityType)) {
        errors.push(`Invalid entity type: ${entityType}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Parse frontmatter data object into BaseFile properties
   */
  private parseFrontmatterData(
    data: Record<string, any>,
    baseFile: Partial<BaseFile>
  ): void {
    if (data.title) {
      // Skip name property as it's not part of BaseFile interface
    }
    if (data.view) {
      baseFile.viewType = this.parseViewTypeValue(data.view);
    }
    if (data.type) {
      baseFile.entityType = this.parseEntityTypeValue(data.type);
    }
    if (data["auto-generate"] !== undefined) {
      baseFile.autoGenerate = Boolean(data["auto-generate"]);
    }
    if (data["auto-update"] !== undefined) {
      baseFile.autoUpdate = Boolean(data["auto-update"]);
    }
    if (data.description) {
      // Skip description property as it's not part of BaseFile interface
    }
  }

  /**
   * Parse markdown content for base configuration code blocks
   */
  private parseMarkdownContent(
    content: string,
    baseFile: Partial<BaseFile>
  ): void {
    // Extract base configuration from ```base code blocks
    const baseCodeBlockRegex = /```base\s*\n([\s\S]*?)\n```/g;
    let match;

    while ((match = baseCodeBlockRegex.exec(content)) !== null) {
      const yamlContent = match[1];
      this.parseBaseConfiguration(yamlContent, baseFile);
    }
  }

  /**
   * Parse base configuration YAML content
   */
  private parseBaseConfiguration(
    yamlContent: string,
    baseFile: Partial<BaseFile>
  ): void {
    try {
      const config = yaml.load(yamlContent) as Record<string, any>;

      if (config.view) {
        baseFile.viewType = this.parseViewTypeValue(config.view);
      }

      if (config.type) {
        baseFile.entityType = this.parseEntityTypeValue(config.type);
      }

      if (config.filters && Array.isArray(config.filters)) {
        baseFile.filters = config.filters.map((filter) => ({
          field: String(filter.field || ""),
          operator: filter.operator || "equals",
          value: filter.value,
          enabled: filter.enabled !== false,
        }));
      }

      if (config.sort) {
        baseFile.sorting = {
          field: String(config.sort.field || "name"),
          direction: config.sort.direction === "desc" ? "desc" : "asc",
        };

        if (config.sort.secondary) {
          baseFile.sorting.secondary = {
            field: String(config.sort.secondary.field),
            direction:
              config.sort.secondary.direction === "desc" ? "desc" : "asc",
          };
        }
      }

      if (config.group) {
        baseFile.grouping = {
          field: String(config.group.field),
          showEmpty: config.group.showEmpty !== false,
          customOrder: Array.isArray(config.group.customOrder)
            ? config.group.customOrder.map(String)
            : undefined,
        };
      }
    } catch (error) {
      console.warn("Failed to parse base configuration YAML:", error);
    }
  }

  private parseViewTypeValue(
    value: any
  ): "kanban" | "list" | "calendar" | "timeline" {
    const viewType = String(value).toLowerCase();

    if (["kanban", "list", "calendar", "timeline"].includes(viewType)) {
      return viewType as "kanban" | "list" | "calendar" | "timeline";
    }

    return "kanban"; // default
  }

  private parseEntityTypeValue(value: any): "task" | "project" | "area" {
    const entityType = String(value).toLowerCase();

    if (["task", "project", "area"].includes(entityType)) {
      return entityType as "task" | "project" | "area";
    }

    return "task"; // default
  }

  private extractNameFromPath(filePath: string): string {
    const fileName = filePath.split("/").pop() || "";
    return fileName.replace(/\.(base\.)?md$/, "");
  }

  private generateId(): string {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  }
}
