<script lang="ts">
  import { onMount } from "svelte";
  import BaseModal from "./BaseModal.svelte";

  interface Props {
    title?: string;
    description?: string;
    titlePlaceholder?: string;
    descriptionPlaceholder?: string;
    titleLabel?: string;
    descriptionLabel?: string;
    titleValue?: string;
    descriptionValue?: string;
    titleRequired?: boolean;
    descriptionRequired?: boolean;
    showTitleDescription?: boolean;
    showPrimaryProperties?: boolean;
    showExtraProperties?: boolean;
    onsubmit?: (data: any) => void;
    oncancel?: () => void;
    submitLabel?: string;
    cancelLabel?: string;
    submitDisabled?: boolean;
    titleError?: boolean;
    descriptionError?: boolean;
  }

  let {
    title = "",
    description = "",
    titlePlaceholder = "Enter title...",
    descriptionPlaceholder = "Add description...",
    titleLabel = "",
    descriptionLabel = "",
    titleValue = $bindable(""),
    descriptionValue = $bindable(""),
    titleRequired = true,
    descriptionRequired = false,
    showTitleDescription = true,
    showPrimaryProperties = true,
    showExtraProperties = true,
    onsubmit,
    oncancel,
    submitLabel = "Create",
    cancelLabel = "Cancel",
    submitDisabled = false,
    titleError = $bindable(false),
    descriptionError = $bindable(false),
  }: Props = $props();

  // UI state
  let showExtraFields = $state(false);
  
  // UI references
  let titleInput: HTMLInputElement;
  let descriptionTextarea: HTMLTextAreaElement;

  onMount(() => {
    // Focus title input if available
    titleInput?.focus();
  });

  function toggleExtraFields() {
    showExtraFields = !showExtraFields;
  }

  function handleTitleInput() {
    titleError = false;
  }

  function handleDescriptionInput() {
    descriptionError = false;
  }

  function handleSubmit() {
    // Basic validation
    if (titleRequired && !titleValue?.trim()) {
      titleError = true;
      titleInput?.focus();
      return;
    }

    if (descriptionRequired && !descriptionValue?.trim()) {
      descriptionError = true;
      descriptionTextarea?.focus();
      return;
    }

    onsubmit?.({
      title: titleValue?.trim(),
      description: descriptionValue?.trim(),
    });
  }
</script>

<BaseModal
  {title}
  {description}
  {oncancel}
  onsubmit={handleSubmit}
  {submitLabel}
  {cancelLabel}
  {submitDisabled}
>
  <svelte:fragment slot="content" let:firstInput>
    {#if showTitleDescription}
      <!-- Title input -->
      {#if titleLabel}
        <div class="task-sync-field">
          <label for="form-title" class="task-sync-field-label">
            {titleLabel}{titleRequired ? " *" : ""}
          </label>
          <input
            bind:this={titleInput}
            bind:value={titleValue}
            id="form-title"
            type="text"
            placeholder={titlePlaceholder}
            class="task-sync-input"
            class:task-sync-required-field={titleRequired}
            class:task-sync-input-error={titleError}
            data-testid="title-input"
            oninput={handleTitleInput}
          />
        </div>
      {:else}
        <!-- Linear-style title input (like TaskCreateModal) -->
        <input
          bind:this={titleInput}
          bind:value={titleValue}
          type="text"
          placeholder={titlePlaceholder}
          class="task-sync-title-input"
          class:task-sync-input-error={titleError}
          data-testid="title-input"
          oninput={handleTitleInput}
        />
      {/if}

      <!-- Description textarea -->
      {#if descriptionLabel}
        <div class="task-sync-field">
          <label for="form-description" class="task-sync-field-label">
            {descriptionLabel}{descriptionRequired ? " *" : ""}
          </label>
          <textarea
            bind:this={descriptionTextarea}
            bind:value={descriptionValue}
            id="form-description"
            placeholder={descriptionPlaceholder}
            class="task-sync-textarea"
            class:task-sync-input-error={descriptionError}
            data-testid="description-input"
            rows="3"
            oninput={handleDescriptionInput}
          ></textarea>
        </div>
      {:else}
        <!-- Linear-style description textarea (like TaskCreateModal) -->
        <textarea
          bind:this={descriptionTextarea}
          bind:value={descriptionValue}
          placeholder={descriptionPlaceholder}
          class="task-sync-description-input"
          class:task-sync-input-error={descriptionError}
          data-testid="description-input"
          rows="8"
          oninput={handleDescriptionInput}
        ></textarea>
      {/if}
    {/if}

    <!-- Additional form content -->
    <slot name="form-content" />
  </svelte:fragment>

  <svelte:fragment slot="properties">
    {#if showPrimaryProperties || showExtraProperties}
      <!-- Properties toolbar -->
      <div class="task-sync-properties-toolbar">
        {#if showPrimaryProperties}
          <!-- Main property controls row -->
          <div class="task-sync-property-controls">
            <!-- Primary property buttons -->
            <slot name="primary-properties" />

            {#if showExtraProperties}
              <!-- More options button -->
              <button
                type="button"
                onclick={toggleExtraFields}
                class="task-sync-property-button task-sync-more-button"
                data-testid="more-options-button"
                title="More options"
              >
                <span class="task-sync-more-dots">⋯</span>
              </button>
            {/if}
          </div>
        {/if}

        {#if showExtraProperties}
          <!-- Extra fields (collapsible) -->
          {#if showExtraFields}
            <div class="task-sync-extra-fields">
              <slot name="extra-properties" />
            </div>
          {/if}
        {/if}
      </div>
    {/if}
  </svelte:fragment>
</BaseModal>

<style>
  .task-sync-field {
    margin-bottom: 1.5rem;
  }

  .task-sync-field-label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    font-size: 0.9rem;
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
