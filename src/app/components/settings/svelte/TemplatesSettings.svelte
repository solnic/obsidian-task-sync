<script lang="ts">
  import type {
    SettingsSection,
    TaskSyncSettings,
  } from "../../../types/settings";
  import { Setting, App } from "obsidian";
  import { onMount } from "svelte";
  import { DEFAULT_SETTINGS } from "../../../types/settings";
  import { validateFolderPath, validateTemplateFileName } from "../validation";
  import { FolderSuggestComponent, FileSuggestComponent } from "../suggest";
  import type TaskSyncPlugin from "../../../../main";
  import { taskSyncApp } from "../../../App";

  let container: HTMLElement;
  let suggestComponents: (FolderSuggestComponent | FileSuggestComponent)[] = [];

  interface Props {
    section: SettingsSection;
    settings: TaskSyncSettings;
    saveSettings: (newSettings: TaskSyncSettings) => Promise<void>;
    app: App;
    plugin: TaskSyncPlugin;
  }

  let { settings = $bindable(), saveSettings, app, plugin }: Props = $props();

  onMount(() => {
    // Template Folder setting
    new Setting(container)
      .setName("Template Folder")
      .setDesc("Folder where templates are stored")
      .addText((text) => {
        const defaultValue = DEFAULT_SETTINGS.templateFolder;
        text
          .setPlaceholder(defaultValue)
          .setValue(settings.templateFolder)
          .onChange(async (value) => {
            const validation = validateFolderPath(value);
            if (validation.isValid) {
              settings.templateFolder = value;
              await saveSettings(settings);
            }
          });

        // Add folder suggestion
        const folderSuggest = new FolderSuggestComponent(app, text.inputEl);
        folderSuggest.onChange(async (value) => {
          const validation = validateFolderPath(value);
          if (validation.isValid) {
            settings.templateFolder = value;
            await saveSettings(settings);
          }
        });
        suggestComponents.push(folderSuggest);
      });

    // Use Templater Plugin toggle
    new Setting(container)
      .setName("Use Templater Plugin")
      .setDesc(
        "Enable integration with Templater plugin for advanced templates"
      )
      .addToggle((toggle) =>
        toggle.setValue(settings.useTemplater).onChange(async (value) => {
          settings.useTemplater = value;
          await saveSettings(settings);
        })
      );

    // Default Task Template
    createFileSetting(
      "defaultTaskTemplate",
      "Default Task Template",
      "Default template to use when creating new tasks"
    );

    // Default Project Template
    createFileSetting(
      "defaultProjectTemplate",
      "Default Project Template",
      "Default template to use when creating new projects"
    );

    // Default Area Template
    createFileSetting(
      "defaultAreaTemplate",
      "Default Area Template",
      "Default template to use when creating new areas"
    );

    // Default Parent Task Template
    createFileSetting(
      "defaultParentTaskTemplate",
      "Default Parent Task Template",
      "Default template to use when creating new parent tasks"
    );

    // Template creation buttons
    createTemplateCreationButtons();

    return () => {
      // Cleanup suggest components
      suggestComponents.forEach((component) => {
        if (component.destroy) {
          component.destroy();
        }
      });
    };
  });

  function createFileSetting(
    key: keyof TaskSyncSettings,
    name: string,
    desc: string
  ): void {
    new Setting(container)
      .setName(name)
      .setDesc(desc)
      .addText((text) => {
        const defaultValue = DEFAULT_SETTINGS[key] as string;
        text
          .setPlaceholder(defaultValue)
          .setValue(settings[key] as string)
          .onChange(async (value) => {
            const validation = validateTemplateFileName(value);
            if (validation.isValid) {
              (settings[key] as any) = value;
              await saveSettings(settings);
            }
          });

        // Add file suggestion
        const fileSuggest = new FileSuggestComponent(app, text.inputEl, {
          fileExtensions: [".md"],
          folderPath: settings.templateFolder,
        });
        fileSuggest.onChange(async (value) => {
          const validation = validateTemplateFileName(value);
          if (validation.isValid) {
            (settings[key] as any) = value;
            await saveSettings(settings);
          }
        });
        suggestComponents.push(fileSuggest);
      });
  }

  function createTemplateCreationButtons(): void {
    // Task template creation
    new Setting(container)
      .setName("Create Default Task Template")
      .setDesc("Create the default task template file if it doesn't exist")
      .addButton((button) => {
        button
          .setButtonText("Create Template")
          .setCta()
          .onClick(async () => {
            button.setDisabled(true);
            button.setButtonText("Creating...");
            try {
              const templateOps = taskSyncApp.getTemplateOperations();
              await templateOps.createTemplate("task");
              button.setButtonText("✓ Created");
              setTimeout(() => {
                button.setDisabled(false);
                button.setButtonText("Create Template");
              }, 2000);
            } catch (error) {
              button.setButtonText("✗ Failed");
              console.error("Failed to create template:", error);
              setTimeout(() => {
                button.setDisabled(false);
                button.setButtonText("Create Template");
              }, 2000);
            }
          });
      });

    // Project template creation
    new Setting(container)
      .setName("Create Default Project Template")
      .setDesc("Create the default project template file if it doesn't exist")
      .addButton((button) => {
        button
          .setButtonText("Create Template")
          .setCta()
          .onClick(async () => {
            button.setDisabled(true);
            button.setButtonText("Creating...");
            try {
              const templateOps = taskSyncApp.getTemplateOperations();
              await templateOps.createTemplate("project");
              button.setButtonText("✓ Created");
              setTimeout(() => {
                button.setDisabled(false);
                button.setButtonText("Create Template");
              }, 2000);
            } catch (error) {
              button.setButtonText("✗ Failed");
              console.error("Failed to create template:", error);
              setTimeout(() => {
                button.setDisabled(false);
                button.setButtonText("Create Template");
              }, 2000);
            }
          });
      });

    // Area template creation
    new Setting(container)
      .setName("Create Default Area Template")
      .setDesc("Create the default area template file if it doesn't exist")
      .addButton((button) => {
        button
          .setButtonText("Create Template")
          .setCta()
          .onClick(async () => {
            button.setDisabled(true);
            button.setButtonText("Creating...");
            try {
              const templateOps = taskSyncApp.getTemplateOperations();
              await templateOps.createTemplate("area");
              button.setButtonText("✓ Created");
              setTimeout(() => {
                button.setDisabled(false);
                button.setButtonText("Create Template");
              }, 2000);
            } catch (error) {
              button.setButtonText("✗ Failed");
              console.error("Failed to create template:", error);
              setTimeout(() => {
                button.setDisabled(false);
                button.setButtonText("Create Template");
              }, 2000);
            }
          });
      });
  }
</script>

<div bind:this={container}></div>
