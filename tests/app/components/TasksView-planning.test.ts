/**
 * Tests for TasksView planning mode integration
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/svelte";
import TasksView from "../../../src/app/components/TasksView.svelte";
import { Host } from "../../../src/app/core/host";
import { extensionRegistry } from "../../../src/app/core/extension";
import { DailyPlanningExtension } from "../../../src/app/extensions/DailyPlanningExtension";
import { ObsidianExtension } from "../../../src/app/extensions/ObsidianExtension";
import type { TaskSyncSettings } from "../../../src/app/types/settings";
import { writable } from "svelte/store";

// Mock Obsidian
vi.mock("obsidian", () => ({
  Plugin: class MockPlugin {},
  setIcon: vi.fn(),
}));

describe("TasksView Planning Mode Integration", () => {
  let host: Host;
  let settings: TaskSyncSettings;
  let dailyPlanningExtension: DailyPlanningExtension;
  let obsidianExtension: ObsidianExtension;

  beforeEach(() => {
    // Clear extension registry
    extensionRegistry.getAll().forEach(ext => {
      extensionRegistry.unregister(ext.id);
    });

    // Create mock settings
    settings = {
      githubIntegration: { enabled: false },
      appleRemindersIntegration: { enabled: false },
      calendarIntegration: { enabled: false },
    } as TaskSyncSettings;

    // Create mock host
    host = new Host({} as any, settings);

    // Create mock extensions
    obsidianExtension = {
      id: "obsidian",
      name: "Obsidian",
      version: "1.0.0",
      supportedEntities: ["task"],
      initialize: vi.fn().mockResolvedValue(undefined),
      load: vi.fn().mockResolvedValue(undefined),
      shutdown: vi.fn().mockResolvedValue(undefined),
      onEntityCreated: vi.fn().mockResolvedValue(undefined),
      onEntityUpdated: vi.fn().mockResolvedValue(undefined),
      onEntityDeleted: vi.fn().mockResolvedValue(undefined),
      isHealthy: vi.fn().mockResolvedValue(true),
      getTasks: vi.fn().mockReturnValue(writable([])),
      refresh: vi.fn().mockResolvedValue(undefined),
      searchTasks: vi.fn().mockReturnValue([]),
      filterTasks: vi.fn().mockReturnValue([]),
      sortTasks: vi.fn().mockReturnValue([]),
    } as any;

    dailyPlanningExtension = {
      id: "daily-planning",
      name: "Daily Planning",
      version: "1.0.0",
      supportedEntities: ["schedule"],
      initialize: vi.fn().mockResolvedValue(undefined),
      load: vi.fn().mockResolvedValue(undefined),
      shutdown: vi.fn().mockResolvedValue(undefined),
      onEntityCreated: vi.fn().mockResolvedValue(undefined),
      onEntityUpdated: vi.fn().mockResolvedValue(undefined),
      onEntityDeleted: vi.fn().mockResolvedValue(undefined),
      isHealthy: vi.fn().mockResolvedValue(true),
      getTasks: vi.fn().mockReturnValue(writable([])),
      refresh: vi.fn().mockResolvedValue(undefined),
      searchTasks: vi.fn().mockReturnValue([]),
      filterTasks: vi.fn().mockReturnValue([]),
      sortTasks: vi.fn().mockReturnValue([]),
      getPlanningActive: vi.fn().mockReturnValue(writable(false)),
      getCurrentSchedule: vi.fn().mockReturnValue(writable(null)),
      setPlanningActive: vi.fn(),
      setCurrentSchedule: vi.fn(),
      moveTaskToToday: vi.fn().mockResolvedValue(undefined),
    } as any;

    // Register extensions
    extensionRegistry.register(obsidianExtension);
    extensionRegistry.register(dailyPlanningExtension);

    // Mock host.getExtensionById
    vi.spyOn(host, 'getExtensionById').mockImplementation((id: string) => {
      if (id === "obsidian") return obsidianExtension;
      if (id === "daily-planning") return dailyPlanningExtension;
      return undefined;
    });
  });

  it("should not show planning header when planning is inactive", () => {
    render(TasksView, {
      props: { settings, host }
    });

    expect(screen.queryByTestId("planning-header")).not.toBeInTheDocument();
  });

  it("should show planning header when planning is active", async () => {
    // Set planning as active
    const planningActiveStore = writable(true);
    dailyPlanningExtension.getPlanningActive = vi.fn().mockReturnValue(planningActiveStore);

    render(TasksView, {
      props: { settings, host }
    });

    // Wait for reactive updates
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(screen.getByTestId("planning-header")).toBeInTheDocument();
    expect(screen.getByText("📅 Daily Planning Mode")).toBeInTheDocument();
    expect(screen.getByText("Select tasks to add to today's schedule")).toBeInTheDocument();
  });

  it("should show planning hint when no tasks are selected", async () => {
    // Set planning as active
    const planningActiveStore = writable(true);
    dailyPlanningExtension.getPlanningActive = vi.fn().mockReturnValue(planningActiveStore);

    render(TasksView, {
      props: { settings, host }
    });

    // Wait for reactive updates
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(screen.getByText("Click tasks to select them for scheduling")).toBeInTheDocument();
  });
});
