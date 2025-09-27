<script lang="ts">
  import type {
    SettingsSection,
    TaskSyncSettings,
  } from "../../../types/settings";
  import { Setting, App } from "obsidian";
  import { onMount } from "svelte";
  import { DEFAULT_SETTINGS } from "../../../types/settings";
  import { validateFolderPath, validateBaseFileName } from "../validation";
  import { FolderSuggestComponent, FileSuggestComponent } from "../suggest";
  import type TaskSyncPlugin from "../../../../main";

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
    // Bases Folder setting
    new Setting(container)
      .setName("Bases Folder")
      .setDesc("Folder where .base files are stored")
      .addText((text) => {
        const defaultValue = DEFAULT_SETTINGS.basesFolder;
        text
          .setPlaceholder(defaultValue)
          .setValue(settings.basesFolder)
          .onChange(async (value) => {
            const validation = validateFolderPath(value);
            if (validation.isValid) {
              settings.basesFolder = value;
              await saveSettings(settings);
            }
          });

        // Add folder suggestion
        const folderSuggest = new FolderSuggestComponent(app, text.inputEl);
        folderSuggest.onChange(async (value) => {
          const validation = validateFolderPath(value);
          if (validation.isValid) {
            settings.basesFolder = value;
            await saveSettings(settings);
          }
        });
        suggestComponents.push(folderSuggest);
      });

    // Tasks Base File setting
    new Setting(container)
      .setName("Tasks Base File")
      .setDesc("Name of the main tasks base file")
      .addText((text) => {
        const defaultValue = DEFAULT_SETTINGS.tasksBaseFile;
        text
          .setPlaceholder(defaultValue)
          .setValue(settings.tasksBaseFile)
          .onChange(async (value) => {
            const validation = validateBaseFileName(value);
            if (validation.isValid) {
              settings.tasksBaseFile = value;
              await saveSettings(settings);
            }
          });

        // Add file suggestion
        const fileSuggest = new FileSuggestComponent(app, text.inputEl, {
          fileExtensions: [".base"],
          folderPath: settings.basesFolder,
        });
        fileSuggest.onChange(async (value) => {
          const validation = validateBaseFileName(value);
          if (validation.isValid) {
            settings.tasksBaseFile = value;
            await saveSettings(settings);
          }
        });
        suggestComponents.push(fileSuggest);
      });

    // Auto Generate Bases toggle
    new Setting(container)
      .setName("Auto Generate Bases")
      .setDesc("Automatically generate base files when needed")
      .addToggle((toggle) =>
        toggle.setValue(settings.autoGenerateBases).onChange(async (value) => {
          settings.autoGenerateBases = value;
          await saveSettings(settings);
        })
      );

    // Auto Update Base Views toggle
    new Setting(container)
      .setName("Auto Update Base Views")
      .setDesc("Automatically update base views when tasks change")
      .addToggle((toggle) =>
        toggle
          .setValue(settings.autoUpdateBaseViews)
          .onChange(async (value) => {
            settings.autoUpdateBaseViews = value;
            await saveSettings(settings);
          })
      );

    // Enable Area Bases toggle
    new Setting(container)
      .setName("Enable Area Bases")
      .setDesc("Create individual base files for each area with filtered views")
      .addToggle((toggle) =>
        toggle.setValue(settings.areaBasesEnabled).onChange(async (value) => {
          settings.areaBasesEnabled = value;
          await saveSettings(settings);

          // Trigger base sync if enabled
          if (settings.autoSyncAreaProjectBases) {
            await plugin.syncAreaProjectBases();
          }
        })
      );

    // Enable Project Bases toggle
    new Setting(container)
      .setName("Enable Project Bases")
      .setDesc(
        "Create individual base files for each project with filtered views"
      )
      .addToggle((toggle) =>
        toggle
          .setValue(settings.projectBasesEnabled)
          .onChange(async (value) => {
            settings.projectBasesEnabled = value;
            await saveSettings(settings);

            // Trigger base sync if enabled
            if (settings.autoSyncAreaProjectBases) {
              await plugin.syncAreaProjectBases();
            }
          })
      );

    // Auto-Sync Area/Project Bases toggle
    new Setting(container)
      .setName("Auto-Sync Area/Project Bases")
      .setDesc(
        "Automatically update area and project bases when settings change"
      )
      .addToggle((toggle) =>
        toggle
          .setValue(settings.autoSyncAreaProjectBases)
          .onChange(async (value) => {
            settings.autoSyncAreaProjectBases = value;
            await saveSettings(settings);
          })
      );

    // Action buttons
    createActionButtons();

    return () => {
      // Cleanup suggest components
      suggestComponents.forEach((component) => {
        if (component.destroy) {
          component.destroy();
        }
      });
    };
  });

  function createActionButtons(): void {
    // Regenerate Bases button
    new Setting(container)
      .setName("Regenerate Bases")
      .setDesc("Manually regenerate all base files")
      .addButton((button) => {
        button
          .setButtonText("Regenerate")
          .setCta()
          .onClick(async () => {
            button.setDisabled(true);
            button.setButtonText("Regenerating...");
            try {
              await plugin.regenerateBases();
              button.setButtonText("✓ Regenerated");
              setTimeout(() => {
                button.setDisabled(false);
                button.setButtonText("Regenerate");
              }, 2000);
            } catch (error) {
              button.setButtonText("✗ Failed");
              console.error("Failed to regenerate bases:", error);
              setTimeout(() => {
                button.setDisabled(false);
                button.setButtonText("Regenerate");
              }, 2000);
            }
          });
      });
  }
</script>

<div bind:this={container}></div>
