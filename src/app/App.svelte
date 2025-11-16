<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import TasksView from "./components/TasksView.svelte";

  interface Props {
    obsidianApp: any;
    plugin: any;
    settings: any;
  }

  let { plugin, settings }: Props = $props();

  let isInitialized = $state(false);
  let initError = $state<string | null>(null);

  onMount(async () => {
    try {
      // Basic initialization - just mark as initialized for now
      isInitialized = true;
      console.log("TaskSync app initialized successfully");
    } catch (error) {
      console.error("Failed to initialize TaskSync app:", error);
      initError = error instanceof Error ? error.message : "Unknown error";
    }
  });

  onDestroy(() => {
    console.log("TaskSync app destroyed");
  });
</script>

<div class="task-sync-app" data-initialized={isInitialized}>
  {#if !isInitialized}
    <div class="app-loading">
      {#if initError}
        <div class="error-state">
          <h3>Initialization Failed</h3>
          <p>{initError}</p>
        </div>
      {:else}
        <div class="loading-state">
          <p>Initializing TaskSync...</p>
        </div>
      {/if}
    </div>
  {:else}
    <div class="app-content">
      <TasksView {settings} host={plugin.host} testId="tasks-view" />
    </div>
  {/if}
</div>
