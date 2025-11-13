<script lang="ts">
  import PropertyFormBuilder from "./PropertyFormBuilder.svelte";
  import type { NoteType } from "../../core/note-kit/types";
  import type { TypeRegistry } from "../../core/note-kit/registry";
  import type { NoteProcessor } from "../../core/note-kit/note-processor";
  import type { TaskSyncSettings } from "../../types/settings";

  console.log("[CreateEntityModal.svelte] Component script loading");

  interface Props {
    typeRegistry: TypeRegistry;
    noteProcessor: NoteProcessor;
    settings: TaskSyncSettings;
    preselectedNoteTypeId?: string;
    validationErrors?: string[];
    initialPropertyValues?: Record<string, any>;
    contextualTitle?: string;
    onsubmit?: (data: {
      noteType: NoteType;
      properties: Record<string, any>;
      description?: string;
    }) => void;
    oncancel?: () => void;
  }

  let {
    typeRegistry,
    noteProcessor,
    settings,
    preselectedNoteTypeId,
    validationErrors = [],
    initialPropertyValues,
    contextualTitle,
    onsubmit,
    oncancel,
  }: Props = $props();

  console.log("[CreateEntityModal.svelte] Props received:", {
    preselectedNoteTypeId,
    hasInitialValues: !!initialPropertyValues,
    contextualTitle,
  });

  // Get all available note types
  const noteTypes = typeRegistry.getAll();
  console.log("[CreateEntityModal.svelte] Available note types:", noteTypes.map(nt => nt.id));

  // Form state - use preselected note type if provided, otherwise auto-select if only one type
  let selectedNoteTypeId = $state(
    preselectedNoteTypeId || (noteTypes.length === 1 ? noteTypes[0].id : "")
  );

  let propertyValues: Record<string, any> = $state({});
  let templateContent = $state(""); // Template content becomes the description for entities

  // Computed
  const selectedNoteType = $derived(
    noteTypes.find((nt) => nt.id === selectedNoteTypeId) || null
  );

  $effect(() => {
    console.log("[CreateEntityModal.svelte] Effect: selectedNoteType changed to:", selectedNoteType?.id);
  });

  $effect(() => {
    // When a note type is preselected and initial values provided, seed the form
    if (selectedNoteTypeId && initialPropertyValues) {
      console.log("[CreateEntityModal.svelte] Seeding form with initial values:", initialPropertyValues);
      propertyValues = { ...initialPropertyValues };
    }
  });

  function handlePropertyValuesChange(values: Record<string, any>) {
    propertyValues = values;
  }

  function handleTemplateContentChange(content: string) {
    templateContent = content;
  }

  function handleSubmit(e: Event) {
    e.preventDefault(); // Prevent default form submission

    console.log("[CreateEntityModal.svelte] handleSubmit called");

    if (!selectedNoteType) {
      console.log("[CreateEntityModal.svelte] No note type selected, aborting");
      return;
    }

    console.log("[CreateEntityModal.svelte] Submitting with:", {
      noteType: selectedNoteType.id,
      properties: propertyValues,
      description: templateContent.trim() || undefined,
    });

    // Submit the data - validation will be handled by entity schema
    onsubmit?.({
      noteType: selectedNoteType,
      properties: propertyValues,
      description: templateContent.trim() || undefined,
    });

    console.log("[CreateEntityModal.svelte] onsubmit callback called");
  }

  function handleCancel(e: Event) {
    e.preventDefault();
    oncancel?.();
  }

  function handleNoteTypeChange(e: Event) {
    const target = e.target as HTMLSelectElement;
    selectedNoteTypeId = target.value;
    // Reset property values and template content when note type changes
    propertyValues = {};
    templateContent = "";
  }
</script>

<!-- Modal container -->
<div class="task-sync-modal-container note-create-modal">
  <!-- Header -->
  <div class="task-sync-modal-header">
    <h2>
      {contextualTitle || `Create New ${selectedNoteType?.name || "Note"}`}
    </h2>
    {#if selectedNoteType?.metadata?.description}
      <p class="task-sync-modal-description">
        {selectedNoteType.metadata.description}
      </p>
    {/if}
  </div>

  <!-- Validation Errors -->
  {#if validationErrors.length > 0}
    <div class="task-sync-validation-errors">
      <ul>
        {#each validationErrors as error}
          <li>{error}</li>
        {/each}
      </ul>
    </div>
  {/if}

  <!-- Form wrapper for HTML validation -->
  <form onsubmit={handleSubmit}>
    <!-- Main content -->
    <div class="task-sync-main-content">
      <!-- Note type selector (if multiple types and no preselected type) -->
      {#if noteTypes.length > 1 && !preselectedNoteTypeId}
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
              showOptionalProperties={true}
              noteType={selectedNoteType}
              {noteProcessor}
              bind:templateContent
              ontemplatecontentchange={handleTemplateContentChange}
              {settings}
              {typeRegistry}
            />
          </div>
        {:else}
          <p class="no-properties-message">
            This note type has no properties defined. Add properties in settings
            to customize the form.
          </p>
        {/if}
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
          type="submit"
          class="task-sync-create-button mod-cta"
          data-testid="submit-button"
        >
          Create {selectedNoteType?.name || "Note"}
        </button>
      </div>
    </div>
  </form>
</div>

<style>
  .note-create-modal {
    min-width: 500px;
  }

  .properties-section {
    margin-top: 1rem;
  }

  .task-sync-validation-errors {
    margin: 1rem 0;
    padding: 1rem;
    background: var(--background-modifier-error);
    border: 1px solid var(--text-error);
    border-radius: 4px;
  }

  .task-sync-validation-errors ul {
    margin: 0;
    padding-left: 1.5rem;
    color: var(--text-error);
  }

  .task-sync-validation-errors li {
    margin: 0.25rem 0;
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
