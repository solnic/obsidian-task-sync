import { SvelteModal } from "./SvelteModal";
import TaskCreateModalComponent from "./TaskCreateModal.svelte";
import type { TaskCreateData } from "../modals/TaskCreateModal";
import type { FileContext } from "../../main";
import type TaskSyncPlugin from "../../main";

export class TaskCreateModalWrapper extends SvelteModal {
  private context: FileContext;
  private initialData: Partial<TaskCreateData>;
  private onSubmit: (data: TaskCreateData) => void;

  constructor(
    plugin: TaskSyncPlugin,
    context: FileContext,
    initialData: Partial<TaskCreateData> = {},
    onSubmit: (data: TaskCreateData) => void
  ) {
    super(plugin);
    this.context = context;
    this.initialData = initialData;
    this.onSubmit = onSubmit;
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
