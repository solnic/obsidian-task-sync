<script lang="ts">
  import type {
    SettingsSection,
    TaskSyncSettings,
  } from "../../../types/settings";
  import { Setting, Notice } from "obsidian";
  import { onMount } from "svelte";
  import type TaskSyncPlugin from "../../../../main";
  import type {
    NoteType,
    PropertyDefinition,
  } from "../../../core/type-note/types";

  let container: HTMLElement;

  interface Props {
    section: SettingsSection;
    settings: TaskSyncSettings;
    saveSettings: (newSettings: TaskSyncSettings) => Promise<void>;
    plugin: TaskSyncPlugin;
  }

  let { settings = $bindable(), saveSettings, plugin }: Props = $props();

  onMount(() => {
    recreateSection();
  });

  /**
   * Create property management interface using native Obsidian Settings
   * Following the pattern from TaskStatusesSettings.svelte
   */
  function createPropertyManagementInterface(
    container: HTMLElement,
    properties: Record<string, any>
  ) {
    const propertiesDiv = container.createDiv("properties-list");

    // Container for property items - created BEFORE the add button
    const propertiesContainer = propertiesDiv.createDiv("properties-items");

    // Create settings for existing properties
    createPropertySettings(propertiesContainer, properties);

    // Add property button - this stays at the bottom
    const addPropertySetting = new Setting(propertiesDiv);
    addPropertySetting.setClass("add-property-setting");
    addPropertySetting
      .setName("Add Property")
      .setDesc("Add a new property to this note type")
      .addButton((button) => {
        button
          .setButtonText("Add Property")
          .setCta()
          .onClick(() => {
            const newKey = `property_${Date.now()}`;
            const newProperty = {
              key: newKey,
              name: "New Property",
              schemaType: "string",
              frontMatterKey: newKey,
              required: false,
              defaultValue: "",
              description: "",
              visible: true,
              order: Object.keys(properties).length,
            };

            // Add the new property directly
            properties[newKey] = newProperty;

            // Recreate the property list to show the new property
            propertiesContainer.empty();
            createPropertySettings(propertiesContainer, properties);
          });
      });
  }

  /**
   * Create settings for each property
   * Following the pattern from TaskStatusesSettings.svelte
   */
  function createPropertySettings(
    container: HTMLElement,
    properties: Record<string, any>
  ) {
    // Create settings for each property
    Object.entries(properties).forEach(([key, property]) => {
      const propertySetting = new Setting(container);

      // Create a more descriptive name that includes the property name
      const propertyDisplayName = property.name || "New Property";
      const propertyTypeLabel =
        property.schemaType === "string"
          ? "Text"
          : property.schemaType === "number"
            ? "Number"
            : property.schemaType === "boolean"
              ? "Boolean"
              : property.schemaType === "date"
                ? "Date"
                : "Text";

      propertySetting
        .setName(propertyDisplayName)
        .setDesc(
          `Type: ${propertyTypeLabel} | Required: ${property.required ? "Yes" : "No"}`
        )
        .addText((text) => {
          text
            .setPlaceholder("Property name")
            .setValue(property.name || "")
            .onChange((value) => {
              // Directly modify the property
              property.name = value;
              // Update the setting name to reflect the change
              propertySetting.setName(value || "New Property");
            });
        })
        .addDropdown((dropdown) => {
          dropdown
            .addOption("string", "Text")
            .addOption("number", "Number")
            .addOption("boolean", "Boolean")
            .addOption("date", "Date")
            .setValue(property.schemaType || "string")
            .onChange((value) => {
              // Directly modify the property
              property.schemaType = value;
              // Update the description to reflect the change
              const typeLabel =
                value === "string"
                  ? "Text"
                  : value === "number"
                    ? "Number"
                    : value === "boolean"
                      ? "Boolean"
                      : value === "date"
                        ? "Date"
                        : "Text";
              propertySetting.setDesc(
                `Type: ${typeLabel} | Required: ${property.required ? "Yes" : "No"}`
              );
            });
        })
        .addToggle((toggle) => {
          toggle
            .setValue(property.required || false)
            .setTooltip("Toggle to mark this property as required")
            .onChange((value) => {
              // Directly modify the property
              property.required = value;
              // Update the description to reflect the change
              const typeLabel =
                property.schemaType === "string"
                  ? "Text"
                  : property.schemaType === "number"
                    ? "Number"
                    : property.schemaType === "boolean"
                      ? "Boolean"
                      : property.schemaType === "date"
                        ? "Date"
                        : "Text";
              propertySetting.setDesc(
                `Type: ${typeLabel} | Required: ${value ? "Yes" : "No"}`
              );
            });

          // Add a label next to the toggle for clarity
          const toggleContainer = toggle.toggleEl.parentElement;
          if (toggleContainer) {
            const label = toggleContainer.createSpan({
              text: "Required",
              cls: "setting-toggle-label",
            });
            label.style.marginLeft = "0.5rem";
            label.style.fontSize = "0.9rem";
            label.style.color = "var(--text-muted)";
          }
        })
        .addButton((button) => {
          button
            .setButtonText("Delete")
            .setWarning()
            .onClick(() => {
              // Delete the property
              delete properties[key];
              // Recreate the property list
              container.empty();
              createPropertySettings(container, properties);
            });
        });
    });
  }

  /**
   * Create template editor interface using native Obsidian Settings
   */
  function createTemplateEditorInterface(
    container: HTMLElement,
    template: any,
    onChange: (newTemplate: any) => void
  ) {
    // Template content
    const contentSetting = new Setting(container);
    contentSetting
      .setName("Template Content")
      .setDesc("Use {{variable}} syntax for property values")
      .addTextArea((textArea) => {
        textArea
          .setPlaceholder("# {{title}}\n\n{{description}}\n\n## Properties")
          .setValue(template.content || "")
          .onChange((value) => {
            const updatedTemplate = { ...template, content: value };
            onChange(updatedTemplate);
          });

        // Make textarea larger and editable
        textArea.inputEl.rows = 10;
        textArea.inputEl.style.width = "100%";
        textArea.inputEl.style.fontFamily = "monospace";
      });

    // Template variables info
    const variablesSetting = new Setting(container);
    variablesSetting
      .setName("Available Variables")
      .setDesc("These variables can be used in your template:");

    const variablesDiv = container.createDiv("template-variables");
    variablesDiv.innerHTML = `
      <ul>
        <li><code>{{title}}</code> - Note title</li>
        <li><code>{{description}}</code> - Note description</li>
        <li><code>{{date}}</code> - Current date</li>
        <li><code>{{time}}</code> - Current time</li>
      </ul>
    `;
  }

  function recreateSection(): void {
    // Description
    container.createEl("p", {
      text: "Manage note types for structured note creation. Note types define the properties, validation rules, and templates for different kinds of notes.",
      cls: "task-sync-settings-section-desc",
    });

    // Create note types list
    createNoteTypesSettings();

    // Add new note type section
    createAddNoteTypeSection();
  }

  function createNoteTypesSettings(): void {
    if (!plugin?.typeNote?.registry) {
      container.createEl("p", {
        text: "TypeNote registry not available",
        cls: "task-sync-settings-error",
      });
      return;
    }

    const noteTypes = plugin.typeNote.registry.getAll();

    if (noteTypes.length === 0) {
      // Empty state
      const emptyDiv = container.createDiv("task-sync-settings-empty-state");
      emptyDiv.createEl("p", { text: "No note types registered yet" });
      emptyDiv.createEl("p", {
        text: "Create your first note type to get started with structured notes.",
        cls: "task-sync-settings-empty-hint",
      });
    } else {
      // List existing note types
      noteTypes.forEach((noteType) => {
        const setting = new Setting(container);
        setting.setName(noteType.name);
        setting.setDesc(
          `ID: ${noteType.id} | Version: ${noteType.version}${
            noteType.metadata?.description
              ? ` | ${noteType.metadata.description}`
              : ""
          }`
        );

        // Add edit button
        setting.addButton((button) => {
          button
            .setButtonText("Edit")
            .setTooltip("Edit this note type")
            .onClick(() => {
              showNoteTypeEditor(noteType, false);
            });
        });

        // Add delete button
        setting.addButton((button) => {
          button
            .setButtonText("Delete")
            .setTooltip("Delete this note type")
            .setWarning()
            .onClick(() => {
              if (
                confirm(
                  `Are you sure you want to delete the note type "${noteType.name}"? This action cannot be undone.`
                )
              ) {
                const result = plugin.typeNote.registry.unregister(noteType.id);
                if (result) {
                  new Notice("Note type deleted successfully");
                  // Refresh the settings
                  container.empty();
                  recreateSection();
                } else {
                  new Notice(
                    `Failed to delete note type: ${noteType.name}`,
                    5000
                  );
                }
              }
            });
        });
      });
    }
  }

  function createAddNoteTypeSection(): void {
    // Add new note type section
    const addSetting = new Setting(container);
    addSetting.setName("Create New Note Type");
    addSetting.setDesc(
      "Create a new structured note type with properties and templates"
    );
    addSetting.addButton((button) => {
      button
        .setButtonText("Create New Note Type")
        .setCta()
        .onClick(() => {
          // Create a new empty note type for editing
          const newNoteType = {
            id: "",
            name: "",
            version: "1.0.0",
            properties: {},
            template: {
              version: "1.0.0",
              content: `# {{title}}\n\n{{description}}\n\n## Properties\n\n`,
              variables: {},
            },
            metadata: {
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          };
          showNoteTypeEditor(newNoteType, true);
        });
    });
  }

  function showNoteTypeEditor(
    noteType: NoteType,
    isNew: boolean = false
  ): void {
    // Clear container and show editor
    container.empty();

    // Back button
    const backSetting = new Setting(container);
    backSetting.setName("← Back to Note Types");
    backSetting.addButton((button) => {
      button.setButtonText("Back").onClick(() => {
        container.empty();
        recreateSection();
      });
    });

    // Editor title
    const title = isNew
      ? "Create Note Type"
      : `Edit Note Type: ${noteType.name}`;
    container.createEl("h3", { text: title });

    // State for editing
    let editId = noteType.id;
    let editName = noteType.name;
    let editVersion = noteType.version;
    let editDescription = noteType.metadata?.description || "";
    let editProperties = { ...noteType.properties };
    let editTemplate = { ...noteType.template };

    // Basic info section
    container.createEl("h4", { text: "Basic Information" });

    // Name setting
    const nameSetting = new Setting(container);
    nameSetting.setName("Name");
    nameSetting.setDesc("Display name for this note type");
    nameSetting.addText((text) => {
      text
        .setValue(editName)
        .setPlaceholder("e.g., Meeting Note, Project Plan")
        .onChange((value) => {
          editName = value;
          // Auto-generate ID from name if creating new
          if (isNew && value) {
            editId = value
              .toLowerCase()
              .replace(/\s+/g, "-")
              .replace(/[^a-z0-9-]/g, "");
          }
        });
    });

    // ID setting
    const idSetting = new Setting(container);
    idSetting.setName("ID");
    idSetting.setDesc("Unique identifier for this note type");
    idSetting.addText((text) => {
      text
        .setValue(editId)
        .setPlaceholder("e.g., meeting-note, project-plan")
        .setDisabled(!isNew) // Only allow editing ID when creating new
        .onChange((value) => {
          editId = value;
        });
    });

    // Version setting
    const versionSetting = new Setting(container);
    versionSetting.setName("Version");
    versionSetting.setDesc("Semantic version for this note type");
    versionSetting.addText((text) => {
      text
        .setValue(editVersion)
        .setPlaceholder("1.0.0")
        .onChange((value) => {
          editVersion = value;
        });
    });

    // Description setting
    const descSetting = new Setting(container);
    descSetting.setName("Description");
    descSetting.setDesc("Optional description of what this note type is for");
    descSetting.addTextArea((text) => {
      text
        .setValue(editDescription)
        .setPlaceholder("Describe what this note type is for...")
        .onChange((value) => {
          editDescription = value;
        });
    });

    // Properties section
    container.createEl("h4", { text: "Properties" });
    const propertiesContainer = container.createDiv(
      "properties-editor-container"
    );

    // Create a simple property management interface using Obsidian Settings
    createPropertyManagementInterface(propertiesContainer, editProperties);

    // Template section
    container.createEl("h4", { text: "Template" });
    const templateContainer = container.createDiv("template-editor-container");

    // Create a simple template editor using Obsidian Settings
    createTemplateEditorInterface(
      templateContainer,
      editTemplate,
      (newTemplate: any) => {
        editTemplate = newTemplate;
      }
    );

    // Save button
    const saveSetting = new Setting(container);
    saveSetting.setName(isNew ? "Create Note Type" : "Save Changes");
    saveSetting.addButton((button) => {
      button
        .setButtonText(isNew ? "Create Note Type" : "Save Changes")
        .setCta()
        .onClick(async () => {
          // Validation
          if (!editName || !editId) {
            new Notice("Name and ID are required");
            return;
          }

          if (isNew && plugin.typeNote.registry.has(editId)) {
            new Notice(`Note type with ID "${editId}" already exists`);
            return;
          }

          // Create/update the note type
          const updatedNoteType: NoteType = {
            id: editId,
            name: editName,
            version: editVersion,
            properties: editProperties,
            template: editTemplate,
            metadata: {
              ...noteType.metadata,
              description: editDescription || undefined,
              updatedAt: new Date(),
              ...(isNew ? { createdAt: new Date() } : {}),
            },
          };

          const result = plugin.typeNote.registry.register(updatedNoteType, {
            allowOverwrite: !isNew,
            validate: true,
          });

          if (result.valid) {
            new Notice(
              isNew
                ? "Note type created successfully"
                : "Note type updated successfully"
            );

            // No cleanup needed for native Obsidian Settings components

            container.empty();
            recreateSection();
          } else {
            new Notice(
              `Failed to ${isNew ? "create" : "update"} note type: ${result.errors
                .map((e: any) => e.message)
                .join(", ")}`,
              5000
            );
          }
        });
    });
  }
</script>

<div bind:this={container} data-testid="type-note-settings"></div>

<style>
  /* Fix visual glitches in embedded components */
  :global(.properties-editor) {
    margin: 1rem 0;
    padding: 0;
    border: none;
    background: transparent;
  }

  :global(.template-editor) {
    margin: 1rem 0;
    padding: 0;
    border: none;
    background: transparent;
  }

  /* Override PropertyDefinitionBuilder styles for better integration */
  :global(.properties-editor .property-definition-builder) {
    background: transparent;
    border: none;
    padding: 0;
  }

  :global(.properties-editor .section-header) {
    display: none; /* Hide duplicate header since we have our own */
  }

  :global(.properties-editor .add-property-form) {
    background: var(--background-primary) !important;
    border: 1px solid var(--background-modifier-border) !important;
    border-radius: 6px !important;
    padding: 1.5rem !important;
    margin: 1rem 0 !important;
  }

  :global(.properties-editor .add-property-form h4) {
    margin: 0 0 1rem 0 !important;
    color: var(--text-normal) !important;
    font-size: 1.1rem !important;
    font-weight: 600 !important;
  }

  :global(.properties-editor .form-grid) {
    display: grid !important;
    grid-template-columns: 1fr 1fr !important;
    gap: 1rem !important;
    margin-bottom: 1rem !important;
  }

  :global(.properties-editor .form-input),
  :global(.properties-editor .form-select),
  :global(.properties-editor .form-textarea) {
    width: 100% !important;
    padding: 0.5rem !important;
    border: 1px solid var(--background-modifier-border) !important;
    border-radius: 4px !important;
    background: var(--background-primary) !important;
    color: var(--text-normal) !important;
    font-size: 0.9rem !important;
    font-family: var(--font-text) !important;
    box-sizing: border-box !important;
  }

  :global(.properties-editor .form-input:focus),
  :global(.properties-editor .form-select:focus),
  :global(.properties-editor .form-textarea:focus) {
    outline: none !important;
    border-color: var(--interactive-accent) !important;
    box-shadow: 0 0 0 2px var(--interactive-accent-hover) !important;
  }

  :global(.properties-editor .form-textarea) {
    resize: vertical !important;
    min-height: 80px !important;
  }

  /* Fix property list styling */
  :global(.properties-editor .properties-list) {
    display: flex !important;
    flex-direction: column !important;
    gap: 0.75rem !important;
    margin: 1rem 0 !important;
  }

  :global(.properties-editor .property-item) {
    padding: 1rem !important;
    border: 1px solid var(--background-modifier-border) !important;
    border-radius: 6px !important;
    background: var(--background-primary) !important;
  }

  :global(.properties-editor .property-header) {
    display: flex !important;
    justify-content: space-between !important;
    align-items: flex-start !important;
    margin-bottom: 0.5rem !important;
  }

  :global(.properties-editor .property-name) {
    font-weight: 600 !important;
    color: var(--text-normal) !important;
    margin-right: 0.5rem !important;
  }

  :global(.properties-editor .property-key) {
    font-family: var(--font-monospace) !important;
    color: var(--text-muted) !important;
    font-size: 0.85rem !important;
  }

  :global(.properties-editor .required-badge) {
    background: var(--text-error) !important;
    color: var(--text-on-accent) !important;
    padding: 0.1rem 0.4rem !important;
    border-radius: 3px !important;
    font-size: 0.75rem !important;
    font-weight: 500 !important;
    margin-left: 0.5rem !important;
  }

  :global(.properties-editor .delete-property-button) {
    padding: 0.25rem 0.75rem !important;
    border: 1px solid var(--text-error) !important;
    border-radius: 3px !important;
    background: transparent !important;
    color: var(--text-error) !important;
    cursor: pointer !important;
    font-size: 0.85rem !important;
  }

  :global(.properties-editor .delete-property-button:hover) {
    background: var(--background-modifier-error) !important;
  }

  /* Fix button styling */
  :global(.properties-editor .add-property-button),
  :global(.properties-editor .save-button) {
    padding: 0.5rem 1rem !important;
    border: none !important;
    border-radius: 4px !important;
    background: var(--interactive-accent) !important;
    color: var(--text-on-accent) !important;
    cursor: pointer !important;
    font-size: 0.9rem !important;
    font-weight: 500 !important;
  }

  :global(.properties-editor .add-property-button:hover),
  :global(.properties-editor .save-button:hover) {
    background: var(--interactive-accent-hover) !important;
  }

  :global(.properties-editor .cancel-button) {
    padding: 0.5rem 1rem !important;
    border: 1px solid var(--background-modifier-border) !important;
    border-radius: 4px !important;
    background: var(--background-primary) !important;
    color: var(--text-normal) !important;
    cursor: pointer !important;
    font-size: 0.9rem !important;
    margin-left: 0.5rem !important;
  }

  :global(.properties-editor .cancel-button:hover) {
    background: var(--background-modifier-hover) !important;
  }

  /* Fix form actions layout */
  :global(.properties-editor .form-actions) {
    display: flex !important;
    justify-content: flex-start !important;
    align-items: center !important;
    gap: 0.5rem !important;
    margin-top: 1rem !important;
  }

  /* Fix checkbox styling */
  :global(.properties-editor .form-checkboxes) {
    display: flex !important;
    gap: 1rem !important;
    margin: 1rem 0 !important;
  }

  :global(.properties-editor .checkbox-label) {
    display: flex !important;
    align-items: center !important;
    gap: 0.5rem !important;
    font-size: 0.9rem !important;
    color: var(--text-normal) !important;
    cursor: pointer !important;
  }

  /* Fix template editor styling */
  :global(.template-editor .template-textarea) {
    width: 100% !important;
    min-height: 200px !important;
    padding: 1rem !important;
    border: 1px solid var(--background-modifier-border) !important;
    border-radius: 4px !important;
    background: var(--background-primary) !important;
    color: var(--text-normal) !important;
    font-family: var(--font-monospace) !important;
    font-size: 0.9rem !important;
    line-height: 1.5 !important;
    resize: vertical !important;
    box-sizing: border-box !important;
  }

  :global(.template-editor .template-textarea:focus) {
    outline: none !important;
    border-color: var(--interactive-accent) !important;
    box-shadow: 0 0 0 2px var(--interactive-accent-hover) !important;
  }

  /* Fix empty states */
  :global(.properties-editor .empty-properties) {
    text-align: center !important;
    padding: 2rem !important;
    color: var(--text-muted) !important;
    border: 1px dashed var(--background-modifier-border) !important;
    border-radius: 6px !important;
    margin: 1rem 0 !important;
  }

  :global(.properties-editor .empty-properties p) {
    margin: 0 0 0.5rem 0 !important;
  }

  :global(.properties-editor .empty-hint) {
    font-size: 0.85rem !important;
    opacity: 0.8 !important;
  }

  /* Fix error messages */
  :global(.error-message) {
    color: var(--text-error) !important;
    font-style: italic !important;
    padding: 1rem !important;
    text-align: center !important;
  }

  /* Fix FieldGroup styling within property editor */
  :global(.properties-editor .task-sync-field-group) {
    margin-bottom: 1rem !important;
  }

  :global(.properties-editor .task-sync-field-label) {
    display: block !important;
    margin-bottom: 0.25rem !important;
    color: var(--text-normal) !important;
    font-weight: 500 !important;
    font-size: 0.9rem !important;
  }

  :global(.properties-editor .task-sync-field-description) {
    font-size: 0.8rem !important;
    color: var(--text-muted) !important;
    margin-top: 0.25rem !important;
  }

  /* Fix property meta styling */
  :global(.properties-editor .property-meta) {
    display: flex !important;
    gap: 1rem !important;
    font-size: 0.8rem !important;
    color: var(--text-muted) !important;
    margin-top: 0.5rem !important;
  }

  :global(.properties-editor .property-description) {
    font-size: 0.85rem !important;
    color: var(--text-muted) !important;
    margin: 0.5rem 0 !important;
    font-style: italic !important;
  }
</style>
