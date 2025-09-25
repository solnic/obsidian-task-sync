<script lang="ts">
  /**
   * PriorityBadge - Standardized badge for task priorities with dot-style design
   */

  interface Props {
    priority: string;
    color?: string;
    size?: "small" | "medium" | "large";
    className?: string;
  }

  let { priority, color, size = "medium", className = "" }: Props = $props();

  // Default colors for common priorities
  const defaultColors: Record<string, string> = {
    Critical: "#dc2626",
    High: "#ea580c",
    Medium: "#f59e0b",
    Low: "#10b981",
    Urgent: "#dc2626",
    Normal: "#6b7280",
    P0: "#dc2626",
    P1: "#ea580c",
    P2: "#f59e0b",
    P3: "#10b981",
    P4: "#6b7280",
  };

  let badgeColor = $derived(color || defaultColors[priority] || "#6b7280");
  let sizeClass = $derived(`task-sync-badge-${size}`);
</script>

<span
  class="task-sync-priority-badge task-sync-dot-badge {sizeClass} {className}"
  title="Priority: {priority}"
>
  <span class="task-sync-color-dot" style="background-color: {badgeColor}"
  ></span>
  <span class="task-sync-badge-label">{priority}</span>
</span>
