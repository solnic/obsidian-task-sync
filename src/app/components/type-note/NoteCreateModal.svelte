<script lang="ts">
  import { onMount } from "svelte";
  import { BaseFormModal } from "../base";
  import PropertyFormBuilder from "./PropertyFormBuilder.svelte";
  import type { NoteType, ValidationResult } from "../../core/type-note/types";
  import type { TypeRegistry } from "../../core/type-note/registry";

  interface Props {
    typeRegistry: TypeRegistry;
    selectedNoteType?: NoteType;
    onsubmit?: (data: { noteType: NoteType; properties: Record<string, any>; title: string; description: string }) => void;
    oncancel?: () => void;
    onchangenotetype?: () => void;
  }

  let {
    typeRegistry,
    selectedNoteType,
    onsubmit,
    oncancel,
    onchangenotetype,
  }: Props = $props();

  // Form state
  let titleValue = $state("");
  let descriptionValue = $state("");
  let propertyValues: Record<string, any> = $state({});
  let propertyValidation: Record<string, ValidationResult> = $state({});
  let titleError = $state(false);
  let showOptionalProperties = $state(false);

  // Computed values
  $: hasValidationErrors = Object.values(propertyValidation).some(result => !result.valid);
  $: canSubmit = selectedNoteType && titleValue.trim() && !hasValidationErrors;

  onMount(() => {
    // Initialize property values with defaults if note type is already selected
    if (selectedNoteType) {
      initializePropertyValues();
    }
  });

  function initializePropertyValues() {
    if (!selectedNoteType) return;

    const newValues: Record<string, any> = {};
    for (const [key, prop] of Object.entries(selectedNoteType.properties)) {
      if (prop.defaultValue !== undefined) {
        newValues[prop.frontMatterKey] = prop.defaultValue;
      }
    }
    propertyValues = newValues;
  }

  function handlePropertyValuesChange(values: Record<string, any>) {
    propertyValues = values;
  }

  function handlePropertyValidationChange(validation: Record<string, ValidationResult>) {
    propertyValidation = validation;
  }

  function handleSubmit() {
    if (!selectedNoteType) return;

    // Validate title
    if (!titleValue.trim()) {
      titleError = true;
      return;
    }

    // Check for validation errors
    if (hasValidationErrors) {
      return;
    }

    onsubmit?.({
      noteType: selectedNoteType,
      properties: propertyValues,
      title: titleValue.trim(),
      description: descriptionValue.trim(),
    });
  }

  function handleChangeNoteType() {
    onchangenotetype?.();
  }

  function toggleOptionalProperties() {
    showOptionalProperties = !showOptionalProperties;
  }

  // Reset form when note type changes
  $effect(() => {
    if (selectedNoteType) {
      initializePropertyValues();
    }
  });
</script>

<BaseFormModal
  title="Create {selectedNoteType?.name || 'Note'}"
  description="Fill in the details to create a new {selectedNoteType?.name?.toLowerCase() || 'note'} with the defined structure and properties."
  titlePlaceholder="{selectedNoteType?.name || 'Note'} title"
  descriptionPlaceholder="Add description..."
  bind:titleValue
  bind:descriptionValue
  bind:titleError
  onsubmit={handleSubmit}
  {oncancel}
  submitLabel="Create {selectedNoteType?.name || 'Note'}"
  submitDisabled={!canSubmit}
  showPrimaryProperties={true}
  showExtraProperties={true}
>
  <svelte:fragment slot="form-content">
    {#if !selectedNoteType}
      <!-- No note type selected -->
      <div class="note-type-required">
        <p>Please select a note type first.</p>
        <button
          type="button"
          class="select-note-type-button"
          onclick={handleChangeNoteType}
        >
          Select Note Type
        </button>
      </div>
    {:else}
      <!-- Note type info -->
      <div class="note-type-info">
        <div class="note-type-header">
          <h3>{selectedNoteType.name}</h3>
          <button
            type="button"
            class="change-note-type-button"
            onclick={handleChangeNoteType}
            title="Change note type"
          >
            Change
          </button>
        </div>
        {#if selectedNoteType.metadata?.description}
          <p class="note-type-description">{selectedNoteType.metadata.description}</p>
        {/if}
      </div>

      <!-- Property form -->
      {#if Object.keys(selectedNoteType.properties).length > 0}
        <div class="properties-section">
          <PropertyFormBuilder
            properties={selectedNoteType.properties}
            bind:values={propertyValues}
            onvalueschange={handlePropertyValuesChange}
            onvalidationchange={handlePropertyValidationChange}
            {showOptionalProperties}
          />
        </div>
      {/if}
    {/if}
  </svelte:fragment>

  <svelte:fragment slot="extra-properties">
    {#if selectedNoteType && Object.keys(selectedNoteType.properties).length > 0}
      <!-- Toggle optional properties -->
      <div class="optional-properties-toggle">
        <label class="toggle-container">
          <input
            type="checkbox"
            bind:checked={showOptionalProperties}
            onchange={toggleOptionalProperties}
          />
          <span class="toggle-label">Show optional properties</span>
        </label>
      </div>

      <!-- Validation summary -->
      {#if hasValidationErrors}
        <div class="validation-summary">
          <h4>Please fix the following errors:</h4>
          <ul>
            {#each Object.entries(propertyValidation) as [key, result]}
              {#if !result.valid}
                {@const property = selectedNoteType.properties[key]}
                <li>{property?.name || key}: {result.errors[0]?.message}</li>
              {/if}
            {/each}
          </ul>
        </div>
      {/if}
    {/if}
  </svelte:fragment>
</BaseFormModal>

<style>
  .note-type-required {
    text-align: center;
    padding: 2rem;
    color: var(--text-muted);
  }

  .select-note-type-button {
    padding: 0.75rem 1.5rem;
    border: 1px solid var(--interactive-accent);
    border-radius: 6px;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    cursor: pointer;
    font-size: 0.9rem;
    margin-top: 1rem;
  }

  .select-note-type-button:hover {
    background: var(--interactive-accent-hover);
  }

  .note-type-info {
    padding: 1rem;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    margin-bottom: 1.5rem;
  }

  .note-type-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .note-type-header h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
  }

  .change-note-type-button {
    padding: 0.25rem 0.75rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    background: var(--background-primary);
    color: var(--text-normal);
    cursor: pointer;
    font-size: 0.8rem;
  }

  .change-note-type-button:hover {
    background: var(--background-modifier-hover);
  }

  .note-type-description {
    margin: 0;
    font-size: 0.85rem;
    color: var(--text-muted);
    line-height: 1.4;
  }

  .properties-section {
    margin-bottom: 1rem;
  }

  .optional-properties-toggle {
    margin-bottom: 1rem;
  }

  .toggle-container {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
  }

  .toggle-container input[type="checkbox"] {
    width: auto;
    margin: 0;
  }

  .toggle-label {
    font-size: 0.9rem;
    color: var(--text-normal);
  }

  .validation-summary {
    padding: 1rem;
    background: var(--background-modifier-error);
    border: 1px solid var(--background-modifier-error-hover);
    border-radius: 6px;
    color: var(--text-error);
  }

  .validation-summary h4 {
    margin: 0 0 0.5rem 0;
    font-size: 0.9rem;
    font-weight: 600;
  }

  .validation-summary ul {
    margin: 0;
    padding-left: 1.5rem;
  }

  .validation-summary li {
    font-size: 0.85rem;
    margin-bottom: 0.25rem;
  }
</style>
