/**
 * Note Type Modal
 * Obsidian modal wrapper for the NoteTypeModal Svelte component
 */

import { App, Modal } from "obsidian";
import { mount, unmount } from "svelte";
import NoteTypeModalSvelte from "../components/type-note/NoteTypeModal.svelte";
import type { NoteType } from "../core/type-note/types";
import type { TypeRegistry } from "../core/type-note/registry";

export class NoteTypeModal extends Modal {
  private component: any = null;
  private typeRegistry: TypeRegistry;
  private onNoteTypeSelected?: (noteType: NoteType) => void;

  constructor(
    app: App, 
    typeRegistry: TypeRegistry,
    onNoteTypeSelected?: (noteType: NoteType) => void
  ) {
    super(app);
    this.typeRegistry = typeRegistry;
    this.onNoteTypeSelected = onNoteTypeSelected;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    try {
      this.component = mount(NoteTypeModalSvelte, {
        target: contentEl,
        props: {
          typeRegistry: this.typeRegistry,
          onsubmit: (noteType: NoteType) => {
            console.log("Note type selected:", noteType);
            this.onNoteTypeSelected?.(noteType);
            this.close();
          },
          oncancel: () => {
            this.close();
          },
        },
      });
    } catch (error) {
      console.error("Failed to mount NoteTypeModal component:", error);
      contentEl.createEl("div", {
        text: "Failed to load note type selection: " + error.message,
      });
    }
  }

  onClose() {
    // Unmount Svelte component
    if (this.component) {
      unmount(this.component);
      this.component = null;
    }
  }
}
