/**
 * Project store with action-based architecture
 * All mutations go through action dispatcher for centralized state management
 */

import { writable, type Readable } from "svelte/store";
import {
  projectReducer,
  type ProjectStoreState,
} from "./reducers/projectReducer";
import type { ProjectAction } from "./actions";

export interface ProjectStore extends Readable<ProjectStoreState> {
  // Action dispatcher
  dispatch: (action: ProjectAction) => void;
}

export function createProjectStore(): ProjectStore {
  const initialState: ProjectStoreState = {
    projects: [],
    loading: false,
    error: null,
    lastSync: null,
  };

  const { subscribe, update } = writable(initialState);

  // Action dispatcher - all mutations go through reducer
  const dispatch = (action: ProjectAction) => {
    update((state) => projectReducer(state, action));
  };

  return {
    subscribe,
    dispatch,
  };
}

// Global project store instance
export const projectStore = createProjectStore();
