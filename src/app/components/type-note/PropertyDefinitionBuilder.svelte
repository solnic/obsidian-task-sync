<script lang="ts">
  import { z } from "zod";
  import { FieldGroup } from "../base";
  import type { PropertyDefinition } from "../../core/type-note/types";
  import {
    stringSchema,
    numberSchema,
    booleanSchema,
    dateSchema,
    enumSchema,
    stringArraySchema,
  } from "../../core/type-note/schemas";

  interface Props {
    properties: Record<string, PropertyDefinition>;
    onpropertieschange?: (
      properties: Record<string, PropertyDefinition>
    ) => void;
  }

  let { properties = $bindable({}), onpropertieschange }: Props = $props();

  // Available schema types
  const schemaTypes = [
    { value: "string", label: "Text", schema: stringSchema },
    { value: "number", label: "Number", schema: numberSchema },
    { value: "boolean", label: "Checkbox", schema: booleanSchema },
    { value: "date", label: "Date", schema: dateSchema },
    { value: "enum", label: "Dropdown", schema: null }, // Will be created dynamically
    { value: "array", label: "List", schema: stringArraySchema },
  ];

  // State for adding new property
  let showAddForm = $state(false);
  let newProperty = $state({
    key: "",
    name: "",
    schemaType: "string",
    frontMatterKey: "",
    required: false,
    defaultValue: "",
    description: "",
    visible: true,
    order: 0,
    enumOptions: "",
  });

  function handleAddProperty() {
    showAddForm = true;
    resetNewProperty();
  }

  function resetNewProperty() {
    newProperty = {
      key: "",
      name: "",
      schemaType: "string",
      frontMatterKey: "",
      required: false,
      defaultValue: "",
      description: "",
      visible: true,
      order: Object.keys(properties).length,
      enumOptions: "",
    };
  }

  function handleSaveProperty() {
    if (!newProperty.key || !newProperty.name) {
      return;
    }

    // Create schema based on type
    let schema: z.ZodType<any>;
    switch (newProperty.schemaType) {
      case "string":
        schema = stringSchema;
        break;
      case "number":
        schema = numberSchema;
        break;
      case "boolean":
        schema = booleanSchema;
        break;
      case "date":
        schema = dateSchema;
        break;
      case "enum":
        const options = newProperty.enumOptions
          .split(",")
          .map((opt) => opt.trim())
          .filter((opt) => opt);
        schema = enumSchema(options as [string, ...string[]]);
        break;
      case "array":
        schema = stringArraySchema;
        break;
      default:
        schema = stringSchema;
    }

    const propertyDef: PropertyDefinition = {
      key: newProperty.key,
      name: newProperty.name,
      schema,
      frontMatterKey: newProperty.frontMatterKey || newProperty.key,
      required: newProperty.required,
      description: newProperty.description || undefined,
      visible: newProperty.visible,
      order: newProperty.order,
    };

    if (newProperty.defaultValue) {
      try {
        // Parse default value based on type
        switch (newProperty.schemaType) {
          case "number":
            propertyDef.defaultValue = parseFloat(newProperty.defaultValue);
            break;
          case "boolean":
            propertyDef.defaultValue = newProperty.defaultValue === "true";
            break;
          case "array":
            propertyDef.defaultValue = newProperty.defaultValue
              .split(",")
              .map((item) => item.trim())
              .filter((item) => item);
            break;
          default:
            propertyDef.defaultValue = newProperty.defaultValue;
        }
      } catch (error) {
        console.warn("Failed to parse default value:", error);
      }
    }

    properties = { ...properties, [newProperty.key]: propertyDef };
    onpropertieschange?.(properties);
    showAddForm = false;
  }

  function handleCancelAdd() {
    showAddForm = false;
  }

  function handleDeleteProperty(key: string) {
    if (
      confirm(
        `Are you sure you want to delete the "${properties[key]?.name}" property?`
      )
    ) {
      const newProperties = { ...properties };
      delete newProperties[key];
      properties = newProperties;
      onpropertieschange?.(properties);
    }
  }

  function handleKeyInput() {
    // Auto-generate front matter key from property key
    if (!newProperty.frontMatterKey) {
      newProperty.frontMatterKey = newProperty.key
        .toLowerCase()
        .replace(/\s+/g, "_");
    }
  }

  // Sort properties by order
  let sortedProperties = $derived(
    Object.entries(properties).sort(
      ([, a], [, b]) => (a.order || 0) - (b.order || 0)
    )
  );
