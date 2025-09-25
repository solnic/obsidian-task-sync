<script lang="ts">
  /**
   * Reusable FilterDropdown component for project/area/parent task filtering
   * Shows active/inactive state and provides dropdown selection
   */

  interface Props {
    label: string;
    currentValue: string | null;
    options: string[];
    onselect: (value: string | null) => void;
    placeholder?: string;
    disabled?: boolean;
    testId?: string;
    isActive?: boolean;
  }

  let {
    label,
    currentValue,
    options,
    onselect,
    placeholder = "All",
    disabled = false,
    testId,
    isActive = false,
  }: Props = $props();

  let buttonEl: HTMLButtonElement;
  let isMenuOpen = $state(false);

  // Computed display value - show "All {entity type}" format
  let displayValue = $derived.by(() => {
    if (currentValue) {
      return currentValue;
    }
    // Convert placeholder to "All {entity type}" format if not already
    if (placeholder.toLowerCase().startsWith("all ")) {
      return placeholder;
    }
    return `All ${placeholder.toLowerCase()}`;
  });

  // Computed active state - active if a specific value is selected
  let computedIsActive = $derived.by(() => {
    return isActive || (currentValue !== null && currentValue !== "");
  });

  function handleButtonClick() {
    if (!disabled && options.length > 0) {
      showSelectorMenu();
    }
  }

  function showSelectorMenu() {
    if (!buttonEl) return;

    const menu = createSelectorMenu(buttonEl);

    // Add "All" option to clear filter
    const allItem = menu.createDiv("task-sync-selector-item");
    allItem.textContent = placeholder;
    if (currentValue === null) {
      allItem.addClass("selected");
    }
    allItem.addEventListener("click", () => {
      onselect(null);
      menu.remove();
      isMenuOpen = false;
    });

    // Add separator if there are options
    if (options.length > 0) {
      menu.createDiv("task-sync-selector-separator");
    }

    // Add filter options
    options.forEach((option) => {
      const item = menu.createDiv("task-sync-selector-item");
      item.textContent = option;
      if (currentValue === option) {
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

  function createSelectorMenu(buttonElement: HTMLElement): HTMLElement {
    const menu = document.createElement("div");
    menu.className = "task-sync-selector-menu";

    // Position the menu
    const rect = buttonElement.getBoundingClientRect();
    menu.style.position = "fixed";
    menu.style.top = `${rect.bottom + 4}px`;
    menu.style.left = `${rect.left}px`;
    menu.style.minWidth = `${rect.width}px`;
    menu.style.zIndex = "1000";

    document.body.appendChild(menu);

    // Close menu when clicking outside
    const closeMenu = (event: MouseEvent) => {
      if (!menu.contains(event.target as Node)) {
        menu.remove();
        isMenuOpen = false;
        document.removeEventListener("click", closeMenu);
      }
    };

    // Add slight delay to prevent immediate closure
    setTimeout(() => {
      document.addEventListener("click", closeMenu);
    }, 10);

    return menu;
  }
</script>

<button
  type="button"
  bind:this={buttonEl}
  onclick={handleButtonClick}
  class="filter-dropdown-button {computedIsActive ? 'active' : 'inactive'}"
  class:disabled
  {disabled}
  data-testid={testId}
  title={displayValue}
>
  <span class="filter-value">{displayValue}</span>
  <span class="filter-arrow" class:open={isMenuOpen}>▼</span>
</button>

<style>
  .filter-dropdown-button {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 12px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
    max-width: 250px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .filter-dropdown-button:hover:not(.disabled) {
    background: var(--background-modifier-hover);
    border-color: var(--background-modifier-border-hover);
  }

  .filter-dropdown-button.active {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-color: var(--interactive-accent);
  }

  .filter-dropdown-button.active:hover:not(.disabled) {
    background: var(--interactive-accent-hover);
    border-color: var(--interactive-accent-hover);
  }

  .filter-dropdown-button.inactive {
    opacity: 0.7;
  }

  .filter-dropdown-button.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .filter-value {
    font-weight: 500;
  }

  .filter-arrow {
    font-size: 10px;
    transition: transform 0.2s ease;
    margin-left: 4px;
  }

  .filter-arrow.open {
    transform: rotate(180deg);
  }

  /* Global styles for the dropdown menu */
  :global(.task-sync-selector-menu) {
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    box-shadow: var(--shadow-s);
    max-height: 200px;
    overflow-y: auto;
    padding: 4px 0;
  }

  :global(.task-sync-selector-item) {
    padding: 8px 12px;
    cursor: pointer;
    font-size: 13px;
    color: var(--text-normal);
    transition: background-color 0.1s ease;
  }

  :global(.task-sync-selector-item:hover) {
    background: var(--background-modifier-hover);
  }

  :global(.task-sync-selector-item.selected) {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  :global(.task-sync-selector-separator) {
    height: 1px;
    background: var(--background-modifier-border);
    margin: 4px 0;
  }
</style>
