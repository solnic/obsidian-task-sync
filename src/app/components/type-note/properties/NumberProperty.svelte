<!--
  Number Property Component
  Handles number input for numeric properties
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
    value?: number;
    onvaluechange?: (value: number | undefined) => void;
    validationResult?: ValidationResult;
    compact?: boolean;
  }

  let {
    property,
    propertyKey,
    value = $bindable(),
    onvaluechange,
    validationResult,
  }: Props = $props();

  const hasError = $derived(
    validationResult &&
      !validationResult.valid &&
      validationResult.errors.length > 0
  );
  const errorMessage = $derived(
    hasError ? validationResult!.errors[0].message : undefined
  );

  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement;
    const newValue = parseFloat(target.value) || undefined;
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
  <input
    id="prop-{propertyKey}"
    type="number"
    value={value || ""}
    oninput={handleInput}
    placeholder={property.description ||
      `Enter ${property.name.toLowerCase()}...`}
    class="property-input"
    class:error={hasError}
    data-testid="property-{propertyKey}"
  />
</FieldGroup>
