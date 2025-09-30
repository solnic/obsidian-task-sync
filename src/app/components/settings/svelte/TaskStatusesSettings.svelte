<script lang="ts">
  import type {
    SettingsSection,
    TaskSyncSettings,
    TaskStatus,
  } from "../../../types/settings";

  import { Setting } from "obsidian";
  import { onMount } from "svelte";
  import { createStatusBadge } from "../../../utils/badges";
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
      colorPicker.setValue(taskStatus.color).onChange(async (value: string) => {
        if (isNewStatus) {
          taskStatus.color = value;
        } else {
          settings.taskStatuses[index].color = value;
          await saveSettings(settings);

          // Update badge background color (pill style)
          badge.style.backgroundColor = value;

          // Trigger base sync if enabled
          if (settings.autoSyncAreaProjectBases) {
            await plugin.syncAreaProjectBases();
          }
        }
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
      label.setAttribute("for", radio.id || `radio-${index}-${state.value}`);

      // Set radio ID for proper label association
      if (!radio.id) {
        radio.id = `radio-${index}-${state.value}`;
      }

      // Use standard change event for radio button behavior
      radio.addEventListener("change", async () => {
        if (radio.checked) {
          // Update the task status flags based on selected state
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
      });

      // Add click handler to label for deselection behavior (optional enhancement)
      label.addEventListener("click", (e) => {
        // Allow deselecting by clicking the same radio again
        if (radio.checked) {
          e.preventDefault(); // Prevent default label behavior
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
        }
      });
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
      color: "#3b82f6", // Default blue color
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
