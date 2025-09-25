<script lang="ts">
  /**
   * StatusBadge - Standardized badge for task statuses with dot-style design
   */

  interface Props {
    status: string;
    color?: string;
    size?: "small" | "medium" | "large";
    className?: string;
  }

  let { status, color, size = "medium", className = "" }: Props = $props();

  // Default colors for common statuses
  const defaultColors: Record<string, string> = {
    Open: "#10b981",
    Closed: "#6b7280",
    "In Progress": "#3b82f6",
    Done: "#10b981",
    Todo: "#f59e0b",
    Blocked: "#ef4444",
    Review: "#8b5cf6",
    Testing: "#14b8a6",
    Merged: "#10b981",
    Draft: "#f59e0b",
  };

  let badgeColor = $derived(color || defaultColors[status] || "#6b7280");
  let sizeClass = $derived(`task-sync-badge-${size}`);
</script>

<span
  class="task-sync-status-badge task-sync-dot-badge {sizeClass} {className}"
  title="Status: {status}"
>
  <span class="task-sync-color-dot" style="background-color: {badgeColor}"
  ></span>
  <span class="task-sync-badge-label">{status}</span>
</span>
