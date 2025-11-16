/**
 * Svelte store wrapper for FilterManager
 * Provides reactive filter state management
 */

import { writable, derived, type Readable } from "svelte/store";
import { FilterManager } from "./FilterManager";
import type { Host } from "../host";
import type { FilterState, ServiceFilters } from "./types";

class FilterStore {
  private filterManager: FilterManager;
  private updateTrigger = writable(0);

  constructor(host: Host) {
    this.filterManager = new FilterManager(host);
  }

  /**
   * Initialize the filter store and load persisted state
   */
  async initialize(): Promise<void> {
    await this.filterManager.loadPersistedState();
    this.triggerUpdate();
  }

  /**
   * Register a service with its filter definitions
   */
  registerService(serviceId: string, filters: any[]): void {
    this.filterManager.registerService(serviceId, filters);
    this.triggerUpdate();
  }

  /**
   * Get reactive filter state for a service
   */
  getServiceFilters(serviceId: string): Readable<ServiceFilters | undefined> {
    return derived(this.updateTrigger, () => {
      return this.filterManager.getServiceFilters(serviceId);
    });
  }

  /**
   * Get reactive filter state for a service
   */
  getFilterState(serviceId: string): Readable<FilterState> {
    return derived(this.updateTrigger, () => {
      return this.filterManager.getFilterState(serviceId);
    });
  }

  /**
   * Update a filter value
   */
  setFilterValue(serviceId: string, filterId: string, value: any): void {
    this.filterManager.setFilterValue(serviceId, filterId, value);
    this.triggerUpdate();
  }

  /**
   * Get recent values for a filter
   */
  getRecentValues(serviceId: string, filterId: string): string[] {
    return this.filterManager.getRecentValues(serviceId, filterId);
  }

  /**
   * Clear a filter value
   */
  clearFilter(serviceId: string, filterId: string): void {
    this.filterManager.clearFilter(serviceId, filterId);
    this.triggerUpdate();
  }

  /**
   * Clear all filters for a service
   */
  clearAllFilters(serviceId: string): void {
    this.filterManager.clearAllFilters(serviceId);
    this.triggerUpdate();
  }

  /**
   * Get filter definition
   */
  getFilterDefinition(serviceId: string, filterId: string) {
    return this.filterManager.getFilterDefinition(serviceId, filterId);
  }

  /**
   * Check if a filter is active
   */
  isFilterActive(serviceId: string, filterId: string): boolean {
    return this.filterManager.isFilterActive(serviceId, filterId);
  }

  /**
   * Trigger reactive updates
   */
  private triggerUpdate(): void {
    this.updateTrigger.update(n => n + 1);
  }
}

// Global filter store instance
let filterStore: FilterStore | null = null;

/**
 * Initialize the global filter store
 */
export function initializeFilterStore(host: Host): FilterStore {
  if (!filterStore) {
    filterStore = new FilterStore(host);
  }
  return filterStore;
}

/**
 * Get the global filter store instance
 */
export function getFilterStore(): FilterStore {
  if (!filterStore) {
    throw new Error("FilterStore not initialized. Call initializeFilterStore() first.");
  }
  return filterStore;
}
