/**
 * Obsidian Area Operations
 * Reactive note manager that responds to area domain events by managing corresponding Obsidian notes
 */

import { App } from "obsidian";
import { Area } from "../core/entities";
import { ObsidianEntityOperations } from "./ObsidianEntityOperations";
import { PROPERTY_REGISTRY } from "./obsidian/PropertyRegistry";
import type { TaskSyncSettings } from "../types/settings";

export class ObsidianAreaOperations extends ObsidianEntityOperations<Area> {
  constructor(app: App, settings: TaskSyncSettings) {
    super(app, settings.areasFolder);
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
}
