/**
 * Obsidian Area Operations
 * Reactive note manager that responds to area domain events by managing corresponding Obsidian notes
 */

import { App } from "obsidian";
import { Area } from "../core/entities";
import { ObsidianEntityOperations } from "./ObsidianEntityOperations";

export class ObsidianAreaOperations extends ObsidianEntityOperations<Area> {
  constructor(app: App, folder: string) {
    super(app, folder);
  }

  // Implement abstract methods for area-specific behavior
  protected generateFrontMatter(area: Area): Record<string, any> {
    return {
      Name: area.name,
      Type: "Area",
      tags: area.tags.length > 0 ? area.tags : undefined,
    };
  }

  protected getEntityType(): string {
    return "Area";
  }
}
