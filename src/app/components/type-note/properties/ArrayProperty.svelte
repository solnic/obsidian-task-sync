<!--
  Array Property Component
  Handles textarea input for array properties (comma-separated)
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
    value?: string[];
    onvaluechange?: (value: string[]) => void;
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

  function handleInput(event: Event) {
    const target = event.target as HTMLTextAreaElement;
    const arrayValue = target.value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item);
    value = arrayValue;
    onvaluechange?.(arrayValue);
  }
</script>

<FieldGroup
  label={property.name}
  required={property.required}
  description={hasError ? errorMessage : property.description}
  error={hasError}
  htmlFor="prop-{propertyKey}"
>
  <textarea
    id="prop-{propertyKey}"
    value={Array.isArray(value) ? value.join(", ") : value || ""}
    oninput={handleInput}
    placeholder={property.description ||
      `Enter ${property.name.toLowerCase()} (comma-separated)...`}
    class="property-textarea"
    class:error={hasError}
    rows="3"
    data-testid="property-{propertyKey}"
  ></textarea>
</FieldGroup>
