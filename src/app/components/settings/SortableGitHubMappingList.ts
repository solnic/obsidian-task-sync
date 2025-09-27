/**
 * Sortable GitHub Mapping List Component
 * Provides drag-and-drop functionality for reordering GitHub organization/repository mappings
 * Adapted from old-stuff for the new architecture
 */

import { GitHubOrgRepoMapping } from "../../types/settings";

export interface SortableGitHubMappingListOptions {
  container: HTMLElement;
  mappings: GitHubOrgRepoMapping[];
  onReorder: (newOrder: GitHubOrgRepoMapping[]) => void;
  onUpdate: (index: number, mapping: GitHubOrgRepoMapping) => void;
  onDelete: (index: number) => void;
  onAdd: () => void;
}

export class SortableGitHubMappingList {
  private container: HTMLElement;
  private mappings: GitHubOrgRepoMapping[];
  private onReorder: (newOrder: GitHubOrgRepoMapping[]) => void;
  private onUpdate: (index: number, mapping: GitHubOrgRepoMapping) => void;
  private onDelete: (index: number) => void;
  private onAdd: () => void;
  private listElement: HTMLElement;
  private draggedElement: HTMLElement | null = null;
  private draggedIndex: number = -1;

  constructor(options: SortableGitHubMappingListOptions) {
    this.container = options.container;
    this.mappings = [...options.mappings];
    this.onReorder = options.onReorder;
    this.onUpdate = options.onUpdate;
    this.onDelete = options.onDelete;
    this.onAdd = options.onAdd;
    this.listElement = this.container.createDiv("sortable-github-mapping-list");

    this.render();
    this.addStyles();
  }

  private addStyles(): void {
    // Only add styles once
    if (document.getElementById("sortable-github-mapping-list-styles")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "sortable-github-mapping-list-styles";
    style.textContent = `
      .sortable-github-mapping-list {
        border: 1px solid var(--background-modifier-border);
        border-radius: 6px;
        background: var(--background-primary);
        overflow: hidden;
      }

      .github-mapping-item {
        display: flex;
        align-items: center;
        padding: 12px;
        border-bottom: 1px solid var(--background-modifier-border-hover);
        cursor: move;
        transition: background-color 0.2s ease;
        user-select: none;
        gap: 12px;
      }

      .github-mapping-item:last-child {
        border-bottom: none;
      }

      .github-mapping-item:hover {
        background: var(--background-modifier-hover);
      }

      .github-mapping-item.dragging {
        opacity: 0.5;
        background: var(--background-modifier-active-hover);
      }

      .github-mapping-item.drag-over {
        background: var(--interactive-accent-hover);
        border-color: var(--interactive-accent);
      }

      .mapping-drag-handle {
        color: var(--text-muted);
        font-size: 14px;
        cursor: grab;
      }

      .mapping-drag-handle:active {
        cursor: grabbing;
      }

      .mapping-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .mapping-primary {
        font-weight: 500;
        color: var(--text-normal);
      }

      .mapping-secondary {
        font-size: 12px;
        color: var(--text-muted);
      }

      .mapping-actions {
        display: flex;
        gap: 8px;
      }

      .mapping-actions button {
        padding: 4px 8px;
        font-size: 12px;
      }

      .github-mapping-add-button {
        margin-top: 12px;
        width: 100%;
      }
    `;
    document.head.appendChild(style);
  }

  private render(): void {
    this.listElement.empty();

    if (this.mappings.length === 0) {
      const emptyState = this.listElement.createDiv("github-mapping-item");
      emptyState.style.cursor = "default";
      emptyState.style.textAlign = "center";
      emptyState.style.color = "var(--text-muted)";
      emptyState.textContent = "No GitHub mappings configured";
    } else {
      this.mappings.forEach((mapping, index) => {
        this.renderMappingItem(mapping, index);
      });
    }

    // Add button
    const addButton = this.container.createEl("button", {
      text: "Add GitHub Mapping",
      cls: "github-mapping-add-button",
    });
    addButton.onclick = () => this.onAdd();
  }

  private renderMappingItem(
    mapping: GitHubOrgRepoMapping,
    index: number
  ): void {
    const item = this.listElement.createDiv("github-mapping-item");
    item.draggable = true;
    item.dataset.index = index.toString();

    // Drag handle
    const handle = item.createSpan("mapping-drag-handle");
    handle.innerHTML = "⋮⋮";

    // Content
    const content = item.createDiv("mapping-content");
    const primary = content.createDiv("mapping-primary");
    const secondary = content.createDiv("mapping-secondary");

    // Display mapping info
    if (mapping.organization) {
      primary.textContent = `Organization: ${mapping.organization}`;
    } else if (mapping.repository) {
      primary.textContent = `Repository: ${mapping.repository}`;
    } else {
      primary.textContent = "Empty mapping";
    }

    const targets = [];
    if (mapping.targetArea) targets.push(`Area: ${mapping.targetArea}`);
    if (mapping.targetProject)
      targets.push(`Project: ${mapping.targetProject}`);
    secondary.textContent =
      targets.length > 0 ? targets.join(", ") : "No targets set";

    // Actions
    const actions = item.createDiv("mapping-actions");

    const editButton = actions.createEl("button", {
      text: "Edit",
      cls: "mod-muted",
    });
    editButton.onclick = (e) => {
      e.stopPropagation();
      this.editMapping(index);
    };

    const deleteButton = actions.createEl("button", {
      text: "Delete",
      cls: "mod-warning",
    });
    deleteButton.onclick = (e) => {
      e.stopPropagation();
      this.onDelete(index);
    };

    // Add drag listeners
    this.addDragListeners(item);
  }

  private editMapping(index: number): void {
    // For now, just trigger the update callback
    // In a full implementation, this would open an edit modal
    this.onUpdate(index, this.mappings[index]);
  }

  private addDragListeners(item: HTMLElement): void {
    item.addEventListener("dragstart", (e) => {
      this.draggedElement = item;
      this.draggedIndex = parseInt(item.dataset.index || "-1");
      item.classList.add("dragging");

      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/html", item.outerHTML);
      }
    });

    item.addEventListener("dragend", () => {
      item.classList.remove("dragging");
      this.draggedElement = null;
      this.draggedIndex = -1;

      this.listElement
        .querySelectorAll(".github-mapping-item")
        .forEach((el) => {
          el.classList.remove("drag-over");
        });
    });

    item.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = "move";
      }
    });

    item.addEventListener("dragenter", (e) => {
      e.preventDefault();
      if (this.draggedElement && item !== this.draggedElement) {
        item.classList.add("drag-over");
      }
    });

    item.addEventListener("dragleave", (e) => {
      if (!item.contains(e.relatedTarget as Node)) {
        item.classList.remove("drag-over");
      }
    });

    item.addEventListener("drop", (e) => {
      e.preventDefault();
      item.classList.remove("drag-over");

      if (this.draggedElement && item !== this.draggedElement) {
        const targetIndex = parseInt(item.dataset.index || "-1");
        this.moveMapping(this.draggedIndex, targetIndex);
      }
    });
  }

  private moveMapping(fromIndex: number, toIndex: number): void {
    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
      return;
    }

    const newMappings = [...this.mappings];
    const [movedMapping] = newMappings.splice(fromIndex, 1);
    newMappings.splice(toIndex, 0, movedMapping);

    this.mappings = newMappings;
    this.onReorder(newMappings);
    this.render();
  }

  public updateMappings(newMappings: GitHubOrgRepoMapping[]): void {
    this.mappings = [...newMappings];
    this.render();
  }

  public destroy(): void {
    this.listElement.remove();
  }
}
