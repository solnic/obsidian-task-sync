/**
 * Project Create Modal
 * Obsidian modal wrapper for the ProjectCreateModal Svelte component
 */

import { App, Modal } from "obsidian";
import { mount, unmount } from "svelte";
import ProjectCreateModalSvelte from "../components/ProjectCreateModal.svelte";
import type TaskSyncPlugin from "../../main";

export class ProjectCreateModal extends Modal {
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
      this.component = mount(ProjectCreateModalSvelte, {
        target: contentEl,
        props: {
          onsubmit: (projectData: any) => {
            console.log("Project created:", projectData);
            this.close();
          },
          oncancel: () => {
            this.close();
          },
        },
      });
    } catch (error) {
      console.error("Failed to mount ProjectCreateModal component:", error);
      contentEl.createEl("div", {
        text: "Failed to load project creation form: " + error.message,
      });
    }
  }

  onClose() {
    if (this.component) {
      try {
        unmount(this.component);
        this.component = null;
      } catch (error) {
        console.error("Failed to unmount ProjectCreateModal component:", error);
      }
    }

    const { contentEl } = this;
    contentEl.empty();
  }
}
