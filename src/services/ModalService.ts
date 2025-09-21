/**
 * ModalService - Centralized modal creation and management
 * Handles all modal creation logic to keep commands focused on coordination
 */

import { App } from "obsidian";
import type { FileContext } from "../main";
import type { TaskSyncSettings } from "../components/ui/settings/types";
import type { TaskSyncPluginInterface } from "../interfaces/TaskSyncPluginInterface";
import { TaskCreateModalWrapper } from "../components/svelte/TaskCreateModalWrapper";
import { AreaCreateModal, type AreaCreateData } from "../components/modals/AreaCreateModal";
import { ProjectCreateModal, type ProjectCreateData } from "../components/modals/ProjectCreateModal";
import { TaskScheduleModal } from "../components/modals/TaskScheduleModal";
import type { Task } from "../types/entities";

export class ModalService {
  private app: App;
  private taskSyncPlugin: TaskSyncPluginInterface;
  private settings: TaskSyncSettings;

  constructor(app: App, taskSyncPlugin: TaskSyncPluginInterface, settings: TaskSyncSettings) {
    this.app = app;
    this.taskSyncPlugin = taskSyncPlugin;
    this.settings = settings;
  }

  /**
   * Update settings reference
   */
  updateSettings(settings: TaskSyncSettings): void {
    this.settings = settings;
  }

  /**
   * Open task creation modal
   */
  async openTaskCreateModal(context?: FileContext): Promise<void> {
    const fileContext = context || this.taskSyncPlugin.contextService.detectCurrentFileContext();

    const modal = new TaskCreateModalWrapper(
      this.taskSyncPlugin as any, // Cast for compatibility
      fileContext,
      {},
      async (taskData) => {
        await this.taskSyncPlugin.createTask(taskData);

        if (this.settings.autoUpdateBaseViews) {
          await this.taskSyncPlugin.refreshBaseViews();
        }
      }
    );

    modal.open();
  }

  /**
   * Open area creation modal
   */
  openAreaCreateModal(): void {
    const modal = new AreaCreateModal(this.app, this.taskSyncPlugin as any);

    modal.onSubmit(async (areaData: AreaCreateData) => {
      await this.taskSyncPlugin.createArea(areaData);

      if (this.settings.autoUpdateBaseViews) {
        await this.taskSyncPlugin.refreshBaseViews();
      }
    });

    modal.open();
  }

  /**
   * Open project creation modal
   */
  openProjectCreateModal(): void {
    const modal = new ProjectCreateModal(this.app, this.taskSyncPlugin as any);

    modal.onSubmit(async (projectData: ProjectCreateData) => {
      await this.taskSyncPlugin.createProject(projectData);

      if (this.settings.autoUpdateBaseViews) {
        await this.taskSyncPlugin.refreshBaseViews();
      }
    });

    modal.open();
  }

  /**
   * Open task scheduling modal
   */
  openTaskScheduleModal(task: Task, onSubmit: (scheduleData: any) => Promise<void>): void {
    const modal = new TaskScheduleModal(this.app, this.taskSyncPlugin as any, task);

    modal.onSubmit(onSubmit);
    modal.open();
  }
}
