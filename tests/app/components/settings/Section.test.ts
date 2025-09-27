/**
 * Unit tests for Section.svelte component
 */

import { describe, test, expect } from "vitest";
import { render } from "@testing-library/svelte";
import Section from "../../../../src/app/components/settings/svelte/Section.svelte";
import { DEFAULT_SETTINGS } from "../../../../src/app/types/settings";

// Mock Obsidian App
const mockApp = {
  vault: {
    getAllLoadedFiles: () => [],
  },
} as any;

// Mock plugin
const mockPlugin = {
  settings: DEFAULT_SETTINGS,
  saveSettings: async () => {},
} as any;

describe("Section.svelte", () => {
  test("should render general settings section", () => {
    const section = { id: "general", title: "General" };
    const saveSettings = async () => {};

    const { getByTestId } = render(Section, {
      props: {
        section,
        settings: DEFAULT_SETTINGS,
        saveSettings,
        app: mockApp,
        plugin: mockPlugin,
      },
    });

    expect(getByTestId("settings-section-general")).toBeTruthy();
  });

  test("should render templates settings section", () => {
    const section = { id: "templates", title: "Templates" };
    const saveSettings = async () => {};

    const { getByTestId } = render(Section, {
      props: {
        section,
        settings: DEFAULT_SETTINGS,
        saveSettings,
        app: mockApp,
        plugin: mockPlugin,
      },
    });

    expect(getByTestId("settings-section-templates")).toBeTruthy();
  });

  test("should render bases settings section", () => {
    const section = { id: "bases", title: "Bases" };
    const saveSettings = async () => {};

    const { getByTestId } = render(Section, {
      props: {
        section,
        settings: DEFAULT_SETTINGS,
        saveSettings,
        app: mockApp,
        plugin: mockPlugin,
      },
    });

    expect(getByTestId("settings-section-bases")).toBeTruthy();
  });

  test("should render task properties settings section", () => {
    const section = { id: "task-properties", title: "Task Properties" };
    const saveSettings = async () => {};

    const { getByTestId } = render(Section, {
      props: {
        section,
        settings: DEFAULT_SETTINGS,
        saveSettings,
        app: mockApp,
        plugin: mockPlugin,
      },
    });

    expect(getByTestId("settings-section-task-properties")).toBeTruthy();
  });

  test("should render task categories settings section", () => {
    const section = { id: "task-categories", title: "Task Categories" };
    const saveSettings = async () => {};

    const { getByTestId } = render(Section, {
      props: {
        section,
        settings: DEFAULT_SETTINGS,
        saveSettings,
        app: mockApp,
        plugin: mockPlugin,
      },
    });

    expect(getByTestId("settings-section-task-categories")).toBeTruthy();
  });

  test("should render task priorities settings section", () => {
    const section = { id: "task-priorities", title: "Task Priorities" };
    const saveSettings = async () => {};

    const { getByTestId } = render(Section, {
      props: {
        section,
        settings: DEFAULT_SETTINGS,
        saveSettings,
        app: mockApp,
        plugin: mockPlugin,
      },
    });

    expect(getByTestId("settings-section-task-priorities")).toBeTruthy();
  });

  test("should render task statuses settings section", () => {
    const section = { id: "task-statuses", title: "Task Statuses" };
    const saveSettings = async () => {};

    const { getByTestId } = render(Section, {
      props: {
        section,
        settings: DEFAULT_SETTINGS,
        saveSettings,
        app: mockApp,
        plugin: mockPlugin,
      },
    });

    expect(getByTestId("settings-section-task-statuses")).toBeTruthy();
  });

  test("should render integrations settings section", () => {
    const section = { id: "integrations", title: "Integrations" };
    const saveSettings = async () => {};

    const { getByTestId } = render(Section, {
      props: {
        section,
        settings: DEFAULT_SETTINGS,
        saveSettings,
        app: mockApp,
        plugin: mockPlugin,
      },
    });

    expect(getByTestId("settings-section-integrations")).toBeTruthy();
  });
});
