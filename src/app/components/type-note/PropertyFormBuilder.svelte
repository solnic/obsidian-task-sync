<!--
  Property Form Builder - Clean version matching Task Create modal style
  - No visible labels (uses placeholders)
  - Button-style dropdowns for select/enum
  - Horizontal layout for property buttons
  - Clean collapsible section for optional properties
-->
<script lang="ts">
  import { onMount } from "svelte";
  import {
    StringProperty,
    NumberProperty,
    BooleanProperty,
    DateProperty,
    EnumProperty,
    ArrayProperty,
    SelectProperty,
  } from "./properties";
  import type {
    PropertyDefinition,
    ValidationResult,
  } from "../../core/type-note/types";
  import { validateProperty } from "../../core/type-note/validation";

  interface Props {
    properties: Record<string, PropertyDefinition>;
    values?: Record<string, any>;
    onvalueschange?: (values: Record<string, any>) => void;
    onvalidationchange?: (validation: Record<string, ValidationResult>) => void;
    showOptionalProperties?: boolean;
  }

  let {
    properties,
    values = $bindable({}),
    onvalueschange,
    onvalidationchange,
    showOptionalProperties = true,
  }: Props = $props();

  // Internal state
  let validationResults: Record<string, ValidationResult> = $state({});
  let touchedFields: Record<string, boolean> = $state({});
  let showOptional = $state(false);

  // Helper to check if property is a "button-style" property (select/enum)
  function isButtonProperty(prop: PropertyDefinition): boolean {
    return prop.type === "select" || prop.type === "enum";
  }

  // Helper to check if property is a text-like property (string, number, date, array)
  function isTextProperty(prop: PropertyDefinition): boolean {
    return (
      prop.type === "string" ||
      prop.type === "number" ||
      prop.type === "date" ||
      prop.type === "array"
    );
  }

  // Filter out hidden properties
  const visibleProperties = $derived(
    Object.entries(properties).filter(([_, prop]) => !prop.form?.hidden)
  );

  // Separate required properties by type
  const requiredTextProperties = $derived(
    visibleProperties
      .filter(([_, prop]) => prop.required && isTextProperty(prop))
      .sort(([_, a], [__, b]) => {
        const orderA = a.order ?? 999;
        const orderB = b.order ?? 999;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name);
      })
  );

  const requiredButtonProperties = $derived(
    visibleProperties
      .filter(([_, prop]) => prop.required && isButtonProperty(prop))
      .sort(([_, a], [__, b]) => {
        const orderA = a.order ?? 999;
        const orderB = b.order ?? 999;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name);
      })
  );

  const requiredBooleanProperties = $derived(
    visibleProperties
      .filter(([_, prop]) => prop.required && prop.type === "boolean")
      .sort(([_, a], [__, b]) => {
        const orderA = a.order ?? 999;
        const orderB = b.order ?? 999;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name);
      })
  );

  const optionalProperties = $derived(
    visibleProperties
      .filter(([_, prop]) => !prop.required)
      .sort(([_, a], [__, b]) => {
        const orderA = a.order ?? 999;
        const orderB = b.order ?? 999;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name);
      })
  );

  onMount(() => {
    initializeValues();
  });

  function initializeValues() {
    const newValues = { ...values };
    let hasChanges = false;

    for (const [key, prop] of Object.entries(properties)) {
      if (
        values[prop.frontMatterKey] === undefined &&
        prop.defaultValue !== undefined
      ) {
        newValues[prop.frontMatterKey] = prop.defaultValue;
        hasChanges = true;
      }
    }

    if (hasChanges) {
      values = newValues;
      onvalueschange?.(values);
    }
  }

  function handleValueChange(
    propertyKey: string,
    frontMatterKey: string,
    value: any
  ) {
    touchedFields[propertyKey] = true;

    const newValues = { ...values };
    newValues[frontMatterKey] = value;
    values = newValues;
    onvalueschange?.(values);

    // Validate
    const property = properties[propertyKey];
    if (property) {
      const result = validateProperty(value, property);
      validationResults[propertyKey] = result;
      onvalidationchange?.(validationResults);
    }
  }

  function renderProperty(propertyKey: string, property: PropertyDefinition) {
    const frontMatterKey = property.frontMatterKey;
    const value = values[frontMatterKey];
    const validationResult = validationResults[propertyKey];
    const touched = touchedFields[propertyKey] || false;

    const commonProps = {
      property,
      propertyKey,
      value,
      onvaluechange: (newValue: any) =>
        handleValueChange(propertyKey, frontMatterKey, newValue),
      validationResult,
      touched,
    };

    switch (property.type) {
      case "string":
        return StringProperty;
      case "number":
        return NumberProperty;
      case "boolean":
        return BooleanProperty;
      case "date":
        return DateProperty;
      case "enum":
        return EnumProperty;
      case "array":
        return ArrayProperty;
      case "select":
        return SelectProperty;
      default:
        return null;
    }
  }

  function toggleOptional() {
    showOptional = !showOptional;
  }
