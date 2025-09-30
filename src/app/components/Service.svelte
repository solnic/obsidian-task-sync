<script lang="ts">
  import type { TaskSyncSettings } from "../types/settings";
  import type { Extension } from "../core/extension";
  import LocalTasksService from "./LocalTasksService.svelte";
  import { Host } from "../core/host";

  interface Props {
    // Service ID to determine which service to render
    serviceId: string;

    // Settings for configuration
    settings?: TaskSyncSettings;

    // Host for data persistence and extension resolution
    host: Host;

    // Test attributes
    testId?: string;
  }

  let { serviceId, settings, host, testId }: Props = $props();

  // Resolve the extension from the host
  let extension = $derived<Extension | undefined>(
    host.getExtensionById(serviceId)
  );

  // Map service IDs to their corresponding UI components
  // This is where we define which component renders which service
  const serviceComponents: Record<string, any> = {
    local: LocalTasksService,
    // Future: github: GitHubTasksService,
    // Future: apple-reminders: AppleRemindersService,
  };

  // Get the component to render based on serviceId
  let ServiceComponent = $derived(serviceComponents[serviceId]);
</script>

<!-- Render the service component dynamically -->
{#if ServiceComponent && extension}
  <ServiceComponent
    {settings}
    localTasksSettings={{}}
    {extension}
    {host}
    testId={testId || `${serviceId}-service`}
  />
{:else}
  <!-- Fallback for unsupported services -->
  <div class="service-unavailable">
    <div class="service-unavailable-icon">⚠️</div>
    <h3>Service Not Available</h3>
    <p>
      The selected service "{serviceId}" is not available{!extension
        ? " (extension not found)"
        : " (no UI component)"}.
    </p>
  </div>
{/if}
