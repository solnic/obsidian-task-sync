<!--
  Date Property Component
  Handles date input for date properties
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
    value?: Date | string;
    onvaluechange?: (value: Date | undefined) => void;
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

  function handleChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const newValue = parseDate(target.value);
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
    type="date"
    value={formatDate(value)}
    onchange={handleChange}
    class="property-input"
    class:error={hasError}
    data-testid="property-{propertyKey}"
  />
</FieldGroup>
