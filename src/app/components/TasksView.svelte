<script lang="ts">
  /**
   * TasksView component for the new architecture
   * Simplified version that initially only supports Local Tasks
   */

  import Service from "./Service.svelte";
  import TabView from "./TabView.svelte";
  import type { TaskSyncSettings } from "../types/settings";
  import { setIcon } from "obsidian";
  import { extensionRegistry } from "../core/extension";
  import { eventBus } from "../core/events";
  import type { DailyPlanningExtension } from "../extensions/DailyPlanningExtension";
  import type { Host } from "../core/host";

  interface Props {
    // Settings for configuration
    settings?: TaskSyncSettings;

    // Host for data persistence and extension resolution
    host: Host;

    // Test attributes
    testId?: string;
  }

  let { settings, host, testId }: Props = $props();

  // State - simplified to only support local tasks initially
  let activeService = $state<string>("local");

  // Reactive state that updates when extensions are registered/unregistered
  let extensionsVersion = $state(0);

  // Get daily planning extension and track its planning state
  let dailyPlanningExtension = $derived<DailyPlanningExtension | undefined>(
    host.getExtensionById("daily-planning") as DailyPlanningExtension
  );

  // Track planning active state reactively
  let isPlanningActive = $state(false);
  let currentSchedule = $state(null);

  // Subscribe to daily planning state changes
  $effect(() => {
    if (dailyPlanningExtension) {
      const planningActiveStore = dailyPlanningExtension.getPlanningActive();
      const currentScheduleStore = dailyPlanningExtension.getCurrentSchedule();

      const unsubscribePlanning = planningActiveStore.subscribe((active) => {
        isPlanningActive = active;
      });

      const unsubscribeSchedule = currentScheduleStore.subscribe((schedule) => {
        currentSchedule = schedule;
      });

      return () => {
        unsubscribePlanning();
        unsubscribeSchedule();
      };
    }

    return () => {
      // No cleanup needed if extension not available
    };
  });

  // Listen to extension lifecycle events to trigger reactivity
  $effect(() => {
    const unsubscribeRegistered = eventBus.on("extension.registered", () => {
      extensionsVersion++;
    });

    const unsubscribeUnregistered = eventBus.on(
      "extension.unregistered",
      () => {
        extensionsVersion++;
      }
    );

    return () => {
      unsubscribeRegistered();
      unsubscribeUnregistered();
    };
  });

  // Available services - reactively built from registered extensions
  let services = $derived.by(() => {
    // Access extensionsVersion to make this reactive
    extensionsVersion;

    const allServices = [];

    // Always include local tasks (obsidian extension)
    const obsidianExt = extensionRegistry.getById("obsidian");
    if (obsidianExt) {
      allServices.push({
        id: "local",
        name: "Local Tasks",
        icon: "file-text",
        enabled: true,
      });
    }

    // Include GitHub if extension is registered
    const githubExt = extensionRegistry.getById("github");
    if (githubExt) {
      allServices.push({
        id: "github",
        name: "GitHub",
        icon: "github",
        enabled: true,
      });
    }

    return allServices;
  });

  // Set Obsidian icons after component mounts
  $effect(() => {
    if (typeof window !== "undefined") {
      // Set service icons for vertical switcher
      const serviceIcons = document.querySelectorAll(
        ".service-icon-vertical[data-icon]"
      );
      serviceIcons.forEach((iconEl) => {
        const iconName = iconEl.getAttribute("data-icon");
        if (iconName) {
          setIcon(iconEl as HTMLElement, iconName);
        }
      });
    }
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
        headerTitle={services.find((s: any) => s.id === activeService).name}
      >
        <!-- Service Content -->
        <div class="service-content" data-testid="service-content">
          <Service
            serviceId={activeService}
            {settings}
            {host}
            {isPlanningActive}
            {currentSchedule}
            {dailyPlanningExtension}
            testId="{activeService}-service"
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
          onclick={() => {
            activeService = service.id;
          }}
        >
          <span class="service-icon-vertical" data-icon={service.icon}></span>
        </button>
      {/each}
    </div>
  </div>
</div>

<!-- Styles moved to styles.css for consistency -->
