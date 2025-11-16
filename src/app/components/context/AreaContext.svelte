<script lang="ts">
  /**
   * AreaContext - Displays area properties in the context widget
   * Currently areas have no editable properties
   */

  import type { Area } from "../../core/entities";

  interface Props {
    area: Area;
    settings: any;
  }

  let { area, settings }: Props = $props();
</script>

<div class="area-context">
  <div class="no-context-message">
    <span class="no-context">No editable properties</span>
  </div>
</div>

<style>
  .area-context {
    display: flex;
    flex-direction: column;
  }

  .no-context-message {
    padding: 20px;
    text-align: center;
  }

  .no-context {
    color: var(--text-muted);
    font-style: italic;
    font-size: 14px;
  }
</style>
