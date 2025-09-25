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
      return new Promise((resolve, reject) => {
        // Listen for the creation completion
        const unsubscribe = eventBus.on("areas.created", (event) => {
          unsubscribe();
          clearTimeout(timeout);
          resolve(event.area);
        });

        // Set a timeout in case no extension handles the request
        const timeout = setTimeout(() => {
          unsubscribe();
          reject(new Error("No extension handled the area creation request"));
        }, 5000);

        // Trigger the request
        areaStore.requestCreateArea(areaData);
      });
    }

    async update(area: Area): Promise<Area> {
      return new Promise((resolve, reject) => {
        const unsubscribe = eventBus.on("areas.updated", (event) => {
          if (event.area.id === area.id) {
            unsubscribe();
            clearTimeout(timeout);
            resolve(event.area);
          }
        });

        const timeout = setTimeout(() => {
          unsubscribe();
          reject(new Error("No extension handled the area update request"));
        }, 5000);

        areaStore.requestUpdateArea(area);
      });
    }

    async delete(id: string): Promise<void> {
      return new Promise((resolve, reject) => {
        const unsubscribe = eventBus.on("areas.deleted", (event) => {
          if (event.areaId === id) {
            unsubscribe();
            clearTimeout(timeout);
            resolve();
          }
        });

        const timeout = setTimeout(() => {
          unsubscribe();
          reject(new Error("No extension handled the area deletion request"));
        }, 5000);

        areaStore.requestDeleteArea(id);
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
