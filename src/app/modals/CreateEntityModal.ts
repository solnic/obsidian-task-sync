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
    description?: string;
  }) {
    try {
      // PropertyFormBuilder uses property keys which match entity schema property names
      const taskData: any = {
        title: data.properties.title,
        description: data.description, // Description from template content
        category: data.properties.category,
        priority: data.properties.priority,
        status: data.properties.status,
        done: data.properties.done,
        project: data.properties.project,
        areas: data.properties.areas,
        parentTask: data.properties.parentTask,
        doDate: data.properties.doDate,
        dueDate: data.properties.dueDate,
        tags: data.properties.tags,
      };

      const createdTask = await this.plugin.operations.taskOperations.create(
        taskData
      );
      new Notice(`Task "${createdTask.title}" created successfully`);
      this.close();
    } catch (error) {
      // Entity schema validation failed
      console.error("Failed to create task:", error);
      new Notice(`Failed to create task: ${error.message}`, 5000);
    }
  }

  private async createAreaEntity(data: {
    noteType: NoteType;
    properties: Record<string, any>;
    description?: string;
  }) {
    try {
      const areaData: any = {
        name: data.properties.name,
        description: data.description,
        tags: data.properties.tags,
      };

      const createdArea = await this.plugin.operations.areaOperations.create(
        areaData
      );
      new Notice(`Area "${createdArea.name}" created successfully`);
      this.close();
    } catch (error) {
      console.error("Failed to create area:", error);
      new Notice(`Failed to create area: ${error.message}`, 5000);
    }
  }

  private async createProjectEntity(data: {
    noteType: NoteType;
    properties: Record<string, any>;
    description?: string;
  }) {
    try {
      const projectData: any = {
        name: data.properties.name,
        description: data.description,
        areas: data.properties.areas,
        tags: data.properties.tags,
      };

      const createdProject =
        await this.plugin.operations.projectOperations.create(projectData);
      new Notice(`Project "${createdProject.name}" created successfully`);
      this.close();
    } catch (error) {
      console.error("Failed to create project:", error);
      new Notice(`Failed to create project: ${error.message}`, 5000);
    }
  }

  private async createGenericNote(data: {
    noteType: NoteType;
    properties: Record<string, any>;
    description?: string;
  }) {
    try {
      // Determine folder based on note type ID and settings
      const folder = this.getFolderForNoteType(data.noteType.id);

      // Extract title from properties (required for file name)
      const title = data.properties.title || data.properties.name || "Untitled";

      // Create the note using TypeNote FileManager API
      // TypeNote validation is fully encapsulated - any validation errors will be in the result
      const result = await this.plugin.typeNote.fileManager.createTypedNote(
        data.noteType.id,
        {
          folder,
          fileName: title,
          properties: data.properties,
          content: data.description, // Use description as content for generic notes
          validateProperties: true,
        }
      );

      if (result.success) {
        new Notice(`${data.noteType.name} created successfully`);
        this.close();
      } else {
        // TypeNote validation failed - show errors to user
        const errorMessage = result.errors?.join(", ") || "Unknown error";
        new Notice(
          `Failed to create ${data.noteType.name}: ${errorMessage}`,
          5000
        );
      }
    } catch (error) {
      // Unexpected error during note creation
      console.error("Failed to create generic note:", error);
      new Notice(
        `Failed to create ${data.noteType.name}: ${error.message}`,
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
