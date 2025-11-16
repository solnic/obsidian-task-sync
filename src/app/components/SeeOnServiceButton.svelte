<script lang="ts">
  /**
   * SeeOnServiceButton - Unified button for opening external service links
   * Provides consistent "See on {service}" text across all integrations
   */

  interface Props {
    serviceName: string;
    url: string;
    testId?: string;
  }

  let { serviceName, url, testId = "see-on-service-button" }: Props = $props();

  function handleClick() {
    window.open(url, "_blank");
  }
</script>

<button
  class="task-sync-see-on-service-button"
  title="See on {serviceName} (opens in new window)"
  onclick={handleClick}
  data-testid={testId}
>
  <span class="task-sync-see-on-service-text">See on {serviceName}</span>
  <span class="task-sync-see-on-service-icon">↗</span>
</button>

<style>
  .task-sync-see-on-service-button {
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    background: var(--background-secondary);
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .task-sync-see-on-service-button:hover {
    background: var(--background-modifier-hover);
    border-color: var(--background-modifier-border-hover);
    color: var(--text-normal);
  }

  .task-sync-see-on-service-text {
    font-size: 12px;
  }

  .task-sync-see-on-service-icon {
    font-size: 10px;
    opacity: 0.7;
  }
</style>
