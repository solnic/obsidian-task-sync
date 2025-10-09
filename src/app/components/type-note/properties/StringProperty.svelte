<!--
  String Property Component
  Handles text input for string properties using base PropertyInput
-->
<script lang="ts">
  import PropertyInput from "./PropertyInput.svelte";
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
    compact?: boolean;
  }

  let {
    property,
    propertyKey,
    value = $bindable(),
    onvaluechange,
    validationResult,
    compact = false,
  }: Props = $props();

  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement;
    const newValue = target.value || undefined;
    value = newValue;
    onvaluechange?.(newValue);
  }
</script>

<PropertyInput
  {property}
  {propertyKey}
  bind:value
  {onvaluechange}
  {validationResult}
  {compact}
  inputType="text"
>
  {#snippet children()}
    <input
      id="prop-{propertyKey}"
      type="text"
      value={value || ""}
      oninput={handleInput}
      placeholder={compact
        ? property.required
          ? `${property.name.toUpperCase()} *`
          : property.name.toUpperCase()
        : property.description || `Enter ${property.name.toLowerCase()}...`}
      required={property.required}
      class={compact ? "task-sync-title-input" : "property-input"}
      class:task-sync-input-error={compact &&
        validationResult &&
        !validationResult.valid}
      class:error={!compact && validationResult && !validationResult.valid}
      data-testid="property-{propertyKey}"
    />
  {/snippet}
</PropertyInput>
