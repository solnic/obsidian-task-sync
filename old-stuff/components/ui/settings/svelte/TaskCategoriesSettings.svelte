<script lang="ts">
  import type { SettingsSection, TaskSyncSettings, TaskType } from "../types";

  import { Setting, Notice } from "obsidian";
  import { onMount } from "svelte";
  import { createTypeBadge } from "../../TypeBadge";
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
      text: "Configure the available task categories and their colors.",
      cls: "task-sync-settings-section-desc",
    });

    // Create settings for existing task types
    createTaskTypeSettings();

    // Add new task category section
    createAddTaskCategorySection();
  });

  function createTaskTypeSettings(): void {
    // Create a setting for each task type
    settings.taskTypes.forEach((taskType, index) => {
      const setting = new Setting(container);

      // Add type badge preview
      const badgeContainer = setting.controlEl.createDiv(
        "task-sync-settings-badge-preview"
      );
      const badge = createTypeBadge(taskType);
      badgeContainer.appendChild(badge);

      // Add color picker (positioned next to badge preview)
      setting.addColorPicker((colorPicker) => {
        // Convert named color to hex if needed
        let currentColor = taskType.color;
        if (!currentColor.startsWith("#")) {
          // Convert named color to hex for color picker
          const colorMap: Record<string, string> = {
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
          currentColor = colorMap[taskType.color] || "#3b82f6";
        }

        colorPicker.setValue(currentColor).onChange(async (value: string) => {
          // Store the hex color directly
          settings.taskTypes[index].color = value;
          await saveSettings(settings);

          // Update badge color with custom color
          badge.style.backgroundColor = value;
          badge.className = "task-type-badge"; // Remove predefined color classes

          // Trigger base sync if enabled
          if (settings.autoSyncAreaProjectBases) {
            await plugin.syncAreaProjectBases();
          }
        });
      });

      // Add name input
      setting.addText((text) => {
        text
          .setValue(taskType.name)
          .setPlaceholder("Task category name")
          .onChange(async (value) => {
            if (value.trim()) {
              settings.taskTypes[index].name = value.trim();
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

      // Add delete button (don't allow deleting if it's the last type)
      if (settings.taskTypes.length > 1) {
        setting.addButton((button) => {
          button
            .setButtonText("Delete")
            .setWarning()
            .onClick(async () => {
              settings.taskTypes.splice(index, 1);
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

  function createAddTaskCategorySection(): void {
    let newCategoryName = "";
    let newCategoryColor = "#3b82f6"; // Default to blue hex color

    const addSetting = new Setting(container)
      .setName("Add New Task Category")
      .setDesc("Create a new task category with custom color");

    addSetting.settingEl.setAttribute(
      "data-testid",
      "add-task-category-section"
    );

    // Add badge preview for new category
    const badgeContainer = addSetting.controlEl.createDiv(
      "task-sync-settings-badge-preview"
    );
    const badge = createTypeBadge({
      name: "New Category",
      color: newCategoryColor,
    });
    badgeContainer.appendChild(badge);

    // Color picker (positioned next to badge preview)
    addSetting.addColorPicker((colorPicker) => {
      colorPicker.setValue(newCategoryColor).onChange((value: string) => {
        newCategoryColor = value;
        // Update preview badge with custom color
        badge.style.backgroundColor = value;
        badge.className = "task-type-badge"; // Remove predefined color classes
      });
    });

    // Name input
    addSetting
      .addText((text) => {
        text.setPlaceholder("Category name").onChange((value) => {
          newCategoryName = value.trim();
          // Update preview badge
          badge.textContent = newCategoryName || "New Category";
        });
      })
      .then((setting) => {
        const input = setting.controlEl.querySelector('input[type="text"]');
        if (input) {
          input.setAttribute("data-testid", "task-category-name-input");
        }
      });

    // Add button
    addSetting
      .addButton((button) => {
        button
          .setButtonText("Add Category")
          .setCta()
          .onClick(async () => {
            if (!newCategoryName) {
              // Show error - category name is required
              new Notice("Category name is required");
              return;
            }

            // Check for duplicate names
            const isDuplicate = settings.taskTypes.some(
              (type) =>
                type.name.toLowerCase() === newCategoryName.toLowerCase()
            );

            if (isDuplicate) {
              // Show error - duplicate name
              new Notice(`Category "${newCategoryName}" already exists`);
              return;
            }

            // Add the new category
            const newTaskType: TaskType = {
              name: newCategoryName,
              color: newCategoryColor,
            };

            settings.taskTypes.push(newTaskType);
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
          button.setAttribute("data-testid", "add-task-category-button");
        }
      });
  }

  function recreateSection(): void {
    // Description
    container.createEl("p", {
      text: "Configure the available task categories and their colors.",
      cls: "task-sync-settings-section-desc",
    });

    // Create settings for existing task types
    createTaskTypeSettings();

    // Add new task category section
    createAddTaskCategorySection();
  }
</script>

<div bind:this={container}></div>
