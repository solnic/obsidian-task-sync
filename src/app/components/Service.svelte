<script lang="ts">
  import LocalTasksService from "./LocalTasksService.svelte";
  import type { TaskSyncSettings } from "../types/settings";
  import { LocalTasksService as LocalTasksServiceClass } from "../services/LocalTasksService";
  import { onMount } from "svelte";

  interface Props {
    // Service ID to determine which service to render
    serviceId: string;

    // Settings for configuration
    settings?: TaskSyncSettings;

    // Host for data persistence
    host?: any;

    // Test attributes
    testId?: string;
  }

  let { serviceId, settings, host, testId }: Props = $props();

  // Create LocalTasksService instance with extension
  let localTasksService: LocalTasksServiceClass | undefined = $state();

  onMount(async () => {
    if (serviceId === "local") {
      try {
        // Get the ObsidianExtension from the taskSyncApp
        const { taskSyncApp } = await import("../App");

        // Access the extension through the app's private properties
        const obsidianExtension = (taskSyncApp as any).obsidianExtension;

        if (obsidianExtension && obsidianExtension.taskOperations) {
          // Create LocalTasksService with the extension's task operations
          localTasksService = new LocalTasksServiceClass(
            obsidianExtension.taskOperations
          );
        } else {
          console.warn("ObsidianExtension or taskOperations not available");
          // Create service without extension (will show warning on refresh)
          localTasksService = new LocalTasksServiceClass();
        }
      } catch (error) {
        console.error("Failed to create LocalTasksService:", error);
        localTasksService = new LocalTasksServiceClass();
      }
    }
  });
</script>

<!-- Render the appropriate service component based on serviceId -->
{#if serviceId === "local"}
  <LocalTasksService
    {settings}
    localTasksSettings={{}}
    {localTasksService}
    {host}
    testId={testId || "local-tasks-service"}
  />
{:else}
  <!-- Fallback for unsupported services -->
  <div class="service-unavailable">
    <div class="service-unavailable-icon">⚠️</div>
    <h3>Service Not Available</h3>
    <p>The selected service "{serviceId}" is not available.</p>
  </div>
{/if}
