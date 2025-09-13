/**
 * Custom Obsidian Day View for Schedule-X
 * Sunsama-inspired design with zoom controls and Obsidian theme integration
 */

import { createViewDay } from "@schedule-x/calendar";

// For now, let's use the standard day view and enhance it with CSS
// We'll add zoom functionality through DOM manipulation after the view is rendered
export const createObsidianDayView = (): any => {
  const dayView = createViewDay();

  // Override the view name to distinguish it
  return {
    ...dayView,
    name: "obsidian-day",
    label: "Day",
  };
};
