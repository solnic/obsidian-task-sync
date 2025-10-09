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

export class CreateEntityModal extends Modal {
  private component: any = null;
  private plugin: TaskSyncPlugin;
  private settings: TaskSyncSettings;
  private preselectedNoteTypeId?: string;

  constructor(
    app: App,
    plugin: TaskSyncPlugin,
    preselectedNoteTypeId?: string
  ) {
    super(app);
    this.plugin = plugin;
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
            title: string;
            description?: string;
          }) => {
            await this.handleSubmit(data);
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

  /**
   * Get the folder path for a note type based on settings
   */
  private getFolderForNoteType(noteTypeId: string): string {
    switch (noteTypeId) {
      case "task":
        return this.settings.tasksFolder;
      case "project":
        return this.settings.projectsFolder;
      case "area":
        return this.settings.areasFolder;
      default:
        // For custom note types, use empty string (root folder)
        return "";
    }
  }

  private async handleSubmit(data: {
    noteType: NoteType;
    properties: Record<string, any>;
    title: string;
    description?: string;
  }) {
    try {
      // For Task/Area/Project entities, use entity operations
      // This triggers events that ObsidianExtension handles to create notes
      if (data.noteType.id === "task") {
        await this.createTaskEntity(data);
      } else if (data.noteType.id === "area") {
        await this.createAreaEntity(data);
      } else if (data.noteType.id === "project") {
        await this.createProjectEntity(data);
      } else {
        // For other note types, use TypeNote FileManager directly
        await this.createGenericNote(data);
      }
    } catch (error) {
      console.error("Failed to create note:", error);
      new Notice(`Failed to create note: ${error.message}`, 5000);
    }
  }

  private async createTaskEntity(data: {
    noteType: NoteType;
    properties: Record<string, any>;
    title: string;
    description?: string;
  }) {
    const taskData: any = {
      title: data.title,
      description: data.description,
      category: data.properties.Category,
      priority: data.properties.Priority,
      status: data.properties.Status,
      done: data.properties.Done,
      project: data.properties.Project,
      areas: data.properties.Areas,
      parentTask: data.properties["Parent task"],
      doDate: data.properties["Do Date"],
      dueDate: data.properties["Due Date"],
      tags: data.properties.tags,
    };

    const createdTask = await this.plugin.operations.taskOperations.create(
      taskData
    );
    new Notice(`Task "${createdTask.title}" created successfully`);
    this.close();

    // Open the created file
    const filePath = `${this.settings.tasksFolder}/${createdTask.title}.md`;
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (file) {
      const leaf = this.app.workspace.getLeaf(false);
      await leaf.openFile(file as any);
    }
  }

  private async createAreaEntity(data: {
    noteType: NoteType;
    properties: Record<string, any>;
    title: string;
    description?: string;
  }) {
    const areaData: any = {
      name: data.title,
      description: data.description,
      tags: data.properties.tags,
    };

    const createdArea = await this.plugin.operations.areaOperations.create(
      areaData
    );
    new Notice(`Area "${createdArea.name}" created successfully`);
    this.close();

    // Open the created file
    const filePath = `${this.settings.areasFolder}/${createdArea.name}.md`;
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (file) {
      const leaf = this.app.workspace.getLeaf(false);
      await leaf.openFile(file as any);
    }
  }

  private async createProjectEntity(data: {
    noteType: NoteType;
    properties: Record<string, any>;
    title: string;
    description?: string;
  }) {
    const projectData: any = {
      name: data.title,
      description: data.description,
      areas: data.properties.Areas,
      tags: data.properties.tags,
    };

    const createdProject =
      await this.plugin.operations.projectOperations.create(projectData);
    new Notice(`Project "${createdProject.name}" created successfully`);
    this.close();

    // Open the created file
    const filePath = `${this.settings.projectsFolder}/${createdProject.name}.md`;
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (file) {
      const leaf = this.app.workspace.getLeaf(false);
      await leaf.openFile(file as any);
    }
  }

  private async createGenericNote(data: {
    noteType: NoteType;
    properties: Record<string, any>;
    title: string;
    description?: string;
  }) {
    // Determine folder based on note type ID and settings
    const folder = this.getFolderForNoteType(data.noteType.id);

    // Create the note using TypeNote FileManager API
    const result = await this.plugin.typeNote.fileManager.createTypedNote(
      data.noteType.id,
      {
        folder,
        fileName: data.title,
        properties: data.properties,
        content: data.description, // Use description as content for generic notes
        validateProperties: true,
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
