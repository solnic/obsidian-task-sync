<script lang="ts">
  /**
   * CalendarEventItem - Specialized TaskItem for calendar events
   */

  import TaskItem from "./TaskItem.svelte";
  import type { CalendarEvent } from "../../types/calendar";

  interface Props {
    event: CalendarEvent;
    isHovered?: boolean;
    onHover?: (hovered: boolean) => void;
    testId?: string;
  }

  let { event, isHovered = false, onHover, testId }: Props = $props();

  // Convert event data to TaskItem format
  let subtitle = $derived(event.calendar.name);

  let meta = $derived.by(() => {
    const parts: string[] = [];

    // Add time information
    if (event.allDay) {
      const startDate = event.startDate.toLocaleDateString();
      const endDate = event.endDate.toLocaleDateString();

      if (startDate === endDate) {
        parts.push(`All day on ${startDate}`);
      } else {
        parts.push(`All day from ${startDate} to ${endDate}`);
      }
    } else {
      // Check if same day
      if (event.startDate.toDateString() === event.endDate.toDateString()) {
        const startTime = event.startDate.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
        const endTime = event.endDate.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
        parts.push(
          `${event.startDate.toLocaleDateString()} ${startTime} - ${endTime}`
        );
      } else {
        parts.push(
          `${event.startDate.toLocaleString()} - ${event.endDate.toLocaleString()}`
        );
      }
    }

    // Add location if available
    if (event.location) {
      parts.push(`📍 ${event.location}`);
    }

    return parts.join(" • ");
  });

  let badges = $derived.by(() => {
    const result: Array<{
      text: string;
      type: "category" | "status" | "priority" | "project" | "area";
    }> = [];

    // Add event type badge
    result.push({
      text: event.allDay ? "All Day" : "Timed",
      type: "category",
    });

    // Add status badge (events are always "active")
    result.push({
      text: "Active",
      type: "status",
    });

    return result;
  });

  let labels = $derived.by(() => {
    const result: Array<{ name: string; color?: string }> = [];

    // Add calendar as a label
    result.push({
      name: event.calendar.name,
      color: event.calendar.color,
    });

    // Add time indicator
    if (event.allDay) {
      result.push({
        name: "All Day",
        color: "#6366f1", // Indigo color for all-day events
      });
    } else {
      result.push({
        name: "Timed Event",
        color: "#059669", // Green color for timed events
      });
    }

    return result;
  });
</script>

<TaskItem
  title={event.title}
  {subtitle}
  {meta}
  {badges}
  {labels}
  createdAt={event.startDate}
  {isHovered}
  {onHover}
  {testId}
/>
