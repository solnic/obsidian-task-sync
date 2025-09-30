<script lang="ts">
  import type {
    SettingsSection,
    TaskSyncSettings,
    TaskPriority,
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
        colorPicker
          .setValue(taskPriority.color)
          .onChange(async (value: string) => {
            settings.taskPriorities[index].color = value;
            await saveSettings(settings);

            // Update badge background color (pill style)
            badge.style.backgroundColor = value;

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
    let newPriorityColor = "#3b82f6"; // Default blue color

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
        // Update preview badge text
        const label = badge.querySelector("span:not(.task-sync-color-dot)");
        if (label) {
          label.textContent = newPriorityName || "New Priority";
        }
      });
    });

    // Color picker
    addSetting.addColorPicker((colorPicker) => {
      colorPicker.setValue(newPriorityColor).onChange((value: string) => {
        newPriorityColor = value;
        // Update preview badge color dot
        const dot = badge.querySelector(".task-sync-color-dot") as HTMLElement;
        if (dot) {
          dot.style.backgroundColor = value;
        }
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
