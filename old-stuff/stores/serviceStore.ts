/**
 * Service Store - Reactive Svelte store for integration services
 * Provides a centralized, reactive API for service availability and status
 */

import { writable, derived, get } from "svelte/store";
import type { GitHubService } from "../services/GitHubService";
import type { AppleRemindersService } from "../services/AppleRemindersService";

interface ServiceStoreState {
  githubService: GitHubService | null;
  appleRemindersService: AppleRemindersService | null;
  isInitialized: boolean;
}

export class ServiceStore {
  private _store = writable<ServiceStoreState>({
    githubService: null,
    appleRemindersService: null,
    isInitialized: false,
  });

  // Main store subscription
  public subscribe = this._store.subscribe;

  // Derived stores for individual services
  public githubService = derived(this._store, ($store) => $store.githubService);
  public appleRemindersService = derived(
    this._store,
    ($store) => $store.appleRemindersService
  );

  // Derived stores for service status
  public githubEnabled = derived(
    this._store,
    ($store) => $store.githubService?.isEnabled() || false
  );

  public appleRemindersEnabled = derived(
    this._store,
    ($store) => $store.appleRemindersService?.isEnabled() || false
  );

  // Derived store for available services
  public availableServices = derived(this._store, ($store) => {
    const services = [];

    console.log("🔧 ServiceStore: Checking available services", {
      githubService: $store.githubService,
      githubServiceEnabled: $store.githubService?.isEnabled(),
      appleRemindersService: $store.appleRemindersService,
      appleRemindersServiceEnabled: $store.appleRemindersService?.isEnabled(),
    });

    if ($store.githubService?.isEnabled()) {
      services.push({
        id: "github",
        name: "GitHub",
        icon: "github",
        service: $store.githubService,
      });
    }

    if ($store.appleRemindersService?.isEnabled()) {
      services.push({
        id: "apple-reminders",
        name: "Apple Reminders",
        icon: "apple",
        service: $store.appleRemindersService,
      });
    }

    // Always include local service
    services.push({
      id: "local",
      name: "Local Tasks",
      icon: "file-text",
      service: null,
    });

    console.log("🔧 ServiceStore: Available services result", services);
    return services;
  });

  /**
   * Initialize the store
   */
  initialize(): void {
    this._store.update((state) => ({
      ...state,
      isInitialized: true,
    }));
  }

  /**
   * Update GitHub service
   */
  setGitHubService(service: GitHubService | null): void {
    console.log("🔧 ServiceStore: Setting GitHub service", {
      service,
      isEnabled: service?.isEnabled(),
    });
    this._store.update((state) => ({
      ...state,
      githubService: service,
    }));
  }

  /**
   * Update Apple Reminders service
   */
  setAppleRemindersService(service: AppleRemindersService | null): void {
    this._store.update((state) => ({
      ...state,
      appleRemindersService: service,
    }));
  }

  /**
   * Get current GitHub service (non-reactive)
   */
  getCurrentGitHubService(): GitHubService | null {
    const state = get(this._store);
    return state.githubService;
  }

  /**
   * Get current Apple Reminders service (non-reactive)
   */
  getCurrentAppleRemindersService(): AppleRemindersService | null {
    const state = get(this._store);
    return state.appleRemindersService;
  }

  /**
   * Check if store is initialized
   */
  isStoreInitialized(): boolean {
    const state = get(this._store);
    return state.isInitialized;
  }
}

// Export singleton instance
export const serviceStore = new ServiceStore();
