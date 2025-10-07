<script lang="ts">
  import { onMount } from "svelte";
  import type {
    TaskSyncSettings,
    SettingsSection,
  } from "../../../types/settings";
  import type { NoteType } from "../../../core/type-note/types";
  import PropertyDefinitionBuilder from "../../type-note/PropertyDefinitionBuilder.svelte";
  import TemplateEditor from "../../type-note/TemplateEditor.svelte";
  import { FieldGroup } from "../../base";
  import {
    nextMajor,
    nextMinor,
    nextPatch,
    isValidVersion,
  } from "../../../core/type-note/version";

  interface Props {
    settings: TaskSyncSettings;
    saveSettings: (newSettings: TaskSyncSettings) => Promise<void>;
    section: SettingsSection;
    plugin: any;
  }

  let { settings = $bindable(), saveSettings, plugin }: Props = $props();

  // State
  let noteTypes = $state<NoteType[]>([]);
  let showEditor = $state(false);
  let editingNoteType = $state<NoteType | null>(null);
  let isNewNoteType = $state(false);

  // Form state for editing
  let formId = $state("");
  let formName = $state("");
  let formVersion = $state("1.0.0");
  let formDescription = $state("");
  let formCategory = $state("");
  let formIcon = $state("");
  let formColor = $state("");
  let formProperties = $state<Record<string, any>>({});
  let formTemplate = $state<any>({
    version: "1.0.0",
    content: "",
    variables: {},
  });

  onMount(() => {
    loadNoteTypes();
  });

  function loadNoteTypes() {
    if (!plugin?.typeNote?.registry) {
      noteTypes = [];
      return;
    }
    noteTypes = plugin.typeNote.registry.getAll();
  }

  function handleCreateNoteType() {
    isNewNoteType = true;
    editingNoteType = null;
    resetForm();
    showEditor = true;
  }

  function handleEditNoteType(noteType: NoteType) {
    isNewNoteType = false;
    editingNoteType = noteType;
    loadFormFromNoteType(noteType);
    showEditor = true;
  }

  function handleDeleteNoteType(noteType: NoteType) {
    if (
      confirm(
        `Are you sure you want to delete the "${noteType.name}" note type?`
      )
    ) {
      plugin.typeNote.registry.unregister(noteType.id);
      loadNoteTypes();
    }
  }

  function resetForm() {
    formId = "";
    formName = "";
    formVersion = "1.0.0";
    formDescription = "";
    formCategory = "";
    formIcon = "";
    formColor = "";
    formProperties = {};
    formTemplate = {
      version: "1.0.0",
      content: "",
      variables: {},
    };
  }

  function loadFormFromNoteType(noteType: NoteType) {
    formId = noteType.id;
    formName = noteType.name;
    formVersion = noteType.version;
    formDescription = noteType.metadata?.description || "";
    formCategory = noteType.metadata?.category || "";
    formIcon = noteType.metadata?.icon || "";
    formColor = noteType.metadata?.color || "";
    formProperties = { ...noteType.properties };
    formTemplate = { ...noteType.template };
  }

  function handleSaveNoteType() {
    if (!formId || !formName) {
      alert("Note type ID and name are required");
      return;
    }

    const noteType: NoteType = {
      id: formId,
      name: formName,
      version: formVersion,
      properties: formProperties,
      template: formTemplate,
      metadata: {
        description: formDescription || undefined,
        category: formCategory || undefined,
        icon: formIcon || undefined,
        color: formColor || undefined,
        updatedAt: new Date(),
        ...(isNewNoteType ? { createdAt: new Date() } : {}),
      },
    };

    const result = plugin.typeNote.registry.register(noteType, {
      allowOverwrite: !isNewNoteType,
      validate: true,
    });

    if (!result.valid) {
      alert(
        `Failed to save note type: ${result.errors.map((e) => e.message).join(", ")}`
      );
      return;
    }

    showEditor = false;
    loadNoteTypes();
  }

  function handleCancelEdit() {
    showEditor = false;
    editingNoteType = null;
  }

  function handlePropertiesChange(properties: Record<string, any>) {
    formProperties = properties;
  }

  function handleTemplateChange(template: any) {
    formTemplate = template;
  }

  function handleIdInput() {
    // Auto-generate ID from name if empty
    if (!formId && formName) {
      formId = formName
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");
    }
  }

  function handleIncrementMajor() {
    const next = nextMajor(formVersion);
    if (next) {
      formVersion = next;
    }
  }

  function handleIncrementMinor() {
    const next = nextMinor(formVersion);
    if (next) {
      formVersion = next;
    }
  }

  function handleIncrementPatch() {
    const next = nextPatch(formVersion);
    if (next) {
      formVersion = next;
    }
  }

  // Get version history for the current note type
  let versionHistory = $derived(
    editingNoteType
      ? plugin?.typeNote?.registry?.getVersionHistory(editingNoteType.id) || []
      : []
  );

  // Check if version is valid
  let isVersionValid = $derived(isValidVersion(formVersion));
