<script lang="ts">
  import type {
    SettingsSection,
    TaskSyncSettings,
  } from "../../../types/settings";
  import { Setting, Notice } from "obsidian";
  import { onMount, mount } from "svelte";
  import type TaskSyncPlugin from "../../../../main";
  import type {
    NoteType,
    PropertyDefinition,
  } from "../../../core/type-note/types";
  import {
    stringSchema,
    numberSchema,
    booleanSchema,
    dateSchema,
    enumSchema,
  } from "../../../core/type-note/schemas";
  import { createSchemaFromType } from "../../../core/type-note/schema-utils";
  import PropertySettings from "./PropertySettings.svelte";
  import { camelize } from "inflection";
  import { ObsidianPropertyManager } from "../../../core/type-note/obsidian-property-manager";

  let container: HTMLElement;

  interface Props {
    section: SettingsSection;
    settings: TaskSyncSettings;
    saveSettings: (newSettings: TaskSyncSettings) => Promise<void>;
    plugin: TaskSyncPlugin;
    typeMapping?: Record<string, string>;
  }

  let {
    settings = $bindable(),
    saveSettings,
    plugin,
    typeMapping = ObsidianPropertyManager.getTypeMapping(),
  }: Props = $props();

  // Helper function to generate camelCase key from name
  function generateKeyFromName(name: string): string {
    if (!name) return "";
    return name
      .trim()
      .replace(/[^\w\s]/g, "") // Remove special characters
      .split(/\s+/) // Split on whitespace
      .map((word, index) => {
        if (index === 0) {
          return word.toLowerCase();
        }
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join("");
  }

  // Helper function to get default value for a property type
  function getDefaultValueForType(schemaType: string): any {
    switch (schemaType) {
      case "string":
        return "";
      case "number":
        return 0;
      case "boolean":
        return false;
      case "date":
        return ""; // Empty date input instead of today
      default:
        return "";
    }
  }

  // Helper function to get string type from Zod schema
  function getSchemaTypeFromSchema(schema: any): string {
    // This is a simple heuristic - in a real implementation you might want
    // to store the schema type separately or use a more robust detection
    if (schema === stringSchema) return "string";
    if (schema === numberSchema) return "number";
    if (schema === booleanSchema) return "boolean";
    if (schema === dateSchema) return "date";
    return "string"; // default fallback
  }

  onMount(() => {
    recreateSection();
  });

  /**
   * Create property management interface using Svelte components
   * with drag-and-drop support
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
              frontMatterKey: "New Property",
              required: false,
              defaultValue: getDefaultValueForType("string"),
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
   * Create settings for each property using Svelte components
   * with drag-and-drop support
   */
  let draggedElement: HTMLElement | null = null;
  let draggedKey: string | null = null;

  function createPropertySettings(
    container: HTMLElement,
    properties: Record<string, any>
  ) {
    // Clear container
    container.empty();

    // Get property entries and sort by order if available
    const propertyEntries = Object.entries(properties).sort(
      ([, a], [, b]) => (a.order || 0) - (b.order || 0)
    );

    // Create settings for each property
    propertyEntries.forEach(([key, property]) => {
      // Mount PropertySettings component
      mount(PropertySettings, {
        target: container,
        props: {
          propertyKey: key,
          property: property,
          typeMapping: typeMapping,
          onUpdate: () => {
            // Property was updated, no need to recreate
          },
          onDelete: () => {
            // Delete the property
            delete properties[key];
            // Recreate the property list
            createPropertySettings(container, properties);
          },
        },
      });

      // Get the container element for drag-and-drop
      const propertyContainer = container.lastElementChild as HTMLElement;
      if (propertyContainer) {
        propertyContainer.draggable = true;
        propertyContainer.dataset.propertyKey = key;

        // Add drag event listeners
        propertyContainer.addEventListener("dragstart", (e) => {
          draggedElement = propertyContainer;
          draggedKey = key;
          propertyContainer.classList.add("dragging");
          if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = "move";
          }
        });

        propertyContainer.addEventListener("dragend", () => {
          propertyContainer.classList.remove("dragging");
          draggedElement = null;
          draggedKey = null;
        });

        propertyContainer.addEventListener("dragover", (e) => {
          e.preventDefault();
          if (e.dataTransfer) {
            e.dataTransfer.dropEffect = "move";
          }

          if (draggedElement && draggedElement !== propertyContainer) {
            const rect = propertyContainer.getBoundingClientRect();
            const midpoint = rect.top + rect.height / 2;
            const insertBefore = e.clientY < midpoint;

            if (insertBefore) {
              propertyContainer.classList.add("drag-over-top");
              propertyContainer.classList.remove("drag-over-bottom");
            } else {
              propertyContainer.classList.add("drag-over-bottom");
              propertyContainer.classList.remove("drag-over-top");
            }
          }
        });

        propertyContainer.addEventListener("dragleave", () => {
          propertyContainer.classList.remove(
            "drag-over-top",
            "drag-over-bottom"
          );
        });

        propertyContainer.addEventListener("drop", (e) => {
          e.preventDefault();
          propertyContainer.classList.remove(
            "drag-over-top",
            "drag-over-bottom"
          );

          if (draggedKey && draggedKey !== key) {
            // Reorder properties
            const propertyKeys = Object.keys(properties);
            const fromIndex = propertyKeys.indexOf(draggedKey);
            const toIndex = propertyKeys.indexOf(key);

            if (fromIndex !== -1 && toIndex !== -1) {
              // Determine if we should insert before or after
              const rect = propertyContainer.getBoundingClientRect();
              const midpoint = rect.top + rect.height / 2;
              const insertBefore = e.clientY < midpoint;

              // Create new properties object with reordered keys
              const newProperties: Record<string, any> = {};
              const movedProperty = properties[draggedKey];

              propertyKeys.forEach((k) => {
                if (k === draggedKey) return; // Skip the dragged item

                if (k === key) {
                  if (insertBefore) {
                    newProperties[draggedKey] = movedProperty;
                    newProperties[k] = properties[k];
                  } else {
                    newProperties[k] = properties[k];
                    newProperties[draggedKey] = movedProperty;
                  }
                } else {
                  newProperties[k] = properties[k];
                }
              });

              // Update order property for each item
              Object.keys(newProperties).forEach((k, i) => {
                newProperties[k].order = i;
              });

              // Clear and update properties
              Object.keys(properties).forEach((k) => delete properties[k]);
              Object.assign(properties, newProperties);

              // Recreate the property list
              createPropertySettings(container, properties);
            }
          }
        });
      }
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
          // Create a new note type with a default property for editing
          const defaultPropertyKey = `property_${Date.now()}`;
          const newNoteType = {
            id: "",
            name: "",
            version: "1.0.0",
            properties: {
              [defaultPropertyKey]: {
                key: generateKeyFromName("New Property"),
                name: "New Property",
                schemaType: "string",
                frontMatterKey: "New Property",
                required: false,
                defaultValue: getDefaultValueForType("string"),
                description: "",
                visible: true,
                order: 0,
              },
            },
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
      // Add data-testid for e2e tests
      button.buttonEl.setAttribute("data-testid", "create-note-type-button");
    });
  }

  function showNoteTypeEditor(
    noteType: any, // Allow any type since we handle both NoteType and UI format
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

    // Convert properties to UI format (with schemaType instead of schema)
    let editProperties: Record<string, any> = {};
    Object.entries(noteType.properties || {}).forEach(
      ([key, prop]: [string, any]) => {
        if (prop.schemaType) {
          // Already in UI format
          editProperties[key] = { ...prop };
        } else if (prop.schema) {
          // Convert from NoteType format to UI format
          // Use the property's type field if available, otherwise infer from schema
          const schemaType = prop.type || getSchemaTypeFromSchema(prop.schema);
          editProperties[key] = {
            ...prop,
            schemaType: schemaType,
          };
          // Remove the schema field since UI uses schemaType
          delete editProperties[key].schema;
        } else {
          // Fallback for malformed properties
          editProperties[key] = {
            ...prop,
            schemaType: "string",
          };
        }
      }
    );

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
      // Add data-testid for e2e tests
      text.inputEl.setAttribute("data-testid", "note-type-name-input");
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
      // Add data-testid for e2e tests
      text.inputEl.setAttribute("data-testid", "note-type-id-input");
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

          // Convert schemaType strings to proper schema objects and generate keys
          const processedProperties: Record<string, PropertyDefinition> = {};
          Object.entries(editProperties).forEach(
            ([_key, property]: [string, any]) => {
              const { schemaType, enumOptions, ...propertyWithoutSchemaType } =
                property;

              // Generate key and frontMatterKey from name
              const generatedKey = camelize(property.name || "", true); // true = lower camel case
              const frontMatterKey = property.name || "";

              // Create the property definition
              const propertyDef: any = {
                ...propertyWithoutSchemaType,
                key: generatedKey,
                frontMatterKey: frontMatterKey,
                type: schemaType || "string",
                schema: createSchemaFromType(
                  schemaType || "string",
                  property.selectOptions
                ),
              };

              // For select type, ensure selectOptions are included
              if (schemaType === "select" && property.selectOptions) {
                propertyDef.selectOptions = property.selectOptions;
              }

              processedProperties[generatedKey] = propertyDef;
            }
          );

          // Create the note type object
          const noteTypeToSave = {
            id: editId,
            name: editName,
            version: editVersion,
            properties: processedProperties,
            template: editTemplate,
            metadata: {
              description: editDescription,
              createdAt: isNew
                ? new Date()
                : noteType.metadata?.createdAt || new Date(),
              updatedAt: new Date(),
            },
          };

          // Register the note type
          const result = plugin.typeNote.registry.register(noteTypeToSave, {
            allowOverwrite: !isNew,
            validate: true,
          });

          if (result.valid) {
            new Notice(
              isNew
                ? "Note type created successfully"
                : "Note type updated successfully"
            );
            // Return to the list view
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

  /* Property container styling with drag-and-drop support */
  :global(.property-container) {
    transition: all 0.2s ease !important;
  }

  :global(.property-container.dragging) {
    opacity: 0.5 !important;
  }

  :global(.property-container.drag-over-top) {
    border-top: 2px solid var(--interactive-accent) !important;
  }

  :global(.property-container.drag-over-bottom) {
    border-bottom: 2px solid var(--interactive-accent) !important;
  }
</style>
