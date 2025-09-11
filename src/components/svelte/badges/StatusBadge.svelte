<script lang="ts">
  /**
   * StatusBadge - Standardized badge for task statuses
   */

  interface Props {
    status: string;
    color?: string;
    size?: 'small' | 'medium' | 'large';
    className?: string;
  }

  let {
    status,
    color,
    size = 'medium',
    className = '',
  }: Props = $props();

  // Default colors for common statuses
  const defaultColors: Record<string, string> = {
    'Open': '#10b981',
    'Closed': '#6b7280',
    'In Progress': '#3b82f6',
    'Done': '#10b981',
    'Todo': '#f59e0b',
    'Blocked': '#ef4444',
    'Review': '#8b5cf6',
    'Testing': '#14b8a6',
    'Merged': '#10b981',
    'Draft': '#f59e0b',
  };

  let badgeColor = $derived(color || defaultColors[status] || '#6b7280');
  let sizeClass = $derived(`task-sync-badge-${size}`);
</script>

<span 
  class="task-sync-status-badge {sizeClass} {className}"
  style="background-color: {badgeColor}"
  title="Status: {status}"
>
  {status}
</span>

<style>
  .task-sync-status-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 12px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: white;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
    text-align: center;
    white-space: nowrap;
  }

  .task-sync-badge-small {
    font-size: 0.65em;
    padding: 1px 6px;
    min-width: 40px;
  }

  .task-sync-badge-medium {
    font-size: 0.75em;
    padding: 2px 8px;
    min-width: 60px;
  }

  .task-sync-badge-large {
    font-size: 0.85em;
    padding: 3px 10px;
    min-width: 80px;
  }
</style>
