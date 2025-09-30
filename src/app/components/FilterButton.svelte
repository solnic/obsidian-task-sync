<script lang="ts">
  /**
   * Reusable FilterButton component with dropdown functionality
   * Used for filter buttons in GitHub View - works like project/area selectors
   */
  import Dropdown from "./Dropdown.svelte";

  interface Props {
    label: string;
    currentValue: string;
    options: string[];
    onselect: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    testId?: string;
    autoSuggest?: boolean; // Enable auto-suggest functionality
    allowClear?: boolean; // Allow clearing the selection
    isActive?: boolean; // Whether the filter is currently active (has a non-default value)
    recentlyUsedItems?: string[]; // List of recently used items (for showing clear buttons)
    onRemoveRecentItem?: (item: string) => void; // Callback to remove item from recently used list
    selectedOptions?: string[]; // List of currently selected options (for multi-select)
    keepMenuOpen?: boolean; // Whether to keep menu open after selection (for multi-select)
  }

  let {
    label,
    currentValue,
    options,
    onselect,
    placeholder = "Select...",
    disabled = false,
    testId,
    autoSuggest = false,
    allowClear = false,
    isActive = false,
    recentlyUsedItems = [],
    onRemoveRecentItem,
    selectedOptions = [],
    keepMenuOpen = false,
  }: Props = $props();

  let buttonEl: HTMLButtonElement | null = $state(null);
  let isMenuOpen = $state(false);

  // Convert options to dropdown items
  let dropdownItems = $derived(
    options.map((option) => ({
      value: option,
      label: option,
      isSeparator: option === "---",
      isRecent: recentlyUsedItems.includes(option),
    }))
  );

  function handleButtonClick(event: MouseEvent) {
    // Check if the click was on the clear button
    if (
      (event.target as HTMLElement).classList.contains("filter-clear-button")
    ) {
      event.stopPropagation();
      onselect("");
      return;
    }

    if (!disabled && options.length > 0) {
      isMenuOpen = true;
    }
  }

  function handleSelect(value: string) {
    onselect(value);
    if (!keepMenuOpen) {
      isMenuOpen = false;
    }
  }

  function handleClose() {
    isMenuOpen = false;
  }
</script>

<button
  type="button"
  bind:this={buttonEl}
  onclick={handleButtonClick}
  class="task-sync-property-button task-sync-text-button {isActive
    ? 'active'
    : ''}"
  {disabled}
  data-testid={testId}
  aria-label="Select {label}"
>
  <span class="task-sync-button-label">
    {currentValue || placeholder}
  </span>
  {#if allowClear && isActive}
    <span class="filter-clear-button" title="Clear {label}">×</span>
  {/if}
</button>

{#if isMenuOpen && buttonEl}
  <Dropdown
    anchor={buttonEl}
    items={dropdownItems}
    selectedValue={currentValue}
    selectedValues={selectedOptions}
    searchable={autoSuggest}
    searchPlaceholder="Type {label.toLowerCase()}..."
    keepOpenOnSelect={keepMenuOpen}
    onSelect={handleSelect}
    onRemoveRecent={onRemoveRecentItem}
    onClose={handleClose}
    testId="{testId}-dropdown"
  />
{/if}
