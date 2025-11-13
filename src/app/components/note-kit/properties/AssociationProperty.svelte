<!--
  Association Property Component
  Handles associations (links) between notes with type-safe entity references
  Supports single/multiple selection, inline entity creation, and validation
-->
<script lang="ts">
  import { Notice } from "obsidian";
  import { FieldGroup } from "../../base";
  import Dropdown from "../../Dropdown.svelte";
  import type {
    PropertyDefinition,
    ValidationResult,
  } from "../../../core/note-kit/types";
  import { TypeRegistry } from "../../../core/note-kit/registry";
  import { Tasks } from "../../../entities/Tasks";
  import { Projects } from "../../../entities/Projects";
  import { Areas } from "../../../entities/Areas";
  import type { TaskSyncSettings } from "../../../types/settings";

  interface Props {
    property: PropertyDefinition;
    propertyKey: string;
    value?: string | string[];
    onvaluechange?: (value: string | string[] | undefined) => void;
    validationResult?: ValidationResult;
    compact?: boolean;
    typeRegistry?: TypeRegistry;
    settings?: TaskSyncSettings;
  }

  let {
    property,
    propertyKey,
    value = $bindable(),
    onvaluechange,
    validationResult,
    compact = false,
    typeRegistry,
    settings,
  }: Props = $props();

  const hasError = $derived(
    validationResult &&
      !validationResult.valid &&
      validationResult.errors.length > 0
  );
  const errorMessage = $derived(
    hasError ? validationResult!.errors[0].message : undefined
  );

  // Association configuration from property definition
  const association = $derived(property.association);
  const isMultiple = $derived(association?.multiple ?? false);
  const allowCreate = $derived(association?.allowCreate ?? false);
  const noteTypeId = $derived(association?.noteTypeId ?? "");

  // State for dropdown
  let showDropdown = $state(false);
  let buttonEl: HTMLButtonElement | null = $state(null);

  // State for inline entity creation
  let showInlineCreate = $state(false);
  let newEntityName = $state("");
  let newEntityDescription = $state("");
  let creatingEntity = $state(false);

  // Available entities from the store
  let availableEntities = $state<Array<{ id: string; name: string; filePath?: string }>>([]);

  // Load entities based on noteTypeId
  async function loadEntities() {
    if (!noteTypeId) {
      availableEntities = [];
      return;
    }

    try {
      let entities: readonly any[] = [];

      // Get entities based on note type ID
      switch (noteTypeId) {
        case "task":
          entities = await new Tasks.Queries().getAll();
          break;
        case "project":
          entities = await new Projects.Queries().getAll();
          break;
        case "area":
          entities = await new Areas.Queries().getAll();
          break;
        default:
          console.warn(`Unknown note type ID: ${noteTypeId}`);
          entities = [];
      }

      // Map to { id, name, filePath } format - make a copy since entities is readonly
      availableEntities = Array.from(entities).map((entity) => {
        return {
          id: entity.id,
          name: entity.name || entity.title || entity.id,
          filePath: entity.source?.keys?.obsidian || entity.source?.filePath,
        };
      });
    } catch (error) {
      console.error(`Error loading entities for ${noteTypeId}:`, error);
      availableEntities = [];
    }
  }

  // Load entities when component mounts or noteTypeId changes
  $effect(() => {
    if (noteTypeId) {
      loadEntities();
    }
  });

  // Create dropdown items with "Create new..." option if allowed
  const dropdownItems = $derived.by(() => {
    const items = availableEntities.map((entity) => ({
      value: entity.id,
      label: entity.name,
    }));

    // Add "Create new..." option at the beginning if allowed
    if (allowCreate && !showInlineCreate) {
      items.unshift({
        value: "__create_new__",
        label: "➕ Create new...",
      });
    }

    return items;
  });

  // Get selected entity IDs for dropdown (to show checkmarks)
  const selectedEntityIds = $derived.by(() => {
    if (!value) return [];

    const selectedValues = Array.isArray(value) ? value : [value];
    return selectedValues
      .map((entityName) => {
        if (!entityName) return null;
        // Find entity by name to get its ID
        const entity = availableEntities.find(e => e.name === entityName);
        return entity?.id;
      })
      .filter(Boolean) as string[];
  });

  // Get selected entity names for display
  const selectedEntityNames = $derived.by(() => {
    if (!value) return [];

    const selectedValues = Array.isArray(value) ? value : [value];
    return selectedValues.filter(Boolean);
  });

  // Display text for the button
  const displayText = $derived.by(() => {
    const names = selectedEntityNames;
    if (names.length === 0) {
      return `Select ${property.name}`;
    }
    if (names.length === 1) {
      return names[0];
    }
    return `${names.length} selected`;
  });

  // Helper to remove an item from multi-select
  function removeItem(itemToRemove: string) {
    if (!isMultiple || !Array.isArray(value)) return;

    const newValues = value.filter(v => v !== itemToRemove);
    value = newValues;
    onvaluechange?.(newValues);
  }

  function handleButtonClick() {
    if (showInlineCreate) return; // Don't open dropdown while creating
    showDropdown = true;
  }

  function handleSelect(selectedValue: string) {
    console.log("[AssociationProperty] handleSelect called with:", selectedValue);

    // Handle "Create new..." selection
    if (selectedValue === "__create_new__") {
      showDropdown = false;
      showInlineCreate = true;
      return;
    }

    // Find the entity name from the ID
    const entity = availableEntities.find((e) => e.id === selectedValue);
    if (!entity) {
      console.log("[AssociationProperty] Entity not found for ID:", selectedValue);
      return;
    }

    console.log("[AssociationProperty] Found entity:", entity);

    // Store plain entity name (not wiki link)
    // Wiki link format is only for frontmatter and base properties, not entity properties
    const entityName = entity.name;
    console.log("[AssociationProperty] Storing entity name:", entityName);

    // Handle normal selection
    if (isMultiple) {
      const currentValues = Array.isArray(value) ? value : value ? [value] : [];
      const newValues = currentValues.includes(entityName)
        ? currentValues.filter((v) => v !== entityName)
        : [...currentValues, entityName];
      console.log("[AssociationProperty] Updating multiple values:", newValues);
      value = newValues;
      onvaluechange?.(newValues);
    } else {
      console.log("[AssociationProperty] Updating single value:", entityName);
      value = entityName;
      onvaluechange?.(entityName);
    }

    // Always close dropdown after selection
    showDropdown = false;
  }

  async function handleCreateEntity() {
    if (!newEntityName.trim() || creatingEntity || !settings) return;

    creatingEntity = true;

    try {
      let createdEntity: any;

      // Create entity based on note type ID
      switch (noteTypeId) {
        case "task": {
          const operations = new Tasks.Operations(settings);
          createdEntity = await operations.create({
            title: newEntityName,
            description: newEntityDescription || undefined,
            done: false,
            status: "To Do",
            project: "",
            areas: [],
            tags: [],
            priority: "Medium",
            source: {
              extension: "local",
              keys: {},
            },
          });
          break;
        }
        case "project": {
          const operations = new Projects.Operations(settings);
          createdEntity = await operations.create({
            name: newEntityName,
            description: newEntityDescription || undefined,
            areas: [],
            tags: [],
            source: {
              extension: "local",
              keys: {},
            },
          });
          break;
        }
        case "area": {
          const operations = new Areas.Operations(settings);
          createdEntity = await operations.create({
            name: newEntityName,
            description: newEntityDescription || undefined,
            tags: [],
            source: {
              extension: "local",
              keys: {},
            },
          });
          break;
        }
        default:
          throw new Error(`Cannot create entity for unknown type: ${noteTypeId}`);
      }

      // Reload entities to include the new one
      await loadEntities();

      // Store plain entity name (not wiki link)
      const entityName = createdEntity.name || createdEntity.title || newEntityName;

      // Add the newly created entity to the selection
      if (isMultiple) {
        const currentValues = Array.isArray(value) ? value : value ? [value] : [];
        value = [...currentValues, entityName];
        onvaluechange?.(value);
      } else {
        value = entityName;
        onvaluechange?.(entityName);
      }

      // Reset inline create form
      newEntityName = "";
      newEntityDescription = "";
      showInlineCreate = false;
    } catch (error) {
      console.error(`Error creating ${noteTypeId}:`, error);
      new Notice(`Failed to create ${noteTypeId}: ${error.message}`, 5000);
    } finally {
      creatingEntity = false;
    }
  }

  function handleCancelCreate() {
    newEntityName = "";
    newEntityDescription = "";
    showInlineCreate = false;
  }
