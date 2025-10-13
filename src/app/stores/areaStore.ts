/**
 * Area store with action-based architecture
 * All mutations go through action dispatcher for centralized state management
 */

import { writable, get, type Readable } from "svelte/store";
import { Area } from "../core/entities";
import { areaReducer, type AreaStoreState } from "./reducers/areaReducer";
import type { AreaAction } from "./actions";

export interface AreaStore extends Readable<AreaStoreState> {
  // Action dispatcher
  dispatch: (action: AreaAction) => void;
}

export function createAreaStore(): AreaStore {
  const initialState: AreaStoreState = {
    areas: [],
    loading: false,
    error: null,
    lastSync: null,
  };

  const { subscribe, update } = writable(initialState);

  // Action dispatcher - all mutations go through reducer
  const dispatch = (action: AreaAction) => {
    update((state) => areaReducer(state, action));
  };

  return {
    subscribe,
    dispatch,
  };
}

// Global area store instance
export const areaStore = createAreaStore();
