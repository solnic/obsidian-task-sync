<script lang="ts">
  /**
   * Reusable FilterButton component with dropdown functionality
   * Used for filter buttons in GitHub View - works like project/area selectors
   */
  import Dropdown from "./Dropdown.svelte";

  interface DropdownGroup {
    label: string;
    items: Array<{
      value: string;
      label?: string;
    }>;
  }

  interface Props {
    label: string;
    currentValue: string;
    allOptions?: string[]; // All available options (will be combined with recently used)
    defaultOption?: string; // Default option (e.g., "All projects")
    options?: string[]; // Pre-built options list (for backward compatibility)
    groups?: DropdownGroup[]; // Grouped options
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
    allOptions,
    defaultOption,
    options,
    groups,
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

  // Build options list with recently used items at the top
  let optionsWithRecent = $derived.by(() => {
    // If groups are provided, don't build flat options
    if (groups && groups.length > 0) {
      return [];
    }

    // If options are provided directly, use them (backward compatibility)
    if (options) {
      return options;
    }

    // Otherwise, build from allOptions and recentlyUsedItems
    if (!allOptions) {
      return [];
    }

    const recentItems = recentlyUsedItems.filter((item) =>
      allOptions.includes(item)
    );
    const otherItems = allOptions.filter((item) => !recentItems.includes(item));

    const result = [];
    if (defaultOption) {
      result.push(defaultOption);
    }

    if (recentItems.length > 0) {
      result.push(...recentItems);
      if (otherItems.length > 0) {
        result.push("---"); // Separator
        result.push(...otherItems);
      }
    } else {
      result.push(...otherItems);
    }

    return result;
  });

  // Convert options to dropdown items or groups
  let dropdownItems = $derived.by(() => {
    if (groups && groups.length > 0) {
      return [];
    }
    return optionsWithRecent.map((option) => ({
      value: option,
      label: option,
      isSeparator: option === "---",
      isRecent: recentlyUsedItems.includes(option),
    }));
  });

  let dropdownGroups = $derived.by(() => {
    if (!groups || groups.length === 0) {
      return [];
    }
    return groups.map((group) => ({
      label: group.label,
      items: group.items.map((item) => ({
        value: item.value,
        label: item.label || item.value,
        isRecent: recentlyUsedItems.includes(item.value),
      })),
    }));
  });

  function handleButtonClick(event: MouseEvent) {
    // Check if the click was on the clear button or inside it
    const target = event.target as HTMLElement;
    const clearButton = target.closest(".filter-clear-button");

    if (clearButton) {
      event.stopPropagation();
      onselect("");
      return;
    }

    const hasOptions = groups && groups.length > 0 || optionsWithRecent.length > 0;
    if (!disabled && hasOptions) {
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
    groups={dropdownGroups}
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
