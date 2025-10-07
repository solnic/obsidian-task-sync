<!--
  Enum Property Component
  Handles select dropdown for enum properties
-->
<script lang="ts">
  import { FieldGroup } from "../../base";
  import type {
    PropertyDefinition,
    ValidationResult,
  } from "../../../core/type-note/types";

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

  const hasError = $derived(
    touched &&
      validationResult &&
      !validationResult.valid &&
      validationResult.errors.length > 0
  );
  const errorMessage = $derived(
    hasError ? validationResult!.errors[0].message : undefined
  );

  const enumOptions = $derived(property.options || []);

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
