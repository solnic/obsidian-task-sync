<script lang="ts">
  /**
   * CategoryBadge - Standardized badge for task categories/types with dot-style design
   */

  interface Props {
    category: string;
    color?: string;
    size?: "small" | "medium" | "large";
    className?: string;
  }

  let { category, color, size = "medium", className = "" }: Props = $props();

  // Default colors for common categories
  const defaultColors: Record<string, string> = {
    Feature: "#3b82f6",
    Bug: "#ef4444",
    Enhancement: "#10b981",
    Documentation: "#f59e0b",
    Maintenance: "#6b7280",
    Research: "#8b5cf6",
    Design: "#ec4899",
    Testing: "#14b8a6",
    Refactor: "#f97316",
  };

  let badgeColor = $derived(color || defaultColors[category] || "#6b7280");
  let sizeClass = $derived(`task-sync-badge-${size}`);
</script>

<span
  class="task-sync-category-badge task-sync-dot-badge {sizeClass} {className}"
  title="Category: {category}"
>
  <span class="task-sync-color-dot" style="background-color: {badgeColor}"
  ></span>
  <span class="task-sync-badge-label">{category}</span>
</span>
