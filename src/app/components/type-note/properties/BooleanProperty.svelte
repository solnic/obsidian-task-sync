<!--
  Boolean Property Component
  Handles checkbox input for boolean properties
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
    value?: boolean;
    onvaluechange?: (value: boolean) => void;
    validationResult?: ValidationResult;
    touched?: boolean;
    compact?: boolean;
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

  function handleChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const newValue = target.checked;
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
  <label class="checkbox-container">
    <input
      id="prop-{propertyKey}"
      type="checkbox"
      checked={value || false}
      onchange={handleChange}
      data-testid="property-{propertyKey}"
    />
    <span class="checkbox-label">{property.name}</span>
  </label>
</FieldGroup>
