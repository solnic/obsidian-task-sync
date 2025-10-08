<script lang="ts">
  import { Setting } from "obsidian";
  import { onMount } from "svelte";

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
  let dragHandle: HTMLElement;

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

  onMount(() => {
    // Create the main property content area
    const propertyContent = container.createDiv("property-content");

    // Main inputs section (name and type)
    const mainSetting = new Setting(propertyContent);
    mainSetting.setClass("property-main-setting");

    mainSetting
      .addText((text) => {
        text
          .setPlaceholder("Property name")
          .setValue(property.name || "")
          .onChange((value) => {
            // Update property name
            property.name = value;

            // Auto-generate key and frontMatterKey from name
            if (value) {
              property.key = generateKeyFromName(value);
              property.frontMatterKey = value; // Use the display name as frontMatterKey
            }
            onUpdate();
          });

        // Add data-testid for e2e testing
        text.inputEl.setAttribute(
          "data-testid",
          `property-name-input-${propertyKey}`
        );
      })
      .addDropdown((dropdown) => {
        // Use the typeMapping prop for dropdown options
        Object.entries(typeMapping).forEach(([value, label]) => {
          dropdown.addOption(value, label);
        });

        dropdown
          .setValue(property.schemaType || "string")
          .onChange((value) => {
            // Preserve the current required state
            const wasRequired = property.required;

            // Update property type and default value
            property.schemaType = value;
            property.defaultValue = getDefaultValueForType(value);

            // Preserve the required state
            property.required = wasRequired;

            onUpdate();
          });

        // Add data-testid for e2e testing
        dropdown.selectEl.setAttribute(
          "data-testid",
          `property-type-dropdown-${propertyKey}`
        );
      })
      .addButton((button) => {
        button
          .setButtonText("Delete")
          .setWarning()
          .onClick(() => {
            onDelete();
          });

        // Add data-testid for e2e testing
        button.buttonEl.setAttribute(
          "data-testid",
          `property-delete-button-${propertyKey}`
        );
      });

    // Secondary settings section (default value and required toggle on same row)
    const secondaryContainer = propertyContent.createDiv(
      "property-secondary-settings"
    );

    // Create a single row for default value and required toggle
    const settingsRow = new Setting(secondaryContainer);
    settingsRow.setClass("property-settings-row");
    settingsRow.setName("Default value");

    // Add type-specific default value field
    const schemaType = property.schemaType || "string";
    switch (schemaType) {
      case "string":
        settingsRow.addText((text) => {
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
        settingsRow.addText((text) => {
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
        settingsRow.addToggle((toggle) => {
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
        settingsRow.addText((text) => {
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

      default:
        settingsRow.addText((text) => {
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
    }

    // Add required toggle to the same row
    settingsRow.addToggle((toggle) => {
      toggle
        .setValue(property.required || false)
        .setTooltip("Mark this property as required")
        .onChange((value) => {
          property.required = value;
          onUpdate();
        });

      // Add data-testid for e2e testing
      toggle.toggleEl.setAttribute(
        "data-testid",
        `property-required-toggle-${propertyKey}`
      );

      // Add a label next to the toggle
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
    });
  });
</script>

<div bind:this={container} class="property-container" draggable="true">
  <div bind:this={dragHandle} class="property-drag-handle" title="Drag to reorder">
    ⋮⋮
  </div>
</div>

<style>
  :global(.property-container) {
    display: flex !important;
    align-items: stretch !important;
    margin-bottom: 1rem !important;
    border: 1px solid var(--background-modifier-border) !important;
    border-radius: 6px !important;
    background: var(--background-primary) !important;
    overflow: hidden !important;
  }

  :global(.property-drag-handle) {
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    width: 24px !important;
    background: var(--background-modifier-border) !important;
    color: var(--text-muted) !important;
    cursor: grab !important;
    font-size: 0.8rem !important;
    line-height: 1 !important;
    user-select: none !important;
    border-right: 1px solid var(--background-modifier-border) !important;
  }

  :global(.property-drag-handle:hover) {
    background: var(--background-modifier-hover) !important;
    color: var(--text-normal) !important;
  }

  :global(.property-drag-handle:active) {
    cursor: grabbing !important;
  }

  :global(.property-content) {
    flex: 1 !important;
    padding: 0 !important;
  }

  :global(.property-main-setting) {
    border-bottom: 1px solid var(--background-modifier-border) !important;
    margin-bottom: 0 !important;
    padding-bottom: 0 !important;
  }

  :global(.property-secondary-settings) {
    background: var(--background-secondary) !important;
    padding: 0.75rem 1rem !important;
  }

  :global(.property-settings-row) {
    margin-bottom: 0 !important;
    padding: 0 !important;
  }

  :global(.property-settings-row .setting-item-name) {
    font-size: 0.85rem !important;
    color: var(--text-muted) !important;
    font-weight: 500 !important;
    min-width: 100px !important;
  }

  :global(.property-settings-row .setting-item-control) {
    display: flex !important;
    align-items: center !important;
    gap: 1rem !important;
  }

  :global(.setting-toggle-label) {
    margin-left: 0.5rem !important;
    font-size: 0.9rem !important;
    color: var(--text-muted) !important;
  }
</style>

