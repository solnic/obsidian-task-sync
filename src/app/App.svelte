<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  interface Props {
    obsidianApp: any;
    plugin: any;
    settings: any;
  }

  let { obsidianApp, plugin, settings }: Props = $props();

  let isInitialized = $state(false);
  let initError = $state<string | null>(null);

  onMount(async () => {
    try {
      // Basic initialization - just mark as initialized for now
      isInitialized = true;
      console.log('TaskSync app initialized successfully');
    } catch (error) {
      console.error('Failed to initialize TaskSync app:', error);
      initError = error instanceof Error ? error.message : 'Unknown error';
    }
  });

  onDestroy(() => {
    console.log('TaskSync app destroyed');
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
      <h1>Hello from Task Sync</h1>
      <p>The new Svelte app is running!</p>
    </div>
  {/if}
</div>

<style>
  .task-sync-app {
    height: 100%;
    display: flex;
    flex-direction: column;
    padding: 1rem;
  }

  .app-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 2rem;
  }

  .loading-state, .error-state {
    text-align: center;
  }

  .app-content {
    flex: 1;
  }

  .app-content h1 {
    color: var(--text-normal);
    margin-bottom: 1rem;
  }

  .app-content p {
    color: var(--text-muted);
  }
</style>
