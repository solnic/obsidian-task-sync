/**
 * Area Store - Reactive Svelte store for area management
 * Provides a centralized, reactive API for area operations and queries
 */

import { derived } from "svelte/store";
import { TFile } from "obsidian";
import { EntityStore } from "./EntityStore";
import { Area } from "../types/entities";

class AreaStore extends EntityStore<Area> {
  constructor() {
    super("areaStore");
  }

  protected getPropertySet(): readonly string[] {
    // Areas use a subset of properties
    return ["NAME", "TYPE", "TAGS"] as const;
  }

  // Derived stores for common queries
  public activeAreas = derived(
    this._store,
    ($store) => $store.entities // All areas are considered active since we don't have isActive property
  );

  public inactiveAreas = derived(
    this._store,
    ($store) => [] as Area[] // No inactive areas since we don't have isActive property
  );

  public areasByTag = derived(this._store, ($store) => {
    const areasByTag: Record<string, Area[]> = {};

    $store.entities.forEach((area) => {
      if (area.tags && area.tags.length > 0) {
        area.tags.forEach((tag) => {
          if (!areasByTag[tag]) {
            areasByTag[tag] = [];
          }
          areasByTag[tag].push(area);
        });
      }
    });

    return areasByTag;
  });

  /**
   * Find an area by name
   */
  findAreaByName(name: string): Area | null {
    const entities = this.getEntities();
    return (
      entities.find(
        (area) =>
          area.name === name ||
          area.name === `[[${name}]]` ||
          area.file?.name === name
      ) || null
    );
  }

  /**
   * Get areas by tag
   */
  getAreasByTag(tag: string): Area[] {
    const entities = this.getEntities();
    return entities.filter((area) => area.tags?.includes(tag));
  }

  /**
   * Get area statistics - simplified since Area entity doesn't have isActive/goals/purpose/vision
   */
  getAreaStats() {
    const entities = this.getEntities();
    return {
      total: entities.length,
    };
  }
}

// Export singleton instance
export const areaStore = new AreaStore();
