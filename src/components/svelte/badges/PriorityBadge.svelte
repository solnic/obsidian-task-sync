<script lang="ts">
  /**
   * PriorityBadge - Standardized badge for task priorities
   */

  interface Props {
    priority: string;
    color?: string;
    size?: 'small' | 'medium' | 'large';
    className?: string;
  }

  let {
    priority,
    color,
    size = 'medium',
    className = '',
  }: Props = $props();

  // Default colors for common priorities
  const defaultColors: Record<string, string> = {
    'Critical': '#dc2626',
    'High': '#ea580c',
    'Medium': '#f59e0b',
    'Low': '#10b981',
    'Urgent': '#dc2626',
    'Normal': '#6b7280',
    'P0': '#dc2626',
    'P1': '#ea580c',
    'P2': '#f59e0b',
    'P3': '#10b981',
    'P4': '#6b7280',
  };

  let badgeColor = $derived(color || defaultColors[priority] || '#6b7280');
  let sizeClass = $derived(`task-sync-badge-${size}`);
</script>

<span 
  class="task-sync-priority-badge {sizeClass} {className}"
  style="background-color: {badgeColor}"
  title="Priority: {priority}"
>
  {priority}
</span>

<style>
  .task-sync-priority-badge {
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
