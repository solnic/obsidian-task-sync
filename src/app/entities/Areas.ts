/**
 * Areas entity with Queries and Operations
 * Implements the abstract base pattern for area management
 */

import { Area } from "../core/entities";
import {
  Entities,
  EntitiesQueries,
  EntitiesOperations,
} from "../core/entities-base";
import { areaStore } from "../stores/areaStore";
import { eventBus } from "../core/events";

export class Areas extends Entities {
  protected entityType = "area" as const;

  static Queries = class AreaQueries extends EntitiesQueries {
    public entityType = "area" as const;

    async getAll(): Promise<readonly Area[]> {
      return new Promise((resolve) => {
        const unsubscribe = areaStore.subscribe((state) => {
          resolve(state.areas);
          unsubscribe();
        });
      });
    }

    async getById(id: string): Promise<Area | null> {
      return new Promise((resolve) => {
        const unsubscribe = areaStore.subscribe((state) => {
          const area = state.areas.find((a) => a.id === id);
          resolve(area || null);
          unsubscribe();
        });
      });
    }

    async getByExtension(extensionId: string): Promise<readonly Area[]> {
      return new Promise((resolve) => {
        const unsubscribe = areaStore.subscribe((state) => {
          const areas = state.areas.filter(
            (a) => a.source?.extension === extensionId
          );
          resolve(areas);
          unsubscribe();
        });
      });
    }

    // Area-specific query methods
    async search(query: string): Promise<readonly Area[]> {
      const searchTerm = query.toLowerCase();
      return new Promise((resolve) => {
        const unsubscribe = areaStore.subscribe((state) => {
          const areas = state.areas.filter(
            (a) =>
              a.name.toLowerCase().includes(searchTerm) ||
              a.description?.toLowerCase().includes(searchTerm) ||
              a.tags.some((tag) => tag.toLowerCase().includes(searchTerm))
          );
          resolve(areas);
          unsubscribe();
        });
      });
    }

    async getByTag(tag: string): Promise<readonly Area[]> {
      return new Promise((resolve) => {
        const unsubscribe = areaStore.subscribe((state) => {
          const areas = state.areas.filter((a) => a.tags.includes(tag));
          resolve(areas);
          unsubscribe();
        });
      });
    }

    async getAllTags(): Promise<readonly string[]> {
      return new Promise((resolve) => {
        const unsubscribe = areaStore.subscribe((state) => {
          const allTags = new Set<string>();
          state.areas.forEach((area) => {
            area.tags.forEach((tag) => allTags.add(tag));
          });
          resolve(Array.from(allTags).sort());
          unsubscribe();
        });
      });
    }
  };

  static Operations = class AreaOperations extends EntitiesOperations {
    public entityType = "area" as const;

    async create(
      areaData: Omit<Area, "id" | "createdAt" | "updatedAt">
    ): Promise<Area> {
      // Generate ID and create area entity
      const now = new Date();
      const area: Area = {
        ...areaData,
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
      };

      // Actually create the area entity in the store first
      areaStore.addArea(area);

      // THEN trigger domain event so extensions can react (e.g., create notes)
      // Use extension from source if available, otherwise default to "local"
      const extension = area.source?.extension || "local";
      eventBus.trigger({ type: "areas.created", area, extension });

      return area;
    }

    async update(area: Area): Promise<Area> {
      // Update the area entity directly
      const updatedArea: Area = {
        ...area,
        updatedAt: new Date(),
      };

      // Actually update the area entity in the store first
      areaStore.updateArea(updatedArea);

      // THEN trigger domain event so extensions can react (e.g., update notes)
      eventBus.trigger({
        type: "areas.updated",
        area: updatedArea,
        changes: {}, // We don't track specific changes here
        extension: "obsidian",
      });

      return updatedArea;
    }

    async delete(id: string): Promise<void> {
      // Actually delete the area entity from the store first
      areaStore.removeArea(id);

      // THEN trigger domain event so extensions can react (e.g., delete notes)
      eventBus.trigger({
        type: "areas.deleted",
        areaId: id,
        extension: "obsidian",
      });
    }

    // Area-specific operation methods
    async addTag(areaId: string, tag: string): Promise<void> {
      const area = await new Areas.Queries().getById(areaId);
      if (area) {
        const tags = area.tags.includes(tag) ? area.tags : [...area.tags, tag];
        await this.update({
          ...area,
          tags,
        });
      }
    }

    async removeTag(areaId: string, tag: string): Promise<void> {
      const area = await new Areas.Queries().getById(areaId);
      if (area) {
        await this.update({
          ...area,
          tags: area.tags.filter((t) => t !== tag),
        });
      }
    }

    async updateDescription(
      areaId: string,
      description: string
    ): Promise<void> {
      const area = await new Areas.Queries().getById(areaId);
      if (area) {
        await this.update({
          ...area,
          description,
        });
      }
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

// Export instances for easy use
export const areaQueries = new Areas.Queries();
export const areaOperations = new Areas.Operations();
