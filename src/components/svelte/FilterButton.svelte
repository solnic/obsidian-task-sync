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
  }

  let {
    label,
    currentValue,
    options,
    onselect,
    placeholder = "Select...",
    disabled = false,
    testId,
  }: Props = $props();

  let buttonEl: HTMLButtonElement;
  let isMenuOpen = $state(false);

  function handleButtonClick() {
    if (!disabled && options.length > 0) {
      showSelectorMenu();
    }
  }

  function showSelectorMenu() {
    if (!buttonEl) return;

    const menu = createSelectorMenu(buttonEl);

    options.forEach((option) => {
      const item = menu.createDiv("task-sync-selector-item");
      item.textContent = option;
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
