/**
 * Add Task Command
 * Opens the task creation modal
 */

import { Command, type CommandContext } from "../Command";
import { CommandModal } from "../CommandModal";
import TaskCreateModalComponent from "../../components/svelte/TaskCreateModal.svelte";
import type { TaskCreateData } from "../../components/modals/TaskCreateModal";
import type { FileContext } from "../../main";

class Modal extends CommandModal {
  private context: FileContext;
  private initialData: Partial<TaskCreateData>;

  constructor(
    command: AddTaskCommand,
    context: FileContext,
    initialData: Partial<TaskCreateData> = {}
  ) {
    super(command);
    this.context = context;
    this.initialData = initialData;
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
          (this.command as AddTaskCommand).handleSubmit(data);
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

export class AddTaskCommand extends Command {
  constructor(context: CommandContext) {
    super(context);
  }

  getId(): string {
    return "add-task";
  }

  getName(): string {
    return "Add Task";
  }

  async execute(): Promise<void> {
    const context =
      this.taskSyncPlugin.contextService.detectCurrentFileContext();

    const modal = new Modal(this, context);
    modal.open();
  }

  async handleSubmit(taskData: TaskCreateData): Promise<void> {
    await this.taskSyncPlugin.createTask(taskData);

    if (this.settings.autoUpdateBaseViews) {
      await this.taskSyncPlugin.refreshBaseViews();
    }
  }
}
