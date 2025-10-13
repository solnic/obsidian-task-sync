/**
 * Area store reducer
 * Handles all area state mutations through actions
 */

import type { Area } from "../../core/entities";
import type { AreaAction } from "../actions";

export interface AreaStoreState {
  areas: readonly Area[];
  loading: boolean;
  error: string | null;
  lastSync: Date | null;
}

export function areaReducer(
  state: AreaStoreState,
  action: AreaAction
): AreaStoreState {
  switch (action.type) {
    case "ADD_AREA":
      return {
        ...state,
        areas: [...state.areas, action.area],
        lastSync: new Date(),
      };

    case "UPDATE_AREA":
      return {
        ...state,
        areas: state.areas.map((a) =>
          a.id === action.area.id ? action.area : a
        ),
        lastSync: new Date(),
      };

    case "REMOVE_AREA":
      return {
        ...state,
        areas: state.areas.filter((a) => a.id !== action.areaId),
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

