<script lang="ts">
  /**
   * LabelBadge - Generic badge with label and value (e.g., "Project: MyProject", "Area: Development", "Source: GitHub")
   */

  interface Props {
    label: string;
    value: string;
    size?: "small" | "medium" | "large";
    className?: string;
  }

  let { label, value, size = "medium", className = "" }: Props = $props();

  let sizeClass = $derived(`task-sync-badge-${size}`);
</script>

<span
  class="task-sync-location-badge {sizeClass} {className}"
  title="{label}: {value}"
>
  <span class="task-sync-location-label">{label}</span>
  <span class="task-sync-location-value">{value}</span>
</span>
