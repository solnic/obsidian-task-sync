/**
 * Task Create Modal
 * Obsidian modal wrapper for the TaskCreateModal Svelte component
 */

import { App, Modal } from "obsidian";
import { mount, unmount } from "svelte";
import TaskCreateModalSvelte from "../components/TaskCreateModal.svelte";
import type TaskSyncPlugin from "../../main";

export class TaskCreateModal extends Modal {
  private component: any = null;
  private plugin: TaskSyncPlugin;

  constructor(app: App, plugin: TaskSyncPlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    try {
      this.component = mount(TaskCreateModalSvelte, {
        target: contentEl,
        props: {
          obsidianApp: this.app,
          onsubmit: (taskData: any) => {
            console.log("Task created:", taskData);
            this.close();
          },
          oncancel: () => {
            this.close();
          },
        },
      });
    } catch (error) {
      console.error("Failed to mount TaskCreateModal component:", error);
      contentEl.createEl("div", {
        text: "Failed to load task creation form: " + error.message,
      });
    }
  }

  onClose() {
    if (this.component) {
      try {
        unmount(this.component);
        this.component = null;
      } catch (error) {
        console.error("Failed to unmount TaskCreateModal component:", error);
      }
    }

    const { contentEl } = this;
    contentEl.empty();
  }
}