</script>

<div class="property-definition-builder">
  <div class="section-header">
    <h4>Properties</h4>
    <button
      type="button"
      class="add-property-button"
      onclick={handleAddProperty}
      data-testid="add-property-button"
    >
      Add Property
    </button>
  </div>

  <!-- Existing properties list -->
  {#if sortedProperties.length > 0}
    <div class="properties-list">
      {#each sortedProperties as [key, property]}
        <div class="property-item" data-testid="property-{key}">
          <div class="property-header">
            <div class="property-info">
              <span class="property-name">{property.name}</span>
              <span class="property-key">({property.key})</span>
              {#if property.required}
                <span class="required-badge">Required</span>
              {/if}
            </div>
            <button
              type="button"
              class="delete-property-button"
              onclick={() => handleDeleteProperty(key)}
              data-testid="delete-property-{key}"
            >
              Delete
            </button>
          </div>
          {#if property.description}
            <p class="property-description">{property.description}</p>
          {/if}
          <div class="property-meta">
            <span>Type: {property.schema.constructor.name}</span>
            <span>Front-matter: {property.frontMatterKey}</span>
            {#if property.defaultValue !== undefined}
              <span>Default: {JSON.stringify(property.defaultValue)}</span>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <div class="empty-properties">
      <p>No properties defined</p>
      <p class="empty-hint">
        Add properties to define the structure of this note type.
      </p>
    </div>
  {/if}

  <!-- Add property form -->
  {#if showAddForm}
    <div class="add-property-form">
      <h4>Add Property</h4>

      <div class="form-grid">
        <FieldGroup label="Property Key" required={true} htmlFor="prop-key">
          <input
            id="prop-key"
            type="text"
            bind:value={newProperty.key}
            oninput={handleKeyInput}
            placeholder="e.g., title, dueDate"
            class="form-input"
            data-testid="property-key-input"
          />
        </FieldGroup>

        <FieldGroup label="Display Name" required={true} htmlFor="prop-name">
          <input
            id="prop-name"
            type="text"
            bind:value={newProperty.name}
            placeholder="e.g., Title, Due Date"
            class="form-input"
            data-testid="property-name-input"
          />
        </FieldGroup>

        <FieldGroup label="Type" required={true} htmlFor="prop-type">
          <select
            id="prop-type"
            bind:value={newProperty.schemaType}
            class="form-select"
            data-testid="property-type-select"
          >
            {#each schemaTypes as type}
              <option value={type.value}>{type.label}</option>
            {/each}
          </select>
        </FieldGroup>

        <FieldGroup label="Front-matter Key" htmlFor="prop-frontmatter">
          <input
            id="prop-frontmatter"
            type="text"
            bind:value={newProperty.frontMatterKey}
            placeholder="Auto-generated from key"
            class="form-input"
            data-testid="property-frontmatter-input"
          />
        </FieldGroup>

        {#if newProperty.schemaType === "enum"}
          <FieldGroup
            label="Options"
            required={true}
            htmlFor="prop-options"
            description="Comma-separated list of options"
          >
            <input
              id="prop-options"
              type="text"
              bind:value={newProperty.enumOptions}
              placeholder="Option 1, Option 2, Option 3"
              class="form-input"
              data-testid="property-options-input"
            />
          </FieldGroup>
        {/if}

        <FieldGroup label="Default Value" htmlFor="prop-default">
          <input
            id="prop-default"
            type="text"
            bind:value={newProperty.defaultValue}
            placeholder="Optional default value"
            class="form-input"
            data-testid="property-default-input"
          />
        </FieldGroup>

        <FieldGroup label="Description" htmlFor="prop-description">
          <textarea
            id="prop-description"
            bind:value={newProperty.description}
            placeholder="Optional description for this property"
            class="form-textarea"
            rows="2"
            data-testid="property-description-input"
          ></textarea>
        </FieldGroup>

        <FieldGroup label="Order" htmlFor="prop-order">
          <input
            id="prop-order"
            type="number"
            bind:value={newProperty.order}
            min="0"
            class="form-input"
            data-testid="property-order-input"
          />
        </FieldGroup>
      </div>

      <div class="form-checkboxes">
        <label class="checkbox-label">
          <input
            type="checkbox"
            bind:checked={newProperty.required}
            data-testid="property-required-checkbox"
          />
          Required
        </label>

        <label class="checkbox-label">
          <input
            type="checkbox"
            bind:checked={newProperty.visible}
            data-testid="property-visible-checkbox"
          />
          Visible in UI
        </label>
      </div>

      <div class="form-actions">
        <button
          type="button"
          class="save-button"
          onclick={handleSaveProperty}
          data-testid="save-property-button"
        >
          Save Property
        </button>
        <button
          type="button"
          class="cancel-button"
          onclick={handleCancelAdd}
          data-testid="cancel-property-button"
        >
          Cancel
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .property-definition-builder {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .section-header h4 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
  }

  .add-property-button {
    padding: 0.5rem 1rem;
    border: 1px solid var(--interactive-accent);
    border-radius: 4px;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    cursor: pointer;
    font-size: 0.85rem;
  }

  .add-property-button:hover {
    background: var(--interactive-accent-hover);
  }

  .properties-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .property-item {
    padding: 1rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    background: var(--background-secondary);
  }

  .property-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .property-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .property-name {
    font-weight: 600;
  }

  .property-key {
    font-size: 0.85rem;
    color: var(--text-muted);
    font-family: var(--font-monospace);
  }

  .required-badge {
    font-size: 0.7rem;
    padding: 0.2rem 0.4rem;
    background: var(--text-error);
    color: white;
    border-radius: 2px;
  }

  .delete-property-button {
    padding: 0.25rem 0.5rem;
    border: 1px solid var(--text-error);
    border-radius: 3px;
    background: transparent;
    color: var(--text-error);
    cursor: pointer;
    font-size: 0.8rem;
  }

  .delete-property-button:hover {
    background: var(--background-modifier-error);
  }

  .property-description {
    margin: 0 0 0.5rem 0;
    font-size: 0.9rem;
    color: var(--text-muted);
  }

  .property-meta {
    display: flex;
    gap: 1rem;
    font-size: 0.8rem;
    color: var(--text-muted);
    flex-wrap: wrap;
  }

  .empty-properties {
    text-align: center;
    padding: 2rem;
    color: var(--text-muted);
    border: 1px dashed var(--background-modifier-border);
    border-radius: 6px;
  }

  .empty-properties p {
    margin: 0 0 0.5rem 0;
  }

  .empty-hint {
    font-size: 0.85rem;
    opacity: 0.8;
  }

  .add-property-form {
    padding: 1.5rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    background: var(--background-secondary);
  }

  .add-property-form h4 {
    margin: 0 0 1rem 0;
    font-size: 1rem;
    font-weight: 600;
  }

  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .form-input,
  .form-select,
  .form-textarea {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: 0.9rem;
  }

  .form-input:focus,
  .form-select:focus,
  .form-textarea:focus {
    outline: none;
    border-color: var(--interactive-accent);
    box-shadow: 0 0 0 2px var(--interactive-accent-hover);
  }

  .form-textarea {
    resize: vertical;
  }

  .form-checkboxes {
    display: flex;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    font-size: 0.9rem;
  }

  .checkbox-label input[type="checkbox"] {
    width: auto;
    margin: 0;
  }

  .form-actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
  }

  .save-button {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 4px;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    cursor: pointer;
    font-size: 0.9rem;
  }

  .save-button:hover {
    background: var(--interactive-accent-hover);
  }

  .cancel-button {
    padding: 0.5rem 1rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    background: var(--background-primary);
    color: var(--text-normal);
    cursor: pointer;
    font-size: 0.9rem;
  }

  .cancel-button:hover {
    background: var(--background-modifier-hover);
  }
</style>
