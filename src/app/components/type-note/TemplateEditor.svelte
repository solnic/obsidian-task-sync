<script lang="ts">
  import { onMount } from "svelte";
  import type { Template } from "../../core/type-note/types";

  interface Props {
    template: Template;
    onchange?: (template: Template) => void;
    properties?: Record<string, any>;
  }

  let { template = $bindable(), onchange, properties = {} }: Props = $props();

  // State
  let templateContent = $state(template.content || "");
  let templateVersion = $state(template.version || "1.0.0");
  let showPreview = $state(false);
  let previewContent = $state("");

  // UI references
  let textareaEl: HTMLTextAreaElement;

  onMount(() => {
    updatePreview();
  });

  function handleContentChange() {
    template = {
      ...template,
      content: templateContent,
      version: templateVersion,
    };
    onchange?.(template);
    updatePreview();
  }

  function handleVersionChange() {
    template = {
      ...template,
      version: templateVersion,
    };
    onchange?.(template);
  }

  function updatePreview() {
    try {
      // Simple template variable replacement for preview
      let content = templateContent;

      // Replace property variables
      Object.entries(properties).forEach(([key, value]) => {
        const regex = new RegExp(`{{\\s*${key}\\s*}}`, "g");
        content = content.replace(regex, String(value || `[${key}]`));
      });

      // Replace common variables
      content = content.replace(/{{title}}/g, "[Title]");
      content = content.replace(/{{description}}/g, "[Description]");
      content = content.replace(
        /{{date}}/g,
        new Date().toISOString().split("T")[0]
      );
      content = content.replace(/{{time}}/g, new Date().toLocaleTimeString());

      previewContent = content;
    } catch (error) {
      previewContent = "Error in template: " + error.message;
    }
  }

  function insertVariable(variable: string) {
    if (!textareaEl) return;

    const start = textareaEl.selectionStart;
    const end = textareaEl.selectionEnd;
    const before = templateContent.substring(0, start);
    const after = templateContent.substring(end);

    templateContent = before + `{{${variable}}}` + after;

    // Set cursor position after the inserted variable
    setTimeout(() => {
      textareaEl.focus();
      textareaEl.setSelectionRange(
        start + variable.length + 4,
        start + variable.length + 4
      );
    }, 0);

    handleContentChange();
  }

  function togglePreview() {
    showPreview = !showPreview;
    if (showPreview) {
      updatePreview();
    }
  }

  // Available variables for insertion
  let availableVariables = $derived([
    "title",
    "description",
    "date",
    "time",
    ...Object.keys(properties),
  ]);

  // Reactive updates
  $effect(() => {
    if (templateContent !== template.content) {
      templateContent = template.content || "";
    }
  });

  $effect(() => {
    if (templateVersion !== template.version) {
      templateVersion = template.version || "1.0.0";
    }
  });
</script>

