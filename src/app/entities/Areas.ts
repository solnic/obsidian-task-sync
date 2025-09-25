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
import { get } from "svelte/store";

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
      return areaStore.createArea(areaData);
    }

    async update(area: Area): Promise<Area> {
      return areaStore.updateArea(area);
    }

    async delete(id: string): Promise<void> {
      const success = await areaStore.deleteArea(id);
      if (!success) {
        throw new Error(`Failed to delete area with id: ${id}`);
      }
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
