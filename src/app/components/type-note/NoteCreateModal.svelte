<script lang="ts">
  import PropertyFormBuilder from "./PropertyFormBuilder.svelte";
  import type { NoteType } from "../../core/type-note/types";
  import type { TypeRegistry } from "../../core/type-note/registry";
  import type { NoteProcessor } from "../../core/type-note/note-processor";
  import { validateProperties } from "../../core/type-note/validation";

  interface Props {
    typeRegistry: TypeRegistry;
    noteProcessor: NoteProcessor;
    preselectedNoteTypeId?: string;
    onsubmit?: (data: {
      noteType: NoteType;
      properties: Record<string, any>;
      title: string;
      templateVariables?: Record<string, any>;
    }) => void;
    oncancel?: () => void;
  }

  let {
    typeRegistry,
    noteProcessor,
    preselectedNoteTypeId,
    onsubmit,
    oncancel,
  }: Props = $props();

  // Get all available note types
  const noteTypes = typeRegistry.getAll();

  // Form state - use preselected note type if provided, otherwise auto-select if only one type
  let selectedNoteTypeId = $state(
    preselectedNoteTypeId || (noteTypes.length === 1 ? noteTypes[0].id : "")
  );
  let propertyValues: Record<string, any> = $state({});
  let templateContent = $state("");
  let description = $state(""); // Description/content field separate from properties

  // Computed
  const selectedNoteType = $derived(
    noteTypes.find((nt) => nt.id === selectedNoteTypeId) || null
  );

  function handlePropertyValuesChange(values: Record<string, any>) {
    propertyValues = values;
  }

  function handleTemplateContentChange(content: string) {
    templateContent = content;
  }

  function handleSubmit() {
    if (!selectedNoteType) return;

    // Validate all properties using TypeNote's validation
    const validationResult = validateProperties(
      selectedNoteType,
      propertyValues
    );

    if (!validationResult.valid) {
      // Show validation errors
      const errorMessages = validationResult.errors
        .map((e) => e.message)
        .join(", ");
      console.error("Validation failed:", errorMessages);
      return;
    }

    // Find the title property (look for a property with frontMatterKey 'title' or the first string property)
    let title = "";
    const titleProp = Object.values(selectedNoteType.properties).find(
      (p) => p.frontMatterKey === "title"
    );

    if (titleProp) {
      title = String(propertyValues[titleProp.frontMatterKey] || "").trim();
    } else {
      // Fallback: use the first string property value
      const firstStringProp = Object.values(selectedNoteType.properties).find(
        (p) => p.type === "string"
      );
      if (firstStringProp) {
        title = String(
          propertyValues[firstStringProp.frontMatterKey] || ""
        ).trim();
      }
    }

    if (!title) {
      console.error("No title found");
      return;
    }

    // Pass description separately for template processing (not as a property)
    // The description will be used in template variables but won't be added to front-matter
    const templateVariables = {
      ...propertyValues,
      ...(description.trim() ? { description: description.trim() } : {}),
    };

    onsubmit?.({
      noteType: selectedNoteType,
      properties: propertyValues, // Only actual properties go to front-matter
      title: title,
      templateVariables, // Template variables include description for content
    });
  }

  function handleCancel() {
    oncancel?.();
  }

  function handleNoteTypeChange(e: Event) {
    const target = e.target as HTMLSelectElement;
    selectedNoteTypeId = target.value;
    // Reset property values, template content, and description when note type changes
    propertyValues = {};
    templateContent = "";
    description = "";
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
          />
        </div>
      {:else}
        <p class="no-properties-message">
          This note type has no properties defined. Add properties in settings
          to customize the form.
        </p>
      {/if}

      <!-- Description/Content field (separate from properties) -->
      <div class="description-section">
        <label for="note-description" class="task-sync-field-label">
          Description
        </label>
        <textarea
          id="note-description"
          bind:value={description}
          placeholder="Enter description or content for this note..."
          class="task-sync-textarea"
          data-testid="property-description"
          rows="4"
        ></textarea>
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

  .description-section {
    margin-top: 1rem;
  }

  .task-sync-textarea {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: 0.9rem;
    font-family: var(--font-text);
    resize: vertical;
    min-height: 80px;
  }

  .task-sync-textarea:focus {
    outline: none;
    border-color: var(--interactive-accent);
  }
</style>
