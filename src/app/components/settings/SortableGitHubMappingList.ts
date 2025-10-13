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
      .github-mapping-section-description {
        margin-bottom: 16px;
        padding: 12px;
        background: var(--background-secondary);
        border-radius: 6px;
      }

      .github-mapping-section-description p {
        margin: 0 0 8px 0;
        color: var(--text-normal);
      }

      .github-mapping-section-description p:last-child {
        margin-bottom: 0;
      }

      .sortable-github-mapping-list {
        margin-bottom: 16px;
      }

      .github-mapping-item {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 12px;
        margin-bottom: 8px;
        background: var(--background-primary);
        border: 1px solid var(--background-modifier-border);
        border-radius: 6px;
        cursor: grab;
        max-width: 100%;
      }

      .github-mapping-item:hover {
        background: var(--background-modifier-hover);
      }

      .github-mapping-item.dragging {
        opacity: 0.5;
        cursor: grabbing;
      }

      .mapping-header {
        display: flex;
        align-items: center;
        gap: 8px;
        justify-content: space-between;
      }

      .mapping-drag-handle {
        color: var(--text-muted);
        cursor: grab;
        font-size: 16px;
        line-height: 1;
      }

      .mapping-content {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .mapping-source, .mapping-target {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .mapping-source-row, .mapping-target-row {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .mapping-source-field, .mapping-target-field {
        display: flex;
        flex-direction: column;
        gap: 4px;
        flex: 1;
        min-width: 200px;
      }

      .mapping-source h4, .mapping-target h4 {
        margin: 0 0 8px 0;
        font-size: 14px;
        font-weight: 600;
        color: var(--text-normal);
      }

      .mapping-source-label, .mapping-target-label {
        font-size: 12px;
        color: var(--text-muted);
        font-weight: 500;
      }

      .mapping-source-input, .mapping-target-input {
        padding: 6px 8px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        background: var(--background-primary);
        color: var(--text-normal);
        font-size: 13px;
      }

      .mapping-source-input:focus, .mapping-target-input:focus {
        outline: none;
        border-color: var(--interactive-accent);
      }

      .mapping-arrow {
        color: var(--text-muted);
        font-size: 16px;
        align-self: flex-start;
        margin: 8px 0;
        text-align: center;
      }

      .mapping-actions {
        display: flex;
        gap: 4px;
      }

      .mapping-delete-btn {
        background: var(--interactive-accent);
        color: var(--text-on-accent);
        border: none;
        border-radius: 4px;
        padding: 4px 8px;
        cursor: pointer;
        font-size: 14px;
        font-weight: bold;
      }

      .mapping-delete-btn:hover {
        background: var(--interactive-accent-hover);
      }

      .github-mapping-empty {
        text-align: center;
        padding: 24px;
        color: var(--text-muted);
        font-style: italic;
      }

      .github-mapping-add-section {
        margin-top: 16px;
      }

      .github-mapping-add-btn {
        background: var(--interactive-accent);
        color: var(--text-on-accent);
        border: none;
        border-radius: 6px;
        padding: 8px 16px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
      }

      .github-mapping-add-btn:hover {
        background: var(--interactive-accent-hover);
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
    addButton.setAttribute("data-testid", "github-add-mapping-btn");
    addButton.onclick = () => this.onAdd();
  }

  private renderMappingItem(
    mapping: GitHubOrgRepoMapping,
    index: number
  ): void {
    const item = this.listElement.createDiv("github-mapping-item");
    item.draggable = true;
    item.dataset.index = index.toString();
    item.setAttribute("data-testid", `github-mapping-item-${index}`);

    // Header with drag handle and actions
    const header = item.createDiv("mapping-header");

    const handle = header.createSpan("mapping-drag-handle");
    handle.innerHTML = "⋮⋮"; // Vertical dots

    const actions = header.createDiv("mapping-actions");
    const deleteBtn = actions.createEl("button", {
      text: "×",
      cls: "mapping-delete-btn",
    });
    deleteBtn.setAttribute("data-testid", `github-mapping-delete-btn-${index}`);
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      this.onDelete(index);
    };

    // Content section
    const content = item.createDiv("mapping-content");

    // Source section (org/repo)
    const source = content.createDiv("mapping-source");
    source.createEl("h4", { text: "From GitHub" });

    const sourceRow = source.createDiv("mapping-source-row");

    const orgField = sourceRow.createDiv("mapping-source-field");
    orgField.createSpan("mapping-source-label").textContent = "Organization";
    const orgInput = orgField.createEl("input", {
      cls: "mapping-source-input",
    });
    orgInput.type = "text";
    orgInput.placeholder = "Organization name";
    orgInput.value = mapping.organization || "";
    orgInput.setAttribute("data-testid", `github-mapping-org-input-${index}`);
    orgInput.oninput = () => {
      const updatedMapping = {
        ...this.mappings[index],
        organization: orgInput.value.trim() || undefined,
      };
      // Update the internal mappings array to keep it in sync
      this.mappings[index] = updatedMapping;
      this.onUpdate(index, updatedMapping);
    };

    const repoField = sourceRow.createDiv("mapping-source-field");
    repoField.createSpan("mapping-source-label").textContent = "Repository";
    const repoInput = repoField.createEl("input", {
      cls: "mapping-source-input",
    });
    repoInput.type = "text";
    repoInput.placeholder = "owner/repository";
    repoInput.value = mapping.repository || "";
    repoInput.setAttribute("data-testid", `github-mapping-repo-input-${index}`);
    repoInput.oninput = () => {
      const updatedMapping = {
        ...this.mappings[index],
        repository: repoInput.value.trim() || undefined,
      };
      // Update the internal mappings array to keep it in sync
      this.mappings[index] = updatedMapping;
      this.onUpdate(index, updatedMapping);
    };

    // Arrow
    const arrow = content.createDiv("mapping-arrow");
    arrow.innerHTML = "↓";

    // Target section (area/project)
    const target = content.createDiv("mapping-target");
    target.createEl("h4", { text: "To Obsidian" });

    const targetRow = target.createDiv("mapping-target-row");

    const areaField = targetRow.createDiv("mapping-target-field");
    areaField.createSpan("mapping-target-label").textContent = "Area";
    const areaInput = areaField.createEl("input", {
      cls: "mapping-target-input",
    });
    areaInput.type = "text";
    areaInput.placeholder = "Area name";
    areaInput.value = mapping.targetArea || "";
    areaInput.setAttribute("data-testid", `github-mapping-area-input-${index}`);
    areaInput.oninput = () => {
      const updatedMapping = {
        ...this.mappings[index],
        targetArea: areaInput.value.trim() || undefined,
      };
      // Update the internal mappings array to keep it in sync
      this.mappings[index] = updatedMapping;
      this.onUpdate(index, updatedMapping);
    };

    const projectField = targetRow.createDiv("mapping-target-field");
    projectField.createSpan("mapping-target-label").textContent = "Project";
    const projectInput = projectField.createEl("input", {
      cls: "mapping-target-input",
    });
    projectInput.type = "text";
    projectInput.placeholder = "Project name";
    projectInput.value = mapping.targetProject || "";
    projectInput.setAttribute("data-testid", `github-mapping-project-input-${index}`);
    projectInput.oninput = () => {
      const updatedMapping = {
        ...this.mappings[index],
        targetProject: projectInput.value.trim() || undefined,
      };
      // Update the internal mappings array to keep it in sync
      this.mappings[index] = updatedMapping;
      this.onUpdate(index, updatedMapping);
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
