<script lang="ts">
  import LocalTasksService from "./LocalTasksService.svelte";
  import type { TaskSyncSettings } from "../types/settings";

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
</script>

<!-- Render the appropriate service component based on serviceId -->
{#if serviceId === "local"}
  <LocalTasksService {settings} {host} testId={testId || "local-tasks-service"} />
{:else}
  <!-- Fallback for unsupported services -->
  <div class="service-unavailable">
    <div class="service-unavailable-icon">⚠️</div>
    <h3>Service Not Available</h3>
    <p>The selected service "{serviceId}" is not available.</p>
  </div>
{/if}
