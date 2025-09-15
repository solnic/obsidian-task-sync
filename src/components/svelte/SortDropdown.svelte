<script lang="ts">
  /**
   * Reusable SortDropdown component for configuring sort order
   * Supports drag-and-drop reordering and asc/desc direction controls
   */

  interface SortField {
    key: string;
    label: string;
    direction: "asc" | "desc";
  }

  interface Props {
    label?: string;
    sortFields: SortField[];
    availableFields: Array<{ key: string; label: string }>;
    onSortChange: (sortFields: SortField[]) => void;
    testId?: string;
    disabled?: boolean;
  }

  let {
    label = "Sort by",
    sortFields,
    availableFields,
    onSortChange,
    testId,
    disabled = false,
  }: Props = $props();

  let isMenuOpen = $state(false);
  let draggedIndex = $state<number | null>(null);

  // Computed display value
  let displayValue = $derived.by(() => {
    if (sortFields.length === 0) {
      return "Default";
    }
    if (sortFields.length === 1) {
      const field = sortFields[0];
      return `${field.label} (${field.direction === "asc" ? "↑" : "↓"})`;
    }
    return `${sortFields.length} fields`;
  });

  // Available fields that can be added (not already in sortFields)
  let availableToAdd = $derived.by(() => {
    return availableFields.filter(
      (field) => !sortFields.some((sf) => sf.key === field.key)
    );
  });

  function handleButtonClick() {
    if (!disabled) {
      isMenuOpen = !isMenuOpen;
    }
  }

  function closeMenu() {
    isMenuOpen = false;
  }

  function addSortField(key: string, label: string) {
    const newField: SortField = { key, label, direction: "asc" };
    onSortChange([...sortFields, newField]);
  }

  function removeSortField(index: number) {
    const newFields = sortFields.filter((_, i) => i !== index);
    onSortChange(newFields);
  }

  function toggleDirection(index: number) {
    const newFields = sortFields.map((field, i) =>
      i === index
        ? {
            ...field,
            direction:
              field.direction === "asc" ? "desc" : ("asc" as "asc" | "desc"),
          }
        : field
    );
    onSortChange(newFields);
  }

  function clearAllSorting() {
    onSortChange([]);
    closeMenu();
  }

  // Drag and drop functions
  function handleDragStart(event: DragEvent, index: number) {
    draggedIndex = index;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
    }
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }
  }

  function handleDrop(event: DragEvent, dropIndex: number) {
    event.preventDefault();

    if (draggedIndex !== null && draggedIndex !== dropIndex) {
      const newFields = [...sortFields];
      const [movedField] = newFields.splice(draggedIndex, 1);
      newFields.splice(dropIndex, 0, movedField);
      onSortChange(newFields);
    }

    draggedIndex = null;
  }

  function handleDragEnd() {
    draggedIndex = null;
  }
</script>

