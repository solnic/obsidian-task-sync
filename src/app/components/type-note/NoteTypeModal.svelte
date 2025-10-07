<script lang="ts">
  import type { TypeRegistry } from "../../core/type-note/registry";
  import type { NoteType } from "../../core/type-note/types";

  interface Props {
    typeRegistry: TypeRegistry;
    onselect?: (noteType: NoteType) => void;
    oncancel?: () => void;
  }

  let { typeRegistry, onselect, oncancel }: Props = $props();

  // Get all available note types
  const noteTypes = $derived(typeRegistry.getAll());

  function handleSelect(noteType: NoteType) {
    onselect?.(noteType);
  }

  function handleCancel() {
    oncancel?.();
  }
</script>

<div class="note-type-selector">
  <h2>Select Note Type</h2>
  <p class="description">Choose a note type to create a new note with the defined structure and properties.</p>

  <div class="note-type-list">
    {#each noteTypes as noteType}
      <button
        class="note-type-item"
        onclick={() => handleSelect(noteType)}
        data-testid="note-type-option-{noteType.id}"
      >
        <div class="note-type-header">
          <h3>{noteType.name}</h3>
          <span class="note-type-version">v{noteType.version}</span>
        </div>
        {#if noteType.metadata?.description}
          <p class="note-type-description">{noteType.metadata.description}</p>
        {/if}
        <div class="note-type-properties">
          {Object.keys(noteType.properties).length} properties
        </div>
      </button>
    {/each}
  </div>

  <div class="modal-actions">
    <button class="cancel-button" onclick={handleCancel}>Cancel</button>
  </div>
</div>

<style>
  .note-type-selector {
    padding: 1rem;
  }

  h2 {
    margin: 0 0 0.5rem 0;
    font-size: 1.5rem;
    font-weight: 600;
  }

  .description {
    margin: 0 0 1.5rem 0;
    color: var(--text-muted);
    font-size: 0.9rem;
  }

  .note-type-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }

  .note-type-item {
    display: block;
    width: 100%;
    padding: 1rem;
    text-align: left;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .note-type-item:hover {
    background: var(--background-modifier-hover);
    border-color: var(--interactive-accent);
  }

  .note-type-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.5rem;
  }

  .note-type-header h3 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
  }

  .note-type-version {
    font-size: 0.8rem;
    color: var(--text-muted);
    padding: 0.2rem 0.5rem;
    background: var(--background-primary);
    border-radius: 4px;
  }

  .note-type-description {
    margin: 0 0 0.5rem 0;
    color: var(--text-muted);
    font-size: 0.9rem;
  }

  .note-type-properties {
    font-size: 0.85rem;
    color: var(--text-faint);
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    padding-top: 1rem;
    border-top: 1px solid var(--background-modifier-border);
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
</style>

