<script lang="ts">
  /**
   * Reusable FilterButton component with dropdown functionality
   * Used for filter buttons in GitHub View - works like project/area selectors
   */

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

  let buttonEl: HTMLButtonElement;
  let isMenuOpen = $state(false);
  let searchQuery = $state("");

  // Filtered options based on search query (for auto-suggest mode)
  let filteredOptions = $derived.by(() => {
    if (!autoSuggest || !searchQuery.trim()) {
      return options;
    }
    return options.filter((option) =>
      option.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

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
      if (autoSuggest) {
        showAutoSuggestMenu();
      } else {
        showSelectorMenu();
      }
    }
  }

  function showAutoSuggestMenu() {
    if (!buttonEl) return;

    const menu = createSelectorMenu(buttonEl);

    // Add search input for auto-suggest
    const searchContainer = menu.createDiv("task-sync-selector-search");
    const searchInput = searchContainer.createEl("input", {
      type: "text",
      placeholder: `Type ${label.toLowerCase()}...`,
      cls: "task-sync-selector-search-input",
    });

    searchInput.value = searchQuery;
    searchInput.focus();

    // Handle search input
    searchInput.addEventListener("input", (e) => {
      searchQuery = (e.target as HTMLInputElement).value;
      updateMenuOptions(menu);
    });

    // Handle keyboard navigation
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        menu.remove();
        isMenuOpen = false;
      } else if (e.key === "Enter") {
        const firstOption = filteredOptions[0];
        if (firstOption) {
          onselect(firstOption);
          menu.remove();
          isMenuOpen = false;
        }
      }
    });

    updateMenuOptions(menu);
    isMenuOpen = true;
  }

  function updateMenuOptions(menu: HTMLElement) {
    // Remove existing options
    const existingOptions = menu.querySelectorAll(".task-sync-selector-item");
    existingOptions.forEach((item) => item.remove());

    // Clear option is now handled by the "x" button on the filter button itself

    // Add filtered options
    filteredOptions.forEach((option) => {
      if (option === "---") {
        // Add separator
        menu.createDiv("task-sync-selector-separator");
      } else {
        // Check if this is a recently used item
        const isRecentlyUsed = recentlyUsedItems.includes(option);

        if (isRecentlyUsed && onRemoveRecentItem) {
          // Create container for recently used item with clear button
          const itemContainer = menu.createDiv(
            "task-sync-selector-item task-sync-selector-item-container"
          );

          const textSpan = itemContainer.createSpan(
            "task-sync-selector-item-text"
          );
          textSpan.textContent = option;

          const clearButton = itemContainer.createSpan(
            "task-sync-selector-clear-button"
          );
          clearButton.textContent = "×";
          clearButton.title = `Remove "${option}" from recent items`;

          if (option === currentValue) {
            itemContainer.addClass("selected");
          }

          // Click on text selects the option
          textSpan.addEventListener("click", () => {
            onselect(option);
            if (!keepMenuOpen) {
              menu.remove();
              isMenuOpen = false;
            } else {
              // Update the menu to reflect new selection state
              updateMenuOptions(menu);
            }
          });

          // Click on clear button removes from recent items
          clearButton.addEventListener("click", (e) => {
            e.stopPropagation();
            onRemoveRecentItem(option);
            // Don't close menu, just update it
            updateMenuOptions(menu);
          });
        } else {
          // Regular item without clear button
          const item = menu.createDiv("task-sync-selector-item");
          item.textContent = option;
          if (option === currentValue || selectedOptions.includes(option)) {
            item.addClass("selected");
          }
          item.addEventListener("click", () => {
            onselect(option);
            if (!keepMenuOpen) {
              menu.remove();
              isMenuOpen = false;
            } else {
              // Update the menu to reflect new selection state
              updateMenuOptions(menu);
            }
          });
        }
      }
    });

    // Show "no results" message if no options
    if (filteredOptions.length === 0) {
      const noResults = menu.createDiv("task-sync-selector-no-results");
      noResults.textContent = "No results found";
    }
  }

  function showSelectorMenu() {
    if (!buttonEl) return;

    const menu = createSelectorMenu(buttonEl);

    // Clear option is now handled by the "x" button on the filter button itself

    options.forEach((option) => {
      if (option === "---") {
        // Add separator
        menu.createDiv("task-sync-selector-separator");
      } else {
        const item = menu.createDiv("task-sync-selector-item");
        item.textContent = option;
        if (option === currentValue || selectedOptions.includes(option)) {
          item.addClass("selected");
        }
        item.addEventListener("click", () => {
          onselect(option);
          if (!keepMenuOpen) {
            menu.remove();
            isMenuOpen = false;
          }
        });
      }
    });

    isMenuOpen = true;
  }

  function createSelectorMenu(anchorEl: HTMLElement): HTMLElement {
    const menu = document.createElement("div");
    menu.className = "task-sync-selector-menu";

    // Position the menu below the anchor element
    const rect = anchorEl.getBoundingClientRect();
    menu.style.position = "absolute";
    menu.style.top = `${rect.bottom + 5}px`;
    menu.style.left = `${rect.left}px`;
    menu.style.zIndex = "1000";

    document.body.appendChild(menu);

    // Close menu when clicking outside
    const closeMenu = (e: MouseEvent) => {
      if (!menu.contains(e.target as Node)) {
        menu.remove();
        isMenuOpen = false;
        document.removeEventListener("click", closeMenu);
      }
    };
    setTimeout(() => document.addEventListener("click", closeMenu), 0);

    return menu;
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
