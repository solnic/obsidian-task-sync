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
import { areaStore as store } from "../stores/areaStore";
import { eventBus } from "../core/events";

export class Areas extends Entities {
  protected entityType = "area" as const;

  static Queries = class AreaQueries extends EntitiesQueries {
    public entityType = "area" as const;

    async getAll(): Promise<readonly Area[]> {
      return new Promise((resolve) => {
        const unsubscribe = store.subscribe((state) => {
          resolve(state.areas);
          unsubscribe();
        });
      });
    }

    async getById(id: string): Promise<Area | null> {
      return new Promise((resolve) => {
        const unsubscribe = store.subscribe((state) => {
          const area = state.areas.find((a) => a.id === id);
          resolve(area || null);
          unsubscribe();
        });
      });
    }

    async getByExtension(extensionId: string): Promise<readonly Area[]> {
      return new Promise((resolve) => {
        const unsubscribe = store.subscribe((state) => {
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
        const unsubscribe = store.subscribe((state) => {
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
        const unsubscribe = store.subscribe((state) => {
          const areas = state.areas.filter((a) => a.tags.includes(tag));
          resolve(areas);
          unsubscribe();
        });
      });
    }

    async getAllTags(): Promise<readonly string[]> {
      return new Promise((resolve) => {
        const unsubscribe = store.subscribe((state) => {
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

export const areaQueries = new Areas.Queries();
export const areaOperations = new Areas.Operations();
