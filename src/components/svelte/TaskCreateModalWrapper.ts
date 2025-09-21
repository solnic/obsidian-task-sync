import { SvelteModal } from "./SvelteModal";
import TaskCreateModalComponent from "./TaskCreateModal.svelte";
import type { TaskCreateData } from "../modals/TaskCreateModal";
import type { FileContext } from "../../main";
import type { TaskSyncPluginInterface } from "../../interfaces/TaskSyncPluginInterface";

export class TaskCreateModalWrapper extends SvelteModal {
  private context: FileContext;
  private initialData: Partial<TaskCreateData>;
  private onSubmit: (data: TaskCreateData) => void;

  constructor(
    plugin: TaskSyncPluginInterface,
    context: FileContext,
    initialData: Partial<TaskCreateData> = {},
    onSubmit: (data: TaskCreateData) => void
  ) {
    super(plugin as any); // Cast needed for SvelteModal which expects Plugin
    this.context = context;
    this.initialData = initialData;
    this.onSubmit = onSubmit;
  }

  onOpen() {
    // Set the modal title based on context
    const title = this.getContextualTitle();
    this.titleEl.setText(title);

    // Set modal width and styling
    this.modalEl.addClass("task-sync-create-task");
    this.modalEl.addClass("task-sync-modal");

    // Set modal width directly
    this.modalEl.style.width = "800px";
    this.modalEl.style.maxWidth = "90vw";
    this.modalEl.style.minWidth = "600px";

    // Call parent onOpen to create the component
    super.onOpen();
  }

  private getContextualTitle(): string {
    switch (this.context.type) {
      case "project":
        return `Create Task for Project: ${this.context.name}`;
      case "area":
        return `Create Task for Area: ${this.context.name}`;
      default:
        return "Create New Task";
    }
  }

  protected createComponent(container: HTMLElement) {
    const component = this.createSvelteComponent(
      TaskCreateModalComponent,
      container,
      {
        context: this.context,
        initialData: this.initialData,
        onsubmit: (data: TaskCreateData) => {
          this.onSubmit(data);
          this.close();
        },
        oncancel: () => {
          this.close();
        },
      }
    );

    return component;
  }
}
