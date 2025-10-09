<!--
  Select Property Component
  Handles select dropdown for select properties with colored options
  Uses the same Dropdown component as TaskCreateModal for consistency
-->
<script lang="ts">
  import { FieldGroup } from "../../base";
  import Dropdown from "../../Dropdown.svelte";
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

  const hasError = $derived(
    validationResult &&
      !validationResult.valid &&
      validationResult.errors.length > 0
  );
  const errorMessage = $derived(
    hasError ? validationResult!.errors[0].message : undefined
  );

  const selectOptions = $derived(property.selectOptions || []);

  // Get color for selected option
  const selectedOption = $derived(() => {
    if (!value) return null;
    return selectOptions.find((opt) => opt.value === value);
  });

  // State for dropdown
  let showDropdown = $state(false);
  let buttonEl: HTMLButtonElement | null = $state(null);

  // Create dropdown items with custom badge content
  const dropdownItems = $derived(
    selectOptions.map((option) => ({
      value: option.value,
      label: option.value,
      customContent: createOptionBadge(option),
    }))
  );

  function createOptionBadge(option: {
    value: string;
    color?: string;
  }): string {
    const color = option.color || "#3b82f6";
    return `<span class="task-sync-color-dot" style="background-color: ${color}"></span><span>${option.value}</span>`;
  }

  function handleButtonClick() {
    showDropdown = true;
  }

  function handleSelect(selectedValue: string) {
    value = selectedValue;
    onvaluechange?.(selectedValue);
    showDropdown = false;
  }

  function updateButtonContent() {
    if (!buttonEl) return;
    buttonEl.innerHTML = "";

    const selected = selectedOption();
    if (selected) {
      // Create color dot
      const dot = document.createElement("span");
      dot.className = "task-sync-color-dot";
      dot.style.backgroundColor = selected.color || "#3b82f6";

      // Create label
      const label = document.createElement("span");
      label.textContent = selected.value;

      buttonEl.appendChild(dot);
      buttonEl.appendChild(label);
    } else {
      const label = document.createElement("span");
      label.textContent = `Select ${property.name}`;
      label.style.color = "var(--text-muted)";
      buttonEl.appendChild(label);
    }
  }

  $effect(() => {
    // Update button content when value changes
    if (buttonEl) {
      updateButtonContent();
    }
  });
</script>

{#if compact}
  <!-- Compact mode: no label, just button -->
  <button
    bind:this={buttonEl}
    type="button"
    onclick={handleButtonClick}
    class="task-sync-property-button"
    class:error={hasError}
    data-testid="property-{propertyKey}"
    aria-label="Select {property.name}"
  ></button>
{:else}
  <!-- Standard mode: with FieldGroup label -->
  <FieldGroup
    label={property.name}
    required={property.required}
    description={hasError ? errorMessage : property.description}
    error={hasError}
    htmlFor="prop-{propertyKey}"
  >
    <button
      bind:this={buttonEl}
      type="button"
      onclick={handleButtonClick}
      class="task-sync-property-button"
      class:error={hasError}
      data-testid="property-{propertyKey}"
      aria-label="Select {property.name}"
    ></button>
  </FieldGroup>
{/if}

{#if showDropdown && buttonEl}
  <Dropdown
    anchor={buttonEl}
    items={dropdownItems}
    selectedValue={value}
    onSelect={handleSelect}
    onClose={() => (showDropdown = false)}
    testId="property-{propertyKey}-dropdown"
  />
{/if}

<style>
  /* Styles are in custom.css - using task-sync-property-button class */
</style>
