<script lang="ts">
  /**
   * AreaBadge - Standardized badge for areas (simple text style)
   */

  interface Props {
    area: string;
    size?: "small" | "medium" | "large";
    className?: string;
  }

  let { area, size = "medium", className = "" }: Props = $props();

  let sizeClass = $derived(`task-sync-badge-${size}`);
</script>

<span
  class="task-sync-area-badge task-sync-text-badge {sizeClass} {className}"
  title="Area: {area}"
>
  {area}
</span>
