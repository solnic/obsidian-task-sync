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
  import type { FileContext } from "../../main";

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

  // State
  let activeService = $state<"github" | "local" | "apple-reminders">("local");

  // Get context store and reactive context
  const contextStore = getContextStore();
  let currentContext = $state<FileContext>({ type: "none" });

  // Subscribe to context changes
  $effect(() => {
    const unsubscribe = contextStore.subscribe((value) => {
      currentContext = value;
    });
    return unsubscribe;
  });

  // Detect day planning mode based on current file context
  let dayPlanningMode = $derived.by(() => {
    return currentContext.type === "daily";
  });

  // Available services with native Obsidian icons
  const services = [
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
      enabled: true,
    },
    {
      id: "apple-reminders",
      name: "Apple Reminders",
      icon: "calendar-check", // Native Obsidian icon for reminders
      enabled:
        appleRemindersService?.isPlatformSupported() &&
        settings.appleRemindersIntegration.enabled,
    },
  ];

  function setActiveService(serviceId: string): void {
    activeService = serviceId as "github" | "local" | "apple-reminders";
  }

  function updateSettings(newSettings: {
    githubIntegration: GitHubIntegrationSettings;
    appleRemindersIntegration: AppleRemindersIntegrationSettings;
  }): void {
    settings = newSettings;
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
        showContextWidget={activeService !== "local"}
        showImportIndicator={activeService !== "local"}
      >
        <!-- Service Content -->
        <div class="service-content" data-testid="service-content">
          {#if activeService === "github"}
            <GitHubService
              {githubService}
              {settings}
              {dependencies}
              {dayPlanningMode}
            />
          {:else if activeService === "local"}
            <LocalTasksService {dayPlanningMode} />
          {:else if activeService === "apple-reminders"}
            <AppleRemindersService
              {appleRemindersService}
              {settings}
              {dependencies}
              {dayPlanningMode}
            />
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
