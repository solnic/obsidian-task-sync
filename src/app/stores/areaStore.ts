/**
 * Extension-aware area store with event bus integration
 * Maintains reactive state for areas from multiple extensions
 */

import { writable, derived, get, type Readable } from "svelte/store";
import { Area } from "../core/entities";
import { EventBus, type DomainEvent, eventBus } from "../core/events";
import { extensionRegistry } from "../core/extension";

interface AreaStoreState {
  areas: readonly Area[];
  loading: boolean;
  error: string | null;
  lastSync: Date | null;
}

interface AreaStore extends Readable<AreaStoreState> {
  // Derived stores for common queries
  areasByExtension: Readable<Map<string, Area[]>>;
  importedAreas: Readable<Area[]>;

  // Actions
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  cleanup: () => void;

  // Command methods that delegate to appropriate extensions
  createArea: (
    areaData: Omit<Area, "id" | "createdAt" | "updatedAt">
  ) => Promise<Area>;
  updateArea: (area: Area) => Promise<Area>;
  deleteArea: (areaId: string) => Promise<boolean>;
}

export function createAreaStore(eventBus: EventBus): AreaStore {
  const initialState: AreaStoreState = {
    areas: [],
    loading: false,
    error: null,
    lastSync: null,
  };

  const { subscribe, update } = writable(initialState);

  // Store cleanup functions for event subscriptions
  const unsubscribeFunctions: (() => void)[] = [];

  // Subscribe to extension events
  const unsubscribeCreated = eventBus.on("areas.created", (event) => {
    update((state) => ({
      ...state,
      areas: [...state.areas, event.area],
      lastSync: new Date(),
    }));
  });
  unsubscribeFunctions.push(unsubscribeCreated);

  const unsubscribeUpdated = eventBus.on("areas.updated", (event) => {
    update((state) => ({
      ...state,
      areas: state.areas.map((a) => (a.id === event.area.id ? event.area : a)),
      lastSync: new Date(),
    }));
  });
  unsubscribeFunctions.push(unsubscribeUpdated);

  const unsubscribeDeleted = eventBus.on("areas.deleted", (event) => {
    update((state) => ({
      ...state,
      areas: state.areas.filter((a) => a.id !== event.areaId),
      lastSync: new Date(),
    }));
  });
  unsubscribeFunctions.push(unsubscribeDeleted);

  const unsubscribeLoaded = eventBus.on("areas.loaded", (event) => {
    update((state) => ({
      ...state,
      areas: [...event.areas],
      lastSync: new Date(),
    }));
  });
  unsubscribeFunctions.push(unsubscribeLoaded);

  // Derived stores for common queries
  const areasByExtension = derived({ subscribe }, ($store) => {
    const grouped = new Map<string, Area[]>();
    for (const area of $store.areas) {
      const extension = area.source?.extension || "unknown";
      if (!grouped.has(extension)) {
        grouped.set(extension, []);
      }
      grouped.get(extension)!.push(area);
    }
    return grouped;
  });

  const importedAreas = derived({ subscribe }, ($store) =>
    $store.areas.filter((area) => area.source)
  );

  // Actions
  const setLoading = (loading: boolean) => {
    update((state) => ({ ...state, loading }));
  };

  const setError = (error: string | null) => {
    update((state) => ({ ...state, error }));
  };

  const cleanup = () => {
    unsubscribeFunctions.forEach((unsubscribe) => unsubscribe());
  };

  // Command methods that delegate to appropriate extensions
  const createArea = async (
    areaData: Omit<Area, "id" | "createdAt" | "updatedAt">
  ): Promise<Area> => {
    const extension = extensionRegistry.getById("obsidian"); // Default to Obsidian
    if (extension?.areas) {
      return extension.areas.create(areaData);
    }
    throw new Error("No extension available to create areas");
  };

  const updateArea = async (area: Area): Promise<Area> => {
    const extensionId = area.source?.extension || "obsidian";
    const extension = extensionRegistry.getById(extensionId);
    if (extension?.areas) {
      return extension.areas.update(area.id, area);
    }
    throw new Error(`Extension ${extensionId} not available`);
  };

  const deleteArea = async (areaId: string): Promise<boolean> => {
    // Find which extension owns this area
    let area: Area | undefined;
    const store = { subscribe };
    const currentState = get(store);
    area = currentState.areas.find((a: Area) => a.id === areaId);

    if (area) {
      const extensionId = area.source?.extension || "obsidian";
      const extension = extensionRegistry.getById(extensionId);
      if (extension?.areas) {
        return extension.areas.delete(areaId);
      }
    }
    throw new Error("Area not found or extension not available");
  };

  return {
    subscribe,
    areasByExtension,
    importedAreas,
    setLoading,
    setError,
    cleanup,
    createArea,
    updateArea,
    deleteArea,
  };
}

// Global area store instance
export const areaStore = createAreaStore(eventBus);
