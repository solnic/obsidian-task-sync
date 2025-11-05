/**
 * Project store reducer
 * Handles all project state mutations through actions
 */

import type { Project } from "../../core/entities";
import type { ProjectAction } from "../actions";

export interface ProjectStoreState {
  projects: readonly Project[];
  loading: boolean;
  error: string | null;
  lastSync: Date | null;
}

export function projectReducer(
  state: ProjectStoreState,
  action: ProjectAction
): ProjectStoreState {
  switch (action.type) {
    case "ADD_PROJECT":
      // Check if project already exists to prevent duplicates
      const exists = state.projects.some((p) => p.id === action.project.id);
      if (exists) {
        // Project already exists, update it instead
        return {
          ...state,
          projects: state.projects.map((p) =>
            p.id === action.project.id ? action.project : p
          ),
          lastSync: new Date(),
        };
      }
      return {
        ...state,
        projects: [...state.projects, action.project],
        lastSync: new Date(),
      };

    case "UPDATE_PROJECT":
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === action.project.id ? action.project : p
        ),
        lastSync: new Date(),
      };

    case "REMOVE_PROJECT":
      return {
        ...state,
        projects: state.projects.filter((p) => p.id !== action.projectId),
        lastSync: new Date(),
      };

    case "SET_LOADING":
      return {
        ...state,
        loading: action.loading,
      };

    case "SET_ERROR":
      return {
        ...state,
        error: action.error,
      };

    default:
      return state;
  }
}
