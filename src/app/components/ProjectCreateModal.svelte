<script lang="ts">
  import { onMount } from "svelte";
  import { Notice } from "obsidian";
  import type { Project } from "../core/entities";
  import { Obsidian } from "../entities/Obsidian";

  interface Props {
    projectOperations: InstanceType<typeof Obsidian.ProjectOperations>;
    onsubmit?: (data: any) => void;
    oncancel: () => void;
  }

  let { projectOperations, onsubmit, oncancel }: Props = $props();

  // Form data
  let formData = $state({
    name: "",
    description: "",
    areas: "",
  });

  // UI references
  let nameInput: HTMLInputElement;

  // Error state for input styling
  let hasNameError = $state<boolean>(false);

  onMount(() => {
    // Focus name input
    nameInput?.focus();
  });

  async function handleSubmit() {
    // Clear previous errors
    hasNameError = false;

    // Validate required fields
    if (!formData.name?.trim()) {
      hasNameError = true;
      new Notice("Project name is required");
      return;
    }

    try {
      // Parse areas from comma-separated string
      const areas = formData.areas
        ? formData.areas
            .split(",")
            .map((area) => area.trim())
            .filter((area) => area)
        : [];

      const projectData: Omit<Project, "id" | "createdAt" | "updatedAt"> = {
        name: formData.name.trim(),
        description: formData.description?.trim() || undefined,
        areas,
        tags: [],
      };

      // Create project using provided project operations
      // This will automatically set source.filePath based on the project name
      const createdProject = await projectOperations.create(projectData);

      new Notice(`Project "${createdProject.name}" created successfully`);

      // Call onsubmit if provided, which will handle closing the modal
      if (onsubmit) {
        onsubmit({
          name: formData.name.trim(),
          description: formData.description?.trim() || undefined,
          areas: areas,
        });
      } else {
        // Only close directly if no onsubmit handler
        oncancel();
      }
    } catch (error) {
      console.error("Failed to create project:", error);
      new Notice(`Failed to create project: ${error.message}`);
    }
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

  function handleNameInput() {
    hasNameError = false;
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="task-sync-modal-container">
  <!-- Header -->
  <div class="task-sync-modal-header">
    <h2>Create New Project</h2>
    <p class="task-sync-modal-description">
      Create a new project to organize related tasks and track progress.
      Projects represent specific outcomes or deliverables with a defined scope.
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
        placeholder="e.g., Website Redesign, Learn Spanish"
        class="task-sync-input task-sync-required-field"
        class:task-sync-input-error={hasNameError}
        data-testid="project-name-input"
        oninput={handleNameInput}
      />
      <div class="task-sync-field-description">
        Enter a descriptive name for the project
      </div>
    </div>

    <!-- Areas input -->
    <div class="task-sync-field">
      <label for="project-areas" class="task-sync-field-label">Areas</label>
      <input
        bind:value={formData.areas}
        id="project-areas"
        type="text"
        placeholder="e.g., Work, Learning"
        class="task-sync-input"
        data-testid="project-areas-input"
      />
      <div class="task-sync-field-description">
        Comma-separated list of areas this project belongs to
      </div>
    </div>

    <!-- Project description input -->
    <div class="task-sync-field">
      <label for="project-description" class="task-sync-field-label"
        >Description</label
      >
      <textarea
        bind:value={formData.description}
        id="project-description"
        placeholder="Brief description of the project goals and scope"
        class="task-sync-textarea"
        data-testid="project-description-input"
        rows="3"
      ></textarea>
      <div class="task-sync-field-description">
        Optional description of the project
      </div>
    </div>
  </div>

  <!-- Footer with action buttons -->
  <div class="task-sync-modal-footer">
    <button
      type="button"
      class="task-sync-button task-sync-button-secondary"
      onclick={handleCancel}
      data-testid="cancel-button"
    >
      Cancel
    </button>
    <button
      type="button"
      class="task-sync-button task-sync-button-primary"
      onclick={handleSubmit}
      data-testid="create-button"
    >
      Create Project
    </button>
  </div>
</div>
