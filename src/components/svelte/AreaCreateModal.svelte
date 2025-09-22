<script lang="ts">
  import { onMount } from "svelte";
  import { getPluginContext } from "./context";
  import type { AreaCreateData } from "../../commands/core/CreateAreaCommand";
  import { Notice } from "obsidian";

  interface Props {
    onsubmit: (data: AreaCreateData) => void;
    oncancel: () => void;
  }

  let { onsubmit, oncancel }: Props = $props();

  const { plugin } = getPluginContext();

  // Form data
  let formData = $state<AreaCreateData>({
    name: "",
    description: "",
  });

  // UI references
  let nameInput: HTMLInputElement;

  // Error state for input styling
  let hasNameError = $state<boolean>(false);

  onMount(() => {
    // Focus name input
    nameInput?.focus();
  });

  function handleSubmit() {
    // Clear previous errors
    hasNameError = false;

    // Validate required fields
    if (!formData.name?.trim()) {
      hasNameError = true;
      new Notice("Area name is required");
      return;
    }

    // Prepare area data
    const areaData: AreaCreateData = {
      name: formData.name.trim(),
      description: formData.description?.trim() || undefined,
    };

    onsubmit(areaData);
  }

  function handleCancel() {
    oncancel();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      handleSubmit();
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="task-sync-modal-container">
  <!-- Header -->
  <div class="task-sync-modal-header">
    <h2>Create New Area</h2>
    <p class="task-sync-modal-description">
      Create a new area to organize your projects and tasks. Areas represent
      ongoing responsibilities or life domains.
    </p>
  </div>

  <!-- Main content area -->
  <div class="task-sync-main-content">
    <!-- Area name input -->
    <div class="task-sync-field">
      <label for="area-name" class="task-sync-field-label">Area Name *</label>
      <input
        bind:this={nameInput}
        bind:value={formData.name}
        id="area-name"
        type="text"
        placeholder="e.g., Health, Finance, Learning"
        class="task-sync-input task-sync-required-field"
        class:task-sync-input-error={hasNameError}
        data-testid="area-name-input"
        oninput={() => {
          hasNameError = false;
        }}
      />
      <div class="task-sync-field-description">
        Enter a descriptive name for the area
      </div>
    </div>

    <!-- Area description textarea -->
    <div class="task-sync-field">
      <label for="area-description" class="task-sync-field-label"
        >Description</label
      >
      <textarea
        bind:value={formData.description}
        id="area-description"
        placeholder="Brief description of this area..."
        class="task-sync-textarea"
        data-testid="area-description-input"
        rows="3"
      ></textarea>
      <div class="task-sync-field-description">
        Optional description for the area
      </div>
    </div>
  </div>

  <!-- Footer with action buttons -->
  <div class="task-sync-modal-footer">
    <div class="task-sync-footer-actions">
      <button
        type="button"
        class="task-sync-cancel-button"
        data-testid="cancel-button"
        onclick={handleCancel}
      >
        Cancel
      </button>
      <button
        type="button"
        class="task-sync-create-button mod-cta"
        data-testid="create-button"
        onclick={handleSubmit}
      >
        Create Area
      </button>
    </div>
  </div>
</div>

<style>
  .task-sync-modal-header {
    margin-bottom: 1.5rem;
  }

  .task-sync-modal-header h2 {
    margin: 0 0 0.5rem 0;
    font-size: 1.25rem;
    font-weight: 600;
  }

  .task-sync-modal-description {
    margin: 0;
    color: var(--text-muted);
    font-size: 0.9rem;
    line-height: 1.4;
  }

  .task-sync-field {
    margin-bottom: 1.5rem;
  }

  .task-sync-field-label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    font-size: 0.9rem;
  }

  .task-sync-field-description {
    margin-top: 0.25rem;
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  .task-sync-input,
  .task-sync-textarea {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    background: var(--background-primary);
    color: var(--text-normal);
    font-family: inherit;
    font-size: 0.9rem;
  }

  .task-sync-input:focus,
  .task-sync-textarea:focus {
    outline: none;
    border-color: var(--interactive-accent);
    box-shadow: 0 0 0 2px var(--interactive-accent-hover);
  }

  .task-sync-required-field {
    border-color: var(--text-accent);
  }

  .task-sync-textarea {
    resize: vertical;
    min-height: 4rem;
  }

  .task-sync-input-error {
    border-color: var(--text-error) !important;
    box-shadow: 0 0 0 2px var(--text-error-hover) !important;
  }
</style>
