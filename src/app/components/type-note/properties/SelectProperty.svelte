<!--
  Select Property Component
  Handles select dropdown for select properties with colored options
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

  const selectOptions = $derived(property.selectOptions || []);

  function handleChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    const newValue = target.value || undefined;
    value = newValue;
    onvaluechange?.(newValue);
  }

  // Get color for selected option
  const selectedColor = $derived(() => {
    if (!value) return undefined;
    const option = selectOptions.find((opt) => opt.value === value);
    return option?.color;
  });
</script>

<FieldGroup
  label={property.name}
  required={property.required}
  description={hasError ? errorMessage : property.description}
  error={hasError}
  htmlFor="prop-{propertyKey}"
>
  <div class="select-property-wrapper">
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
      {#each selectOptions as option}
        <option value={option.value}>{option.value}</option>
      {/each}
    </select>
    {#if value && selectedColor()}
      <span
        class="select-option-badge"
        style="background-color: {selectedColor()}"
      >
        {value}
      </span>
    {/if}
  </div>
</FieldGroup>

<style>
  .select-property-wrapper {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .select-option-badge {
    display: inline-block;
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.85rem;
    font-weight: 500;
    white-space: nowrap;
  }

  .property-select {
    flex: 1;
    min-width: 0;
  }
</style>

