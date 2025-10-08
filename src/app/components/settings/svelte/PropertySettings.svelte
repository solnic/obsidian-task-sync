<script lang="ts">
  import { Setting } from "obsidian";
  import { onMount } from "svelte";
  import inflection from "inflection";

  interface Props {
    propertyKey: string;
    property: any;
    typeMapping: Record<string, string>;
    onUpdate: () => void;
    onDelete: () => void;
  }

  let {
    propertyKey,
    property = $bindable(),
    typeMapping,
    onUpdate,
    onDelete,
  }: Props = $props();

  let container: HTMLElement;

  // Helper function to generate camelCase key from name using inflection
  function generateKeyFromName(name: string): string {
    if (!name) return "";
    return inflection.camelize(name, true); // true = lower camel case
  }

  // Helper function to get default value for a given type
  function getDefaultValueForType(type: string) {
    switch (type) {
      case "number":
        return 0;
      case "boolean":
        return false;
      case "date":
        return "";
      default:
        return "";
    }
  }

  function renderPropertySettings() {
    // Clear only the property content, not the entire container
    const propertyContainer = container.querySelector(
      ".property-controls-container"
    );

    propertyContainer.empty();

    // Create the main property content area
    const propertyContent = container.createDiv("property-content");

    propertyContainer.appendChild(propertyContent);

    // Property name
    new Setting(propertyContent).setName("Property name").addText((text) => {
      text
        .setPlaceholder("Property name")
        .setValue(property.name || "")
        .onChange((value) => {
          property.name = value;
          if (value) {
            property.key = generateKeyFromName(value);
            property.frontMatterKey = value;
          }
          onUpdate();
        });
      text.inputEl.setAttribute(
        "data-testid",
        `property-name-input-${propertyKey}`
      );
    });

    // Type
    new Setting(propertyContent).setName("Type").addDropdown((dropdown) => {
      Object.entries(typeMapping).forEach(([value, label]) => {
        dropdown.addOption(value, label);
      });
      dropdown.setValue(property.schemaType || "string").onChange((value) => {
        const wasRequired = property.required;
        property.schemaType = value;
        property.defaultValue = getDefaultValueForType(value);
        property.required = wasRequired;
        renderPropertySettings();
        onUpdate();
      });
      dropdown.selectEl.setAttribute(
        "data-testid",
        `property-type-dropdown-${propertyKey}`
      );
    });

    // Default value
    const defaultSetting = new Setting(propertyContent).setName(
      "Default value"
    );

    const schemaType = property.schemaType || "string";
    switch (schemaType) {
      case "string":
        defaultSetting.addText((text) => {
          text
            .setPlaceholder("Default value")
            .setValue(property.defaultValue || "")
            .onChange((value: string) => {
              property.defaultValue = value;
              onUpdate();
            });
          text.inputEl.setAttribute(
            "data-testid",
            `property-default-input-${propertyKey}`
          );
        });
        break;

      case "number":
        defaultSetting.addText((text) => {
          text
            .setPlaceholder("Default value")
            .setValue(property.defaultValue?.toString() || "0")
            .onChange((value: string) => {
              const numValue = parseFloat(value);
              property.defaultValue = isNaN(numValue) ? 0 : numValue;
              onUpdate();
            });
          text.inputEl.setAttribute("type", "number");
          text.inputEl.setAttribute(
            "data-testid",
            `property-default-input-${propertyKey}`
          );
        });
        break;

      case "boolean":
        defaultSetting.addToggle((toggle) => {
          toggle
            .setValue(property.defaultValue || false)
            .setTooltip("Default checked state")
            .onChange((value: boolean) => {
              property.defaultValue = value;
              onUpdate();
            });
          toggle.toggleEl.setAttribute(
            "data-testid",
            `property-default-toggle-${propertyKey}`
          );
        });
        break;

      case "date":
        defaultSetting.addText((text) => {
          text
            .setPlaceholder("YYYY-MM-DD")
            .setValue(property.defaultValue || "")
            .onChange((value: string) => {
              property.defaultValue = value;
              onUpdate();
            });
          text.inputEl.setAttribute("type", "date");
          text.inputEl.setAttribute(
            "data-testid",
            `property-default-input-${propertyKey}`
          );
        });
        break;
    }

    // Required toggle
    new Setting(propertyContent).setName("Required").addToggle((toggle) => {
      toggle.setValue(property.required || false).onChange((value: boolean) => {
        property.required = value;
        onUpdate();
      });
      toggle.toggleEl.setAttribute(
        "data-testid",
        `property-required-toggle-${propertyKey}`
      );
    });

    // Front-matter key
    new Setting(propertyContent)
      .setName("Front-matter key")
      .setDesc("The key used in the note's front-matter")
      .addText((text) => {
        text
          .setPlaceholder("Front-matter key")
          .setValue(property.frontMatterKey || "")
          .onChange((value) => {
            property.frontMatterKey = value;
            onUpdate();
          });
      });
  }

  onMount(() => {
    renderPropertySettings();
  });
</script>

<div bind:this={container} class="property-container" draggable="true">
  <div class="property-handle-wrapper">
    <button
      class="property-handle-button drag-handle"
      title="Drag to reorder"
      type="button"
      aria-label="Drag to reorder"
    >
      ⋮⋮
    </button>
  </div>
  <div class="property-controls-container">
    <!-- Property settings will be rendered here -->
  </div>
  <div class="property-handle-wrapper">
    <button
      class="property-handle-button delete-handle"
      title="Delete property"
      onclick={onDelete}
      type="button"
      aria-label="Delete property"
    >
      ×
    </button>
  </div>
</div>

<style>
  :global(.property-controls-container) {
    width: 100%;
  }

  :global(.property-container) {
    display: flex;
    align-items: stretch;
    margin-bottom: 0.5rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    background: var(--background-primary);
    overflow: hidden;
  }

  :global(.property-handle-wrapper) {
    display: flex;
    flex-shrink: 0;
    align-self: stretch;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 100%;
    background: var(--background-modifier-border);
    color: var(--text-muted);
    cursor: pointer;
    font-size: 1rem;
    line-height: 1;
    user-select: none;
    border: none;
    padding: 0;
    margin: 0;
    transition: background 0.2s ease;
  }

  :global(.property-handle-button) {
    display: flex;
  }

  :global(.property-handle-button:hover) {
    background: var(--background-modifier-hover);
  }

  :global(.property-handle-button.drag-handle) {
    cursor: grab;
    border-right: 1px solid var(--background-modifier-border);
  }

  :global(.property-handle-button.drag-handle:active) {
    cursor: grabbing;
  }

  :global(.property-handle-button.delete-handle) {
    border-left: 1px solid var(--background-modifier-border);
  }

  :global(.property-handle-button.delete-handle:hover) {
    color: var(--text-error);
  }

  :global(.property-content) {
    flex: 1;
    min-width: 0;
    padding: 1rem;
  }

  /* Remove default Setting padding */
  :global(.property-content .setting-item) {
    padding: 0.75rem 0;
    border-top: none;
  }

  :global(.property-content .setting-item:first-child) {
    padding-top: 0;
  }
</style>
