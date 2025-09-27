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
