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
  import type { DailyPlanningExtension } from "../extensions/DailyPlanningExtension";
  import type { Host } from "../core/host";
  import {
    isPlanningActive,
    currentSchedule,
  } from "../stores/dailyPlanningStore";
  import { untrack } from "svelte";

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

  // Get daily planning extension - simple, direct lookup
  let dailyPlanningExtension = $derived(
    host.getExtensionById("daily-planning") as
      | DailyPlanningExtension
      | undefined
  );

  // Staged tasks state - managed at TasksView level for all services
  let stagedTaskIds = $state<Set<string>>(new Set());

  // Subscribe to staged changes from daily planning extension
  // Use untrack to prevent infinite loops when updating state
  $effect(() => {
    if (!dailyPlanningExtension) {
      stagedTaskIds = new Set();
      return;
    }

    const unsubscribe = dailyPlanningExtension
      .getStagedChanges()
      .subscribe((changes) => {
        // Use untrack to prevent this state update from triggering the effect again
        untrack(() => {
          stagedTaskIds = changes.toSchedule;
        });
      });

    return unsubscribe;
  });

  // Unified task staging handler for all services
  function handleStageTask(task: any): void {
    if (dailyPlanningExtension) {
      dailyPlanningExtension.scheduleTaskForToday(task.id);
    }
  }

  // Available services - built from registered extensions
  let services = $derived.by(() => {
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
            isPlanningActive={$isPlanningActive}
            currentSchedule={$currentSchedule}
            {dailyPlanningExtension}
            {stagedTaskIds}
            onStageTask={handleStageTask}
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