</script>

<div class="type-note-settings">
  <div class="setting-item-description">
    Manage note types for structured note creation. Note types define the
    properties, validation rules, and templates for different kinds of notes.
  </div>

  {#if !showEditor}
    <!-- List of note types -->
    <div class="note-types-list">
      <div class="list-header">
        <h3>Note Types</h3>
        <button
          type="button"
          class="create-button"
          onclick={handleCreateNoteType}
        >
          Create Note Type
        </button>
      </div>

      {#if noteTypes.length === 0}
        <div class="empty-state">
          <p>No note types registered yet</p>
          <p class="empty-hint">
            Create your first note type to get started with structured notes.
          </p>
        </div>
      {:else}
        <div class="note-type-items">
          {#each noteTypes as noteType}
            <div class="note-type-item">
              <div class="note-type-header">
                <div class="note-type-info">
                  {#if noteType.metadata?.icon}
                    <span class="note-type-icon">{noteType.metadata.icon}</span>
                  {/if}
                  <div>
                    <h4 class="note-type-name">{noteType.name}</h4>
                    <span class="note-type-id">{noteType.id}</span>
                    <span class="note-type-version">v{noteType.version}</span>
                  </div>
                </div>
                <div class="note-type-actions">
                  <button
                    type="button"
                    class="edit-button"
                    onclick={() => handleEditNoteType(noteType)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    class="delete-button"
                    onclick={() => handleDeleteNoteType(noteType)}
                  >
                    Delete
                  </button>
                </div>
              </div>
              {#if noteType.metadata?.description}
                <p class="note-type-description">
                  {noteType.metadata.description}
                </p>
              {/if}
              <div class="note-type-meta">
                <span>{Object.keys(noteType.properties).length} properties</span
                >
                {#if noteType.metadata?.category}
                  <span>Category: {noteType.metadata.category}</span>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {:else}
    <!-- Note type editor -->
    <div class="note-type-editor">
      <div class="editor-header">
        <h3>{isNewNoteType ? "Create" : "Edit"} Note Type</h3>
        <div class="editor-actions">
          <button
            type="button"
            class="save-button"
            onclick={handleSaveNoteType}
          >
            Save
          </button>
          <button
            type="button"
            class="cancel-button"
            onclick={handleCancelEdit}
          >
            Cancel
          </button>
        </div>
      </div>

      <div class="editor-form">
        <!-- Basic info -->
        <div class="form-section">
          <h4>Basic Information</h4>
          <div class="form-grid">
            <FieldGroup label="Name" required={true} htmlFor="note-type-name">
              <input
                id="note-type-name"
                type="text"
                bind:value={formName}
                oninput={handleIdInput}
                placeholder="e.g., Meeting Note, Project Plan"
                class="form-input"
              />
            </FieldGroup>

            <FieldGroup label="ID" required={true} htmlFor="note-type-id">
              <input
                id="note-type-id"
                type="text"
                bind:value={formId}
                placeholder="e.g., meeting-note, project-plan"
                class="form-input"
                disabled={!isNewNoteType}
              />
            </FieldGroup>

            <FieldGroup
              label="Version"
              required={true}
              htmlFor="note-type-version"
              description={!isVersionValid
                ? "Invalid version format (use x.y.z)"
                : undefined}
            >
              <div class="version-input-group">
                <input
                  id="note-type-version"
                  type="text"
                  bind:value={formVersion}
                  placeholder="1.0.0"
                  class="form-input"
                  class:invalid={!isVersionValid}
                />
                <div class="version-buttons">
                  <button
                    type="button"
                    class="version-increment-button"
                    onclick={handleIncrementMajor}
                    title="Increment major version"
                  >
                    Major
                  </button>
                  <button
                    type="button"
                    class="version-increment-button"
                    onclick={handleIncrementMinor}
                    title="Increment minor version"
                  >
                    Minor
                  </button>
                  <button
                    type="button"
                    class="version-increment-button"
                    onclick={handleIncrementPatch}
                    title="Increment patch version"
                  >
                    Patch
                  </button>
                </div>
              </div>
              {#if versionHistory.length > 0}
                <div class="version-history">
                  <span class="version-history-label">History:</span>
                  {#each versionHistory as version}
                    <span class="version-history-item">{version}</span>
                  {/each}
                </div>
              {/if}
            </FieldGroup>

            <FieldGroup label="Category" htmlFor="note-type-category">
              <input
                id="note-type-category"
                type="text"
                bind:value={formCategory}
                placeholder="e.g., Work, Personal"
                class="form-input"
              />
            </FieldGroup>

            <FieldGroup label="Icon" htmlFor="note-type-icon">
              <input
                id="note-type-icon"
                type="text"
                bind:value={formIcon}
                placeholder="e.g., 📝, 📋"
                class="form-input"
              />
            </FieldGroup>

            <FieldGroup label="Color" htmlFor="note-type-color">
              <input
                id="note-type-color"
                type="text"
                bind:value={formColor}
                placeholder="e.g., blue, #3b82f6"
                class="form-input"
              />
            </FieldGroup>
          </div>

          <FieldGroup label="Description" htmlFor="note-type-description">
            <textarea
              id="note-type-description"
              bind:value={formDescription}
              placeholder="Describe what this note type is for..."
              class="form-textarea"
              rows="3"
            ></textarea>
          </FieldGroup>
        </div>

        <!-- Properties -->
        <div class="form-section">
          <PropertyDefinitionBuilder
            bind:properties={formProperties}
            onpropertieschange={handlePropertiesChange}
          />
        </div>

        <!-- Template -->
        <div class="form-section">
          <TemplateEditor
            bind:template={formTemplate}
            onchange={handleTemplateChange}
            properties={formProperties}
          />
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .type-note-settings {
    padding: 1rem 0;
  }

  .setting-item-description {
    margin-bottom: 1.5rem;
    color: var(--text-muted);
    font-size: 0.9rem;
  }

  .note-types-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .list-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .list-header h3 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
  }

  .create-button {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 4px;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    cursor: pointer;
    font-size: 0.9rem;
  }

  .create-button:hover {
    background: var(--interactive-accent-hover);
  }

  .empty-state {
    text-align: center;
    padding: 3rem 1rem;
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

  .note-type-items {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
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
    margin-bottom: 0.5rem;
  }

  .note-type-info {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .note-type-icon {
    font-size: 1.5rem;
  }

  .note-type-name {
    margin: 0 0 0.25rem 0;
    font-size: 1rem;
    font-weight: 600;
  }

  .note-type-id {
    font-size: 0.8rem;
    color: var(--text-muted);
    font-family: var(--font-monospace);
    margin-right: 0.5rem;
  }

  .note-type-version {
    font-size: 0.8rem;
    color: var(--text-muted);
    padding: 0.1rem 0.3rem;
    background: var(--background-modifier-border);
    border-radius: 3px;
  }

  .note-type-actions {
    display: flex;
    gap: 0.5rem;
  }

  .edit-button,
  .delete-button {
    padding: 0.25rem 0.75rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 3px;
    background: var(--background-primary);
    color: var(--text-normal);
    cursor: pointer;
    font-size: 0.85rem;
  }

  .edit-button:hover {
    background: var(--background-modifier-hover);
  }

  .delete-button {
    border-color: var(--text-error);
    color: var(--text-error);
  }

  .delete-button:hover {
    background: var(--background-modifier-error);
  }

  .note-type-description {
    margin: 0 0 0.5rem 0;
    font-size: 0.9rem;
    color: var(--text-muted);
  }

  .note-type-meta {
    display: flex;
    gap: 1rem;
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  .note-type-editor {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .editor-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .editor-header h3 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
  }

  .editor-actions {
    display: flex;
    gap: 0.5rem;
  }

  .save-button {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 4px;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    cursor: pointer;
    font-size: 0.9rem;
  }

  .save-button:hover {
    background: var(--interactive-accent-hover);
  }

  .cancel-button {
    padding: 0.5rem 1rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    background: var(--background-primary);
    color: var(--text-normal);
    cursor: pointer;
    font-size: 0.9rem;
  }

  .cancel-button:hover {
    background: var(--background-modifier-hover);
  }

  .editor-form {
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
    font-size: 1rem;
    font-weight: 600;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .form-input,
  .form-textarea {
    width: 100%;
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

  .form-input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .form-textarea {
    resize: vertical;
    font-family: var(--font-text);
  }

  .version-input-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .version-buttons {
    display: flex;
    gap: 0.25rem;
  }

  .version-increment-button {
    padding: 0.25rem 0.5rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 3px;
    background: var(--background-primary);
    color: var(--text-normal);
    cursor: pointer;
    font-size: 0.75rem;
  }

  .version-increment-button:hover {
    background: var(--background-modifier-hover);
  }

  .version-history {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-top: 0.5rem;
    padding: 0.5rem;
    background: var(--background-secondary);
    border-radius: 4px;
    font-size: 0.8rem;
  }

  .version-history-label {
    color: var(--text-muted);
    font-weight: 500;
  }

  .version-history-item {
    padding: 0.1rem 0.4rem;
    background: var(--background-modifier-border);
    border-radius: 3px;
    font-family: var(--font-monospace);
    color: var(--text-muted);
  }

  .form-input.invalid {
    border-color: var(--text-error);
  }
</style>
