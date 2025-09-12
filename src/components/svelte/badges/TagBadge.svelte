<script lang="ts">
  /**
   * TagBadge - Standardized badge for tags/labels
   */

  interface Props {
    tag: string;
    color?: string;
    size?: "small" | "medium" | "large";
    className?: string;
  }

  let { tag, color, size = "medium", className = "" }: Props = $props();

  let badgeColor = $derived(color || "var(--background-modifier-border)");
  let textColor = $derived(color ? "white" : "var(--text-muted)");
  let sizeClass = $derived(`task-sync-badge-${size}`);
</script>

<span
  class="task-sync-tag-badge {sizeClass} {className}"
  style="background-color: {badgeColor}; color: {textColor}"
  title="Tag: {tag}"
>
  {tag}
</span>

<!-- Styles moved to styles.css for consistency -->
