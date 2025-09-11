<script lang="ts">
  import GitHubService from "./GitHubService.svelte";
  import LocalTasksService from "./LocalTasksService.svelte";
  import TabView from "./TabView.svelte";
  import type { GitHubIntegrationSettings } from "../ui/settings/types";
  import type { TaskImportConfig } from "../../types/integrations";
  import { setIcon } from "obsidian";
  import { getContextStore } from "./context";
  import type { FileContext } from "../../main";

  interface Props {
    githubService: any;
    settings: { githubIntegration: GitHubIntegrationSettings };
    dependencies: {
      taskImportManager: any;
      getDefaultImportConfig: () => TaskImportConfig;
    };
  }

  let { githubService, settings, dependencies }: Props = $props();

  // State
  let activeService = $state<"github" | "local">("local");

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
  ];

  function setActiveService(serviceId: string): void {
    activeService = serviceId as "github" | "local";
  }

  function updateSettings(newSettings: {
    githubIntegration: GitHubIntegrationSettings;
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
      <TabView className="tasks-view-tab" testId="tasks-view-tab">
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

<style>
  .tasks-view-layout {
    display: flex;
    height: 100%;
    gap: 12px;
  }

  .tasks-view-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .service-content {
    flex: 1;
    overflow: hidden;
  }

  .service-switcher-vertical {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 8px;
    background: var(--background-secondary);
    border-left: 1px solid var(--background-modifier-border);
    width: 48px;
    flex-shrink: 0;
  }

  .service-button-vertical {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    background: var(--background-primary);
    color: var(--text-normal);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .service-button-vertical:hover:not(.disabled) {
    background: var(--background-modifier-hover);
    border-color: var(--background-modifier-border-hover);
  }

  .service-button-vertical.active {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-color: var(--interactive-accent);
  }

  .service-button-vertical.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .service-icon-vertical {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }
</style>
