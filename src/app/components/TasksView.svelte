<script lang="ts">
  /**
   * TasksView component for the new architecture
   * Simplified version that initially only supports Local Tasks
   */

  import Service from "./Service.svelte";
  import TabView from "./TabView.svelte";
  import ContextWidget from "./ContextWidget.svelte";
  import type { TaskSyncSettings } from "../types/settings";
  import { setIcon } from "obsidian";
  import { extensionRegistry } from "../core/extension";
  import type { DailyPlanningExtension } from "../extensions/daily-planning/DailyPlanningExtension";
  import type { Host } from "../core/host";
  import { isPlanningActive, currentFileContext } from "../stores/contextStore";
  import { untrack } from "svelte";
  import { eventBus } from "../core/events";

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
  let showContextTab = $state<boolean>(true); // Default to showing context tab

  // Track which services have been mounted (visited at least once)
  // Context tab and local service are mounted by default
  let mountedServices = $state<Set<string>>(new Set(["local"]));

  // Debug logging for context changes - use $derived to access store reactively
  $effect(() => {
    console.log("TasksView - Context from store:", {
      type: $currentFileContext?.type,
      name: $currentFileContext?.name,
      hasEntity: !!$currentFileContext?.entity,
      entityId: $currentFileContext?.entity?.id,
    });
  });

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

  // Track extension loading state to trigger service list updates
  let extensionLoadCounter = $state(0);

  // Listen to extension.loaded events to update services list
  $effect(() => {
    const unsubscribe = eventBus.on("extension.loaded", () => {
      // Increment counter to trigger services re-computation
      untrack(() => {
        extensionLoadCounter++;
      });
    });

    return unsubscribe;
  });

  // Available services - built from registered extensions
  // Depends on extensionLoadCounter to re-compute when extensions are loaded
  let services = $derived.by(() => {
    // Access extensionLoadCounter to make this reactive to extension loading
    extensionLoadCounter;

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

    // Include Apple Reminders if extension is registered
    const appleRemindersExt = extensionRegistry.getById("apple-reminders");
    if (appleRemindersExt) {
      allServices.push({
        id: "apple-reminders",
        name: "Apple Reminders",
        icon: "apple",
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
        showHeader={showContextTab || !showContextTab}
        headerTitle={showContextTab
          ? $currentFileContext?.type === "task"
            ? "Task"
            : $currentFileContext?.type === "project"
              ? "Project"
              : $currentFileContext?.type === "area"
                ? "Area"
                : $currentFileContext?.type === "daily"
                  ? "Daily Note"
                  : "Context"
          : services.find((s: any) => s.id === activeService)?.name}
      >
        <!-- Context Widget Content - Always mounted, visibility controlled by CSS -->
        <div
          class="context-tab-content"
          class:tab-hidden={!showContextTab}
          data-testid="context-tab-content"
        >
          <ContextWidget context={$currentFileContext} {settings} {host} />
        </div>

        <!-- Service Content - Only mount services that have been visited, keep them mounted -->
        {#each services as service}
          {#if mountedServices.has(service.id)}
            <div
              class="service-content"
              class:tab-hidden={showContextTab || activeService !== service.id}
              data-testid="service-content-{service.id}"
            >
              <Service
                serviceId={service.id}
                {settings}
                {host}
                {dailyPlanningExtension}
                {stagedTaskIds}
                onStageTask={handleStageTask}
                testId="{service.id}-service"
              />
            </div>
          {/if}
        {/each}
      </TabView>
    </div>

    <!-- Vertical Tab Switcher on the right -->
    <div class="service-switcher-vertical" data-testid="service-switcher">
      <!-- Context Tab Button (above service tabs) -->
      <button
        class="service-button-vertical context-tab-button {showContextTab
          ? 'active'
          : ''}"
        title="Context Information"
        data-testid="context-tab-button"
        aria-label="Show context information"
        onclick={() => {
          showContextTab = true;
          activeService = ""; // Deactivate service tabs when context tab is clicked
        }}
      >
        <span class="service-icon-vertical" data-icon="info"></span>
      </button>

      <!-- Service Tab Buttons -->
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
            showContextTab = false; // Hide context tab when switching to service
            // Mark this service as mounted so it stays loaded
            // Create a new Set to trigger reactivity
            if (!mountedServices.has(service.id)) {
              mountedServices = new Set([...mountedServices, service.id]);
            }
          }}
        >
          <span class="service-icon-vertical" data-icon={service.icon}></span>
        </button>
      {/each}
    </div>
  </div>
</div>

<!-- Styles moved to styles.css for consistency -->
