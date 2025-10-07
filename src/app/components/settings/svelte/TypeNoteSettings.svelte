<script lang="ts">
  import { onMount } from "svelte";
  import type {
    TaskSyncSettings,
    SettingsSection,
  } from "../../../types/settings";
  import type { TypeRegistry } from "../../../core/type-note/registry";
  import type {
    NoteType,
    NoteTypeMetadata,
  } from "../../../core/type-note/types";

  interface Props {
    settings: TaskSyncSettings;
    saveSettings: (newSettings: TaskSyncSettings) => Promise<void>;
    section: SettingsSection;
    plugin: any;
  }

  let {
    settings = $bindable(),
    saveSettings,
    section,
    plugin,
  }: Props = $props();

  // State
  let noteTypes: NoteTypeMetadata[] = $state([]);
  let selectedNoteType: NoteType | null = $state(null);
  let showCreateForm = $state(false);
  let showEditForm = $state(false);
  let typeRegistry: TypeRegistry | null = $state(null);

  onMount(() => {
    initializeTypeRegistry();
    loadNoteTypes();
  });

  function initializeTypeRegistry() {
    // TODO: Get TypeRegistry from plugin or create one
    // For now, we'll create a placeholder
    console.log("TypeNote settings initialized");
  }

  function loadNoteTypes() {
    try {
      if (typeRegistry) {
        noteTypes = typeRegistry.getAllMetadata({ includeDeprecated: false });
      } else {
        noteTypes = [];
      }
    } catch (error) {
      console.error("Failed to load note types:", error);
      noteTypes = [];
    }
  }

  function handleCreateNoteType() {
    showCreateForm = true;
    showEditForm = false;
    selectedNoteType = null;
  }

  function handleEditNoteType(noteTypeId: string) {
    try {
      if (typeRegistry) {
        selectedNoteType = typeRegistry.get(noteTypeId);
        showEditForm = true;
        showCreateForm = false;
      }
    } catch (error) {
      console.error("Failed to get note type for editing:", error);
    }
  }

  function handleDeleteNoteType(noteTypeId: string) {
    if (
      confirm(
        "Are you sure you want to delete this note type? This action cannot be undone."
      )
    ) {
      try {
        if (typeRegistry) {
          typeRegistry.unregister(noteTypeId);
          loadNoteTypes();
        }
      } catch (error) {
        console.error("Failed to delete note type:", error);
      }
    }
  }

  function handleCancelForm() {
    showCreateForm = false;
    showEditForm = false;
    selectedNoteType = null;
  }

  function handleSaveNoteType(noteType: NoteType) {
    try {
      if (typeRegistry) {
        const result = typeRegistry.register(noteType, {
          allowOverwrite: showEditForm,
        });
        if (result.valid) {
          loadNoteTypes();
          handleCancelForm();
        } else {
          console.error("Failed to save note type:", result.errors);
        }
      }
    } catch (error) {
      console.error("Failed to save note type:", error);
    }
  }

  function formatVersion(version: string): string {
    return `v${version}`;
  }
</script>