<div class="task-sync-sort-dropdown">
  <button
    type="button"
    onclick={handleButtonClick}
    class="task-sync-property-button task-sync-text-button {sortFields.length >
    0
      ? 'active'
      : ''}"
    {disabled}
    data-testid={testId}
    aria-label="Configure {label}"
  >
    <span class="task-sync-button-label">
      {displayValue}
    </span>
    <span class="task-sync-sort-icon">⇅</span>
  </button>

  {#if isMenuOpen}
    <div class="task-sync-sort-menu">
      <div class="task-sync-sort-header">Sort Order</div>

      <div class="task-sync-sort-list">
        {#if sortFields.length === 0}
          <div class="task-sync-sort-empty">No sorting applied</div>
        {:else}
          {#each sortFields as field, index (field.key)}
            <div
              class="task-sync-sort-item {draggedIndex === index
                ? 'dragging'
                : ''}"
              draggable="true"
              role="listitem"
              ondragstart={(e) => handleDragStart(e, index)}
              ondragover={handleDragOver}
              ondrop={(e) => handleDrop(e, index)}
              ondragend={handleDragEnd}
            >
              <div class="task-sync-sort-drag-handle">⋮⋮</div>
              <div class="task-sync-sort-item-label">{field.label}</div>
              <button
                type="button"
                class="task-sync-sort-direction"
                title={field.direction === "asc" ? "Ascending" : "Descending"}
                onclick={() => toggleDirection(index)}
              >
                {field.direction === "asc" ? "↑" : "↓"}
              </button>
              <button
                type="button"
                class="task-sync-sort-remove"
                title="Remove from sort"
                onclick={() => removeSortField(index)}
              >
                ×
              </button>
            </div>
          {/each}
        {/if}
      </div>

      {#if availableToAdd.length > 0}
        <div class="task-sync-selector-separator"></div>
        <div class="task-sync-sort-add-section">
          <div class="task-sync-sort-add-header">Add field:</div>
          {#each availableToAdd as field}
            <div
              class="task-sync-sort-add-item"
              role="button"
              tabindex="0"
              onclick={() => addSortField(field.key, field.label)}
              onkeydown={(e) =>
                e.key === "Enter" && addSortField(field.key, field.label)}
            >
              {field.label}
            </div>
          {/each}
        </div>
      {/if}

      {#if sortFields.length > 0}
        <div class="task-sync-selector-separator"></div>
        <div
          class="task-sync-sort-clear"
          role="button"
          tabindex="0"
          onclick={clearAllSorting}
          onkeydown={(e) => e.key === "Enter" && clearAllSorting()}
        >
          Clear all sorting
        </div>
      {/if}
    </div>
  {/if}
</div>

<!-- Click outside to close -->
{#if isMenuOpen}
  <div
    class="task-sync-sort-backdrop"
    role="button"
    tabindex="-1"
    onclick={closeMenu}
    onkeydown={(e) => e.key === "Escape" && closeMenu()}
  ></div>
{/if}

<style>
  .task-sync-sort-dropdown {
    position: relative;
    display: inline-block;
  }

  .task-sync-sort-menu {
    position: absolute;
    top: 100%;
    left: 0;
    min-width: 250px;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    box-shadow: var(--shadow-s);
    z-index: 1000;
    padding: 8px 0;
    margin-top: 4px;
  }

  .task-sync-sort-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 999;
    background: transparent;
  }

  .task-sync-sort-header {
    padding: 8px 12px;
    font-weight: 600;
    color: var(--text-muted);
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .task-sync-sort-item {
    display: flex;
    align-items: center;
    padding: 6px 12px;
    cursor: move;
    border: 2px solid transparent;
    transition: all 0.2s ease;
  }

  .task-sync-sort-item:hover {
    background: var(--background-modifier-hover);
  }

  .task-sync-sort-item.dragging {
    opacity: 0.5;
    background: var(--background-modifier-active);
  }

  .task-sync-sort-drag-handle {
    color: var(--text-muted);
    margin-right: 8px;
    cursor: grab;
    font-size: 12px;
  }

  .task-sync-sort-item-label {
    flex: 1;
    font-size: 13px;
  }

  .task-sync-sort-direction,
  .task-sync-sort-remove {
    background: none;
    border: none;
    padding: 4px 6px;
    margin-left: 4px;
    border-radius: 3px;
    cursor: pointer;
    font-size: 14px;
    color: var(--text-muted);
    transition: all 0.2s ease;
  }

  .task-sync-sort-direction:hover,
  .task-sync-sort-remove:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .task-sync-sort-empty {
    padding: 12px;
    text-align: center;
    color: var(--text-muted);
    font-style: italic;
  }

  .task-sync-sort-add-header {
    padding: 8px 12px 4px;
    font-size: 12px;
    color: var(--text-muted);
    font-weight: 500;
  }

  .task-sync-sort-add-item {
    padding: 6px 12px;
    cursor: pointer;
    font-size: 13px;
    transition: background 0.2s ease;
  }

  .task-sync-sort-add-item:hover {
    background: var(--background-modifier-hover);
  }

  .task-sync-sort-clear {
    padding: 8px 12px;
    cursor: pointer;
    font-size: 13px;
    color: var(--text-accent);
    font-weight: 500;
    transition: background 0.2s ease;
  }

  .task-sync-sort-clear:hover {
    background: var(--background-modifier-hover);
  }

  .task-sync-selector-separator {
    height: 1px;
    background: var(--background-modifier-border);
    margin: 4px 0;
  }
</style>
