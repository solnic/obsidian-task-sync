<script lang="ts">
  /**
   * TagBadge - Standardized badge for tags/labels
   */

  interface Props {
    tag: string;
    color?: string;
    size?: 'small' | 'medium' | 'large';
    className?: string;
  }

  let {
    tag,
    color,
    size = 'medium',
    className = '',
  }: Props = $props();

  let badgeColor = $derived(color || 'var(--background-modifier-border)');
  let textColor = $derived(color ? 'white' : 'var(--text-muted)');
  let sizeClass = $derived(`task-sync-badge-${size}`);
</script>

<span 
  class="task-sync-tag-badge {sizeClass} {className}"
  style="background-color: {badgeColor}; color: {textColor}"
  title="Tag: {tag}"
>
  {tag}
</span>

<style>
  .task-sync-tag-badge {
    display: inline-block;
    padding: 2px 6px;
    border-radius: 12px;
    font-weight: 500;
    text-align: center;
    white-space: nowrap;
  }

  .task-sync-badge-small {
    font-size: 0.6em;
    padding: 1px 4px;
  }

  .task-sync-badge-medium {
    font-size: 0.7em;
    padding: 2px 6px;
  }

  .task-sync-badge-large {
    font-size: 0.8em;
    padding: 3px 8px;
  }
</style>
