<script lang="ts">
  import { onMount, onDestroy } from "svelte";

  interface Props {
    value: string;
    suggestions: string[];
    placeholder?: string;
    maxSuggestions?: number;
    onInput: (value: string) => void;
    onSelect?: (value: string) => void;
    testId?: string;
    inputRef?: HTMLInputElement | null;
  }

  let {
    value = $bindable(""),
    suggestions,
    placeholder = "Type to search...",
    maxSuggestions = 10,
    onInput,
    onSelect,
    testId = "autocomplete",
    inputRef = $bindable(null),
  }: Props = $props();

  let inputEl: HTMLInputElement | null = $state(null);
  let dropdownEl: HTMLElement | null = $state(null);
  let isOpen = $state(false);
  let selectedIndex = $state(-1);

  // Filter suggestions based on input value
  let filteredSuggestions = $derived(
    value.trim()
      ? suggestions
          .filter((suggestion) =>
            suggestion.toLowerCase().includes(value.toLowerCase())
          )
          .slice(0, maxSuggestions)
      : []
  );

  // Sync inputRef with internal inputEl
  $effect(() => {
    if (inputEl) {
      inputRef = inputEl;
    }
  });

  onMount(() => {
    // Add click outside listener
    setTimeout(() => {
      document.addEventListener("click", handleClickOutside);
    }, 0);
  });

  onDestroy(() => {
    document.removeEventListener("click", handleClickOutside);
  });

  function handleClickOutside(e: MouseEvent) {
    if (
      inputEl &&
      !inputEl.contains(e.target as Node) &&
      dropdownEl &&
      !dropdownEl.contains(e.target as Node)
    ) {
      close();
    }
  }

  function handleInputChange(e: Event) {
    const target = e.target as HTMLInputElement;
    value = target.value;
    onInput(value);
    selectedIndex = -1;
    
    // Open dropdown if there are suggestions
    if (filteredSuggestions.length > 0) {
      isOpen = true;
    } else {
      isOpen = false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!isOpen) {
      // Open dropdown on any key if there are suggestions
      if (filteredSuggestions.length > 0 && e.key !== "Escape") {
        isOpen = true;
      }
      return;
    }

    switch (e.key) {
      case "Escape":
        e.preventDefault();
        close();
        break;
      case "ArrowDown":
        e.preventDefault();
        selectedIndex = Math.min(
          selectedIndex + 1,
          filteredSuggestions.length - 1
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, -1);
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < filteredSuggestions.length) {
          selectSuggestion(filteredSuggestions[selectedIndex]);
        } else if (filteredSuggestions.length > 0) {
          selectSuggestion(filteredSuggestions[0]);
        }
        break;
      case "Tab":
        // Allow tab to select first suggestion
        if (filteredSuggestions.length > 0) {
          e.preventDefault();
          selectSuggestion(
            selectedIndex >= 0
              ? filteredSuggestions[selectedIndex]
              : filteredSuggestions[0]
          );
        }
        break;
    }
  }

  function selectSuggestion(suggestion: string) {
    value = suggestion;
    onInput(value);
    if (onSelect) {
      onSelect(suggestion);
    }
    close();
  }

  function handleSuggestionClick(suggestion: string) {
    selectSuggestion(suggestion);
  }

  function handleSuggestionKeydown(e: KeyboardEvent, suggestion: string) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      selectSuggestion(suggestion);
    }
  }

  function close() {
    isOpen = false;
    selectedIndex = -1;
  }

  function handleFocus() {
    if (filteredSuggestions.length > 0) {
      isOpen = true;
    }
  }
</script>

<div class="autocomplete-container" data-testid="{testId}-container">
  <input
    bind:this={inputEl}
    type="text"
    {value}
    {placeholder}
    oninput={handleInputChange}
    onkeydown={handleKeydown}
    onfocus={handleFocus}
    data-testid={testId}
    class="autocomplete-input"
  />

  {#if isOpen && filteredSuggestions.length > 0}
    <div
      bind:this={dropdownEl}
      class="autocomplete-dropdown"
      data-testid="{testId}-dropdown"
    >
      {#each filteredSuggestions as suggestion, index (suggestion)}
        <div
          class="autocomplete-item"
          class:selected={index === selectedIndex}
          onclick={() => handleSuggestionClick(suggestion)}
          onkeydown={(e) => handleSuggestionKeydown(e, suggestion)}
          role="button"
          tabindex="0"
          data-testid="{testId}-item"
        >
          {suggestion}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .autocomplete-container {
    position: relative;
    width: 100%;
  }

  .autocomplete-input {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: 14px;
  }

  .autocomplete-input:focus {
    outline: none;
    border-color: var(--interactive-accent);
  }

  .autocomplete-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin-top: 4px;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
    max-height: 200px;
    overflow-y: auto;
    z-index: 1000;
  }

  .autocomplete-item {
    padding: 8px 12px;
    cursor: pointer;
    transition: background-color 0.1s ease;
  }

  .autocomplete-item:hover {
    background: var(--background-modifier-hover);
  }

  .autocomplete-item.selected {
    background: var(--background-modifier-hover);
    border-left: 3px solid var(--interactive-accent);
    padding-left: 9px;
  }

  .autocomplete-item:first-child {
    border-top-left-radius: 8px;
    border-top-right-radius: 8px;
  }

  .autocomplete-item:last-child {
    border-bottom-left-radius: 8px;
    border-bottom-right-radius: 8px;
  }
</style>

