<script lang="ts">
  import { getPluginContext } from "./context";
  import type { FileContext } from "../../main";
  import ContextWidget from "./ContextWidget.svelte";
  import { TFile } from "obsidian";

  // Props
  interface Props {
    context: FileContext;
  }

  let { context }: Props = $props();

  const { plugin } = getPluginContext();

  // State
  let entityData = $state<Record<string, any> | null>(null);
  let isLoading = $state(true);
  let error = $state<string | null>(null);

  // Badge elements for dynamic updates
  let typeBadgeEl = $state<HTMLElement>();
  let priorityBadgeEl = $state<HTMLElement>();
  let statusBadgeEl = $state<HTMLElement>();

  // Reactive computed properties
  let entityType = $derived.by(() => {
    if (!entityData) return "unknown";
    return entityData.Type || context.type || "unknown";
  });

  let entityTitle = $derived.by(() => {
    if (!entityData) return "Unknown";
    return entityData.Title || entityData.Name || context.name || "Unknown";
  });

  let entityProperties = $derived.by(() => {
    if (!entityData) return [];

    const properties = [];

    // Add properties based on entity type
    if (entityData.Type === "Task") {
      properties.push(
        { key: "Type", label: "Type", value: entityData.Type, type: "badge" },
        {
          key: "Category",
          label: "Category",
          value: entityData.Category,
          type: "badge",
        },
        {
          key: "Priority",
          label: "Priority",
          value: entityData.Priority,
          type: "badge",
        },
        {
          key: "Status",
          label: "Status",
          value: entityData.Status,
          type: "badge",
        },
        {
          key: "Done",
          label: "Done",
          value: entityData.Done,
          type: "checkbox",
        },
        {
          key: "Project",
          label: "Project",
          value: entityData.Project,
          type: "link",
        },
        {
          key: "Areas",
          label: "Areas",
          value: entityData.Areas,
          type: "array",
        },
        {
          key: "Parent task",
          label: "Parent Task",
          value: entityData["Parent task"],
          type: "link",
        },
        { key: "tags", label: "Tags", value: entityData.tags, type: "array" }
      );
    } else if (context.type === "project") {
      properties.push(
        { key: "Type", label: "Type", value: entityData.Type, type: "text" },
        {
          key: "Areas",
          label: "Areas",
          value: entityData.Areas,
          type: "array",
        },
        {
          key: "Status",
          label: "Status",
          value: entityData.Status,
          type: "text",
        },
        { key: "tags", label: "Tags", value: entityData.tags, type: "array" }
      );
    } else if (context.type === "area") {
      properties.push(
        { key: "Type", label: "Type", value: entityData.Type, type: "text" },
        {
          key: "Projects",
          label: "Projects",
          value: entityData.Projects,
          type: "array",
        },
        {
          key: "Status",
          label: "Status",
          value: entityData.Status,
          type: "text",
        },
        { key: "tags", label: "Tags", value: entityData.tags, type: "array" }
      );
    }

    // Filter out undefined/null values
    return properties.filter(
      (prop) => prop.value !== undefined && prop.value !== null
    );
  });

  // Load entity data when context changes
  $effect(() => {
    loadEntityData();
  });

  async function loadEntityData() {
    if (!context.path || context.type === "none") {
      entityData = null;
      isLoading = false;
      return;
    }

    try {
      isLoading = true;
      error = null;

      // Load front-matter based on entity type
      let frontMatter: Record<string, any>;

      if (context.path.startsWith(plugin.settings.tasksFolder)) {
        frontMatter = await plugin.taskFileManager.loadFrontMatter(
          context.path
        );
      } else if (context.path.startsWith(plugin.settings.projectsFolder)) {
        frontMatter = await plugin.projectFileManager.loadFrontMatter(
          context.path
        );
      } else if (context.path.startsWith(plugin.settings.areasFolder)) {
        frontMatter = await plugin.areaFileManager.loadFrontMatter(
          context.path
        );
      } else {
        // Try to determine type from file content using Obsidian's metadata cache
        const file = plugin.app.vault.getAbstractFileByPath(context.path);
        if (file && file instanceof TFile) {
          const cache = plugin.app.metadataCache.getFileCache(file);
          frontMatter = cache?.frontmatter || {};
        } else {
          throw new Error("File not found");
        }
      }

      entityData = frontMatter;

      // Update badges after data loads
      updateBadges();
    } catch (err) {
      console.error("Failed to load entity data:", err);
      error = err instanceof Error ? err.message : "Failed to load entity data";
      entityData = null;
    } finally {
      isLoading = false;
    }
  }

  function updateBadges() {
    if (!entityData) return;

    // Update type badge with color dot + label
    if (typeBadgeEl && entityData.Category) {
      const taskType = plugin.settings.taskTypes.find(
        (t) => t.name === entityData.Category
      );
      if (taskType) {
        typeBadgeEl.innerHTML = "";

        // Create color dot
        const dot = document.createElement("span");
        dot.className = "task-sync-color-dot";
        dot.style.backgroundColor = taskType.color;

        // Create label
        const label = document.createElement("span");
        label.textContent = taskType.name;

        typeBadgeEl.appendChild(dot);
        typeBadgeEl.appendChild(label);
      }
    }

    // Update priority badge with color dot + label
    if (priorityBadgeEl && entityData.Priority) {
      const priority = plugin.settings.taskPriorities.find(
        (p) => p.name === entityData.Priority
      );
      if (priority) {
        priorityBadgeEl.innerHTML = "";

        // Create color dot
        const dot = document.createElement("span");
        dot.className = "task-sync-color-dot";
        dot.style.backgroundColor = priority.color;

        // Create label
        const label = document.createElement("span");
        label.textContent = priority.name;

        priorityBadgeEl.appendChild(dot);
        priorityBadgeEl.appendChild(label);
      }
    }

    // Update status badge with color dot + label
    if (statusBadgeEl && entityData.Status) {
      const status = plugin.settings.taskStatuses.find(
        (s) => s.name === entityData.Status
      );
      if (status) {
        statusBadgeEl.innerHTML = "";

        // Create color dot
        const dot = document.createElement("span");
        dot.className = "task-sync-color-dot";
        dot.style.backgroundColor = status.color;

        // Create label
        const label = document.createElement("span");
        label.textContent = status.name;

        statusBadgeEl.appendChild(dot);
        statusBadgeEl.appendChild(label);
      }
    }
  }

  function formatPropertyValue(property: any): string {
    if (property.value === undefined || property.value === null) {
      return "—";
    }

    switch (property.type) {
      case "checkbox":
        return property.value ? "✓" : "✗";
      case "array":
        if (Array.isArray(property.value)) {
          return property.value.length > 0 ? property.value.join(", ") : "—";
        }
        return String(property.value);
      case "link":
        if (
          typeof property.value === "string" &&
          property.value.includes("[[")
        ) {
          // Extract link text from [[Link]] format
          return property.value.replace(/\[\[([^\]]+)\]\]/g, "$1");
        }
        return String(property.value);
      default:
        return String(property.value);
    }
  }

  function handleEditEntity() {
    if (!context.path) return;

    // Open the file for editing
    plugin.app.workspace.openLinkText(context.path, "", false);
  }

  function handleDeleteEntity() {
    if (!context.path) return;

    // Show confirmation and delete file
    const confirmed = confirm(
      `Are you sure you want to delete ${entityTitle}?`
    );
    if (confirmed) {
      const file = plugin.app.vault.getAbstractFileByPath(context.path);
      if (file) {
        plugin.app.vault.delete(file);
      }
    }
  }

  function handleCreateTask() {
    // Open task creation modal by triggering the command callback
    const commands = (plugin.app as any).commands?.commands;
    const addTaskCommand = commands?.["obsidian-task-sync:add-task"];
    if (addTaskCommand?.callback) {
      addTaskCommand.callback();
    }
  }

  function handleRefreshBases() {
    // Refresh base views by triggering the command callback
    const commands = (plugin.app as any).commands?.commands;
    const refreshCommand = commands?.["obsidian-task-sync:refresh-base-views"];
    if (refreshCommand?.callback) {
      refreshCommand.callback();
    }
  }
