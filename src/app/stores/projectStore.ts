/**
 * Extension-aware project store with event bus integration
 * Maintains reactive state for projects from multiple extensions
 */

import { writable, derived, type Readable } from 'svelte/store';
import { Project } from '../core/entities';
import { EventBus, type DomainEvent } from '../core/events';

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
}

export function createProjectStore(eventBus: EventBus): ProjectStore {
  const initialState: ProjectStoreState = {
    projects: [],
    loading: false,
    error: null,
    lastSync: null
  };

  const { subscribe, update } = writable(initialState);

  // Store cleanup functions for event subscriptions
  const unsubscribeFunctions: (() => void)[] = [];

  // Subscribe to extension events
  const unsubscribeCreated = eventBus.on('projects.created', (event) => {
    update(state => ({
      ...state,
      projects: [...state.projects, event.project],
      lastSync: new Date()
    }));
  });
  unsubscribeFunctions.push(unsubscribeCreated);

  const unsubscribeUpdated = eventBus.on('projects.updated', (event) => {
    update(state => ({
      ...state,
      projects: state.projects.map(p => p.id === event.project.id ? event.project : p),
      lastSync: new Date()
    }));
  });
  unsubscribeFunctions.push(unsubscribeUpdated);

  const unsubscribeDeleted = eventBus.on('projects.deleted', (event) => {
    update(state => ({
      ...state,
      projects: state.projects.filter(p => p.id !== event.projectId),
      lastSync: new Date()
    }));
  });
  unsubscribeFunctions.push(unsubscribeDeleted);

  const unsubscribeLoaded = eventBus.on('projects.loaded', (event) => {
    update(state => ({
      ...state,
      projects: [...event.projects],
      lastSync: new Date()
    }));
  });
  unsubscribeFunctions.push(unsubscribeLoaded);

  // Derived stores for common queries
  const projectsByExtension = derived({ subscribe }, ($store) => {
    const grouped = new Map<string, Project[]>();
    for (const project of $store.projects) {
      const extension = project.source?.extension || 'unknown';
      if (!grouped.has(extension)) {
        grouped.set(extension, []);
      }
      grouped.get(extension)!.push(project);
    }
    return grouped;
  });

  const importedProjects = derived({ subscribe }, ($store) =>
    $store.projects.filter(project => project.source)
  );

  // Actions
  const setLoading = (loading: boolean) => {
    update(state => ({ ...state, loading }));
  };

  const setError = (error: string | null) => {
    update(state => ({ ...state, error }));
  };

  const cleanup = () => {
    unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
  };

  return {
    subscribe,
    projectsByExtension,
    importedProjects,
    setLoading,
    setError,
    cleanup
  };
}
