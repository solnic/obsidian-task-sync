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
  let propertyErrors: Record<string, string> = $state({});
  let touchedFields: Record<string, boolean> = $state({});
  let showOptional = $state(false);

  // Filter out hidden properties and separate required from optional
  const visibleProperties = $derived(
    Object.entries(properties).filter(([_, prop]) => !prop.form?.hidden)
  );

  const requiredProperties = $derived(
    visibleProperties
      .filter(([_, prop]) => prop.required)
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
    // Initialize values with defaults
    initializeValues();
    // Don't validate on mount - only validate after user interaction
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
    // Mark field as touched
    touchedFields[propertyKey] = true;

    values = { ...values, [frontMatterKey]: value };
    onvalueschange?.(values);

    // Validate this property
    const prop = properties[propertyKey];
    const result = validateProperty(prop, value);
    validationResults[propertyKey] = result;

    // Only show error if field has been touched
    if (!result.valid && result.errors.length > 0) {
      propertyErrors[propertyKey] = result.errors[0].message;
    } else {
      delete propertyErrors[propertyKey];
    }

    onvalidationchange?.(validationResults);
  }
</script>

<div class="property-form-builder">
  <!-- Required Properties -->
  {#each requiredProperties as [propertyKey, property]}
    {@const validationResult = validationResults[propertyKey]}
    {@const touched = touchedFields[propertyKey]}

    {#if property.type === "boolean"}
      <BooleanProperty
        {property}
        {propertyKey}
        bind:value={values[property.frontMatterKey]}
        onvaluechange={(value) =>
          handleValueChange(propertyKey, property.frontMatterKey, value)}
        {validationResult}
        {touched}
      />
    {:else if property.type === "number"}
      <NumberProperty
        {property}
        {propertyKey}
        bind:value={values[property.frontMatterKey]}
        onvaluechange={(value) =>
          handleValueChange(propertyKey, property.frontMatterKey, value)}
        {validationResult}
        {touched}
      />
    {:else if property.type === "date"}
      <DateProperty
        {property}
        {propertyKey}
        bind:value={values[property.frontMatterKey]}
        onvaluechange={(value) =>
          handleValueChange(propertyKey, property.frontMatterKey, value)}
        {validationResult}
        {touched}
      />
    {:else if property.type === "enum"}
      <EnumProperty
        {property}
        {propertyKey}
        bind:value={values[property.frontMatterKey]}
        onvaluechange={(value) =>
          handleValueChange(propertyKey, property.frontMatterKey, value)}
        {validationResult}
        {touched}
      />
    {:else if property.type === "select"}
      <SelectProperty
        {property}
        {propertyKey}
        bind:value={values[property.frontMatterKey]}
        onvaluechange={(value) =>
          handleValueChange(propertyKey, property.frontMatterKey, value)}
        {validationResult}
        {touched}
      />
    {:else if property.type === "array"}
      <ArrayProperty
        {property}
        {propertyKey}
        bind:value={values[property.frontMatterKey]}
        onvaluechange={(value) =>
          handleValueChange(propertyKey, property.frontMatterKey, value)}
        {validationResult}
        {touched}
      />
    {:else}
      <StringProperty
        {property}
        {propertyKey}
        bind:value={values[property.frontMatterKey]}
        onvaluechange={(value) =>
          handleValueChange(propertyKey, property.frontMatterKey, value)}
        {validationResult}
        {touched}
      />
    {/if}
  {/each}

  <!-- Optional Properties Section -->
  {#if optionalProperties.length > 0}
    <div class="optional-properties-section">
      <button
        type="button"
        class="optional-properties-toggle"
        onclick={() => (showOptional = !showOptional)}
      >
        <span class="toggle-icon" class:expanded={showOptional}>▶</span>
        <span>Additional Properties ({optionalProperties.length})</span>
      </button>

      {#if showOptional}
        <div class="optional-properties-content">
          {#each optionalProperties as [propertyKey, property]}
            {@const validationResult = validationResults[propertyKey]}
            {@const touched = touchedFields[propertyKey]}

            {#if property.type === "boolean"}
              <BooleanProperty
                {property}
                {propertyKey}
                bind:value={values[property.frontMatterKey]}
                onvaluechange={(value) =>
                  handleValueChange(
                    propertyKey,
                    property.frontMatterKey,
                    value
                  )}
                {validationResult}
                {touched}
              />
            {:else if property.type === "number"}
              <NumberProperty
                {property}
                {propertyKey}
                bind:value={values[property.frontMatterKey]}
                onvaluechange={(value) =>
                  handleValueChange(
                    propertyKey,
                    property.frontMatterKey,
                    value
                  )}
                {validationResult}
                {touched}
              />
            {:else if property.type === "date"}
              <DateProperty
                {property}
                {propertyKey}
                bind:value={values[property.frontMatterKey]}
                onvaluechange={(value) =>
                  handleValueChange(
                    propertyKey,
                    property.frontMatterKey,
                    value
                  )}
                {validationResult}
                {touched}
              />
            {:else if property.type === "enum"}
              <EnumProperty
                {property}
                {propertyKey}
                bind:value={values[property.frontMatterKey]}
                onvaluechange={(value) =>
                  handleValueChange(
                    propertyKey,
                    property.frontMatterKey,
                    value
                  )}
                {validationResult}
                {touched}
              />
            {:else if property.type === "select"}
              <SelectProperty
                {property}
                {propertyKey}
                bind:value={values[property.frontMatterKey]}
                onvaluechange={(value) =>
                  handleValueChange(
                    propertyKey,
                    property.frontMatterKey,
                    value
                  )}
                {validationResult}
                {touched}
              />
            {:else if property.type === "array"}
              <ArrayProperty
                {property}
                {propertyKey}
                bind:value={values[property.frontMatterKey]}
                onvaluechange={(value) =>
                  handleValueChange(
                    propertyKey,
                    property.frontMatterKey,
                    value
                  )}
                {validationResult}
                {touched}
              />
            {:else}
              <StringProperty
                {property}
                {propertyKey}
                bind:value={values[property.frontMatterKey]}
                onvaluechange={(value) =>
                  handleValueChange(
                    propertyKey,
                    property.frontMatterKey,
                    value
                  )}
                {validationResult}
                {touched}
              />
            {/if}
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .property-form-builder {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    overflow: visible; /* Ensure dropdowns aren't clipped */
  }

  .optional-properties-section {
    margin-top: 0.5rem;
    border-top: 1px solid var(--background-modifier-border);
    padding-top: 1rem;
  }

  .optional-properties-toggle {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.5rem;
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 0.9rem;
    color: var(--text-muted);
    transition: color 0.2s;
  }

  .optional-properties-toggle:hover {
    color: var(--text-normal);
  }

  .toggle-icon {
    display: inline-block;
    transition: transform 0.2s;
    font-size: 0.7rem;
  }

  .toggle-icon.expanded {
    transform: rotate(90deg);
  }

  .optional-properties-content {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-top: 1rem;
    padding-left: 0.5rem;
  }
</style>
