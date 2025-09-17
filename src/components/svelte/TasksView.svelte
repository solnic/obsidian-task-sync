<script lang="ts">
  import GitHubService from "./GitHubService.svelte";
  import LocalTasksService from "./LocalTasksService.svelte";
  import AppleRemindersService from "./AppleRemindersService.svelte";
  import TabView from "./TabView.svelte";
  import type {
    GitHubIntegrationSettings,
    AppleRemindersIntegrationSettings,
  } from "../ui/settings/types";
  import type { TaskImportConfig } from "../../types/integrations";
  import { setIcon } from "obsidian";
  import { getContextStore } from "./context";
  import { getPluginContext } from "./context";
  import type { FileContext } from "../../main";
  import { settingsStore } from "../../stores/settingsStore";

  interface Props {
    githubService: any;
    appleRemindersService: any;
    settings: {
      githubIntegration: GitHubIntegrationSettings;
      appleRemindersIntegration: AppleRemindersIntegrationSettings;
    };
    dependencies: {
      taskImportManager: any;
      getDefaultImportConfig: () => TaskImportConfig;
    };
  }

  let { githubService, appleRemindersService, settings, dependencies }: Props =
    $props();

  const { plugin } = getPluginContext();

  // State
  let activeService = $state<"github" | "local" | "apple-reminders">("local");

  // Get context store and reactive context
  const contextStore = getContextStore();
  let currentContext = $state<FileContext>({ type: "none" });

  // Get reactive settings from store
  let reactiveSettings = $state({
    githubIntegration: settings.githubIntegration,
    appleRemindersIntegration: settings.appleRemindersIntegration,
  });

  // Subscribe to context changes
  $effect(() => {
    const unsubscribe = contextStore.subscribe((value) => {
      currentContext = value;
    });
    return unsubscribe;
  });

  // Subscribe to settings changes
  $effect(() => {
    const unsubscribe = settingsStore.subscribe((storeState) => {
      if (storeState.settings) {
        reactiveSettings = {
          githubIntegration: storeState.settings.githubIntegration,
          appleRemindersIntegration:
            storeState.settings.appleRemindersIntegration,
        };
      }
    });
    return unsubscribe;
  });

  // Auto-switch to available service if current service becomes unavailable
  $effect(() => {
    const currentService = services.find((s) => s.id === activeService);
    if (currentService && !currentService.enabled) {
      // Find first available service
      const availableService = services.find((s) => s.enabled);
      if (availableService) {
        console.log(
          `🔄 TasksView: Switching from disabled ${activeService} to ${availableService.id}`
        );
        setActiveService(availableService.id);
      }
    }
  });

  // Load active service on component mount
  $effect(() => {
    loadActiveService();
  });

  // Detect day planning mode based on current file context
  let dayPlanningMode = $derived.by(() => {
    return currentContext.type === "daily";
  });

  // Get Daily Planning wizard mode from context store
  let dailyPlanningWizardMode = $derived(
    currentContext.dailyPlanningMode || false
  );

  // Available services with native Obsidian icons - reactive to settings changes
  let services = $derived([
    {
      id: "local",
      name: "Local Tasks",
      icon: "file-text", // Native Obsidian icon for local files
      enabled: true,
    },
    {
      id: "github",
      name: "GitHub",
      icon: "github", // Native Obsidian GitHub icon
      enabled: reactiveSettings.githubIntegration.enabled && !!githubService,
    },
    {
      id: "apple-reminders",
      name: "Apple Reminders",
      icon: "calendar-check", // Native Obsidian icon for reminders
      enabled:
        reactiveSettings.appleRemindersIntegration.enabled &&
        !!appleRemindersService &&
        appleRemindersService?.isPlatformSupported(),
    },
  ]);

  async function loadActiveService(): Promise<void> {
    try {
      const data = await plugin.loadData();
      if (data?.tasksViewActiveService) {
        activeService = data.tasksViewActiveService;
      }
    } catch (err: any) {
      console.warn("Failed to load active service:", err.message);
    }
  }

  async function saveActiveService(): Promise<void> {
    try {
      const data = (await plugin.loadData()) || {};
      data.tasksViewActiveService = activeService;
      await plugin.saveData(data);
    } catch (err: any) {
      console.warn("Failed to save active service:", err.message);
    }
  }

  function setActiveService(serviceId: string): void {
    activeService = serviceId as "github" | "local" | "apple-reminders";
    saveActiveService();
  }

  function updateSettings(newSettings: {
    githubIntegration: GitHubIntegrationSettings;
    appleRemindersIntegration: AppleRemindersIntegrationSettings;
  }): void {
    // Settings are now managed by the reactive store, so this function
    // is mainly for backward compatibility. The reactive settings will
    // automatically update when the store changes.
    reactiveSettings = newSettings;
  }

  async function refresh(): Promise<void> {
    // Delegate refresh to the active service component
    if (activeService === "github") {
      const methods = (window as any).__githubServiceMethods;
      if (methods && methods.refresh) {
        await methods.refresh();
      }
    } else if (activeService === "local") {
      const methods = (window as any).__localTasksServiceMethods;
      if (methods && methods.refresh) {
        await methods.refresh();
      }
    } else if (activeService === "apple-reminders") {
      const methods = (window as any).__appleRemindersServiceMethods;
      if (methods && methods.refresh) {
        await methods.refresh();
      }
    }
  }

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

  // Expose methods for the wrapper
  $effect(() => {
    if (typeof window !== "undefined") {
      (window as any).__tasksViewMethods = {
        updateSettings,
        refresh,
      };
    }
  });
</script>

<div class="tasks-view" data-type="tasks" data-testid="tasks-view">
  <div class="tasks-view-layout">
    <!-- Main Content Area -->
    <div class="tasks-view-main">
      <TabView
        className="tasks-view-tab"
        testId="tasks-view-tab"
        showContextWidget={true}
        isNonLocalService={activeService !== "local"}
        {dayPlanningMode}
        serviceName={activeService === "github"
          ? "GitHub"
          : activeService === "apple-reminders"
            ? "Apple Reminders"
            : activeService === "local"
              ? "Local Tasks"
              : ""}
      >
        <!-- Service Content - Only render active service -->
        <div class="service-content" data-testid="service-content">
          {#if activeService === "github" && reactiveSettings.githubIntegration.enabled && githubService}
            <GitHubService
              {githubService}
              settings={reactiveSettings}
              {dependencies}
              {dayPlanningMode}
            />
          {:else if activeService === "local"}
            <LocalTasksService {dayPlanningMode} {dailyPlanningWizardMode} />
          {:else if activeService === "apple-reminders" && reactiveSettings.appleRemindersIntegration.enabled && appleRemindersService}
            <AppleRemindersService
              {appleRemindersService}
              settings={reactiveSettings}
              {dependencies}
              {dayPlanningMode}
            />
          {:else}
            <!-- Show message when selected service is not available -->
            <div class="service-unavailable">
              <div class="service-unavailable-icon">⚠️</div>
              <h3>Service Not Available</h3>
              <p>
                The {activeService === "github" ? "GitHub" : "Apple Reminders"} integration
                is not enabled or not properly configured.
              </p>
              <p>Please check your settings to enable this integration.</p>
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

    <!-- Vertical Service Switcher on the right -->
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
  </div>
</div>

<!-- Styles moved to styles.css for consistency -->
