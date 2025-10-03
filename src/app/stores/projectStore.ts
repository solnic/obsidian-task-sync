/**
 * Extension-aware project store with event bus integration
 * Maintains reactive state for projects from multiple extensions
 */

import { writable, derived, get, type Readable } from "svelte/store";
import { Project } from "../core/entities";

interface ProjectStoreState {
  projects: readonly Project[];
  loading: boolean;
  error: string | null;
  lastSync: Date | null;
}

export interface ProjectStore extends Readable<ProjectStoreState> {
  // Derived stores for common queries
  projectsByExtension: Readable<Map<string, Project[]>>;
  importedProjects: Readable<Project[]>;

  // Actions
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Direct store manipulation methods (for core operations)
  addProject: (project: Project) => void;
  updateProject: (project: Project) => void;
  removeProject: (projectId: string) => void;

  // Query methods
  findByFilePath: (filePath: string) => Project | undefined;
}

export function createProjectStore(): ProjectStore {
  const initialState: ProjectStoreState = {
    projects: [],
    loading: false,
    error: null,
    lastSync: null,
  };

  const { subscribe, update } = writable(initialState);

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

  // Query methods - synchronous access to current state
  const findByFilePath = (filePath: string): Project | undefined => {
    return get({ subscribe }).projects.find(
      (p) => p.source?.filePath === filePath
    );
  };

  return {
    subscribe,
    projectsByExtension,
    importedProjects,
    setLoading,
    setError,
    addProject,
    updateProject,
    removeProject,
    findByFilePath,
  };
}

// Global project store instance
export const projectStore = createProjectStore();
