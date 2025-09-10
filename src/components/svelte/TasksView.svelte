<script lang="ts">
  import GitHubService from "./GitHubService.svelte";
  import LocalTasksService from "./LocalTasksService.svelte";
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

  // Available services
  const services = [
    {
      id: "local",
      name: "Local Tasks",
      icon: "list-todo",
      enabled: true,
    },
    {
      id: "github",
      name: "GitHub",
      icon: "github",
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
      // Set service icons
      const serviceIcons = document.querySelectorAll(
        ".service-icon[data-icon]"
      );
      serviceIcons.forEach((iconEl) => {
        const iconName = iconEl.getAttribute("data-icon");
        if (iconName) {
          setIcon(iconEl as HTMLElement, iconName);
        }
      });

      // Set context icons
      const contextIcons = document.querySelectorAll(
        ".context-icon[data-icon]"
      );
      contextIcons.forEach((iconEl) => {
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
    <!-- Header with Service Switcher -->
    <div class="tasks-view-header">
      <!-- Service Switcher -->
      <div class="service-switcher" data-testid="service-switcher">
        {#each services as service}
          <button
            class="service-button {activeService === service.id
              ? 'active'
              : ''} {!service.enabled ? 'disabled' : ''}"
            title={service.name}
            onclick={() => setActiveService(service.id)}
            disabled={!service.enabled}
            data-testid="service-{service.id}"
            aria-label="Switch to {service.name}"
          >
            <span class="service-icon" data-icon={service.icon}></span>
            <span class="service-label">{service.name}</span>
          </button>
        {/each}
      </div>

      <!-- Context Indicator -->
      <div class="context-indicator">
        {#if dayPlanningMode}
          <span class="context-badge daily-note">
            <span class="context-icon" data-icon="calendar-days"></span>
            Daily Note Mode
          </span>
        {:else}
          <span class="context-badge project-area">
            <span class="context-icon" data-icon="folder"></span>
            Project/Area Mode
          </span>
        {/if}
      </div>
    </div>

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
  </div>
</div>

<style>
  .tasks-view-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .service-switcher {
    display: flex;
    gap: 0.5rem;
  }

  .service-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    background: var(--background-primary);
    color: var(--text-normal);
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 0.9em;
  }

  .service-button:hover {
    background: var(--background-modifier-hover);
  }

  .service-button.active {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-color: var(--interactive-accent);
  }

  .service-button.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .service-icon {
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .service-label {
    font-weight: 500;
  }

  .context-indicator {
    display: flex;
    align-items: center;
  }

  .context-badge {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    font-size: 0.85em;
    font-weight: 500;
  }

  .context-badge.daily-note {
    background: var(--color-accent-1);
    color: var(--text-on-accent);
  }

  .context-badge.project-area {
    background: var(--background-secondary);
    color: var(--text-muted);
  }

  .context-icon {
    width: 14px;
    height: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
