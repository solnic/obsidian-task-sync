<!--
  Base Property Input Component
  Consolidates common logic for all property input types
  Handles validation, error display, compact mode, and required attributes
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
    value?: any;
    onvaluechange?: (value: any) => void;
    validationResult?: ValidationResult;
    compact?: boolean;
    inputType?: string; // 'text', 'number', 'date', etc.
    children?: import('svelte').Snippet; // For custom input rendering
  }

  let {
    property,
    propertyKey,
    value = $bindable(),
    onvaluechange,
    validationResult,
    compact = false,
    inputType = "text",
    children,
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
    if (compact && property.required) {
      return `${property.name.toUpperCase()} *`;
    }
    if (compact) {
      return property.name.toUpperCase();
    }
    return property.description || `Enter ${property.name.toLowerCase()}...`;
  });
</script>

{#if compact}
  <!-- Compact mode: no label, just input with placeholder -->
  {#if children}
    {@render children()}
  {:else}
    <input
      id="prop-{propertyKey}"
      type={inputType}
      {value}
      oninput={(e) => onvaluechange?.((e.target as HTMLInputElement).value || undefined)}
      placeholder={placeholder()}
      required={property.required}
      class="task-sync-title-input"
      class:task-sync-input-error={hasError}
      data-testid="property-{propertyKey}"
    />
  {/if}
{:else}
  <!-- Standard mode: with FieldGroup label -->
  <FieldGroup
    label={property.name}
    required={property.required}
    description={hasError ? errorMessage : property.description}
    error={hasError}
    htmlFor="prop-{propertyKey}"
  >
    {#if children}
      {@render children()}
    {:else}
      <input
        id="prop-{propertyKey}"
        type={inputType}
        {value}
        oninput={(e) => onvaluechange?.((e.target as HTMLInputElement).value || undefined)}
        placeholder={placeholder()}
        required={property.required}
        class="property-input"
        class:error={hasError}
        data-testid="property-{propertyKey}"
      />
    {/if}
  </FieldGroup>
{/if}

