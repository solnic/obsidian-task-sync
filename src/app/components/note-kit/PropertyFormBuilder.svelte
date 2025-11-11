<!--
  Property Form Builder - Clean version matching Task Create modal style
  - No visible labels (uses placeholders)
  - Button-style dropdowns for select/enum
  - Horizontal layout for property buttons
  - Clean collapsible section for optional properties
-->
<script lang="ts">
  import { onMount } from "svelte";
  import {
    StringProperty,
    NumberProperty,
    BooleanProperty,
    DateProperty,
    EnumProperty,
    ArrayProperty,
    SelectProperty,
  } from "./properties";
  import type {
    PropertyDefinition,
    ValidationResult,
    NoteType,
  } from "../../core/note-kit/types";
  import { validateProperty } from "../../core/note-kit/validation";
  import type { NoteProcessor } from "../../core/note-kit/note-processor";

  interface Props {
    properties: Record<string, PropertyDefinition>;
    values?: Record<string, any>;
    onvalueschange?: (values: Record<string, any>) => void;
    onvalidationchange?: (validation: Record<string, ValidationResult>) => void;
    showOptionalProperties?: boolean;
    noteType?: NoteType;
    noteProcessor?: NoteProcessor;
    templateContent?: string;
    ontemplatecontentchange?: (content: string) => void;
  }

  let {
    properties,
    values = $bindable({}),
    onvalueschange,
    onvalidationchange,
    showOptionalProperties = true,
    noteType,
    noteProcessor,
    templateContent = $bindable(""),
    ontemplatecontentchange,
  }: Props = $props();

  // Internal state
  let validationResults: Record<string, ValidationResult> = $state({});
  let showOptional = $state(false);

  // Helper to check if property is a "button-style" property (select/enum)
  function isButtonProperty(prop: PropertyDefinition): boolean {
    return prop.type === "select" || prop.type === "enum";
  }

  // Helper to check if property is a text-like property (string, number, date, array)
  function isTextProperty(prop: PropertyDefinition): boolean {
    return (
      prop.type === "string" ||
      prop.type === "number" ||
      prop.type === "date" ||
      prop.type === "array"
    );
  }

  // Filter out hidden properties
  const visibleProperties = $derived(
    Object.entries(properties).filter(([_, prop]) => !prop.form?.hidden)
  );

  // Separate main property (only one should be marked as main)
  const mainProperty = $derived(
    visibleProperties.find(([_, prop]) => prop.form?.main)
  );

  // Separate required properties by type (excluding main property)
  const requiredTextProperties = $derived(
    visibleProperties
      .filter(([key, prop]) => {
        const isMain = mainProperty && mainProperty[0] === key;
        return prop.required && isTextProperty(prop) && !isMain;
      })
      .sort(([_, a], [__, b]) => {
        const orderA = a.order ?? 999;
        const orderB = b.order ?? 999;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name);
      })
  );

  const requiredButtonProperties = $derived(
    visibleProperties
      .filter(([_, prop]) => prop.required && isButtonProperty(prop))
      .sort(([_, a], [__, b]) => {
        const orderA = a.order ?? 999;
        const orderB = b.order ?? 999;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name);
      })
  );

  const requiredBooleanProperties = $derived(
    visibleProperties
      .filter(([_, prop]) => prop.required && prop.type === "boolean")
      .sort(([_, a], [__, b]) => {
        const orderA = a.order ?? 999;
        const orderB = b.order ?? 999;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name);
      })
  );

  const optionalProperties = $derived(
    visibleProperties
      .filter(([_, prop]) => !prop.required)
      .sort(([_, a], [__, b]) => {
        const orderA = a.order ?? 999;
        const orderB = b.order ?? 999;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name);
      })
  );

  onMount(() => {
    initializeValues();
  });

  function initializeValues() {
    const newValues = { ...values };
    let hasChanges = false;

    for (const [key, prop] of Object.entries(properties)) {
      // Use property key, not frontMatterKey
      if (values[key] === undefined && prop.defaultValue !== undefined) {
        newValues[key] = prop.defaultValue;
        hasChanges = true;
      }
    }

    if (hasChanges) {
      values = newValues;
      onvalueschange?.(values);
    }
  }

  function handleValueChange(propertyKey: string, value: any) {
    const newValues = { ...values };
    // Use property key, not frontMatterKey
    newValues[propertyKey] = value;
    values = newValues;
    onvalueschange?.(values);

    // Validate
    const property = properties[propertyKey];
    if (property) {
      const result = validateProperty(property, value);
      validationResults[propertyKey] = result;
      onvalidationchange?.(validationResults);
    }
  }

  function renderProperty(property: PropertyDefinition) {
    switch (property.type) {
      case "string":
        return StringProperty;
      case "number":
        return NumberProperty;
      case "boolean":
        return BooleanProperty;
      case "date":
        return DateProperty;
      case "enum":
        return EnumProperty;
      case "array":
        return ArrayProperty;
      case "select":
        return SelectProperty;
      default:
        return null;
    }
  }

  function toggleOptional() {
    showOptional = !showOptional;
  }

  // Track the current note type ID to detect when it changes
  let currentNoteTypeId = $state<string | null>(null);

  // Initialize template content only when note type changes (not on every property update)
  $effect(() => {
    // Only update template content when note type changes, not when properties change
    if (noteType && noteType.id !== currentNoteTypeId) {
      currentNoteTypeId = noteType.id;

      // Evaluate template with current property values
      if (noteProcessor && noteType.template) {
        const result = noteProcessor.processTemplate(noteType, values, {
          validateVariables: false,
          allowUndefinedVariables: true,
        });

        if (result.success && result.content) {
          templateContent = result.content;
          ontemplatecontentchange?.(templateContent);
        }
      }
    }
  });

  // Call the callback when template content changes (user edits)
  $effect(() => {
    ontemplatecontentchange?.(templateContent);
  });
