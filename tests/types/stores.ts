/**
 * Test type definitions for store states
 * Re-exports store state types from source for use in tests
 */

// Re-export store state types from source
export type { TaskStoreState } from "../../src/app/stores/reducers/taskReducer";
export type { ProjectStoreState } from "../../src/app/stores/reducers/projectReducer";
export type { AreaStoreState } from "../../src/app/stores/reducers/areaReducer";
