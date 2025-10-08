/**
 * Note Create Modal
 * Obsidian modal wrapper for the NoteCreateModal Svelte component
 */

import { App, Modal, Notice } from "obsidian";
import { mount, unmount } from "svelte";
import NoteCreateModalSvelte from "../components/type-note/NoteCreateModal.svelte";
import type TaskSyncPlugin from "../../main";
import type { NoteType } from "../core/type-note/types";

export class NoteCreateModal extends Modal {
  private component: any = null;
  private plugin: TaskSyncPlugin;
  private preselectedNoteTypeId?: string;

  constructor(
    app: App,
    plugin: TaskSyncPlugin,
    preselectedNoteTypeId?: string
  ) {
    super(app);
    this.plugin = plugin;
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

      this.component = mount(NoteCreateModalSvelte, {
        target: contentEl,
        props: {
          typeRegistry: this.plugin.typeNote.registry,
          noteProcessor: this.plugin.typeNote.noteProcessor,
          preselectedNoteTypeId: this.preselectedNoteTypeId,
          onsubmit: async (data: {
            noteType: NoteType;
            properties: Record<string, any>;
            title: string;
            templateContent?: string;
          }) => {
            await this.handleSubmit(data);
          },
          oncancel: () => {
            this.close();
          },
        },
      });
    } catch (error) {
      console.error("Failed to open NoteCreateModal:", error);
      contentEl.createEl("div", {
        text: "Failed to load note creation form: " + error.message,
      });
    }
  }

  private async handleSubmit(data: {
    noteType: NoteType;
    properties: Record<string, any>;
    title: string;
    templateContent?: string;
  }) {
    try {
      // Merge title into properties
      const allProperties = {
        ...data.properties,
        title: data.title,
      };

      // Determine folder based on note type
      // TODO: Make this configurable in note type settings
      const folder = data.noteType.id === "task" ? "Tasks" : "";

      // Create the note using TypeNote FileManager API
      const result = await this.plugin.typeNote.fileManager.createTypedNote(
        data.noteType.id,
        {
          folder,
          fileName: data.title,
          properties: allProperties,
          validateProperties: true,
          content: data.templateContent,
        }
      );

      if (result.success) {
        new Notice(`${data.noteType.name} created successfully`);
        this.close();

        // Open the created file
        if (result.file) {
          const leaf = this.app.workspace.getLeaf(false);
          await leaf.openFile(result.file);
        }
      } else {
        const errorMessage = result.errors?.join(", ") || "Unknown error";
        new Notice(
          `Failed to create ${data.noteType.name}: ${errorMessage}`,
          5000
        );
      }
    } catch (error) {
      console.error("Failed to create note:", error);
      new Notice(`Failed to create note: ${error.message}`, 5000);
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
