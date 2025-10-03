<script lang="ts">
  /**
   * ProjectBadge - Standardized badge for projects (simple text style)
   */

  interface Props {
    project: string;
    size?: "small" | "medium" | "large";
    className?: string;
  }

  let { project, size = "medium", className = "" }: Props = $props();

  let sizeClass = $derived(`task-sync-badge-${size}`);
</script>

<span
  class="task-sync-project-badge task-sync-text-badge {sizeClass} {className}"
  title="Project: {project}"
>
  {project}
</span>
