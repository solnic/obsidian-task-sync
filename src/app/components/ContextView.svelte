<script lang="ts">
  /**
   * ContextView component - Separate Obsidian view for context information
   * Shows context for the currently active file
   */

  import ContextWidget from "./ContextWidget.svelte";
  import type { Host } from "../core/host";
  import type { TaskSyncSettings } from "../types/settings";
  import { currentFileContext } from "../stores/contextStore";

  interface Props {
    host: Host;
    settings?: TaskSyncSettings;
  }

  let { host, settings }: Props = $props();

  // Get context from store
  let context = $derived($currentFileContext);
</script>

<div class="context-view-container" data-testid="context-view">
  <div class="context-view-header">
    <h3 class="context-view-title">
      {#if context?.type === "task"}
        Task
      {:else if context?.type === "project"}
        Project
      {:else if context?.type === "area"}
        Area
      {:else if context?.type === "daily"}
        Daily Note
      {:else}
        Context
      {/if}
    </h3>
  </div>
  <div class="context-view-content">
    <ContextWidget {context} {settings} {host} />
  </div>
</div>

<style>
  .context-view-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    min-height: 0;
    overflow: hidden;
  }

  .context-view-header {
    padding: 16px 16px 8px 16px;
    border-bottom: 1px solid var(--background-modifier-border);
    flex-shrink: 0;
  }

  .context-view-title {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-normal);
  }

  .context-view-content {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 16px;
  }
</style>