</script>

<!-- Required text properties (title, description, etc.) -->
{#each requiredTextProperties as [propertyKey, property]}
  {@const Component = renderProperty(propertyKey, property)}
  {#if Component}
    <Component
      {property}
      {propertyKey}
      value={values[property.frontMatterKey]}
      onvaluechange={(newValue) =>
        handleValueChange(propertyKey, property.frontMatterKey, newValue)}
      validationResult={validationResults[propertyKey]}
      touched={touchedFields[propertyKey] || false}
      compact={true}
    />
  {/if}
{/each}

<!-- Required button properties (select/enum) in horizontal row with optional toggle -->
{#if requiredButtonProperties.length > 0 || optionalProperties.length > 0}
  <div class="task-sync-property-controls">
    {#each requiredButtonProperties as [propertyKey, property]}
      {@const Component = renderProperty(propertyKey, property)}
      {#if Component}
        <Component
          {property}
          {propertyKey}
          value={values[property.frontMatterKey]}
          onvaluechange={(newValue) =>
            handleValueChange(propertyKey, property.frontMatterKey, newValue)}
          validationResult={validationResults[propertyKey]}
          touched={touchedFields[propertyKey] || false}
          compact={true}
        />
      {/if}
    {/each}

    <!-- Three-dots button for optional properties -->
    {#if optionalProperties.length > 0}
      <button
        type="button"
        onclick={toggleOptional}
        class="task-sync-property-button task-sync-more-button"
        data-testid="toggle-optional-properties"
        title="More options"
      >
        <span class="task-sync-more-dots">⋯</span>
      </button>
    {/if}
  </div>
{/if}

<!-- Required boolean properties -->
{#each requiredBooleanProperties as [propertyKey, property]}
  {@const Component = renderProperty(propertyKey, property)}
  {#if Component}
    <Component
      {property}
      {propertyKey}
      value={values[property.frontMatterKey]}
      onvaluechange={(newValue) =>
        handleValueChange(propertyKey, property.frontMatterKey, newValue)}
      validationResult={validationResults[propertyKey]}
      touched={touchedFields[propertyKey] || false}
    />
  {/if}
{/each}

<!-- Optional Properties Section (collapsible) -->
{#if showOptional}
  <div class="task-sync-extra-fields">
    {#each optionalProperties as [propertyKey, property]}
      {@const Component = renderProperty(propertyKey, property)}
      {#if Component}
        <div class="task-sync-field-group">
          <Component
            {property}
            {propertyKey}
            value={values[property.frontMatterKey]}
            onvaluechange={(newValue) =>
              handleValueChange(propertyKey, property.frontMatterKey, newValue)}
            validationResult={validationResults[propertyKey]}
            touched={touchedFields[propertyKey] || false}
          />
        </div>
      {/if}
    {/each}
  </div>
{/if}

<style>
  .task-sync-property-controls {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 16px 0;
  }

  .task-sync-extra-fields {
    margin-top: 12px;
    padding: 16px;
    background: var(--background-secondary);
    border-radius: 6px;
    border: 1px solid var(--background-modifier-border);
  }

  .task-sync-field-group {
    margin-bottom: 16px;
  }

  .task-sync-field-group:last-child {
    margin-bottom: 0;
  }
</style>
