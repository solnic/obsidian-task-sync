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
  title="See on {serviceName}"
  onclick={handleClick}
  data-testid={testId}
>
  See on {serviceName}
</button>

<style>
  .see-on-service-button {
    padding: 6px 12px;
    border: none;
    border-radius: 4px;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .see-on-service-button:hover {
    background: var(--interactive-accent-hover);
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
  }
</style>
