<script lang="ts">
  /**
   * TasksView component for the new architecture
   * Simplified version that initially only supports Local Tasks
   */

  import LocalTasksService from "./LocalTasksService.svelte";
  import TabView from "./TabView.svelte";
  import type { TaskSyncSettings } from "../types/settings";

  interface Props {
    // Settings for configuration
    settings?: TaskSyncSettings;

    // Host for data persistence
    host?: any;

    // Test attributes
    testId?: string;
  }

  let { settings, host, testId }: Props = $props();

  // State - simplified to only support local tasks initially
  let activeService = $state<"local">("local");

  // Component references for direct method calls
  let localTasksServiceRef: any = $state(null);

  // Available services - simplified for initial implementation
  let services = $derived([
    {
      id: "local",
      name: "Local Tasks",
      icon: "file-text",
      enabled: true,
    },
    // TODO: Add GitHub and Apple Reminders services in future iterations
  ]);

  async function loadActiveService(): Promise<void> {
    try {
      if (!host) return;

      const data = await host.loadData();
      if (data?.tasksViewActiveService) {
        // For now, only allow local service
        if (data.tasksViewActiveService === "local") {
          activeService = data.tasksViewActiveService;
        }
      }
    } catch (err: any) {
      console.warn("Failed to load active service:", err.message);
    }
  }

  async function saveActiveService(): Promise<void> {
    try {
      if (!host) return;

      const data = (await host.loadData()) || {};
      data.tasksViewActiveService = activeService;
      await host.saveData(data);
    } catch (err: any) {
      console.warn("Failed to save active service:", err.message);
    }
  }

  function setActiveService(serviceId: string): void {
    // For now, only allow local service
    if (serviceId === "local") {
      activeService = serviceId as "local";
      saveActiveService();
    }
  }

  async function refresh(): Promise<void> {
    // Delegate refresh to the active service component
    if (activeService === "local" && localTasksServiceRef) {
      // Call refresh method directly on the LocalTasksService component
      if (typeof localTasksServiceRef.refresh === "function") {
        await localTasksServiceRef.refresh();
      }
    }
  }

  // Load active service on component mount
  $effect(() => {
    loadActiveService();
  });

  // Export refresh method for external access (no window hack needed)
  // The component reference will be used by the parent TasksView.ts
</script>

<div class="tasks-view" data-type="tasks" data-testid={testId || "tasks-view"}>
  <div class="tasks-view-layout">
    <!-- Main Content Area -->
    <div class="tasks-view-main">
      <TabView
        className="tasks-view-tab"
        testId="tasks-view-tab"
        showHeader={true}
        headerTitle="Local Tasks"
      >
        <!-- Service Content - Only Local Tasks for now -->
        <div class="service-content" data-testid="service-content">
          {#if activeService === "local"}
            <LocalTasksService
              {settings}
              {host}
              testId="local-tasks-service"
              bind:this={localTasksServiceRef}
            />
          {:else}
            <!-- Fallback - should not happen in current implementation -->
            <div class="service-unavailable">
              <div class="service-unavailable-icon">⚠️</div>
              <h3>Service Not Available</h3>
              <p>The selected service is not available.</p>
              <button
                class="task-sync-button"
                onclick={() => setActiveService("local")}
              >
                Switch to Local Tasks
              </button>
            </div>
          {/if}
        </div>
      </TabView>
    </div>

    <!-- Service Switcher - simplified for single service -->
    {#if services.length > 1}
      <div class="service-switcher-vertical" data-testid="service-switcher">
        {#each services as service}
          <button
            class="service-button-vertical {activeService === service.id
              ? 'active'
              : ''} {!service.enabled ? 'disabled' : ''}"
            title={service.name}
            onclick={() => setActiveService(service.id)}
            disabled={!service.enabled}
            data-testid="service-{service.id}"
            aria-label="Switch to {service.name}"
          >
            <span class="service-icon-vertical" data-icon={service.icon}></span>
          </button>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .tasks-view {
    height: 100%;
    width: 100%;
  }

  .tasks-view-layout {
    display: flex;
    height: 100%;
  }

  .tasks-view-main {
    flex: 1;
    min-width: 0;
  }

  .service-content {
    height: 100%;
  }

  .service-unavailable {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 2rem;
    text-align: center;
    color: var(--text-muted);
  }

  .service-unavailable-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
  }

  .service-unavailable h3 {
    margin: 0 0 1rem 0;
    color: var(--text-normal);
  }

  .service-unavailable p {
    margin: 0 0 0.5rem 0;
    max-width: 400px;
  }

  .task-sync-button {
    margin-top: 1rem;
    padding: 0.5rem 1rem;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
  }

  .task-sync-button:hover {
    background: var(--interactive-accent-hover);
  }

  .service-switcher-vertical {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px 8px;
    border-left: 1px solid var(--background-modifier-border);
    background: var(--background-secondary);
    min-width: 60px;
  }

  .service-button-vertical {
    width: 44px;
    height: 44px;
    border: none;
    border-radius: 8px;
    background: transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    position: relative;
  }

  .service-button-vertical:hover:not(.disabled) {
    background: var(--background-modifier-hover);
  }

  .service-button-vertical.active {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .service-button-vertical.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .service-icon-vertical {
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