</script>

{#if compact}
  <!-- Compact mode: no label, just button -->
  <div class="association-property-compact">
    <button
      bind:this={buttonEl}
      type="button"
      onclick={handleButtonClick}
      class="task-sync-property-button"
      class:error={hasError}
      data-testid="property-{propertyKey}"
      aria-label="Select {property.name}"
      disabled={showInlineCreate}
    >
      {displayText}
    </button>

    {#if isMultiple && selectedEntityNames.length > 0}
      <div class="association-selected-items">
        {#each selectedEntityNames as name}
          <span class="association-selected-chip">
            {name}
            <button
              type="button"
              class="association-remove-chip"
              onclick={() => removeItem(name)}
              aria-label="Remove {name}"
            >
              ×
            </button>
          </span>
        {/each}
      </div>
    {/if}

    {#if showInlineCreate}
      <div class="association-inline-create">
        <input
          type="text"
          bind:value={newEntityName}
          placeholder="Enter {property.name} name..."
          class="association-inline-input"
          data-testid="property-{propertyKey}-create-name"
        />
        <textarea
          bind:value={newEntityDescription}
          placeholder="Description (optional)..."
          rows="2"
          class="association-inline-textarea"
          data-testid="property-{propertyKey}-create-description"
        ></textarea>
        <div class="association-inline-buttons">
          <button
            type="button"
            onclick={handleCreateEntity}
            disabled={!newEntityName.trim() || creatingEntity}
            class="association-inline-create-button"
            data-testid="property-{propertyKey}-create-submit"
          >
            {creatingEntity ? "Creating..." : "Create"}
          </button>
          <button
            type="button"
            onclick={handleCancelCreate}
            disabled={creatingEntity}
            class="association-inline-cancel-button"
            data-testid="property-{propertyKey}-create-cancel"
          >
            Cancel
          </button>
        </div>
      </div>
    {/if}
  </div>
{:else}
  <!-- Standard mode: with FieldGroup label -->
  <FieldGroup
    label={property.name}
    required={property.required}
    description={hasError ? errorMessage : property.description}
    error={hasError}
    htmlFor="prop-{propertyKey}"
  >
    <div class="association-property-standard">
      <button
        bind:this={buttonEl}
        type="button"
        onclick={handleButtonClick}
        class="task-sync-property-button"
        class:error={hasError}
        data-testid="property-{propertyKey}"
        aria-label="Select {property.name}"
        disabled={showInlineCreate}
      >
        {displayText}
      </button>

      {#if isMultiple && selectedEntityNames.length > 0}
        <div class="association-selected-items">
          {#each selectedEntityNames as name}
            <span class="association-selected-chip">
              {name}
              <button
                type="button"
                class="association-remove-chip"
                onclick={() => removeItem(name)}
                aria-label="Remove {name}"
              >
                ×
              </button>
            </span>
          {/each}
        </div>
      {/if}

      {#if showInlineCreate}
        <div class="association-inline-create">
          <input
            type="text"
            bind:value={newEntityName}
            placeholder="Enter {property.name} name..."
            class="association-inline-input"
            data-testid="property-{propertyKey}-create-name"
          />
          <textarea
            bind:value={newEntityDescription}
            placeholder="Description (optional)..."
            rows="2"
            class="association-inline-textarea"
            data-testid="property-{propertyKey}-create-description"
          ></textarea>
          <div class="association-inline-buttons">
            <button
              type="button"
              onclick={handleCreateEntity}
              disabled={!newEntityName.trim() || creatingEntity}
              class="association-inline-create-button"
              data-testid="property-{propertyKey}-create-submit"
            >
              {creatingEntity ? "Creating..." : "Create"}
            </button>
            <button
              type="button"
              onclick={handleCancelCreate}
              disabled={creatingEntity}
              class="association-inline-cancel-button"
              data-testid="property-{propertyKey}-create-cancel"
            >
              Cancel
            </button>
          </div>
        </div>
      {/if}
    </div>
  </FieldGroup>
{/if}

{#if showDropdown && buttonEl && !showInlineCreate}
  <Dropdown
    anchor={buttonEl}
    items={dropdownItems}
    selectedValue={isMultiple ? undefined : selectedEntityIds[0]}
    selectedValues={isMultiple ? selectedEntityIds : undefined}
    onSelect={handleSelect}
    onClose={() => (showDropdown = false)}
    keepOpenOnSelect={false}
    searchable={true}
    searchPlaceholder="Search {property.name}..."
    testId="property-{propertyKey}-dropdown"
  />
{/if}

<style>
  .association-property-compact,
  .association-property-standard {
    position: relative;
  }

  .association-inline-create {
    margin-top: 8px;
    padding: 12px;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
  }

  .association-inline-input {
    width: 100%;
    padding: 8px 12px;
    font-size: var(--font-ui-small);
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    color: var(--text-normal);
    margin-bottom: 8px;
  }

  .association-inline-input:focus {
    outline: none;
    border-color: var(--interactive-accent);
  }

  .association-inline-input::placeholder {
    color: var(--text-muted);
  }

  .association-inline-textarea {
    width: 100%;
    padding: 8px 12px;
    font-size: var(--font-ui-small);
    font-family: var(--font-text);
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    color: var(--text-normal);
    resize: vertical;
    margin-bottom: 8px;
  }

  .association-inline-textarea:focus {
    outline: none;
    border-color: var(--interactive-accent);
  }

  .association-inline-textarea::placeholder {
    color: var(--text-muted);
  }

  .association-selected-items {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
  }

  .association-selected-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    background: var(--background-modifier-form-field);
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    font-size: var(--font-ui-smaller);
    color: var(--text-normal);
  }

  .association-remove-chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 50%;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 18px;
    line-height: 1;
    transition: all 0.15s ease;
  }

  .association-remove-chip:hover {
    background: var(--background-modifier-error-hover);
    color: var(--text-error);
  }

  .association-inline-buttons {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  .association-inline-create-button,
  .association-inline-cancel-button {
    padding: 6px 16px;
    font-size: var(--font-ui-small);
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .association-inline-create-button {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border: none;
  }

  .association-inline-create-button:hover:not(:disabled) {
    background: var(--interactive-accent-hover);
  }

  .association-inline-create-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .association-inline-cancel-button {
    background: transparent;
    color: var(--text-normal);
    border: 1px solid var(--background-modifier-border);
  }

  .association-inline-cancel-button:hover:not(:disabled) {
    background: var(--background-modifier-hover);
  }

  .association-inline-cancel-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
