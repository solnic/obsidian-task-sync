/**
 * Sortable Property List Component
 * Provides drag-and-drop functionality for reordering task properties
 * Adapted from old-stuff for the new architecture
 */

// Simple property registry for the new architecture
const PROPERTY_REGISTRY = {
  title: { name: "Title" },
  status: { name: "Status" },
  priority: { name: "Priority" },
  type: { name: "Type" },
  area: { name: "Area" },
  project: { name: "Project" },
  due: { name: "Due Date" },
  created: { name: "Created" },
  updated: { name: "Updated" },
  tags: { name: "Tags" },
  description: { name: "Description" },
};

export interface SortablePropertyListOptions {
  container: HTMLElement;
  properties: string[];
  onReorder: (newOrder: string[]) => void;
  onReset?: () => void;
}

export class SortablePropertyList {
  private container: HTMLElement;
  private properties: string[];
  private onReorder: (newOrder: string[]) => void;
  private onReset?: () => void;
  private listElement: HTMLElement;
  private draggedElement: HTMLElement | null = null;
  private draggedIndex: number = -1;

  constructor(options: SortablePropertyListOptions) {
    this.container = options.container;
    this.properties = [...options.properties];
    this.onReorder = options.onReorder;
    this.onReset = options.onReset;
    this.listElement = this.container.createDiv("sortable-property-list");

    this.render();
  }

  private render(): void {
    this.listElement.empty();

    this.properties.forEach((propertyKey, index) => {
      const prop =
        PROPERTY_REGISTRY[propertyKey as keyof typeof PROPERTY_REGISTRY];
      if (!prop) return;

      const item = this.listElement.createDiv("sortable-property-item");
      item.draggable = true;
      item.dataset.index = index.toString();
      item.dataset.propertyKey = propertyKey;

      // Drag handle
      const handle = item.createSpan("property-drag-handle");
      handle.innerHTML = "⋮⋮"; // Vertical dots

      // Property info
      const info = item.createDiv("property-info");
      const name = info.createDiv("property-name");
      name.textContent = prop.name;

      const description = info.createDiv("property-description");
      description.textContent = this.getPropertyDescription(propertyKey);

      // Add drag event listeners
      this.addDragListeners(item);
    });

    // Add reset button if callback provided
    if (this.onReset) {
      const actions = this.container.createDiv("sortable-property-actions");
      const resetButton = actions.createEl("button", {
        text: "Reset to Default Order",
        cls: "mod-muted",
      });
      resetButton.onclick = () => this.onReset?.();
    }
  }

  private getPropertyDescription(propertyKey: string): string {
    const descriptions: Record<string, string> = {
      title: "The title/name of the task",
      type: "Task type (Task, Bug, Feature, etc.)",
      priority: "Task priority level",
      area: "Area this task belongs to",
      project: "Project this task belongs to",
      status: "Current status of the task",
      due: "Due date for the task",
      created: "When the task was created",
      updated: "When the task was last updated",
      tags: "Tags associated with the task",
      description: "Task description or notes",
    };
    return descriptions[propertyKey] || "Task property";
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
        .querySelectorAll(".sortable-property-item")
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
        this.moveProperty(this.draggedIndex, targetIndex);
      }
    });
  }

  private moveProperty(fromIndex: number, toIndex: number): void {
    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
      return;
    }

    // Update the properties array
    const newProperties = [...this.properties];
    const [movedProperty] = newProperties.splice(fromIndex, 1);
    newProperties.splice(toIndex, 0, movedProperty);

    this.properties = newProperties;
    this.onReorder(newProperties);
    this.render(); // Re-render with new order
  }

  public updateProperties(newProperties: string[]): void {
    this.properties = [...newProperties];
    this.render();
  }

  public destroy(): void {
    this.listElement.remove();
  }
}
