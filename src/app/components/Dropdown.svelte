<script lang="ts">
  import { onMount, onDestroy } from "svelte";

  interface DropdownItem {
    value: string;
    label?: string;
    isSeparator?: boolean;
    isRecent?: boolean;
    customContent?: any; // For rendering badges or custom HTML
  }

  interface Props {
    anchor: HTMLElement | null;
    items: DropdownItem[];
    selectedValue?: string;
    selectedValues?: string[];
    searchable?: boolean;
    searchPlaceholder?: string;
    keepOpenOnSelect?: boolean;
    onSelect: (value: string) => void;
    onRemoveRecent?: (value: string) => void;
    onClose?: () => void;
    testId?: string;
  }

  let {
    anchor,
    items,
    selectedValue = "",
    selectedValues = [],
    searchable = false,
    searchPlaceholder = "Search...",
    keepOpenOnSelect = false,
    onSelect,
    onRemoveRecent,
    onClose,
    testId = "dropdown",
  }: Props = $props();

  let menuEl: HTMLElement | null = $state(null);
  let searchInput: HTMLInputElement | null = $state(null);
  let searchQuery = $state("");
  let menuPosition = $state({ top: 0, left: 0 });

  // Filter items based on search query
  let filteredItems = $derived(
    searchable && searchQuery
      ? items.filter((item) => {
          if (item.isSeparator) return false;
          const label = item.label || item.value;
          return label.toLowerCase().includes(searchQuery.toLowerCase());
        })
      : items
  );

  onMount(() => {
    if (anchor && menuEl) {
      // Append menu to document.body for proper positioning
      document.body.appendChild(menuEl);

      // Position the menu below the anchor element
      const rect = anchor.getBoundingClientRect();
      menuPosition = {
        top: rect.bottom + 5,
        left: rect.left,
      };
    }

    // Focus search input if searchable
    if (searchable && searchInput) {
      searchInput.focus();
    }

    // Add click outside listener
    setTimeout(() => {
      document.addEventListener("click", handleClickOutside);
    }, 0);
  });

  onDestroy(() => {
    document.removeEventListener("click", handleClickOutside);

    // Remove menu from document.body
    if (menuEl && menuEl.parentNode === document.body) {
      document.body.removeChild(menuEl);
    }
  });

  function handleClickOutside(e: MouseEvent) {
    if (menuEl && !menuEl.contains(e.target as Node)) {
      close();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      close();
    } else if (e.key === "Enter" && searchable) {
      const firstItem = filteredItems.find((item) => !item.isSeparator);
      if (firstItem) {
        handleSelect(firstItem.value);
      }
    }
  }

  function handleSelect(value: string) {
    onSelect(value);
    if (!keepOpenOnSelect) {
      close();
    }
  }

  function handleRemoveRecent(value: string, e: MouseEvent) {
    e.stopPropagation();
    if (onRemoveRecent) {
      onRemoveRecent(value);
    }
  }

  function close() {
    if (onClose) {
      onClose();
    }
  }

  function isSelected(value: string): boolean {
    return value === selectedValue || selectedValues.includes(value);
  }

  function handleItemKeydown(e: KeyboardEvent, value: string) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleSelect(value);
    }
  }

  function handleRemoveKeydown(e: KeyboardEvent, value: string) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (onRemoveRecent) {
        onRemoveRecent(value);
      }
    }
  }
</script>

<div
  bind:this={menuEl}
  class="task-sync-selector-menu"
  style="position: absolute; top: {menuPosition.top}px; left: {menuPosition.left}px; z-index: 1000;"
  data-testid={testId}
>
  {#if searchable}
    <div class="task-sync-selector-search">
      <input
        bind:this={searchInput}
        bind:value={searchQuery}
        type="text"
        placeholder={searchPlaceholder}
        class="task-sync-selector-search-input"
        onkeydown={handleKeydown}
        data-testid="{testId}-search"
      />
    </div>
  {/if}

  {#if filteredItems.length === 0}
    <div
      class="task-sync-selector-no-results"
      data-testid="{testId}-no-results"
    >
      No results found
    </div>
  {:else}
    {#each filteredItems as item (item.value)}
      {#if item.isSeparator}
        <div
          class="task-sync-selector-separator"
          data-testid="{testId}-separator"
        ></div>
      {:else if item.isRecent && onRemoveRecent}
        <div
          class="task-sync-selector-item task-sync-selector-item-container"
          class:selected={isSelected(item.value)}
          data-testid="{testId}-item"
        >
          <span
            class="task-sync-selector-item-text"
            onclick={() => handleSelect(item.value)}
            onkeydown={(e) => handleItemKeydown(e, item.value)}
            role="button"
            tabindex="0"
          >
            {#if item.customContent}
              {@html item.customContent}
            {:else}
              {item.label || item.value}
            {/if}
          </span>
          <span
            class="task-sync-selector-clear-button"
            onclick={(e) => handleRemoveRecent(item.value, e)}
            onkeydown={(e) => handleRemoveKeydown(e, item.value)}
            title="Remove '{item.label || item.value}' from recent items"
            role="button"
            tabindex="0"
          >
            ×
          </span>
        </div>
      {:else}
        <div
          class="task-sync-selector-item"
          class:selected={isSelected(item.value)}
          onclick={() => handleSelect(item.value)}
          onkeydown={(e) => handleItemKeydown(e, item.value)}
          role="button"
          tabindex="0"
          data-testid="{testId}-item"
        >
          {#if item.customContent}
            {@html item.customContent}
          {:else}
            {item.label || item.value}
          {/if}
        </div>
      {/if}
    {/each}
  {/if}
</div>

<style>
  /* Styles are already in src/styles/custom.css */
  /* This component uses existing task-sync-selector-* classes */
</style>
