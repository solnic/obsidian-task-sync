<!--
  Date Property Component
  Handles date input for date properties using base PropertyInput
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
    value?: Date | string;
    onvaluechange?: (value: Date | undefined) => void;
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

<PropertyInput
  {property}
  {propertyKey}
  bind:value
  {onvaluechange}
  {validationResult}
  {compact}
  inputType="date"
>
  {#snippet children()}
    <input
      id="prop-{propertyKey}"
      type="date"
      value={formatDate(value)}
      onchange={handleChange}
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
