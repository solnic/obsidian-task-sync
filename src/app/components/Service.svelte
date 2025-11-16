<script lang="ts">
  import type { TaskSyncSettings } from "../types/settings";
  import type { Extension } from "../core/extension";
  import type { DailyPlanningExtension } from "../extensions/daily-planning/DailyPlanningExtension";
  import LocalTasksService from "./LocalTasksService.svelte";
  import GitHubService from "../extensions/github/components/GitHubService.svelte";
  import AppleRemindersService from "../extensions/apple-reminders/components/AppleRemindersService.svelte";
  import DayView from "./DayView.svelte";
  import { Host } from "../core/host";
  import { isPlanningActive, currentSchedule } from "../stores/contextStore";

  interface Props {
    // Service ID to determine which service to render
    serviceId: string;

    // Settings for configuration
    settings?: TaskSyncSettings;

    // Host for data persistence and extension resolution
    host: Host;

    // Daily planning extension for planning functionality
    dailyPlanningExtension?: DailyPlanningExtension;

    // Unified staging state and handlers
    stagedTaskIds?: Set<string>;
    onStageTask?: (task: any) => void;

    // Test attributes
    testId?: string;
  }

  let {
    serviceId,
    settings,
    host,
    dailyPlanningExtension,
    stagedTaskIds = new Set(),
    onStageTask,
    testId,
  }: Props = $props();

  // Map service IDs to extension IDs
  // Service IDs are UI-friendly names, extension IDs are internal identifiers
  const serviceToExtensionId: Record<string, string> = {
    local: "obsidian",
    github: "github",
    "apple-reminders": "apple-reminders",
    calendar: "calendar",
  };

  // Resolve the extension from the host using the mapped extension ID
  let extension = $derived<Extension | undefined>(
    host.getExtensionById(serviceToExtensionId[serviceId])
  );

  // Map service IDs to their corresponding UI components
  // This is where we define which component renders which service
  const serviceComponents: Record<string, any> = {
    local: LocalTasksService,
    github: GitHubService,
    "apple-reminders": AppleRemindersService,
    calendar: DayView,
  };

  // Get the component to render based on serviceId
  let ServiceComponent = $derived(serviceComponents[serviceId]);

  // Load persisted local tasks settings
  let localTasksSettings = $state({
    recentlyUsedProjects: [],
    recentlyUsedAreas: [],
    recentlyUsedSources: [],
    selectedProject: null,
    selectedArea: null,
    selectedSource: null,
    showCompleted: false,
    sortFields: [
      { key: "updatedAt", label: "Updated", direction: "desc" },
      { key: "title", label: "Title", direction: "asc" },
    ],
  });

  let settingsLoaded = $state(false);

  // Load settings when component mounts or when serviceId changes to local
  $effect(() => {
    if (serviceId === "local") {
      loadLocalTasksSettings();
    } else {
      settingsLoaded = true; // For non-local services, no need to wait
    }
  });

  async function loadLocalTasksSettings(): Promise<void> {
    try {
      const data = await host.loadData();
      if (data?.localTasksFilters) {
        localTasksSettings = {
          recentlyUsedProjects:
            data.localTasksFilters.recentlyUsedProjects ?? [],
          recentlyUsedAreas: data.localTasksFilters.recentlyUsedAreas ?? [],
          recentlyUsedSources: data.localTasksFilters.recentlyUsedSources ?? [],
          selectedProject: data.localTasksFilters.selectedProject ?? null,
          selectedArea: data.localTasksFilters.selectedArea ?? null,
          selectedSource: data.localTasksFilters.selectedSource ?? null,
          showCompleted: data.localTasksFilters.showCompleted ?? false,
          sortFields: [
            { key: "updatedAt", label: "Updated", direction: "desc" },
            { key: "title", label: "Title", direction: "asc" },
          ],
        };
      }
    } catch (err: any) {
      console.warn("Failed to load local tasks settings:", err.message);
    } finally {
      settingsLoaded = true;
    }
  }
</script>

<!-- Render the service component dynamically -->
{#if ServiceComponent && extension && settings && settingsLoaded}
  <ServiceComponent
    {settings}
    {localTasksSettings}
    {extension}
    {host}
    isPlanningActive={$isPlanningActive}
    currentSchedule={$currentSchedule}
    {dailyPlanningExtension}
    {stagedTaskIds}
    {onStageTask}
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
        : !settings
          ? " (settings not provided)"
          : " (no UI component)"}.
    </p>
  </div>
{/if}
