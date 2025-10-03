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
  class="see-on-service-button"
  title="See on {serviceName} (opens in new window)"
  onclick={handleClick}
  data-testid={testId}
>
  <span class="see-on-service-text">See on {serviceName}</span>
  <span class="see-on-service-icon">↗</span>
</button>

<style>
  .see-on-service-button {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 8px 16px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    background: var(--background-secondary);
    color: var(--text-muted);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .see-on-service-button:hover {
    background: var(--background-modifier-hover);
    border-color: var(--background-modifier-border-hover);
    color: var(--text-normal);
  }

  .see-on-service-text {
    font-size: 12px;
  }

  .see-on-service-icon {
    font-size: 10px;
    opacity: 0.7;
  }
</style>
