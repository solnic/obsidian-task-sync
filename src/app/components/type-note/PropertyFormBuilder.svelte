<script lang="ts">
  import { onMount } from "svelte";
  import { z } from "zod";
  import {
    StringProperty,
    NumberProperty,
    BooleanProperty,
    DateProperty,
    EnumProperty,
    ArrayProperty,
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
</script>

<div class="property-form-builder">
  {#each sortedProperties as [propertyKey, property]}
    {@const schemaType = getSchemaType(property.schema)}
    {@const currentValue = values[property.frontMatterKey]}
    {@const validationResult = validationResults[propertyKey]}
    {@const touched = touchedFields[propertyKey]}

    {#if schemaType === "boolean"}
      <BooleanProperty
        {property}
        {propertyKey}
        bind:value={values[property.frontMatterKey]}
        onvaluechange={(value) =>
          handleValueChange(propertyKey, property.frontMatterKey, value)}
        {validationResult}
        {touched}
      />
    {:else if schemaType === "number"}
      <NumberProperty
        {property}
        {propertyKey}
        bind:value={values[property.frontMatterKey]}
        onvaluechange={(value) =>
          handleValueChange(propertyKey, property.frontMatterKey, value)}
        {validationResult}
        {touched}
      />
    {:else if schemaType === "date"}
      <DateProperty
        {property}
        {propertyKey}
        bind:value={values[property.frontMatterKey]}
        onvaluechange={(value) =>
          handleValueChange(propertyKey, property.frontMatterKey, value)}
        {validationResult}
        {touched}
      />
    {:else if schemaType === "enum"}
      <EnumProperty
        {property}
        {propertyKey}
        bind:value={values[property.frontMatterKey]}
        onvaluechange={(value) =>
          handleValueChange(propertyKey, property.frontMatterKey, value)}
        {validationResult}
        {touched}
      />
    {:else if schemaType === "array"}
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
</div>

<style>
  .property-form-builder {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
</style>