</script>

<div class="context-tab-view" data-testid="context-tab-view">
  <!-- Context Widget -->
  <div class="context-tab-header">
    <ContextWidget />
  </div>

  <!-- Content Area -->
  <div class="context-tab-content">
    {#if isLoading}
      <div class="context-tab-loading">
        <div class="task-sync-spinner"></div>
        <p>Loading entity data...</p>
      </div>
    {:else if error}
      <div class="context-tab-error">
        <div class="error-icon">⚠️</div>
        <h3>Error Loading Entity</h3>
        <p>{error}</p>
        <button class="task-sync-button" onclick={loadEntityData}>
          Retry
        </button>
      </div>
    {:else if !entityData || context.type === "none"}
      <div class="context-tab-empty">
        <div class="empty-icon">📄</div>
        <h3>No Entity Selected</h3>
        <p>
          Open a task, project, or area file to view its properties and actions.
        </p>
        <div class="empty-actions">
          <button class="task-sync-button mod-cta" onclick={handleCreateTask}>
            Create Task
          </button>
        </div>
      </div>
    {:else}
      <!-- Entity Details -->
      <div class="context-tab-entity">
        <!-- Entity Header -->
        <div class="entity-header">
          <h2 class="entity-title">{entityTitle}</h2>
          <div class="entity-type-indicator">
            {entityType}
          </div>
        </div>

        <!-- Properties Section -->
        <div class="entity-properties">
          <h3 class="properties-title">Properties</h3>
          <div class="properties-list">
            {#each entityProperties as property}
              <div class="property-item" data-testid="property-{property.key}">
                <div class="property-label">{property.label}</div>
                <div class="property-value">
                  {#if property.type === "badge" && property.key === "Category"}
                    <div
                      bind:this={typeBadgeEl}
                      class="property-badge-container"
                    >
                      {formatPropertyValue(property)}
                    </div>
                  {:else if property.type === "badge" && property.key === "Priority"}
                    <div
                      bind:this={priorityBadgeEl}
                      class="property-badge-container"
                    >
                      {formatPropertyValue(property)}
                    </div>
                  {:else if property.type === "badge" && property.key === "Status"}
                    <div
                      bind:this={statusBadgeEl}
                      class="property-badge-container"
                    >
                      {formatPropertyValue(property)}
                    </div>
                  {:else if property.type === "checkbox"}
                    <div
                      class="property-checkbox {property.value
                        ? 'checked'
                        : 'unchecked'}"
                    >
                      {formatPropertyValue(property)}
                    </div>
                  {:else if property.type === "array" && Array.isArray(property.value) && property.value.length > 0}
                    <div class="property-array">
                      {#each property.value as item}
                        <span class="array-item"
                          >{item.replace(/\[\[([^\]]+)\]\]/g, "$1")}</span
                        >
                      {/each}
                    </div>
                  {:else}
                    <div class="property-text">
                      {formatPropertyValue(property)}
                    </div>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        </div>

        <!-- Actions Section -->
        <div class="entity-actions">
          <h3 class="actions-title">Actions</h3>
          <div class="actions-grid">
            <button
              class="task-sync-button action-button"
              onclick={handleEditEntity}
              data-testid="edit-entity-button"
            >
              <span class="action-icon">✏️</span>
              Edit {entityType}
            </button>

            <button
              class="task-sync-button action-button"
              onclick={handleCreateTask}
              data-testid="create-task-button"
            >
              <span class="action-icon">➕</span>
              Create Task
            </button>

            <button
              class="task-sync-button action-button"
              onclick={handleRefreshBases}
              data-testid="refresh-bases-button"
            >
              <span class="action-icon">🔄</span>
              Refresh Bases
            </button>

            <button
              class="task-sync-button action-button mod-warning"
              onclick={handleDeleteEntity}
              data-testid="delete-entity-button"
            >
              <span class="action-icon">🗑️</span>
              Delete {entityType}
            </button>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>
