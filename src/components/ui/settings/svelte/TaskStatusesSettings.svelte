<script lang="ts">
  import type {
    SettingsSection,
    TaskSyncSettings,
    TaskStatus,
    TaskStatusColor,
  } from "../types";

  import { Setting } from "obsidian";
  import { onMount } from "svelte";
  import { createStatusBadge } from "../../StatusBadge";
  import type TaskSyncPlugin from "../../../../main";

  let container: HTMLElement;

  interface Props {
    section: SettingsSection;
    settings: TaskSyncSettings;
    saveSettings: (newSettings: TaskSyncSettings) => Promise<void>;
    plugin: TaskSyncPlugin;
  }

  let { settings = $bindable(), saveSettings, plugin }: Props = $props();

  onMount(() => {
    // Description
    container.createEl("p", {
      text: "Configure the available task statuses, their colors, and which statuses represent completed or in-progress tasks.",
      cls: "task-sync-settings-section-desc",
    });

    // Create settings for existing task statuses
    createTaskStatusSettings();

    // Add new task status section
    createAddTaskStatusSection();
  });

  function addTaskStatusControls(
    setting: Setting,
    taskStatus: TaskStatus,
    index: number,
    isNewStatus: boolean = false,
    onUpdate?: () => void
  ) {
    // Add status badge preview
    const badgeContainer = setting.controlEl.createDiv(
      "task-sync-settings-badge-preview"
    );
    const badge = createStatusBadge(taskStatus);
    badgeContainer.appendChild(badge);

    // Add name input
    setting.addText((text) => {
      text
        .setValue(taskStatus.name)
        .setPlaceholder("Status name")
        .onChange(async (value) => {
          if (value.trim()) {
            if (isNewStatus) {
              taskStatus.name = value.trim();
            } else {
              settings.taskStatuses[index].name = value.trim();
              await saveSettings(settings);

              // Update badge
              badge.textContent = value.trim();

              // Trigger base sync if enabled
              if (settings.autoSyncAreaProjectBases) {
                await plugin.syncAreaProjectBases();
              }
            }
          }
        });

      text.inputEl.setAttribute("data-testid", "task-status-name-input");
      if (!isNewStatus) {
        text.inputEl.setAttribute("data-name", taskStatus.name);
      }
    });

    // Add color picker
    setting.addColorPicker((colorPicker) => {
      // Convert named color to hex for color picker
      const colorMap: Record<TaskStatusColor, string> = {
        blue: "#3b82f6",
        red: "#ef4444",
        green: "#10b981",
        yellow: "#f59e0b",
        purple: "#8b5cf6",
        orange: "#f97316",
        pink: "#ec4899",
        gray: "#6b7280",
        teal: "#14b8a6",
        indigo: "#6366f1",
      };

      colorPicker
        .setValue(colorMap[taskStatus.color as TaskStatusColor])
        .onChange(async (value: string) => {
          // Convert hex back to named color (find closest match)
          const hexToColor = Object.entries(colorMap).reduce(
            (closest, [color, hex]) => {
              const currentDistance = Math.abs(
                parseInt(value.slice(1), 16) - parseInt(hex.slice(1), 16)
              );
              const closestDistance = Math.abs(
                parseInt(value.slice(1), 16) -
                  parseInt(colorMap[closest as TaskStatusColor].slice(1), 16)
              );
              return currentDistance < closestDistance
                ? (color as TaskStatusColor)
                : closest;
            },
            "blue" as TaskStatusColor
          );

          if (isNewStatus) {
            taskStatus.color = hexToColor;
          } else {
            settings.taskStatuses[index].color = hexToColor;
            await saveSettings(settings);

            // Trigger base sync if enabled
            if (settings.autoSyncAreaProjectBases) {
              await plugin.syncAreaProjectBases();
            }
          }

          // Update badge color
          badge.className = `task-status-badge task-status-${hexToColor}`;
        });
    });

    // Add state radio buttons (inline)
    const stateContainer = setting.controlEl.createDiv(
      "task-status-state-container"
    );
    stateContainer.createSpan("task-status-state-label").textContent = "State:";

    // Create radio buttons for state selection (only In Progress and Done)
    const states = [
      {
        value: "in-progress",
        label: "In Progress",
        isDone: false,
        isInProgress: true,
      },
      { value: "done", label: "Done", isDone: true, isInProgress: false },
    ];

    const currentState = taskStatus.isDone
      ? "done"
      : taskStatus.isInProgress
        ? "in-progress"
        : "";

    states.forEach((state) => {
      const radioWrapper = stateContainer.createDiv(
        "task-status-radio-wrapper"
      );
      const radio = radioWrapper.createEl("input", { type: "radio" });
      radio.name = `task-status-state-${index}-${isNewStatus ? "new" : "existing"}`;
      radio.value = state.value;
      radio.checked = currentState === state.value;
      radio.setAttribute("data-testid", `task-status-state-${state.value}`);

      const label = radioWrapper.createEl("label");
      label.textContent = state.label;
      // Use addEventListener instead of onclick for better event handling
      label.addEventListener("click", () => {
        // Allow unselecting by clicking the same radio again
        if (radio.checked) {
          radio.checked = false;
          // Reset both flags to false (no state)
          if (isNewStatus) {
            taskStatus.isDone = false;
            taskStatus.isInProgress = false;
          } else {
            settings.taskStatuses[index].isDone = false;
            settings.taskStatuses[index].isInProgress = false;
            saveSettings(settings);
            if (settings.autoSyncAreaProjectBases) {
              plugin.syncAreaProjectBases();
            }
          }
        } else {
          radio.click();
        }
      });

      radio.onchange = async () => {
        if (radio.checked) {
          if (isNewStatus) {
            taskStatus.isDone = state.isDone;
            taskStatus.isInProgress = state.isInProgress;
          } else {
            settings.taskStatuses[index].isDone = state.isDone;
            settings.taskStatuses[index].isInProgress = state.isInProgress;
            await saveSettings(settings);

            // Trigger base sync if enabled
            if (settings.autoSyncAreaProjectBases) {
              await plugin.syncAreaProjectBases();
            }
          }
        }
      };
    });
  }

  function createTaskStatusSettings(): void {
    // Create a setting for each task status
    settings.taskStatuses.forEach((taskStatus, index) => {
      const setting = new Setting(container);

      // Add all controls using unified function
      addTaskStatusControls(setting, taskStatus, index, false);

      // Add delete button (don't allow deleting if it's the last status)
      if (settings.taskStatuses.length > 1) {
        setting.addButton((button) => {
          button
            .setButtonText("Delete")
            .setWarning()
            .onClick(async () => {
              settings.taskStatuses.splice(index, 1);
              await saveSettings(settings);

              // Refresh the section
              container.empty();
              recreateSection();

              // Trigger base sync if enabled
              if (settings.autoSyncAreaProjectBases) {
                await plugin.syncAreaProjectBases();
              }
            });
        });
      }
    });
  }

  function createAddTaskStatusSection(): void {
    let newTaskStatus: TaskStatus = {
      name: "",
      color: "blue",
      isDone: false,
      isInProgress: false,
    };

    const addSetting = new Setting(container).then((setting) => {
      setting.settingEl.setAttribute("data-testid", "add-task-status-section");
    });

    // Add all controls using unified function
    addTaskStatusControls(addSetting, newTaskStatus, -1, true);

    // Add button
    addSetting
      .addButton((button) => {
        button
          .setButtonText("Add Status")
          .setCta()
          .onClick(async () => {
            if (!newTaskStatus.name) {
              // Show error - status name is required
              return;
            }

            // Check for duplicate names
            const isDuplicate = settings.taskStatuses.some(
              (status) =>
                status.name.toLowerCase() === newTaskStatus.name.toLowerCase()
            );

            if (isDuplicate) {
              // Show error - duplicate name
              return;
            }

            // Add the new status
            settings.taskStatuses.push({ ...newTaskStatus });
            await saveSettings(settings);

            // Refresh the section
            container.empty();
            recreateSection();

            // Trigger base sync if enabled
            if (settings.autoSyncAreaProjectBases) {
              await plugin.syncAreaProjectBases();
            }
          });
      })
      .then((setting) => {
        const button = setting.controlEl.querySelector("button");
        if (button) {
          button.setAttribute("data-testid", "add-task-status-button");
        }
      });
  }

  function recreateSection(): void {
    // Description
    container.createEl("p", {
      text: "Configure the available task statuses, their colors, and which statuses represent completed or in-progress tasks.",
      cls: "task-sync-settings-section-desc",
    });

    // Create settings for existing task statuses
    createTaskStatusSettings();

    // Add new task status section
    createAddTaskStatusSection();
  }
</script>

<div bind:this={container}></div>
