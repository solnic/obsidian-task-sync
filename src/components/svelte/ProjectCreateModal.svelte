<script lang="ts">
  import { onMount } from "svelte";
  import { getPluginContext } from "./context";
  import type { ProjectCreateData } from "../../commands/core/CreateProjectCommand";
  import { AbstractInputSuggest, Notice } from "obsidian";

  interface Props {
    onsubmit: (data: ProjectCreateData) => void;
    oncancel: () => void;
  }

  let { onsubmit, oncancel }: Props = $props();

  const { plugin } = getPluginContext();

  // Form data
  let formData = $state<ProjectCreateData>({
    name: "",
    description: "",
    areas: [],
  });

  // UI references
  let nameInput: HTMLInputElement;
  let areasInput: HTMLInputElement;

  // Error state for input styling
  let hasNameError = $state<boolean>(false);

  // Autocomplete for areas
  class AreaSuggest extends AbstractInputSuggest<string> {
    areaFiles: string[];

    constructor(app: any, inputEl: HTMLInputElement, areaFiles: string[]) {
      super(app, inputEl);
      this.areaFiles = areaFiles;
    }

    getSuggestions(query: string): string[] {
      return this.areaFiles
        .filter((area) => area.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 10);
    }

    renderSuggestion(value: string, el: HTMLElement): void {
      el.createEl("div", { text: value });
    }

    selectSuggestion(value: string): void {
      this.setValue(value);
      this.close();
    }
  }

  onMount(() => {
    // Focus name input
    nameInput?.focus();

    // Setup areas autocomplete
    if (areasInput) {
      const areaFiles = plugin.app.vault
        .getMarkdownFiles()
        .filter((file) =>
          file.path.startsWith(plugin.settings.areasFolder + "/")
        )
        .map((file) => file.basename);

      new AreaSuggest(plugin.app, areasInput, areaFiles);
    }
  });

  function handleSubmit() {
    // Clear previous errors
    hasNameError = false;

    // Validate required fields
    if (!formData.name?.trim()) {
      hasNameError = true;
      new Notice("Project name is required");
      return;
    }

    // Prepare project data
    const projectData: ProjectCreateData = {
      name: formData.name.trim(),
      description: formData.description?.trim() || undefined,
      areas: formData.areas?.filter((area) => area.trim()) || undefined,
    };

    onsubmit(projectData);
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

  function handleAreasChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const value = target.value;
    formData.areas = value
      .split(",")
      .map((area) => area.trim())
      .filter((area) => area);
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="task-sync-modal-container">
  <!-- Header -->
  <div class="task-sync-modal-header">
    <h2>Create New Project</h2>
    <p class="task-sync-modal-description">
      Create a new project with specific goals and outcomes. Projects have a
      clear beginning and end.
    </p>
  </div>

  <!-- Main content area -->
  <div class="task-sync-main-content">
    <!-- Project name input -->
    <div class="task-sync-field">
      <label for="project-name" class="task-sync-field-label"
        >Project Name *</label
      >
      <input
        bind:this={nameInput}
        bind:value={formData.name}
        id="project-name"
        type="text"
        placeholder="Website Redesign, Learn Spanish"
        class="task-sync-input task-sync-required-field"
        class:task-sync-input-error={hasNameError}
        data-testid="project-name-input"
        oninput={() => {
          hasNameError = false;
        }}
      />
      <div class="task-sync-field-description">
        Enter a descriptive name for the project
      </div>
    </div>

    <!-- Project description textarea -->
    <div class="task-sync-field">
      <label for="project-description" class="task-sync-field-label"
        >Description</label
      >
      <textarea
        bind:value={formData.description}
        id="project-description"
        placeholder="Brief description of this project..."
        class="task-sync-textarea"
        data-testid="project-description-input"
        rows="3"
      ></textarea>
      <div class="task-sync-field-description">
        Optional description for the project
      </div>
    </div>

    <!-- Areas input -->
    <div class="task-sync-field">
      <label for="project-areas" class="task-sync-field-label">Areas</label>
      <input
        bind:this={areasInput}
        value={formData.areas?.join(", ") || ""}
        oninput={handleAreasChange}
        id="project-areas"
        type="text"
        placeholder="Work, Learning"
        class="task-sync-input"
        data-testid="project-areas-input"
      />
      <div class="task-sync-field-description">
        Comma-separated list of areas this project belongs to
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
        Create Project
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
