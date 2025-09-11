<script lang="ts">
  /**
   * Reusable AutoSuggestInput component using Obsidian's AbstractInputSuggest
   * Provides type-ahead functionality for any list of suggestions
   */
  
  import { onMount, onDestroy } from "svelte";
  import { AbstractInputSuggest } from "obsidian";
  import { getPluginContext } from "./context";

  interface Props {
    label: string;
    value: string | null;
    suggestions: string[];
    placeholder?: string;
    disabled?: boolean;
    testId?: string;
    onselect: (value: string | null) => void;
  }

  let {
    label,
    value = $bindable(),
    suggestions,
    placeholder = "Type to search...",
    disabled = false,
    testId,
    onselect,
  }: Props = $props();

  const { plugin } = getPluginContext();

  let inputEl: HTMLInputElement;
  let suggestInstance: AbstractInputSuggest<string> | null = null;

  // Custom suggest class for this component
  class AutoSuggest extends AbstractInputSuggest<string> {
    suggestions: string[];

    constructor(app: any, inputEl: HTMLInputElement, suggestions: string[]) {
      super(app, inputEl);
      this.suggestions = suggestions;
    }

    getSuggestions(query: string): string[] {
      if (!query.trim()) {
        return this.suggestions.slice(0, 10);
      }
      
      return this.suggestions
        .filter((item) =>
          item.toLowerCase().includes(query.toLowerCase())
        )
        .slice(0, 10);
    }

    renderSuggestion(value: string, el: HTMLElement): void {
      el.createEl("div", { text: value });
    }

    selectSuggestion(value: string): void {
      this.setValue(value);
      onselect(value);
      this.close();
    }
  }

  onMount(() => {
    if (inputEl && suggestions.length > 0) {
      suggestInstance = new AutoSuggest(plugin.app, inputEl, suggestions);
    }
  });

  onDestroy(() => {
    if (suggestInstance) {
      suggestInstance.close();
    }
  });

  // Update suggestions when they change
  $effect(() => {
    if (suggestInstance) {
      suggestInstance.suggestions = suggestions;
    }
  });

  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement;
    const newValue = target.value.trim() || null;
    value = newValue;
    onselect(newValue);
  }

  function handleClear() {
    value = null;
    onselect(null);
    if (inputEl) {
      inputEl.value = "";
      inputEl.focus();
    }
  }

  // Computed display value
  let displayValue = $derived.by(() => {
    return value || "";
  });
</script>

<div class="auto-suggest-input-container" data-testid="{testId}-container">
  <label class="auto-suggest-label" for={testId}>
    {label}:
  </label>
  
  <div class="auto-suggest-input-wrapper">
    <input
      bind:this={inputEl}
      type="text"
      class="auto-suggest-input"
      id={testId}
      {placeholder}
      value={displayValue}
      {disabled}
      oninput={handleInput}
      data-testid={testId}
    />
    
    {#if value}
      <button
        class="auto-suggest-clear"
        title="Clear {label}"
        onclick={handleClear}
        {disabled}
        data-testid="{testId}-clear"
      >
        ×
      </button>
    {/if}
  </div>
</div>

<style>
  .auto-suggest-input-container {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 200px;
  }

  .auto-suggest-label {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-muted);
    margin: 0;
  }

  .auto-suggest-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .auto-suggest-input {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: 13px;
    transition: border-color 0.2s ease;
  }

  .auto-suggest-input:focus {
    outline: none;
    border-color: var(--interactive-accent);
  }

  .auto-suggest-input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .auto-suggest-clear {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 16px;
    line-height: 1;
    padding: 2px;
    border-radius: 2px;
    transition: color 0.2s ease;
  }

  .auto-suggest-clear:hover {
    color: var(--text-normal);
    background: var(--background-modifier-hover);
  }

  .auto-suggest-clear:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
