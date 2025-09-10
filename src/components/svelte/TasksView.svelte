<script lang="ts">
  import { onMount } from "svelte";
  import { getPluginContext } from "./context";
  import GitHubService from "./GitHubService.svelte";
  import type { GitHubIntegrationSettings } from "../ui/settings/types";
  import type { TaskImportConfig } from "../../types/integrations";

  interface Props {
    githubService: any;
    settings: { githubIntegration: GitHubIntegrationSettings };
    dependencies: {
      taskImportManager: any;
      getDefaultImportConfig: () => TaskImportConfig;
    };
  }

  let { githubService, settings, dependencies }: Props = $props();

  const { plugin } = getPluginContext();

  // State
  let activeService = $state<"github">("github");

  // Available services
  const services = [
    {
      id: "github",
      name: "GitHub",
      icon: "github",
      enabled: true,
    },
  ];

  function setActiveService(serviceId: string): void {
    activeService = serviceId as "github";
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
    }
  }

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
        </button>
      {/each}
    </div>

    <!-- Service Content -->
    <div class="service-content" data-testid="service-content">
      {#if activeService === "github"}
        <GitHubService {githubService} {settings} {dependencies} />
      {/if}
    </div>
  </div>
</div>