<div class="type-note-settings">
  <div class="settings-header">
    <p class="settings-description">
      Manage note types for structured note creation. Note types define the
      properties, validation rules, and templates for different kinds of notes.
    </p>
  </div>

  {#if !showCreateForm && !showEditForm}
    <!-- Note types list -->
    <div class="note-types-section">
      <div class="section-header">
        <h3>Registered Note Types</h3>
        <button
          type="button"
          class="create-button"
          onclick={handleCreateNoteType}
          data-testid="create-note-type-button"
        >
          Create Note Type
        </button>
      </div>

      {#if noteTypes.length === 0}
        <div class="empty-state">
          <p>No note types registered</p>
          <p class="empty-hint">
            Create your first note type to start using structured notes with
            validation and templates.
          </p>
        </div>
      {:else}
        <div class="note-types-list">
          {#each noteTypes as noteType}
            <div class="note-type-item" data-testid="note-type-{noteType.id}">
              <div class="note-type-header">
                <div class="note-type-info">
                  <h4 class="note-type-name">{noteType.name}</h4>
                  <span class="note-type-version"
                    >{formatVersion(noteType.version)}</span
                  >
                  {#if noteType.category}
                    <span class="note-type-category">{noteType.category}</span>
                  {/if}
                </div>
                <div class="note-type-actions">
                  <button
                    type="button"
                    class="edit-button"
                    onclick={() => handleEditNoteType(noteType.id)}
                    data-testid="edit-note-type-{noteType.id}"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    class="delete-button"
                    onclick={() => handleDeleteNoteType(noteType.id)}
                    data-testid="delete-note-type-{noteType.id}"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {#if noteType.description}
                <p class="note-type-description">{noteType.description}</p>
              {/if}

              <div class="note-type-meta">
                <span class="meta-item">
                  Version: {formatVersion(noteType.version)}
                </span>
                {#if noteType.category}
                  <span class="meta-item">
                    Category: {noteType.category}
                  </span>
                {/if}
                {#if noteType.tags && noteType.tags.length > 0}
                  <div class="note-type-tags">
                    {#each noteType.tags as tag}
                      <span class="tag">{tag}</span>
                    {/each}
                  </div>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {:else}
    <!-- Create/Edit form -->
    <div class="note-type-form">
      <div class="form-header">
        <h3>{showCreateForm ? "Create" : "Edit"} Note Type</h3>
        <button
          type="button"
          class="cancel-button"
          onclick={handleCancelForm}
          data-testid="cancel-form-button"
        >
          Cancel
        </button>
      </div>

      <!-- Note Type Definition Form -->
      <div class="note-type-definition-form">
        <!-- Basic Information -->
        <div class="form-section">
          <h4>Basic Information</h4>
          <div class="form-grid">
            <div class="form-field">
              <label for="note-type-id">ID *</label>
              <input
                id="note-type-id"
                type="text"
                placeholder="e.g., article, meeting, task"
                class="form-input"
                data-testid="note-type-id-input"
              />
            </div>
            <div class="form-field">
              <label for="note-type-name">Name *</label>
              <input
                id="note-type-name"
                type="text"
                placeholder="e.g., Article, Meeting Notes, Task"
                class="form-input"
                data-testid="note-type-name-input"
              />
            </div>
            <div class="form-field">
              <label for="note-type-version">Version</label>
              <input
                id="note-type-version"
                type="text"
                value="1.0.0"
                class="form-input"
                data-testid="note-type-version-input"
              />
            </div>
            <div class="form-field">
              <label for="note-type-category">Category</label>
              <input
                id="note-type-category"
                type="text"
                placeholder="e.g., Documentation, Planning"
                class="form-input"
                data-testid="note-type-category-input"
              />
            </div>
          </div>
          <div class="form-field">
            <label for="note-type-description">Description</label>
            <textarea
              id="note-type-description"
              placeholder="Describe what this note type is used for..."
              class="form-textarea"
              rows="3"
              data-testid="note-type-description-input"
            ></textarea>
          </div>
        </div>

        <!-- Properties Section -->
        <div class="form-section">
          <h4>Properties</h4>
          <p class="section-note">
            Property definition interface with schema builder is available as a
            separate component. Integration will be completed in the next
            development phase.
          </p>
        </div>

        <!-- Template Section -->
        <div class="form-section">
          <h4>Template</h4>
          <p class="section-note">
            Template editor with syntax highlighting is available as a separate
            component. Integration will be completed in the next development
            phase.
          </p>
          <div class="form-field">
            <label for="template-content">Template Content</label>
            <textarea
              id="template-content"
              placeholder="Enter your template content here...

Use double curly braces for variables:
- title for the note title
- description for the note description
- date for the current date"
              class="form-textarea template-textarea"
              rows="10"
              data-testid="template-content-input"
            ></textarea>
          </div>
        </div>

        <!-- Form Actions -->
        <div class="form-actions">
          <button
            type="button"
            class="save-button"
            onclick={handleCancelForm}
            data-testid="save-note-type-button"
          >
            Save Note Type
          </button>
          <button
            type="button"
            class="cancel-button"
            onclick={handleCancelForm}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .type-note-settings {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .settings-description {
    margin: 0;
    color: var(--text-muted);
    font-size: 0.9rem;
    line-height: 1.4;
  }

  .note-types-section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .section-header h3 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
  }

  .create-button,
  .save-button {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 4px;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    cursor: pointer;
    font-size: 0.9rem;
  }

  .create-button:hover,
  .save-button:hover {
    background: var(--interactive-accent-hover);
  }

  .empty-state {
    text-align: center;
    padding: 2rem;
    color: var(--text-muted);
    border: 1px dashed var(--background-modifier-border);
    border-radius: 6px;
  }

  .empty-state p {
    margin: 0 0 0.5rem 0;
  }

  .empty-hint {
    font-size: 0.85rem;
    opacity: 0.8;
  }

  .note-types-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .note-type-item {
    padding: 1rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    background: var(--background-secondary);
  }

  .note-type-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 0.75rem;
  }

  .note-type-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .note-type-name {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
  }

  .note-type-version {
    font-size: 0.8rem;
    padding: 0.2rem 0.5rem;
    background: var(--background-modifier-border);
    border-radius: 3px;
    font-family: var(--font-monospace);
  }

  .note-type-category {
    font-size: 0.8rem;
    padding: 0.2rem 0.5rem;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-radius: 3px;
  }

  .note-type-actions {
    display: flex;
    gap: 0.5rem;
  }

  .edit-button,
  .delete-button,
  .cancel-button {
    padding: 0.25rem 0.75rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    background: var(--background-primary);
    color: var(--text-normal);
    cursor: pointer;
    font-size: 0.8rem;
  }

  .edit-button:hover,
  .cancel-button:hover {
    background: var(--background-modifier-hover);
  }

  .delete-button {
    color: var(--text-error);
    border-color: var(--text-error);
  }

  .delete-button:hover {
    background: var(--background-modifier-error);
  }

  .note-type-description {
    margin: 0 0 0.75rem 0;
    font-size: 0.9rem;
    color: var(--text-muted);
    line-height: 1.4;
  }

  .note-type-meta {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  .meta-item {
    display: flex;
    align-items: center;
  }

  .note-type-tags {
    display: flex;
    gap: 0.25rem;
    flex-wrap: wrap;
  }

  .tag {
    padding: 0.1rem 0.4rem;
    background: var(--background-modifier-border);
    border-radius: 2px;
    font-size: 0.7rem;
  }

  .form-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .form-header h3 {
    margin: 0;
    font-size: 1.2rem;
    font-weight: 600;
  }

  .form-actions {
    margin-top: 2rem;
    display: flex;
    gap: 0.5rem;
    justify-content: center;
  }

  /* Note Type Definition Form */
  .note-type-definition-form {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .form-section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .form-section h4 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .section-note {
    margin: 0;
    padding: 1rem;
    background: var(--background-modifier-hover);
    border-radius: 4px;
    font-size: 0.85rem;
    color: var(--text-muted);
    font-style: italic;
  }

  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .form-field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .form-field label {
    font-weight: 500;
    font-size: 0.9rem;
    color: var(--text-normal);
  }

  .form-input,
  .form-textarea {
    padding: 0.5rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: 0.9rem;
  }

  .form-input:focus,
  .form-textarea:focus {
    outline: none;
    border-color: var(--interactive-accent);
    box-shadow: 0 0 0 2px var(--interactive-accent-hover);
  }

  .form-textarea {
    resize: vertical;
    font-family: var(--font-text);
    line-height: 1.5;
  }

  .template-textarea {
    font-family: var(--font-monospace);
    font-size: 0.85rem;
  }
</style>
