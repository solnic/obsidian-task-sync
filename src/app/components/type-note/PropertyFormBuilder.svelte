<script lang="ts">
  import { onMount } from "svelte";
  import { z } from "zod";
  import { FieldGroup } from "../base";
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

  // Sort properties by order and required status
  const sortedProperties = $derived(
    Object.entries(properties)
      .filter(([_, prop]) => showOptionalProperties || prop.required)
      .sort(([_, a], [__, b]) => {
        // Required properties first
        if (a.required && !b.required) return -1;
        if (!a.required && b.required) return 1;

        // Then by order
        const orderA = a.order ?? 999;
        const orderB = b.order ?? 999;
        if (orderA !== orderB) return orderA - orderB;

        // Finally by name
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

  function validateAllProperties() {
    const newValidationResults: Record<string, ValidationResult> = {};
    const newPropertyErrors: Record<string, string> = {};

    for (const [key, prop] of Object.entries(properties)) {
      const value = values[prop.frontMatterKey];
      const result = validateProperty(prop, value);

      newValidationResults[key] = result;

      // Only show errors for touched fields
      if (touchedFields[key] && !result.valid && result.errors.length > 0) {
        newPropertyErrors[key] = result.errors[0].message;
      }
    }

    validationResults = newValidationResults;
    propertyErrors = newPropertyErrors;
    onvalidationchange?.(validationResults);
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

  function getSchemaType(schema: z.ZodType<any>): string {
    // Extract the underlying type from Zod schema
    if (schema instanceof z.ZodString) return "string";
    if (schema instanceof z.ZodNumber) return "number";
    if (schema instanceof z.ZodBoolean) return "boolean";
    if (schema instanceof z.ZodDate) return "date";
    if (schema instanceof z.ZodEnum) return "enum";
    if (schema instanceof z.ZodArray) return "array";
    if (schema instanceof z.ZodOptional) return getSchemaType(schema.unwrap());
    if (schema instanceof z.ZodDefault)
      return getSchemaType(schema.removeDefault());

    return "string"; // fallback
  }

  function getEnumOptions(schema: z.ZodType<any>): string[] {
    // Extract enum options from Zod schema
    if (schema instanceof z.ZodEnum) {
      return schema.options;
    }
    if (schema instanceof z.ZodOptional) {
      return getEnumOptions(schema.unwrap());
    }
    if (schema instanceof z.ZodDefault) {
      return getEnumOptions(schema.removeDefault());
    }

    return [];
  }

  function formatDate(date: Date | string | undefined): string {
    if (!date) return "";
    if (typeof date === "string") return date;
    return date.toISOString().split("T")[0]; // YYYY-MM-DD format
  }

  function parseDate(dateString: string): Date | undefined {
    if (!dateString) return undefined;
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? undefined : date;
  }
</script>

<div class="property-form-builder">
  {#each sortedProperties as [propertyKey, property]}
    {@const schemaType = getSchemaType(property.schema)}
    {@const enumOptions = getEnumOptions(property.schema)}
    {@const currentValue = values[property.frontMatterKey]}
    {@const hasError = propertyKey in propertyErrors}
    {@const errorMessage = propertyErrors[propertyKey]}

    <FieldGroup
      label={property.name}
      required={property.required}
      description={hasError ? errorMessage : property.description}
      error={hasError}
      htmlFor="prop-{propertyKey}"
    >
      {#if schemaType === "boolean"}
        <!-- Checkbox for boolean properties -->
        <label class="checkbox-container">
          <input
            id="prop-{propertyKey}"
            type="checkbox"
            checked={currentValue || false}
            onchange={(e) =>
              handleValueChange(
                propertyKey,
                property.frontMatterKey,
                e.target.checked
              )}
            data-testid="property-{propertyKey}"
          />
          <span class="checkbox-label">{property.name}</span>
        </label>
      {:else if schemaType === "number"}
        <!-- Number input -->
        <input
          id="prop-{propertyKey}"
          type="number"
          value={currentValue || ""}
          oninput={(e) =>
            handleValueChange(
              propertyKey,
              property.frontMatterKey,
              parseFloat(e.target.value) || undefined
            )}
          placeholder={property.description ||
            `Enter ${property.name.toLowerCase()}...`}
          class="property-input"
          class:error={hasError}
          data-testid="property-{propertyKey}"
        />
      {:else if schemaType === "date"}
        <!-- Date input -->
        <input
          id="prop-{propertyKey}"
          type="date"
          value={formatDate(currentValue)}
          onchange={(e) =>
            handleValueChange(
              propertyKey,
              property.frontMatterKey,
              parseDate(e.target.value)
            )}
          class="property-input"
          class:error={hasError}
          data-testid="property-{propertyKey}"
        />
      {:else if schemaType === "enum" && enumOptions.length > 0}
        <!-- Select dropdown for enum properties -->
        <select
          id="prop-{propertyKey}"
          value={currentValue || ""}
          onchange={(e) =>
            handleValueChange(
              propertyKey,
              property.frontMatterKey,
              e.target.value || undefined
            )}
          class="property-select"
          class:error={hasError}
          data-testid="property-{propertyKey}"
        >
          {#if !property.required}
            <option value="">-- Select {property.name} --</option>
          {/if}
          {#each enumOptions as option}
            <option value={option}>{option}</option>
          {/each}
        </select>
      {:else if schemaType === "array"}
        <!-- Textarea for array properties (comma-separated) -->
        <textarea
          id="prop-{propertyKey}"
          value={Array.isArray(currentValue)
            ? currentValue.join(", ")
            : currentValue || ""}
          oninput={(e) => {
            const arrayValue = e.target.value
              .split(",")
              .map((item) => item.trim())
              .filter((item) => item);
            handleValueChange(propertyKey, property.frontMatterKey, arrayValue);
          }}
          placeholder={property.description ||
            `Enter ${property.name.toLowerCase()} (comma-separated)...`}
          class="property-textarea"
          class:error={hasError}
          rows="3"
          data-testid="property-{propertyKey}"
        ></textarea>
      {:else}
        <!-- Text input for string and other properties -->
        <input
          id="prop-{propertyKey}"
          type="text"
          value={currentValue || ""}
          oninput={(e) =>
            handleValueChange(
              propertyKey,
              property.frontMatterKey,
              e.target.value || undefined
            )}
          placeholder={property.description ||
            `Enter ${property.name.toLowerCase()}...`}
          class="property-input"
          class:error={hasError}
          data-testid="property-{propertyKey}"
        />
      {/if}
    </FieldGroup>
  {/each}
</div>

<style>
  .property-form-builder {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .property-input,
  .property-select,
  .property-textarea {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    background: var(--background-primary);
    color: var(--text-normal);
    font-family: inherit;
    font-size: 0.9rem;
  }

  .property-input:focus,
  .property-select:focus,
  .property-textarea:focus {
    outline: none;
    border-color: var(--interactive-accent);
    box-shadow: 0 0 0 2px var(--interactive-accent-hover);
  }

  .property-input.error,
  .property-select.error,
  .property-textarea.error {
    border-color: var(--text-error);
    box-shadow: 0 0 0 2px var(--text-error-hover);
  }

  .property-textarea {
    resize: vertical;
    min-height: 4rem;
  }

  .checkbox-container {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
  }

  .checkbox-container input[type="checkbox"] {
    width: auto;
    margin: 0;
  }

  .checkbox-label {
    font-size: 0.9rem;
    color: var(--text-normal);
  }
</style>
