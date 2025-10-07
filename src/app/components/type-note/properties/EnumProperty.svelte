<!--
  Enum Property Component
  Handles select dropdown for enum properties
-->
<script lang="ts">
  import { FieldGroup } from "../../base";
  import type { PropertyDefinition, ValidationResult } from "../../../core/type-note/types";
  import { z } from "zod";

  interface Props {
    property: PropertyDefinition;
    propertyKey: string;
    value?: string;
    onvaluechange?: (value: string | undefined) => void;
    validationResult?: ValidationResult;
    touched?: boolean;
  }

  let {
    property,
    propertyKey,
    value = $bindable(),
    onvaluechange,
    validationResult,
    touched = false,
  }: Props = $props();

  const hasError = $derived(touched && validationResult && !validationResult.valid && validationResult.errors.length > 0);
  const errorMessage = $derived(hasError ? validationResult!.errors[0].message : undefined);

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

  const enumOptions = $derived(getEnumOptions(property.schema));

  function handleChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    const newValue = target.value || undefined;
    value = newValue;
    onvaluechange?.(newValue);
  }
</script>

<FieldGroup
  label={property.name}
  required={property.required}
  description={hasError ? errorMessage : property.description}
  error={hasError}
  htmlFor="prop-{propertyKey}"
>
  <select
    id="prop-{propertyKey}"
    value={value || ""}
    onchange={handleChange}
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
</FieldGroup>