<div class="template-editor">
  <div class="editor-header">
    <h4>Template</h4>
    <div class="editor-controls">
      <div class="version-control">
        <label for="template-version">Version:</label>
        <input
          id="template-version"
          type="text"
          bind:value={templateVersion}
          onchange={handleVersionChange}
          placeholder="1.0.0"
          class="version-input"
          data-testid="template-version-input"
        />
      </div>
      <button
        type="button"
        class="preview-button"
        class:active={showPreview}
        onclick={togglePreview}
        data-testid="toggle-preview-button"
      >
        {showPreview ? "Hide" : "Show"} Preview
      </button>
    </div>
  </div>

  <div class="editor-content" class:split-view={showPreview}>
    <!-- Template editor -->
    <div class="editor-panel">
      <div class="editor-toolbar">
        <span class="toolbar-label">Variables:</span>
        {#each availableVariables as variable}
          <button
            type="button"
            class="variable-button"
            onclick={() => insertVariable(variable)}
            data-testid="insert-{variable}-button"
            title="Insert {`{{${variable}}}`}"
          >
            {variable}
          </button>
        {/each}
      </div>

      <textarea
        bind:this={textareaEl}
        bind:value={templateContent}
        oninput={handleContentChange}
        placeholder="Enter your template content here...

Use double curly braces to insert dynamic values:
- title - Note title
- description - Note description
- date - Current date
- time - Current time

You can also use any property defined above."
        class="template-textarea"
        data-testid="template-content-textarea"
        rows="15"
      ></textarea>

      <div class="editor-help">
        <p><strong>Template Syntax:</strong></p>
        <ul>
          <li><code>{"{{variable}}"}</code> - Insert property value</li>
          <li><code>{"{{title}}"}</code> - Note title</li>
          <li><code>{"{{description}}"}</code> - Note description</li>
          <li><code>{"{{date}}"}</code> - Current date</li>
          <li><code>{"{{time}}"}</code> - Current time</li>
        </ul>
      </div>
    </div>

    <!-- Preview panel -->
    {#if showPreview}
      <div class="preview-panel">
        <h5>Preview</h5>
        <div class="preview-content" data-testid="template-preview">
          {#if previewContent}
            <pre>{previewContent}</pre>
          {:else}
            <p class="preview-empty">Template preview will appear here</p>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .template-editor {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .editor-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .editor-header h4 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
  }

  .editor-controls {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .version-control {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
  }

  .version-input {
    width: 80px;
    padding: 0.25rem 0.5rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 3px;
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: 0.85rem;
    font-family: var(--font-monospace);
  }

  .version-input:focus {
    outline: none;
    border-color: var(--interactive-accent);
  }

  .preview-button {
    padding: 0.5rem 1rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    background: var(--background-primary);
    color: var(--text-normal);
    cursor: pointer;
    font-size: 0.85rem;
  }

  .preview-button:hover {
    background: var(--background-modifier-hover);
  }

  .preview-button.active {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-color: var(--interactive-accent);
  }

  .editor-content {
    display: flex;
    gap: 1rem;
  }

  .editor-content.split-view .editor-panel {
    flex: 1;
  }

  .editor-panel {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .editor-toolbar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px 4px 0 0;
    flex-wrap: wrap;
  }

  .toolbar-label {
    font-size: 0.8rem;
    color: var(--text-muted);
    font-weight: 500;
  }

  .variable-button {
    padding: 0.2rem 0.5rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 3px;
    background: var(--background-primary);
    color: var(--text-normal);
    cursor: pointer;
    font-size: 0.75rem;
    font-family: var(--font-monospace);
  }

  .variable-button:hover {
    background: var(--background-modifier-hover);
  }

  .template-textarea {
    width: 100%;
    padding: 1rem;
    border: 1px solid var(--background-modifier-border);
    border-top: none;
    border-radius: 0 0 4px 4px;
    background: var(--background-primary);
    color: var(--text-normal);
    font-family: var(--font-monospace);
    font-size: 0.9rem;
    line-height: 1.5;
    resize: vertical;
    min-height: 300px;
  }

  .template-textarea:focus {
    outline: none;
    border-color: var(--interactive-accent);
    box-shadow: 0 0 0 2px var(--interactive-accent-hover);
  }

  .editor-help {
    padding: 1rem;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    font-size: 0.85rem;
  }

  .editor-help p {
    margin: 0 0 0.5rem 0;
    font-weight: 600;
  }

  .editor-help ul {
    margin: 0;
    padding-left: 1.5rem;
  }

  .editor-help li {
    margin-bottom: 0.25rem;
  }

  .editor-help code {
    background: var(--background-modifier-border);
    padding: 0.1rem 0.3rem;
    border-radius: 2px;
    font-family: var(--font-monospace);
    font-size: 0.8rem;
  }

  .preview-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .preview-panel h5 {
    margin: 0;
    font-size: 0.9rem;
    font-weight: 600;
  }

  .preview-content {
    flex: 1;
    padding: 1rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    background: var(--background-secondary);
    overflow-y: auto;
    min-height: 300px;
  }

  .preview-content pre {
    margin: 0;
    font-family: var(--font-text);
    font-size: 0.9rem;
    line-height: 1.5;
    white-space: pre-wrap;
    word-wrap: break-word;
  }

  .preview-empty {
    margin: 0;
    color: var(--text-muted);
    font-style: italic;
    text-align: center;
    padding: 2rem;
  }
</style>
