<script lang="ts">
  import PropertyFormBuilder from "./PropertyFormBuilder.svelte";
  import type { NoteType, ValidationResult } from "../../core/type-note/types";
  import type { TypeRegistry } from "../../core/type-note/registry";

  interface Props {
    typeRegistry: TypeRegistry;
    onsubmit?: (data: {
      noteType: NoteType;
      properties: Record<string, any>;
      title: string;
    }) => void;
    oncancel?: () => void;
  }

  let { typeRegistry, onsubmit, oncancel }: Props = $props();

  // Get all available note types
  const noteTypes = typeRegistry.getAll();

  // Form state
  let selectedNoteTypeId = $state(
    noteTypes.length === 1 ? noteTypes[0].id : ""
  );
  let propertyValues: Record<string, any> = $state({});
  let propertyValidation: Record<string, ValidationResult> = $state({});

  // Computed
  const selectedNoteType = $derived(
    noteTypes.find((nt) => nt.id === selectedNoteTypeId) || null
  );
  const hasValidationErrors = $derived(
    Object.values(propertyValidation).some((result) => !result.valid)
  );

  // Check if we have a title property value (required for file name)
  const hasTitle = $derived(
    propertyValues.title && String(propertyValues.title).trim().length > 0
  );

  const canSubmit = $derived(
    selectedNoteType && hasTitle && !hasValidationErrors
  );

  function handlePropertyValuesChange(values: Record<string, any>) {
    propertyValues = values;
  }

  function handlePropertyValidationChange(
    validation: Record<string, ValidationResult>
  ) {
    propertyValidation = validation;
  }

  function handleSubmit() {
    if (!selectedNoteType) return;

    // Check for validation errors
    if (hasValidationErrors) {
      return;
    }

    // Get title from property values
    const title = String(propertyValues.title || "").trim();
    if (!title) {
      return;
    }

    onsubmit?.({
      noteType: selectedNoteType,
      properties: propertyValues,
      title: title,
    });
  }

  function handleCancel() {
    oncancel?.();
  }

  function handleNoteTypeChange(e: Event) {
    const target = e.target as HTMLSelectElement;
    selectedNoteTypeId = target.value;
    // Reset property values when note type changes
    propertyValues = {};
  }
</script>

<!-- Modal container -->
<div class="task-sync-modal-container note-create-modal">
  <!-- Header -->
  <div class="task-sync-modal-header">
    <h2>Create {selectedNoteType?.name || "Note"}</h2>
    {#if selectedNoteType?.metadata?.description}
      <p class="task-sync-modal-description">
        {selectedNoteType.metadata.description}
      </p>
    {/if}
  </div>

  <!-- Main content -->
  <div class="task-sync-main-content">
    <!-- Note type selector (if multiple types) -->
    {#if noteTypes.length > 1}
      <div class="task-sync-field">
        <label for="note-type-select" class="task-sync-field-label">
          Note Type *
        </label>
        <select
          id="note-type-select"
          bind:value={selectedNoteTypeId}
          onchange={handleNoteTypeChange}
          class="task-sync-select"
          data-testid="note-type-select"
        >
          <option value="">Select a note type...</option>
          {#each noteTypes as noteType}
            <option value={noteType.id}>{noteType.name}</option>
          {/each}
        </select>
      </div>
    {/if}

    <!-- Property form builder - renders ALL properties including title -->
    {#if selectedNoteType}
      {#if Object.keys(selectedNoteType.properties).length > 0}
        <div class="properties-section">
          <PropertyFormBuilder
            properties={selectedNoteType.properties}
            values={propertyValues}
            onvalueschange={handlePropertyValuesChange}
            onvalidationchange={handlePropertyValidationChange}
            showOptionalProperties={true}
          />
        </div>
      {:else}
        <p class="no-properties-message">
          This note type has no properties defined. Add properties in settings
          to customize the form.
        </p>
      {/if}
    {/if}

    <!-- Validation errors -->
    {#if hasValidationErrors}
      <div class="validation-summary">
        <p class="validation-title">Please fix the following errors:</p>
        <ul class="validation-errors">
          {#each Object.entries(propertyValidation) as [key, result]}
            {#if !result.valid}
              {@const property = selectedNoteType?.properties[key]}
              <li>{property?.name || key}: {result.errors[0]?.message}</li>
            {/if}
          {/each}
        </ul>
      </div>
    {/if}
  </div>

  <!-- Footer -->
  <div class="task-sync-modal-footer">
    <div class="task-sync-footer-actions">
      <button
        type="button"
        class="task-sync-cancel-button"
        data-testid="cancel-button"
        onclick={handleCancel}
      >
        Cancel
      </button>
      <button
        type="button"
        class="task-sync-create-button mod-cta"
        data-testid="submit-button"
        onclick={handleSubmit}
        disabled={!canSubmit}
      >
        Create {selectedNoteType?.name || "Note"}
      </button>
    </div>
  </div>
</div>

<style>
  .note-create-modal {
    min-width: 500px;
  }

  .properties-section {
    margin-top: 1rem;
  }

  .validation-summary {
    margin-top: 1rem;
    padding: 1rem;
    background: var(--background-modifier-error);
    border: 1px solid var(--background-modifier-error-hover);
    border-radius: 6px;
  }

  .validation-title {
    margin: 0 0 0.5rem 0;
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-error);
  }

  .validation-errors {
    margin: 0;
    padding-left: 1.5rem;
  }

  .validation-errors li {
    font-size: 0.85rem;
    color: var(--text-error);
    margin-bottom: 0.25rem;
  }

  .task-sync-select {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: 0.9rem;
  }

  .task-sync-select:focus {
    outline: none;
    border-color: var(--interactive-accent);
  }

  .no-properties-message {
    padding: 2rem;
    text-align: center;
    color: var(--text-muted);
    font-style: italic;
  }
</style>
