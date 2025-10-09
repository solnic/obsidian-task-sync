/**
 * Create Entity Modal
 * Obsidian modal wrapper for the CreateEntityModal Svelte component
 * Used for creating entities (tasks, areas, projects) through the entity system
 */

import { App, Modal, Notice } from "obsidian";
import { mount, unmount } from "svelte";
import CreateEntityModalSvelte from "../components/type-note/CreateEntityModal.svelte";
import type TaskSyncPlugin from "../../main";
import type { NoteType } from "../core/type-note/types";
import type { TaskSyncSettings } from "../types/settings";
import type { EntitiesOperations } from "../core/entities-base";

export class CreateEntityModal extends Modal {
  private component: any = null;
  private plugin: TaskSyncPlugin;
  private operations: Record<string, EntitiesOperations>;
  private settings: TaskSyncSettings;
  private preselectedNoteTypeId?: string;

  constructor(
    app: App,
    plugin: TaskSyncPlugin,
    preselectedNoteTypeId?: string
  ) {
    super(app);
    this.plugin = plugin;
    this.operations = plugin.operations;
    this.settings = plugin.settings;
    this.preselectedNoteTypeId = preselectedNoteTypeId;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    try {
      // Check if there are any note types registered
      const noteTypes = this.plugin.typeNote.registry.getAll();

      if (noteTypes.length === 0) {
        contentEl.createEl("div", {
          text: "No note types available. Please create a note type in settings first.",
          cls: "task-sync-error-message",
        });
        return;
      }

      this.component = mount(CreateEntityModalSvelte, {
        target: contentEl,
        props: {
          typeRegistry: this.plugin.typeNote.registry,
          noteProcessor: this.plugin.typeNote.noteProcessor,
          preselectedNoteTypeId: this.preselectedNoteTypeId,
          onsubmit: async (data: {
            noteType: NoteType;
            properties: Record<string, any>;
            description?: string;
          }) => {
            await this.handleSubmit(
              data.noteType,
              data.properties,
              data.description
            );
          },
          oncancel: () => {
            this.close();
          },
        },
      });
    } catch (error) {
      console.error("Failed to open CreateEntityModal:", error);
      contentEl.createEl("div", {
        text: "Failed to load entity creation form: " + error.message,
      });
    }
  }

  private async handleSubmit(
    noteType: NoteType,
    properties: Record<string, any>,
    description?: string
  ) {
    try {
      await this.operations[noteType.id].create({
        description: description,
        ...properties,
      });
      new Notice(`${noteType.name} created successfully`);
      this.close();
    } catch (error) {
      console.error("Failed to create entity:", error);
      new Notice(`Failed to create entity: ${error.message}`, 5000);
    }
  }

  onClose() {
    const { contentEl } = this;
    if (this.component) {
      unmount(this.component);
      this.component = null;
    }
    contentEl.empty();
  }
}
