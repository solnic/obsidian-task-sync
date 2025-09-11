<script lang="ts">
  /**
   * CategoryBadge - Standardized badge for task categories/types
   */

  interface Props {
    category: string;
    color?: string;
    size?: 'small' | 'medium' | 'large';
    className?: string;
  }

  let {
    category,
    color,
    size = 'medium',
    className = '',
  }: Props = $props();

  // Default colors for common categories
  const defaultColors: Record<string, string> = {
    'Feature': '#3b82f6',
    'Bug': '#ef4444',
    'Enhancement': '#10b981',
    'Documentation': '#f59e0b',
    'Maintenance': '#6b7280',
    'Research': '#8b5cf6',
    'Design': '#ec4899',
    'Testing': '#14b8a6',
    'Refactor': '#f97316',
  };

  let badgeColor = $derived(color || defaultColors[category] || '#6b7280');
  let sizeClass = $derived(`task-sync-badge-${size}`);
</script>

<span 
  class="task-sync-category-badge {sizeClass} {className}"
  style="background-color: {badgeColor}"
  title="Category: {category}"
>
  {category}
</span>

<style>
  .task-sync-category-badge {
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
