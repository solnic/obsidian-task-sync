/**
 * Extension-aware project store with event bus integration
 * Maintains reactive state for projects from multiple extensions
 */

import { writable, derived, type Readable } from "svelte/store";
import { Project } from "../core/entities";

interface ProjectStoreState {
  projects: readonly Project[];
  loading: boolean;
  error: string | null;
  lastSync: Date | null;
}

interface ProjectStore extends Readable<ProjectStoreState> {
  // Derived stores for common queries
  projectsByExtension: Readable<Map<string, Project[]>>;
  importedProjects: Readable<Project[]>;

  // Actions
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  cleanup: () => void;

  // Direct store manipulation methods (for core operations)
  addProject: (project: Project) => void;
  updateProject: (project: Project) => void;
  removeProject: (projectId: string) => void;
}

export function createProjectStore(): ProjectStore {
  const initialState: ProjectStoreState = {
    projects: [],
    loading: false,
    error: null,
    lastSync: null,
  };

  const { subscribe, update } = writable(initialState);

  // Store cleanup functions for event subscriptions
  const unsubscribeFunctions: (() => void)[] = [];

  // Store should NOT listen to domain events - that creates circular dependencies
  // Domain events are for extensions to react to, not for updating the store

  // Derived stores for common queries
  const projectsByExtension = derived({ subscribe }, ($store) => {
    const grouped = new Map<string, Project[]>();
    for (const project of $store.projects) {
      const extension = project.source?.extension || "unknown";
      if (!grouped.has(extension)) {
        grouped.set(extension, []);
      }
      grouped.get(extension)?.push(project);
    }
    return grouped;
  });

  const importedProjects = derived({ subscribe }, ($store) =>
    $store.projects.filter((project) => project.source)
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

  // Direct store manipulation methods (for core operations)
  const addProject = (project: Project): void => {
    update((state) => ({
      ...state,
      projects: [...state.projects, project],
      lastSync: new Date(),
    }));
  };

  const updateProject = (project: Project): void => {
    update((state) => ({
      ...state,
      projects: state.projects.map((p) => (p.id === project.id ? project : p)),
      lastSync: new Date(),
    }));
  };

  const removeProject = (projectId: string): void => {
    update((state) => ({
      ...state,
      projects: state.projects.filter((p) => p.id !== projectId),
      lastSync: new Date(),
    }));
  };

  return {
    subscribe,
    projectsByExtension,
    importedProjects,
    setLoading,
    setError,
    cleanup,
    addProject,
    updateProject,
    removeProject,
  };
}

// Global project store instance
export const projectStore = createProjectStore();
