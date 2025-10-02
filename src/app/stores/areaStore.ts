/**
 * Pure area store with event-driven architecture
 * Maintains reactive state and triggers events - no extension knowledge
 */

import { writable, derived, get, type Readable } from "svelte/store";
import { Area } from "../core/entities";

interface AreaStoreState {
  areas: readonly Area[];
  loading: boolean;
  error: string | null;
  lastSync: Date | null;
}

export interface AreaStore extends Readable<AreaStoreState> {
  // Derived stores for common queries
  areasByExtension: Readable<Map<string, Area[]>>;
  importedAreas: Readable<Area[]>;

  // Actions
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Direct store manipulation methods (for core operations)
  addArea: (area: Area) => void;
  updateArea: (area: Area) => void;
  removeArea: (areaId: string) => void;

  // Query methods
  findByFilePath: (filePath: string) => Area | undefined;

  // Request methods removed - operations now directly manipulate store and trigger events
}

export function createAreaStore(): AreaStore {
  const initialState: AreaStoreState = {
    areas: [],
    loading: false,
    error: null,
    lastSync: null,
  };

  const { subscribe, update } = writable(initialState);

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

  // Query methods - synchronous access to current state
  const findByFilePath = (filePath: string): Area | undefined => {
    return get({ subscribe }).areas.find(
      (a) => a.source?.filePath === filePath
    );
  };

  return {
    subscribe,
    areasByExtension,
    importedAreas,
    setLoading,
    setError,
    addArea,
    updateArea,
    removeArea,
    findByFilePath,
  };
}

// Global area store instance
export const areaStore = createAreaStore();
