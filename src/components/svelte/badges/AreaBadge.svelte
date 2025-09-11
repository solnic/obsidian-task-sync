<script lang="ts">
  /**
   * AreaBadge - Standardized badge for areas
   */

  interface Props {
    area: string;
    color?: string;
    size?: 'small' | 'medium' | 'large';
    className?: string;
    showIcon?: boolean;
  }

  let {
    area,
    color = '#10b981',
    size = 'medium',
    className = '',
    showIcon = true,
  }: Props = $props();

  let sizeClass = $derived(`task-sync-badge-${size}`);
</script>

<span 
  class="task-sync-area-badge {sizeClass} {className}"
  style="background-color: {color}"
  title="Area: {area}"
>
  {#if showIcon}
    <span class="task-sync-badge-icon">🏷️</span>
  {/if}
  {area}
</span>

<style>
  .task-sync-area-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: 12px;
    font-weight: 500;
    letter-spacing: 0.3px;
    color: white;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
    text-align: center;
    white-space: nowrap;
  }

  .task-sync-badge-icon {
    font-size: 0.8em;
    opacity: 0.9;
  }

  .task-sync-badge-small {
    font-size: 0.65em;
    padding: 1px 6px;
    gap: 2px;
  }

  .task-sync-badge-medium {
    font-size: 0.75em;
    padding: 2px 8px;
    gap: 4px;
  }

  .task-sync-badge-large {
    font-size: 0.85em;
    padding: 3px 10px;
    gap: 6px;
  }
</style>
