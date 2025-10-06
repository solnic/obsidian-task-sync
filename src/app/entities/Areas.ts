/**
 * Areas entity with Queries and Operations
 * Implements the abstract base pattern for area management
 */

import { get } from "svelte/store";
import { Area } from "../core/entities";
import {
  Entities,
  EntitiesQueries,
  EntitiesOperations,
} from "../core/entities-base";
import { areaStore as store } from "../stores/areaStore";
import { eventBus } from "../core/events";

export class Areas extends Entities {
  protected entityType = "area" as const;

  static Queries = class AreaQueries extends EntitiesQueries {
    public entityType = "area" as const;

    async getAll(): Promise<readonly Area[]> {
      return get(store).areas;
    }

    async getById(id: string): Promise<Area | null> {
      const area = get(store).areas.find((a) => a.id === id);
      return area || null;
    }

    async getByExtension(extensionId: string): Promise<readonly Area[]> {
      return get(store).areas.filter(
        (a) => a.source?.extension === extensionId
      );
    }

    // Area-specific query methods
    async search(query: string): Promise<readonly Area[]> {
      const searchTerm = query.toLowerCase();
      return get(store).areas.filter(
        (a) =>
          a.name.toLowerCase().includes(searchTerm) ||
          a.description?.toLowerCase().includes(searchTerm) ||
          a.tags.some((tag) => tag.toLowerCase().includes(searchTerm))
      );
    }

    async getByTag(tag: string): Promise<readonly Area[]> {
      return get(store).areas.filter((a) => a.tags.includes(tag));
    }

    async getAllTags(): Promise<readonly string[]> {
      const allTags = new Set<string>();
      get(store).areas.forEach((area) => {
        area.tags.forEach((tag) => allTags.add(tag));
      });
      return Array.from(allTags).sort();
    }
  };

  static Operations = class AreaOperations extends EntitiesOperations {
    public entityType = "area" as const;

    async create(
      areaData: Omit<Area, "id" | "createdAt" | "updatedAt">
    ): Promise<Area> {
      // buildEntity now handles schema validation and date coercion
      const area = this.buildEntity(areaData) as Area;

      store.addArea(area);

      eventBus.trigger({ type: "areas.created", area });

      return area;
    }

    async update(area: Area): Promise<Area> {
      const updatedArea: Area = { ...area, updatedAt: this.timestamp() };

      store.updateArea(updatedArea);

      eventBus.trigger({ type: "areas.updated", area: updatedArea });

      return updatedArea;
    }

    async delete(id: string): Promise<void> {
      store.removeArea(id);
      eventBus.trigger({ type: "areas.deleted", areaId: id });
    }

    async rename(areaId: string, newName: string): Promise<void> {
      const area = await new Areas.Queries().getById(areaId);
      if (area) {
        await this.update({
          ...area,
          name: newName,
        });
      }
    }
  };
}

// Singleton operations removed - operations must be instantiated with settings
// Use Areas.Operations and Areas.Queries classes directly
