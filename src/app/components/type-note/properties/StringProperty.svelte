<!--
  String Property Component
  Handles text input for string properties
  Supports compact mode (no label) for cleaner forms
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
    compact?: boolean; // If true, no label/FieldGroup wrapper
  }

  let {
    property,
    propertyKey,
    value = $bindable(),
    onvaluechange,
    validationResult,
    compact = false,
  }: Props = $props();

  const hasError = $derived(
    validationResult &&
      !validationResult.valid &&
      validationResult.errors.length > 0
  );
  const errorMessage = $derived(
    hasError ? validationResult!.errors[0].message : undefined
  );

  // Determine placeholder text
  const placeholder = $derived(() => {
    if (property.required) {
      return `${property.name.toUpperCase()} *`;
    }
    return property.name.toUpperCase();
  });

  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement;
    const newValue = target.value || undefined;
    value = newValue;
    onvaluechange?.(newValue);
  }
</script>

{#if compact}
  <!-- Compact mode: no label, just input with placeholder -->
  <input
    id="prop-{propertyKey}"
    type="text"
    value={value || ""}
    oninput={handleInput}
    placeholder={placeholder()}
    class="task-sync-title-input"
    class:task-sync-input-error={hasError}
    data-testid="property-{propertyKey}"
  />
{:else}
  <!-- Standard mode: with FieldGroup label -->
  <FieldGroup
    label={property.name}
    required={property.required}
    description={hasError ? errorMessage : property.description}
    error={hasError}
    htmlFor="prop-{propertyKey}"
  >
    <input
      id="prop-{propertyKey}"
      type="text"
      value={value || ""}
      oninput={handleInput}
      placeholder={property.description ||
        `Enter ${property.name.toLowerCase()}...`}
      class="property-input"
      class:error={hasError}
      data-testid="property-{propertyKey}"
    />
  </FieldGroup>
{/if}
