/**
 * Core filter system types
 * Centralized filter management for all services (Local, GitHub, etc.)
 */

export type FilterType = 
  | "select"      // Single selection dropdown
  | "multiselect" // Multiple selection
  | "toggle"      // Boolean on/off
  | "text";       // Text input

export interface FilterDefinition {
  id: string;
  label: string;
  type: FilterType;
  defaultValue: any;
  options?: string[]; // For select/multiselect types
  placeholder?: string;
  allowClear?: boolean;
  autoSuggest?: boolean;
}

export interface FilterValue {
  id: string;
  value: any;
  recentValues?: string[]; // For select types
}

export interface FilterState {
  [filterId: string]: any;
}

export interface ServiceFilters {
  serviceId: string;
  filters: FilterDefinition[];
  state: FilterState;
  recentValues: { [filterId: string]: string[] };
}

export interface FilterChangeEvent {
  filterId: string;
  value: any;
  serviceId: string;
}

export interface FilterPersistenceData {
  [serviceId: string]: {
    state: FilterState;
    recentValues: { [filterId: string]: string[] };
  };
}
