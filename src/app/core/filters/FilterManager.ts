/**
 * Centralized Filter Manager
 * Manages filter state, persistence, and recent values for all services
 */

import type { Host } from "../host";
import type {
  FilterDefinition,
  FilterState,
  ServiceFilters,
  FilterChangeEvent,
  FilterPersistenceData,
} from "./types";

export class FilterManager {
  private services = new Map<string, ServiceFilters>();
  private host: Host;
  private persistenceKey = "filterManager";

  constructor(host: Host) {
    this.host = host;
  }

  /**
   * Register a service with its filter definitions
   */
  registerService(serviceId: string, filters: FilterDefinition[]): void {
    const initialState: FilterState = {};
    const recentValues: { [filterId: string]: string[] } = {};

    // Initialize state with default values
    filters.forEach((filter) => {
      initialState[filter.id] = filter.defaultValue;
      if (filter.type === "select" || filter.type === "multiselect") {
        recentValues[filter.id] = [];
      }
    });

    this.services.set(serviceId, {
      serviceId,
      filters,
      state: initialState,
      recentValues,
    });
  }

  /**
   * Get filter state for a service
   */
  getServiceFilters(serviceId: string): ServiceFilters | undefined {
    return this.services.get(serviceId);
  }

  /**
   * Get current filter state for a service
   */
  getFilterState(serviceId: string): FilterState {
    const service = this.services.get(serviceId);
    return service?.state ?? {};
  }

  /**
   * Update a filter value
   */
  setFilterValue(serviceId: string, filterId: string, value: any): void {
    const service = this.services.get(serviceId);
    if (!service) {
      console.warn(`Service ${serviceId} not registered with FilterManager`);
      return;
    }

    // Update the state
    service.state[filterId] = value;

    // Update recent values for select types
    const filterDef = service.filters.find((f) => f.id === filterId);
    if (filterDef && (filterDef.type === "select" || filterDef.type === "multiselect")) {
      if (value && typeof value === "string") {
        this.addRecentValue(serviceId, filterId, value);
      }
    }

    // Persist changes
    this.persistState();
  }

  /**
   * Add a value to recent values for a filter
   */
  private addRecentValue(serviceId: string, filterId: string, value: string): void {
    const service = this.services.get(serviceId);
    if (!service) return;

    if (!service.recentValues[filterId]) {
      service.recentValues[filterId] = [];
    }

    const recent = service.recentValues[filterId];
    
    // Remove if already exists
    const index = recent.indexOf(value);
    if (index > -1) {
      recent.splice(index, 1);
    }

    // Add to front and limit to 5 items
    recent.unshift(value);
    service.recentValues[filterId] = recent.slice(0, 5);
  }

  /**
   * Get recent values for a filter
   */
  getRecentValues(serviceId: string, filterId: string): string[] {
    const service = this.services.get(serviceId);
    return service?.recentValues[filterId] ?? [];
  }

  /**
   * Clear a filter value
   */
  clearFilter(serviceId: string, filterId: string): void {
    const service = this.services.get(serviceId);
    if (!service) return;

    const filterDef = service.filters.find((f) => f.id === filterId);
    if (filterDef) {
      service.state[filterId] = filterDef.defaultValue;
      this.persistState();
    }
  }

  /**
   * Clear all filters for a service
   */
  clearAllFilters(serviceId: string): void {
    const service = this.services.get(serviceId);
    if (!service) return;

    service.filters.forEach((filter) => {
      service.state[filter.id] = filter.defaultValue;
    });

    this.persistState();
  }

  /**
   * Load persisted state from storage
   */
  async loadPersistedState(): Promise<void> {
    try {
      const data = await this.host.loadData();
      const persistedData: FilterPersistenceData = data?.[this.persistenceKey];

      if (!persistedData) return;

      // Apply persisted state to registered services
      for (const [serviceId, service] of this.services) {
        const persistedService = persistedData[serviceId];
        if (persistedService) {
          // Merge persisted state with current state (preserving defaults for new filters)
          service.state = { ...service.state, ...persistedService.state };
          service.recentValues = { ...service.recentValues, ...persistedService.recentValues };
        }
      }
    } catch (err: any) {
      console.warn("Failed to load filter manager state:", err.message);
    }
  }

  /**
   * Persist current state to storage
   */
  private async persistState(): Promise<void> {
    try {
      const data = (await this.host.loadData()) || {};
      
      const persistenceData: FilterPersistenceData = {};
      
      // Collect state from all services
      for (const [serviceId, service] of this.services) {
        persistenceData[serviceId] = {
          state: service.state,
          recentValues: service.recentValues,
        };
      }

      data[this.persistenceKey] = persistenceData;
      await this.host.saveData(data);
      
      console.log("🔧 FilterManager: Persisted state for services:", Object.keys(persistenceData));
    } catch (err: any) {
      console.warn("Failed to persist filter manager state:", err.message);
    }
  }

  /**
   * Get filter definition by ID for a service
   */
  getFilterDefinition(serviceId: string, filterId: string): FilterDefinition | undefined {
    const service = this.services.get(serviceId);
    return service?.filters.find((f) => f.id === filterId);
  }

  /**
   * Check if a filter is active (has non-default value)
   */
  isFilterActive(serviceId: string, filterId: string): boolean {
    const service = this.services.get(serviceId);
    if (!service) return false;

    const filterDef = service.filters.find((f) => f.id === filterId);
    if (!filterDef) return false;

    const currentValue = service.state[filterId];
    return currentValue !== filterDef.defaultValue;
  }
}
