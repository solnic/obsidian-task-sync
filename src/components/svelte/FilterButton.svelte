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

  function handleButtonClick() {
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

    // Add clear option if enabled
    if (allowClear && currentValue) {
      const clearItem = menu.createDiv(
        "task-sync-selector-item task-sync-selector-clear"
      );
      clearItem.textContent = `Clear ${label}`;
      clearItem.addEventListener("click", () => {
        onselect("");
        menu.remove();
        isMenuOpen = false;
      });
    }

    // Add filtered options
    filteredOptions.slice(0, 10).forEach((option) => {
      const item = menu.createDiv("task-sync-selector-item");
      item.textContent = option;
      if (option === currentValue) {
        item.addClass("selected");
      }
      item.addEventListener("click", () => {
        onselect(option);
        menu.remove();
        isMenuOpen = false;
      });
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

    // Add clear option if enabled
    if (allowClear && currentValue) {
      const clearItem = menu.createDiv(
        "task-sync-selector-item task-sync-selector-clear"
      );
      clearItem.textContent = `Clear ${label}`;
      clearItem.addEventListener("click", () => {
        onselect("");
        menu.remove();
        isMenuOpen = false;
      });

      if (options.length > 0) {
        menu.createDiv("task-sync-selector-separator");
      }
    }

    options.forEach((option) => {
      const item = menu.createDiv("task-sync-selector-item");
      item.textContent = option;
      if (option === currentValue) {
        item.addClass("selected");
      }
      item.addEventListener("click", () => {
        onselect(option);
        menu.remove();
        isMenuOpen = false;
      });
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
  class="task-sync-property-button task-sync-text-button"
  {disabled}
  data-testid={testId}
  aria-label="Select {label}"
>
  <span class="task-sync-button-label">
    {currentValue || placeholder}
  </span>
</button>
