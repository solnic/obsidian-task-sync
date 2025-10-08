<script lang="ts">
  import { Setting } from "obsidian";
  import { onMount } from "svelte";
  import type { PropertySettingsData } from "../../../core/type-note/types";

  interface Props {
    propertyKey: string;
    property: PropertySettingsData;
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

  // Helper function to get default value for a given type
  function getDefaultValueForType(type: string) {
    switch (type) {
      case "number":
        return 0;
      case "boolean":
        return false;
      case "date":
        return "";
      case "select":
        return "";
      default:
        return "";
    }
  }

  // Helper function to create a badge for select option preview
  function createSelectOptionBadge(option: {
    value: string;
    color?: string;
  }): HTMLElement {
    const badge = document.createElement("span");
    badge.className = "select-option-badge";
    badge.textContent = option.value;
    if (option.color) {
      badge.style.backgroundColor = option.color;
      // Calculate optimal text color based on background
      const rgb = hexToRgb(option.color);
      if (rgb) {
        const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
        badge.style.color = luminance > 0.5 ? "#000000" : "#ffffff";
      }
    }
    return badge;
  }

  // Helper function to convert hex to RGB
  function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : null;
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

    switch (property.schemaType) {
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
            .setValue(property.defaultValue?.toString() || "")
            .onChange((value: string) => {
              const numValue = parseFloat(value);
              property.defaultValue = isNaN(numValue) ? "" : numValue;
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

      case "select":
        // For select type, show dropdown of options
        if (property.selectOptions && property.selectOptions.length > 0) {
          defaultSetting.addDropdown((dropdown) => {
            property.selectOptions?.forEach((option) => {
              dropdown.addOption(option.value, option.value);
            });
            dropdown
              .setValue(property.defaultValue || "")
              .onChange((value: string) => {
                property.defaultValue = value;
                onUpdate();
              });
            dropdown.selectEl.setAttribute(
              "data-testid",
              `property-default-select-${propertyKey}`
            );
          });
        } else {
          defaultSetting.setDesc(
            "Add select options below to set a default value"
          );
        }
        break;
    }

    // Select options management (only for select type)
    if (property.schemaType === "select") {
      // Initialize selectOptions if not present
      if (!property.selectOptions) {
        property.selectOptions = [];
      }

      propertyContent.createEl("h5", {
        text: "Select Options",
        cls: "select-options-heading",
      });

      // List existing options
      property.selectOptions.forEach((option, index) => {
        const optionSetting = new Setting(propertyContent);
        optionSetting.setClass("select-option-setting");

        // Add badge preview
        const badgeContainer = optionSetting.controlEl.createDiv(
          "select-option-badge-preview"
        );
        const badge = createSelectOptionBadge(option);
        badgeContainer.appendChild(badge);

        // Add value input
        optionSetting.addText((text) => {
          text
            .setValue(option.value)
            .setPlaceholder("Option value")
            .onChange((value) => {
              if (property.selectOptions) {
                property.selectOptions[index].value = value;
                badge.textContent = value;
                onUpdate();
              }
            });
          text.inputEl.setAttribute(
            "data-testid",
            `select-option-value-${index}`
          );
        });

        // Add color picker
        optionSetting.addColorPicker((colorPicker) => {
          colorPicker
            .setValue(option.color || "#3b82f6")
            .onChange((value: string) => {
              if (property.selectOptions) {
                property.selectOptions[index].color = value;
                badge.style.backgroundColor = value;
                // Update text color for contrast
                const rgb = hexToRgb(value);
                if (rgb) {
                  const luminance =
                    (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
                  badge.style.color = luminance > 0.5 ? "#000000" : "#ffffff";
                }
                onUpdate();
              }
            });
        });

        // Add delete button
        optionSetting.addButton((button) => {
          button
            .setButtonText("Delete")
            .setWarning()
            .onClick(() => {
              if (property.selectOptions) {
                property.selectOptions.splice(index, 1);
                renderPropertySettings();
                onUpdate();
              }
            });
        });
      });

      // Add new option button
      const addOptionSetting = new Setting(propertyContent);
      addOptionSetting.setClass("add-select-option-setting");
      addOptionSetting.setName("Add Option").addButton((button) => {
        button
          .setButtonText("Add Option")
          .setCta()
          .onClick(() => {
            if (!property.selectOptions) {
              property.selectOptions = [];
            }
            property.selectOptions.push({
              value: `Option ${property.selectOptions.length + 1}`,
              color: "#3b82f6",
            });
            renderPropertySettings();
            onUpdate();
          });
        button.buttonEl.setAttribute(
          "data-testid",
          `add-select-option-button-${propertyKey}`
        );
      });
    }

    // Required toggle
    new Setting(propertyContent).setName("Required").addToggle((toggle) => {
      toggle.setValue(property.required).onChange((value: boolean) => {
        property.required = value;
        onUpdate();
      });
      toggle.toggleEl.setAttribute(
        "data-testid",
        `property-required-toggle-${propertyKey}`
      );
    });

    // Hide in forms toggle
    new Setting(propertyContent)
      .setName("Hide in forms")
      .setDesc("Hide this property in note creation forms")
      .addToggle((toggle) => {
        toggle
          .setValue(property.form?.hidden || false)
          .onChange((value: boolean) => {
            if (!property.form) {
              property.form = {};
            }
            property.form.hidden = value;
            onUpdate();
          });
        toggle.toggleEl.setAttribute(
          "data-testid",
          `property-hide-in-forms-toggle-${propertyKey}`
        );
      });

    // Main property toggle
    new Setting(propertyContent)
      .setName("Main property")
      .setDesc(
        "This property will be rendered first in note creation forms, before the template content"
      )
      .addToggle((toggle) => {
        toggle
          .setValue(property.form?.main || false)
          .onChange((value: boolean) => {
            if (!property.form) {
              property.form = {};
            }
            property.form.main = value;
            onUpdate();
          });
        toggle.toggleEl.setAttribute(
          "data-testid",
          `property-main-toggle-${propertyKey}`
        );
      });
  }

  onMount(() => {
    renderPropertySettings();
  });
</script>

<div bind:this={container} class="property-container" draggable="true">
  <div class="property-handle-wrapper drag-handle">
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
  <div class="property-handle-wrapper delete-handle">
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
    background: var(--background-modifier-border);
    transition: background 0.2s ease;
  }

  :global(.property-handle-wrapper.drag-handle) {
    border-right: 1px solid var(--background-modifier-border);
  }

  :global(.property-handle-wrapper.delete-handle) {
    border-left: 1px solid var(--background-modifier-border);
  }

  :global(.property-handle-wrapper:hover) {
    background: var(--background-modifier-hover);
  }

  :global(.property-handle-wrapper.delete-handle:hover) {
    color: var(--text-error);
  }

  :global(.property-handle-button) {
    background: none;
    border: none;
    color: inherit;
    cursor: pointer;
    font-size: 1rem;
    line-height: 1;
    padding: 0.5rem;
    margin: 0;
    user-select: none;
  }

  :global(.property-handle-button.drag-handle) {
    cursor: grab;
  }

  :global(.property-handle-button.drag-handle:active) {
    cursor: grabbing;
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

  /* Select options styling */
  :global(.select-options-heading) {
    margin: 1rem 0 0.5rem 0;
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-normal);
  }

  :global(.select-option-setting) {
    border-left: 2px solid var(--background-modifier-border);
    padding-left: 0.5rem !important;
    margin-left: 0.5rem;
  }

  :global(.select-option-badge-preview) {
    display: inline-flex;
    align-items: center;
    margin-right: 0.5rem;
  }

  :global(.select-option-badge) {
    display: inline-block;
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.85rem;
    font-weight: 500;
    background-color: var(--background-modifier-border);
    color: var(--text-normal);
    white-space: nowrap;
  }

  :global(.add-select-option-setting) {
    margin-top: 0.5rem;
    border-top: 1px dashed var(--background-modifier-border);
    padding-top: 0.75rem !important;
  }
</style>
