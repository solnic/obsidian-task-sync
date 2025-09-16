/**
 * Sortable GitHub Mapping List Component
 * Provides drag-and-drop functionality for reordering GitHub organization/repository mappings
 */

import { GitHubOrgRepoMapping } from "./types";

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
      .github-mapping-section-description {
        background: var(--background-secondary);
        border: 1px solid var(--background-modifier-border);
        border-radius: 6px;
        padding: 12px;
        margin-bottom: 16px;
        font-size: 13px;
        line-height: 1.4;
        color: var(--text-muted);
      }

      .github-mapping-section-description p {
        margin: 0 0 8px 0;
      }

      .github-mapping-section-description p:last-child {
        margin-bottom: 0;
      }

      .github-mapping-section-description strong {
        color: var(--text-normal);
      }

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
        flex-shrink: 0;
      }

      .mapping-drag-handle:active {
        cursor: grabbing;
      }

      .mapping-source {
        display: flex;
        flex-direction: column;
        gap: 4px;
        flex: 1;
        min-width: 0;
      }

      .mapping-source-field {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .mapping-source-label {
        font-size: 11px;
        color: var(--text-muted);
        text-transform: uppercase;
        font-weight: 500;
        min-width: 30px;
        flex-shrink: 0;
      }

      .mapping-source-input {
        flex: 1;
        padding: 4px 8px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        background: var(--background-primary);
        color: var(--text-normal);
        font-size: 12px;
        min-width: 0;
      }

      .mapping-source-input:focus {
        outline: none;
        border-color: var(--interactive-accent);
      }

      .mapping-arrow {
        color: var(--text-muted);
        font-size: 16px;
        flex-shrink: 0;
        margin: 0 4px;
      }

      .mapping-target {
        display: flex;
        flex-direction: column;
        gap: 4px;
        flex: 1;
        min-width: 0;
      }

      .mapping-target-field {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .mapping-target-label {
        font-size: 11px;
        color: var(--text-muted);
        text-transform: uppercase;
        font-weight: 500;
        min-width: 40px;
        flex-shrink: 0;
      }

      .mapping-target-input {
        flex: 1;
        padding: 4px 8px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        background: var(--background-primary);
        color: var(--text-normal);
        font-size: 12px;
        min-width: 0;
      }

      .mapping-target-input:focus {
        outline: none;
        border-color: var(--interactive-accent);
      }

      .mapping-actions {
        display: flex;
        gap: 4px;
        flex-shrink: 0;
      }

      .mapping-delete-btn {
        padding: 4px 8px;
        border: 1px solid var(--background-modifier-border);
        background: var(--background-primary);
        color: var(--text-muted);
        border-radius: 4px;
        cursor: pointer;
        font-size: 11px;
        transition: all 0.2s ease;
      }

      .mapping-delete-btn:hover {
        background: var(--background-modifier-error);
        border-color: var(--text-error);
        color: var(--text-error);
      }

      .github-mapping-add-section {
        margin-top: 12px;
        display: flex;
        justify-content: flex-end;
      }

      .github-mapping-add-btn {
        padding: 6px 12px;
        border: 1px solid var(--interactive-accent);
        background: var(--interactive-accent);
        color: var(--text-on-accent);
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 500;
        transition: all 0.2s ease;
      }

      .github-mapping-add-btn:hover {
        background: var(--interactive-accent-hover);
        border-color: var(--interactive-accent-hover);
      }

      .github-mapping-empty {
        padding: 24px;
        text-align: center;
        color: var(--text-muted);
        font-size: 13px;
        border: 2px dashed var(--background-modifier-border);
        border-radius: 6px;
        background: var(--background-secondary);
      }
    `;
    document.head.appendChild(style);
  }

  private render(): void {
    this.container.empty();

    // Add description
    const description = this.container.createDiv(
      "github-mapping-section-description"
    );
    description.innerHTML = `
      <p><strong>GitHub Organization/Repository Mappings</strong></p>
      <p>Map GitHub organizations and repositories to specific areas and projects. When importing issues or pull requests, they will be automatically assigned to the configured area/project.</p>
      <p><strong>Repository mappings</strong> take precedence over organization mappings. Higher priority mappings (drag to top) are evaluated first.</p>
    `;

    // Create list container
    this.listElement = this.container.createDiv("sortable-github-mapping-list");

    if (this.mappings.length === 0) {
      const emptyState = this.listElement.createDiv("github-mapping-empty");
      emptyState.textContent =
        "No mappings configured. Click 'Add Mapping' to create your first mapping.";
    } else {
      this.mappings.forEach((mapping, index) => {
        this.renderMappingItem(mapping, index);
      });
    }

    // Add button
    const addSection = this.container.createDiv("github-mapping-add-section");
    const addButton = addSection.createEl("button", {
      text: "Add Mapping",
      cls: "github-mapping-add-btn",
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
    handle.innerHTML = "⋮⋮"; // Vertical dots

    // Source section (org/repo)
    const source = item.createDiv("mapping-source");

    const orgField = source.createDiv("mapping-source-field");
    orgField.createSpan("mapping-source-label").textContent = "Org";
    const orgInput = orgField.createEl("input", {
      cls: "mapping-source-input",
    });
    orgInput.type = "text";
    orgInput.placeholder = "organization-name";
    orgInput.value = mapping.organization || "";
    orgInput.oninput = () => {
      const updatedMapping = {
        ...mapping,
        organization: orgInput.value.trim() || undefined,
      };
      this.onUpdate(index, updatedMapping);
    };

    const repoField = source.createDiv("mapping-source-field");
    repoField.createSpan("mapping-source-label").textContent = "Repo";
    const repoInput = repoField.createEl("input", {
      cls: "mapping-source-input",
    });
    repoInput.type = "text";
    repoInput.placeholder = "owner/repository";
    repoInput.value = mapping.repository || "";
    repoInput.oninput = () => {
      const updatedMapping = {
        ...mapping,
        repository: repoInput.value.trim() || undefined,
      };
      this.onUpdate(index, updatedMapping);
    };

    // Arrow
    const arrow = item.createSpan("mapping-arrow");
    arrow.innerHTML = "→";

    // Target section (area/project)
    const target = item.createDiv("mapping-target");

    const areaField = target.createDiv("mapping-target-field");
    areaField.createSpan("mapping-target-label").textContent = "Area";
    const areaInput = areaField.createEl("input", {
      cls: "mapping-target-input",
    });
    areaInput.type = "text";
    areaInput.placeholder = "Area name";
    areaInput.value = mapping.targetArea || "";
    areaInput.oninput = () => {
      const updatedMapping = {
        ...mapping,
        targetArea: areaInput.value.trim() || undefined,
      };
      this.onUpdate(index, updatedMapping);
    };

    const projectField = target.createDiv("mapping-target-field");
    projectField.createSpan("mapping-target-label").textContent = "Project";
    const projectInput = projectField.createEl("input", {
      cls: "mapping-target-input",
    });
    projectInput.type = "text";
    projectInput.placeholder = "Project name";
    projectInput.value = mapping.targetProject || "";
    projectInput.oninput = () => {
      const updatedMapping = {
        ...mapping,
        targetProject: projectInput.value.trim() || undefined,
      };
      this.onUpdate(index, updatedMapping);
    };

    // Actions
    const actions = item.createDiv("mapping-actions");
    const deleteBtn = actions.createEl("button", {
      text: "×",
      cls: "mapping-delete-btn",
    });
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      this.onDelete(index);
    };

    // Add drag event listeners
    this.addDragListeners(item);
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

      // Remove drag-over class from all items
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
      // Only remove drag-over if we're actually leaving the element
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

    // Update the mappings array
    const newMappings = [...this.mappings];
    const [movedMapping] = newMappings.splice(fromIndex, 1);
    newMappings.splice(toIndex, 0, movedMapping);

    // Update priorities based on new order (higher index = higher priority)
    newMappings.forEach((mapping, index) => {
      mapping.priority = newMappings.length - index;
    });

    this.mappings = newMappings;
    this.onReorder(newMappings);
    this.render(); // Re-render with new order
  }

  public updateMappings(newMappings: GitHubOrgRepoMapping[]): void {
    this.mappings = [...newMappings];
    this.render();
  }

  public destroy(): void {
    this.listElement.remove();
  }
}
