<script lang="ts">
  import type {
    SettingsSection,
    TaskSyncSettings,
    TaskPriority,
    TaskPriorityColor,
  } from "../../../types/settings";

  import { Setting } from "obsidian";
  import { onMount } from "svelte";
  import { createPriorityBadge } from "../../../utils/badges";
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
      text: "Configure the available task priorities and their colors.",
      cls: "task-sync-settings-section-desc",
    });

    // Create settings for existing task priorities
    createTaskPrioritySettings();

    // Add new task priority section
    createAddTaskPrioritySection();
  });

  function createTaskPrioritySettings(): void {
    // Create a setting for each task priority
    settings.taskPriorities.forEach((taskPriority, index) => {
      const setting = new Setting(container);

      // Add priority badge preview
      const badgeContainer = setting.controlEl.createDiv(
        "task-sync-settings-badge-preview"
      );
      const badge = createPriorityBadge(taskPriority);
      badgeContainer.appendChild(badge);

      // Add name input
      setting.addText((text) => {
        text
          .setValue(taskPriority.name)
          .setPlaceholder("Priority name")
          .onChange(async (value) => {
            if (value.trim()) {
              settings.taskPriorities[index].name = value.trim();
              await saveSettings(settings);

              // Update badge
              badge.textContent = value.trim();

              // Trigger base sync if enabled
              if (settings.autoSyncAreaProjectBases) {
                await plugin.syncAreaProjectBases();
              }
            }
          });
      });

      // Add color picker
      setting.addColorPicker((colorPicker) => {
        // Convert named color to hex for color picker
        const colorMap: Record<TaskPriorityColor, string> = {
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
          .setValue(colorMap[taskPriority.color as TaskPriorityColor])
          .onChange(async (value: string) => {
            // Convert hex back to named color (find closest match)
            const hexToColor = Object.entries(colorMap).reduce(
              (closest, [color, hex]) => {
                const currentDistance = Math.abs(
                  parseInt(value.slice(1), 16) - parseInt(hex.slice(1), 16)
                );
                const closestDistance = Math.abs(
                  parseInt(value.slice(1), 16) -
                    parseInt(
                      colorMap[closest as TaskPriorityColor].slice(1),
                      16
                    )
                );
                return currentDistance < closestDistance
                  ? (color as TaskPriorityColor)
                  : closest;
              },
              "blue" as TaskPriorityColor
            );

            settings.taskPriorities[index].color = hexToColor;
            await saveSettings(settings);

            // Update badge color
            badge.className = `task-priority-badge task-priority-${hexToColor}`;

            // Trigger base sync if enabled
            if (settings.autoSyncAreaProjectBases) {
              await plugin.syncAreaProjectBases();
            }
          });
      });

      // Add delete button (don't allow deleting if it's the last priority)
      if (settings.taskPriorities.length > 1) {
        setting.addButton((button) => {
          button
            .setButtonText("Delete")
            .setWarning()
            .onClick(async () => {
              settings.taskPriorities.splice(index, 1);
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

  function createAddTaskPrioritySection(): void {
    let newPriorityName = "";
    let newPriorityColor: TaskPriorityColor = "blue";

    const addSetting = new Setting(container);

    // Add badge preview for new priority
    const badgeContainer = addSetting.controlEl.createDiv(
      "task-sync-settings-badge-preview"
    );
    const badge = createPriorityBadge({
      name: "New Priority",
      color: newPriorityColor,
    });
    badgeContainer.appendChild(badge);

    // Name input
    addSetting.addText((text) => {
      text.setPlaceholder("Priority name").onChange((value) => {
        newPriorityName = value.trim();
        // Update preview badge
        badge.textContent = newPriorityName || "New Priority";
      });
    });

    // Color picker
    addSetting.addColorPicker((colorPicker) => {
      // Convert named color to hex for color picker
      const colorMap: Record<TaskPriorityColor, string> = {
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
        .setValue(colorMap[newPriorityColor])
        .onChange((value: string) => {
          // Convert hex back to named color (find closest match)
          const hexToColor = Object.entries(colorMap).reduce(
            (closest, [color, hex]) => {
              const currentDistance = Math.abs(
                parseInt(value.slice(1), 16) - parseInt(hex.slice(1), 16)
              );
              const closestDistance = Math.abs(
                parseInt(value.slice(1), 16) -
                  parseInt(colorMap[closest as TaskPriorityColor].slice(1), 16)
              );
              return currentDistance < closestDistance
                ? (color as TaskPriorityColor)
                : closest;
            },
            "blue" as TaskPriorityColor
          );

          newPriorityColor = hexToColor;
          // Update preview badge
          badge.className = `task-priority-badge task-priority-${hexToColor}`;
        });
    });

    // Add button
    addSetting.addButton((button) => {
      button
        .setButtonText("Add Priority")
        .setCta()
        .onClick(async () => {
          if (!newPriorityName) {
            // Show error - priority name is required
            return;
          }

          // Check for duplicate names
          const isDuplicate = settings.taskPriorities.some(
            (priority) =>
              priority.name.toLowerCase() === newPriorityName.toLowerCase()
          );

          if (isDuplicate) {
            // Show error - duplicate name
            return;
          }

          // Add the new priority
          const newTaskPriority: TaskPriority = {
            name: newPriorityName,
            color: newPriorityColor,
          };

          settings.taskPriorities.push(newTaskPriority);
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

  function recreateSection(): void {
    // Description
    container.createEl("p", {
      text: "Configure the available task priorities and their colors.",
      cls: "task-sync-settings-section-desc",
    });

    // Create settings for existing task priorities
    createTaskPrioritySettings();

    // Add new task priority section
    createAddTaskPrioritySection();
  }
</script>

<div bind:this={container}></div>
