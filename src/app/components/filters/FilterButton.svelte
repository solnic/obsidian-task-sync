<!--
  Centralized Filter Button Component
  Works with the FilterManager system for consistent filter behavior
-->
<script lang="ts">
  import { getFilterStore } from "../../core/filters/filterStore";
  import type { FilterDefinition } from "../../core/filters/types";

  interface Props {
    serviceId: string;
    filterId: string;
    allOptions?: string[];
    testId?: string;
  }

  let { serviceId, filterId, allOptions = [], testId }: Props = $props();

  const filterStore = getFilterStore();
  
  // Get filter definition and current state
  const filterDef = filterStore.getFilterDefinition(serviceId, filterId);
  const serviceFilters = filterStore.getServiceFilters(serviceId);
  
  if (!filterDef) {
    throw new Error(`Filter ${filterId} not found for service ${serviceId}`);
  }

  // Reactive state
  let currentValue = $derived($serviceFilters?.state[filterId] ?? filterDef.defaultValue);
  let isActive = $derived(filterStore.isFilterActive(serviceId, filterId));
  let recentValues = $derived(filterStore.getRecentValues(serviceId, filterId));

  // Display value for the button
  let displayValue = $derived(() => {
    if (filterDef.type === "select") {
      return currentValue || filterDef.placeholder || `All ${filterDef.label.toLowerCase()}`;
    }
    return currentValue?.toString() || filterDef.placeholder || filterDef.label;
  });

  // Handle filter selection
  function handleSelect(value: string): void {
    const newValue = value === filterDef.placeholder || value === "" ? filterDef.defaultValue : value;
    filterStore.setFilterValue(serviceId, filterId, newValue);
  }

  // Handle clear
  function handleClear(): void {
    filterStore.clearFilter(serviceId, filterId);
  }

  // Combined options (recent + all)
  let combinedOptions = $derived(() => {
    if (filterDef.type !== "select") return allOptions;
    
    const recent = recentValues || [];
    const all = allOptions || [];
    
    // Combine recent and all options, removing duplicates
    const combined = [...recent];
    all.forEach(option => {
      if (!combined.includes(option)) {
        combined.push(option);
      }
    });
    
    return combined;
  });
</script>

<!-- Filter Button UI -->
<div class="filter-button-container">
  <button
    type="button"
    class="task-sync-property-button task-sync-text-button {isActive ? 'active' : ''}"
    aria-label="Select {filterDef.label}"
    data-testid={testId}
    onclick={() => {
      // TODO: Implement dropdown logic
      // For now, cycle through options for testing
      if (combinedOptions.length > 0) {
        const currentIndex = combinedOptions.indexOf(currentValue);
        const nextIndex = (currentIndex + 1) % (combinedOptions.length + 1);
        const nextValue = nextIndex === combinedOptions.length ? null : combinedOptions[nextIndex];
        handleSelect(nextValue || "");
      }
    }}
  >
    <span class="filter-label">{filterDef.label}:</span>
    <span class="filter-value">{displayValue}</span>
    {#if isActive && filterDef.allowClear}
      <button
        type="button"
        class="clear-button"
        onclick|stopPropagation={handleClear}
        aria-label="Clear {filterDef.label}"
      >
        ×
      </button>
    {/if}
  </button>
</div>

<style>
  .filter-button-container {
    display: inline-block;
  }

  .task-sync-property-button {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    background: var(--background-primary);
    color: var(--text-normal);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .task-sync-property-button:hover {
    background: var(--background-modifier-hover);
    border-color: var(--background-modifier-border-hover);
  }

  .task-sync-property-button.active {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-color: var(--interactive-accent);
  }

  .filter-label {
    font-weight: 500;
    font-size: 0.875rem;
  }

  .filter-value {
    font-size: 0.875rem;
  }

  .clear-button {
    background: none;
    border: none;
    color: inherit;
    cursor: pointer;
    padding: 0;
    margin-left: 0.25rem;
    font-size: 1rem;
    line-height: 1;
    opacity: 0.7;
  }

  .clear-button:hover {
    opacity: 1;
  }
</style>