</script>

<!-- Main property (rendered first) -->
{#if mainProperty}
  {@const [propertyKey, property] = mainProperty}
  {@const Component = renderProperty(property)}
  {#if Component}
    <Component
      {property}
      {propertyKey}
      onvaluechange={(newValue) => handleValueChange(propertyKey, newValue)}
      validationResult={validationResults[propertyKey]}
      compact={true}
    />
  {/if}
{/if}

<!-- Template content textarea (if note type has a template) -->
{#if noteType?.template?.content}
  <div class="task-sync-template-content">
    <textarea
      bind:value={templateContent}
      placeholder="Note content (edit template as needed)..."
      rows="8"
      class="task-sync-template-textarea"
      data-testid="template-content-textarea"
    ></textarea>
  </div>
{/if}

<!-- Required text properties (title, description, etc.) -->
{#each requiredTextProperties as [propertyKey, property]}
  {@const Component = renderProperty(property)}
  {#if Component}
    <Component
      {property}
      {propertyKey}
      onvaluechange={(newValue) => handleValueChange(propertyKey, newValue)}
      validationResult={validationResults[propertyKey]}
      compact={true}
    />
  {/if}
{/each}

<!-- Required button properties (select/enum) in horizontal row with optional toggle -->
{#if requiredButtonProperties.length > 0 || optionalProperties.length > 0}
  <div class="task-sync-property-controls">
    {#each requiredButtonProperties as [propertyKey, property]}
      {@const Component = renderProperty(property)}
      {#if Component}
        <Component
          {property}
          {propertyKey}
          onvaluechange={(newValue) => handleValueChange(propertyKey, newValue)}
          validationResult={validationResults[propertyKey]}
          compact={true}
        />
      {/if}
    {/each}

    <!-- Three-dots button for optional properties -->
    {#if optionalProperties.length > 0}
      <button
        type="button"
        onclick={toggleOptional}
        class="task-sync-property-button task-sync-more-button"
        data-testid="toggle-optional-properties"
        title="More options"
      >
        <span class="task-sync-more-dots">⋯</span>
      </button>
    {/if}
  </div>
{/if}

<!-- Required boolean properties -->
{#each requiredBooleanProperties as [propertyKey, property]}
  {@const Component = renderProperty(property)}
  {#if Component}
    <Component
      {property}
      {propertyKey}
      onvaluechange={(newValue) => handleValueChange(propertyKey, newValue)}
      validationResult={validationResults[propertyKey]}
    />
  {/if}
{/each}

<!-- Optional Properties Section (collapsible) -->
{#if showOptional}
  <div class="task-sync-extra-fields">
    {#each optionalProperties as [propertyKey, property]}
      {@const Component = renderProperty(property)}
      {#if Component}
        <div class="task-sync-field-group">
          <Component
            {property}
            {propertyKey}
            onvaluechange={(newValue) =>
              handleValueChange(propertyKey, newValue)}
            validationResult={validationResults[propertyKey]}
          />
        </div>
      {/if}
    {/each}
  </div>
{/if}

<style>
  .task-sync-property-controls {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 16px 0;
  }

  .task-sync-extra-fields {
    margin-top: 12px;
    padding: 16px;
    background: var(--background-secondary);
    border-radius: 6px;
    border: 1px solid var(--background-modifier-border);
  }

  .task-sync-field-group {
    margin-bottom: 16px;
  }

  .task-sync-field-group:last-child {
    margin-bottom: 0;
  }

  .task-sync-template-content {
    margin: 16px 0;
  }

  .task-sync-template-textarea {
    width: 100%;
    min-height: 150px;
    padding: 12px;
    font-family: var(--font-monospace);
    font-size: var(--font-ui-small);
    line-height: 1.5;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    resize: vertical;
    color: var(--text-normal);
  }

  .task-sync-template-textarea:focus {
    outline: none;
    border-color: var(--interactive-accent);
  }

  .task-sync-template-textarea::placeholder {
    color: var(--text-muted);
  }
</style>
