<script lang="ts">
  /**
   * TasksView component for the new architecture
   * Simplified version that initially only supports Local Tasks
   */

  import Service from "./Service.svelte";
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
        headerTitle={activeService === "local" ? "Local Tasks" : ""}
      >
        <!-- Service Content -->
        <div class="service-content" data-testid="service-content">
          <Service
            serviceId={activeService}
            {settings}
            {host}
            testId="local-tasks-service"
          />
        </div>
      </TabView>
    </div>

    <!-- Vertical Service Switcher on the right -->
    <div class="service-switcher-vertical" data-testid="service-switcher">
      {#each services as service}
        <button
          class="service-button-vertical {activeService === service.id
            ? 'active'
            : ''} {!service.enabled ? 'disabled' : ''}"
          title={service.name}
          disabled={!service.enabled}
          data-testid="service-{service.id}"
          aria-label="Switch to {service.name}"
        >
          <span class="service-icon-vertical" data-icon={service.icon}></span>
        </button>
      {/each}
    </div>
  </div>
</div>

<!-- Styles moved to styles.css for consistency -->
