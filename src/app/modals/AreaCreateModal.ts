/**
 * Area Create Modal
 * Obsidian modal wrapper for the AreaCreateModal Svelte component
 */

import { App, Modal } from "obsidian";
import { mount, unmount } from "svelte";
import AreaCreateModalSvelte from "../components/AreaCreateModal.svelte";
import type TaskSyncPlugin from "../../main";
import { Obsidian } from "../extensions/obsidian/entities/Obsidian";

export class AreaCreateModal extends Modal {
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
      // Use Obsidian.AreaOperations which sets source.filePath correctly
      const areaOperations = new Obsidian.AreaOperations(this.plugin.settings);

      this.component = mount(AreaCreateModalSvelte, {
        target: contentEl,
        props: {
          areaOperations: areaOperations,
          onsubmit: (areaData: any) => {
            console.log("Area created:", areaData);
            this.close();
          },
          oncancel: () => {
            this.close();
          },
        },
      });
    } catch (error) {
      console.error("Failed to mount AreaCreateModal component:", error);
      contentEl.createEl("div", {
        text: "Failed to load area creation form: " + error.message,
      });
    }
  }

  onClose() {
    if (this.component) {
      try {
        unmount(this.component);
        this.component = null;
      } catch (error) {
        console.error("Failed to unmount AreaCreateModal component:", error);
      }
    }

    const { contentEl } = this;
    contentEl.empty();
  }
}
