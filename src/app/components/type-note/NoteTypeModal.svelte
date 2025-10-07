<script lang="ts">
  import { onMount } from "svelte";
  import { BaseModal } from "../base";
  import type { NoteType, NoteTypeMetadata } from "../../core/type-note/types";
  import type { TypeRegistry } from "../../core/type-note/registry";

  interface Props {
    typeRegistry: TypeRegistry;
    onsubmit?: (noteType: NoteType) => void;
    oncancel?: () => void;
    title?: string;
    description?: string;
  }

  let {
    typeRegistry,
    onsubmit,
    oncancel,
    title = "Select Note Type",
    description = "Choose a note type to create a new typed note with predefined structure and properties.",
  }: Props = $props();

  // State
  let searchQuery = $state("");
  let selectedNoteType: NoteType | null = $state(null);
  let noteTypes: NoteTypeMetadata[] = $state([]);
  let filteredNoteTypes: NoteTypeMetadata[] = $state([]);
  let selectedCategory = $state("all");
  let categories: string[] = $state([]);

  // UI references
  let searchInput: HTMLInputElement;

  onMount(() => {
    loadNoteTypes();
    searchInput?.focus();
  });

  function loadNoteTypes() {
    try {
      // Get all note type metadata (lightweight)
      noteTypes = typeRegistry.getAllMetadata({ includeDeprecated: false });

      // Extract categories
      const categorySet = new Set<string>();
      noteTypes.forEach((nt) => {
        if (nt.category) {
          categorySet.add(nt.category);
        }
      });
      categories = ["all", ...Array.from(categorySet).sort()];

      // Initial filter
      filterNoteTypes();
    } catch (error) {
      console.error("Failed to load note types:", error);
      noteTypes = [];
      filteredNoteTypes = [];
    }
  }

  function filterNoteTypes() {
    let filtered = noteTypes;

    // Filter by category
    if (selectedCategory !== "all") {
      filtered = filtered.filter((nt) => nt.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (nt) =>
          nt.name.toLowerCase().includes(query) ||
          nt.description?.toLowerCase().includes(query) ||
          nt.tags?.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    filteredNoteTypes = filtered;
  }

  function handleSearchInput() {
    filterNoteTypes();
  }

  function handleCategoryChange(category: string) {
    selectedCategory = category;
    filterNoteTypes();
  }

  function handleNoteTypeSelect(noteTypeId: string) {
    try {
      const noteType = typeRegistry.get(noteTypeId);
      if (noteType) {
        selectedNoteType = noteType;
      }
    } catch (error) {
      console.error("Failed to get note type:", error);
    }
  }

  function handleSubmit() {
    if (selectedNoteType) {
      onsubmit?.(selectedNoteType);
    }
  }

  function handleCancel() {
    oncancel?.();
  }

  // Reactive filtering
  $effect(() => {
    filterNoteTypes();
  });
</script>

{#snippet contentSnippet({ firstInput })}
  <!-- Search and filters -->
  <div class="note-type-filters">
    <!-- Search input -->
    <div class="search-section">
      <input
        bind:this={searchInput}
        bind:value={searchQuery}
        type="text"
        placeholder="Search note types..."
        class="search-input"
        data-testid="search-input"
        oninput={handleSearchInput}
      />
    </div>

    <!-- Category filter -->
    {#if categories.length > 1}
      <div class="category-section">
        <div class="category-buttons">
          {#each categories as category}
            <button
              type="button"
              class="category-button"
              class:active={selectedCategory === category}
              onclick={() => handleCategoryChange(category)}
              data-testid="category-{category}"
            >
              {category === "all" ? "All" : category}
            </button>
          {/each}
        </div>
      </div>
    {/if}
  </div>

  <!-- Note type list -->
  <div class="note-type-list">
    {#if filteredNoteTypes.length === 0}
      <div class="empty-state">
        <p>No note types found</p>
        {#if searchQuery}
          <p class="empty-hint">Try adjusting your search or category filter</p>
        {:else}
          <p class="empty-hint">No note types are registered</p>
        {/if}
      </div>
    {:else}
      {#each filteredNoteTypes as noteTypeMetadata}
        <button
          type="button"
          class="note-type-item"
          class:selected={selectedNoteType?.id === noteTypeMetadata.id}
          onclick={() => handleNoteTypeSelect(noteTypeMetadata.id)}
          data-testid="note-type-{noteTypeMetadata.id}"
        >
          <div class="note-type-header">
            <h3 class="note-type-name">{noteTypeMetadata.name}</h3>
            <span class="note-type-version">v{noteTypeMetadata.version}</span>
          </div>

          {#if noteTypeMetadata.description}
            <p class="note-type-description">{noteTypeMetadata.description}</p>
          {/if}

          <div class="note-type-meta">
            {#if noteTypeMetadata.category}
              <span class="note-type-category">{noteTypeMetadata.category}</span
              >
            {/if}

            {#if noteTypeMetadata.tags && noteTypeMetadata.tags.length > 0}
              <div class="note-type-tags">
                {#each noteTypeMetadata.tags as tag}
                  <span class="note-type-tag">{tag}</span>
                {/each}
              </div>
            {/if}
          </div>
        </button>
      {/each}
    {/if}
  </div>
{/snippet}

<BaseModal
  {title}
  {description}
  onsubmit={handleSubmit}
  oncancel={handleCancel}
  submitLabel="Create Note"
  submitDisabled={!selectedNoteType}
  content={contentSnippet}
></BaseModal>

<style>
  .note-type-filters {
    margin-bottom: 1.5rem;
  }

  .search-section {
    margin-bottom: 1rem;
  }

  .search-input {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: 0.9rem;
  }

  .search-input:focus {
    outline: none;
    border-color: var(--interactive-accent);
    box-shadow: 0 0 0 2px var(--interactive-accent-hover);
  }

  .category-section {
    margin-bottom: 1rem;
  }

  .category-buttons {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .category-button {
    padding: 0.5rem 1rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    background: var(--background-primary);
    color: var(--text-normal);
    cursor: pointer;
    font-size: 0.85rem;
    transition: all 0.15s ease;
  }

  .category-button:hover {
    background: var(--background-modifier-hover);
  }

  .category-button.active {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-color: var(--interactive-accent);
  }

  .note-type-list {
    max-height: 400px;
    overflow-y: auto;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
  }

  .note-type-item {
    width: 100%;
    padding: 1rem;
    border: none;
    border-bottom: 1px solid var(--background-modifier-border);
    background: var(--background-primary);
    color: var(--text-normal);
    cursor: pointer;
    text-align: left;
    transition: all 0.15s ease;
  }

  .note-type-item:last-child {
    border-bottom: none;
  }

  .note-type-item:hover {
    background: var(--background-modifier-hover);
  }

  .note-type-item.selected {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .note-type-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .note-type-name {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
  }

  .note-type-version {
    font-size: 0.8rem;
    opacity: 0.7;
    font-family: var(--font-monospace);
  }

  .note-type-description {
    margin: 0 0 0.75rem 0;
    font-size: 0.85rem;
    opacity: 0.8;
    line-height: 1.4;
  }

  .note-type-meta {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .note-type-category {
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
    background: var(--background-modifier-border);
    border-radius: 3px;
    opacity: 0.8;
  }

  .note-type-tags {
    display: flex;
    gap: 0.25rem;
    flex-wrap: wrap;
  }

  .note-type-tag {
    font-size: 0.7rem;
    padding: 0.2rem 0.4rem;
    background: var(--background-modifier-border);
    border-radius: 2px;
    opacity: 0.7;
  }

  .empty-state {
    padding: 2rem;
    text-align: center;
    color: var(--text-muted);
  }

  .empty-state p {
    margin: 0 0 0.5rem 0;
  }

  .empty-hint {
    font-size: 0.85rem;
    opacity: 0.7;
  }

  /* Selected item styling */
  .note-type-item.selected .note-type-category,
  .note-type-item.selected .note-type-tag {
    background: rgba(255, 255, 255, 0.2);
    color: inherit;
  }
</style>
