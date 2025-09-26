/**
 * Pure area store with event-driven architecture
 * Maintains reactive state and triggers events - no extension knowledge
 */

import { writable, derived, type Readable } from "svelte/store";
import { Area } from "../core/entities";
import { eventBus, type EventBus, type DomainEvent } from "../core/events";

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

  // Direct store manipulation methods (for core operations)
  addArea: (area: Area) => void;
  updateArea: (area: Area) => void;
  removeArea: (areaId: string) => void;

  // Command methods that trigger events - extensions will handle the actual work
  requestCreateArea: (
    areaData: Omit<Area, "id" | "createdAt" | "updatedAt">
  ) => void;
  requestUpdateArea: (area: Area) => void;
  requestDeleteArea: (areaId: string) => void;
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

  // Store should NOT listen to domain events - that creates circular dependencies
  // Domain events are for extensions to react to, not for updating the store

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

  // Command methods that trigger events - extensions will handle the actual work
  const requestCreateArea = (
    areaData: Omit<Area, "id" | "createdAt" | "updatedAt">
  ): void => {
    eventBus.trigger({
      type: "areas.create.requested",
      areaData,
    });
  };

  const requestUpdateArea = (area: Area): void => {
    eventBus.trigger({
      type: "areas.update.requested",
      area,
    });
  };

  const requestDeleteArea = (areaId: string): void => {
    eventBus.trigger({
      type: "areas.delete.requested",
      areaId,
    });
  };

  // Direct store manipulation methods (for core operations)
  const addArea = (area: Area): void => {
    update((state) => ({
      ...state,
      areas: [...state.areas, area],
      lastSync: new Date(),
    }));
  };

  const updateArea = (area: Area): void => {
    update((state) => ({
      ...state,
      areas: state.areas.map((a) => (a.id === area.id ? area : a)),
      lastSync: new Date(),
    }));
  };

  const removeArea = (areaId: string): void => {
    update((state) => ({
      ...state,
      areas: state.areas.filter((a) => a.id !== areaId),
      lastSync: new Date(),
    }));
  };

  return {
    subscribe,
    areasByExtension,
    importedAreas,
    setLoading,
    setError,
    cleanup,
    addArea,
    updateArea,
    removeArea,
    requestCreateArea,
    requestUpdateArea,
    requestDeleteArea,
  };
}

// Global area store instance
export const areaStore = createAreaStore(eventBus);
